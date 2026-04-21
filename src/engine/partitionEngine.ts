/**
 * ═══════════════════════════════════════════════════════════════════
 * MOTOR DE PARTICIÓN HEREDITARIA — partitionEngine.ts
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Motor puro de cálculo de reparto de herencia. Separado de la UI
 * para facilitar testing, mantenimiento y determinismo.
 * 
 * Pasos del algoritmo:
 *   1. Gananciales (50% → cónyuge como copropietario)
 *   2. Asignaciones manuales (asignarA[])
 *   3. Colación (donaciones virtuales)
 *   4. Consolidación cónyuge (herencia hasta su cuota)
 *   5. Reparto automático greedy (solo herederos, NO cónyuge)
 *   6. Buffer de caja (solo herederos, NO cónyuge)
 *   7. Unificación de activos duplicados
 *   8. Compensaciones finales
 */

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════

export const CONYUGE_ID = 999;

export interface Heredero {
  id: number;
  nombre: string;
}

export interface SubPartida {
  id: string;
  concepto: string;
  cantidad: number;
  unidad: string;
  valor_unitario: number;
}

export interface ActivoInput {
  id: string;
  nombre: string;
  divisible: boolean;
  esGanancial: boolean;
  isFixed?: boolean;
  asignarA: number[];
  sub_partidas: SubPartida[];
  gastosEspeciales: number;
  valorTotal: number; // pre-calculado
}

export interface LoteItem {
  id: string;
  nombre: string;
  valor: number;
  fraccion: number;
  tipo?: 'gananciales' | 'herencia';
  manual?: boolean;
  virtual?: boolean;
}

export interface Lote {
  id: number;
  idHeredero: number;
  nombreHeredero: string;
  activos: LoteItem[];
  valorBienes: number;
}

export interface Compensacion {
  idHeredero: number;
  heredero: number;
  nombreHeredero: string;
  diferencia: number;
}

export interface FiscalConfig {
  gananciales: boolean;
  usufructo: { enabled: boolean; edadViudo: number };
  colacion: { id: string; concepto: string; valor: number; herederoId?: number }[];
  margenTolerancia: number;
  comunidadAutonoma: string;
  porcentajeImpuestoEstimado: number;
}

export interface RepartoResult {
  lotes: Lote[];
  compensaciones: Compensacion[];
}

// ═══════════════════════════════════════════════════════════════════
// PRNG DETERMINISTA (seeded)
// ═══════════════════════════════════════════════════════════════════

/**
 * Genera un hash numérico simple a partir de un string.
 * Usado como semilla para el PRNG determinista.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Mulberry32 — PRNG determinista rápido.
 * Dado el mismo seed, produce la misma secuencia de números.
 */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Baraja un array de forma determinista usando Fisher-Yates con PRNG seeded.
 */
function shuffleDeterministic<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// MOTOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Calcula un escenario de reparto dado un orden específico de activos.
 * 
 * BUGS CORREGIDOS:
 * - Bug 1: Cónyuge excluido de candidatos en paso 5 (reparto automático)
 * - Bug 2: Cónyuge excluido de candidatos en paso 6 (buffer de caja)
 * - Bug 5: Comentarios explicativos en loop de consolidación
 */
function calcularEscenario(
  activosOrdenados: (ActivoInput & { yaConsolidado?: boolean; valorHeredableRestante?: number })[],
  herederos: Heredero[],
  fiscalConfig: FiscalConfig,
  cuotaIdeal: number,
  todosActivos: ActivoInput[]
): Lote[] {
  // Inicializar lotes de herederos
  const lotes: Lote[] = herederos.map(h => ({
    id: h.id,
    idHeredero: h.id,
    nombreHeredero: h.nombre,
    activos: [] as LoteItem[],
    valorBienes: 0
  }));

  // Añadir lote del cónyuge si hay gananciales
  if (fiscalConfig.gananciales) {
    lotes.push({
      id: CONYUGE_ID,
      idHeredero: CONYUGE_ID,
      nombreHeredero: "Cónyuge Viudo/a",
      activos: [] as LoteItem[],
      valorBienes: 0
    });
  }

  // ─── PASO 1: Gananciales (50% al cónyuge como copropietario) ───
  if (fiscalConfig.gananciales) {
    const loteConyuge = lotes.find(l => l.idHeredero === CONYUGE_ID);
    if (loteConyuge) {
      activosOrdenados.forEach(activo => {
        if (activo.esGanancial !== false) {
          const valorGanancial = activo.valorTotal * 0.5;
          loteConyuge.activos.push({
            id: "gan_" + activo.id,
            nombre: activo.nombre,
            valor: valorGanancial,
            fraccion: 0.5,
            tipo: 'gananciales'
          });
          loteConyuge.valorBienes += valorGanancial;
        }
      });
    }
  }

  // ─── PASO 2: Asignaciones Manuales ───
  const asignados = activosOrdenados.filter(a => a.asignarA && a.asignarA.length > 0);
  asignados.forEach(activo => {
    const numParticipantes = activo.asignarA.length;
    const factorMasa = (fiscalConfig.gananciales && activo.esGanancial !== false) ? 0.5 : 1;
    const valorPorHeredero = (activo.valorTotal * factorMasa) / numParticipantes;

    activo.asignarA.forEach((hId: number) => {
      const lote = lotes.find(l => l.idHeredero === hId);
      if (lote) {
        lote.activos.push({
          id: activo.id + "_" + hId,
          nombre: activo.nombre,
          valor: valorPorHeredero,
          fraccion: factorMasa / numParticipantes,
          manual: true,
          tipo: 'herencia'
        });
        lote.valorBienes += valorPorHeredero;
      }
    });
  });

  // ─── PASO 3: Donaciones (Colación) ───
  fiscalConfig.colacion.forEach((donacion) => {
    if (donacion.herederoId) {
      const lote = lotes.find(l => l.idHeredero === donacion.herederoId);
      if (lote) {
        lote.activos.push({
          id: "don_" + donacion.id,
          nombre: donacion.concepto,
          valor: donacion.valor,
          fraccion: 1,
          virtual: true
        });
        lote.valorBienes += donacion.valor;
      }
    }
  });

  // ─── PASO 4: Consolidación Cónyuge (herencia hasta su cuota ideal) ───
  if (fiscalConfig.gananciales) {
    const loteConyuge = lotes.find(l => l.idHeredero === CONYUGE_ID);
    if (loteConyuge) {
      const candidatosCol = activosOrdenados
        .filter(a => a.asignarA.length === 0 && a.esGanancial !== false)
        .sort((a, b) => a.valorTotal - b.valorTotal);

      for (const activo of candidatosCol) {
        // NOTA (Bug 5): totalPropiedad se recalcula en cada iteración del loop.
        // Solo contiene activos de tipo 'gananciales', que NO se modifican en este loop
        // (solo se añaden activos de tipo 'herencia'). Por tanto, el resultado es correcto,
        // pero lo recalculamos por claridad y seguridad ante futuros cambios.
        const totalPropiedad = loteConyuge.activos
          .filter(a => a.tipo === 'gananciales')
          .reduce((s, a) => s + a.valor, 0);
        const deficit = cuotaIdeal - (loteConyuge.valorBienes - totalPropiedad);
        if (deficit <= 0.01) break;

        const valorHeredable = activo.valorTotal * 0.5;
        const aAsignar = Math.min(deficit, valorHeredable);

        loteConyuge.activos.push({
          id: activo.id + "_consol",
          nombre: activo.nombre,
          valor: aAsignar,
          fraccion: aAsignar / activo.valorTotal,
          tipo: 'herencia'
        });
        loteConyuge.valorBienes += aAsignar;
        activo.yaConsolidado = (aAsignar >= valorHeredable - 0.01);
        if (!activo.yaConsolidado) activo.valorHeredableRestante = valorHeredable - aAsignar;
      }
    }
  }

  // ─── PASO 5: REPARTO AUTOMÁTICO (Greedy + Tolerancia) ───
  // ⚠️ BUG 1 FIX: Solo herederos participan, NO el cónyuge
  const margenEuros = cuotaIdeal * (fiscalConfig.margenTolerancia / 100);
  const lotesHerederos = lotes.filter(l => l.idHeredero !== CONYUGE_ID);

  const pendientes = activosOrdenados.filter(a =>
    a.id !== 'cash' && a.asignarA.length === 0 && !a.yaConsolidado
  );

  pendientes.forEach(activo => {
    const factorMasa = (fiscalConfig.gananciales && activo.esGanancial !== false) ? 0.5 : 1;
    let valorHeredable = activo.valorHeredableRestante !== undefined
      ? activo.valorHeredableRestante
      : (activo.valorTotal * factorMasa);

    if (valorHeredable <= 0.01) return;

    // ¿Cabe en algún heredero con el margen de tolerancia?
    const candidatos = lotesHerederos
      .filter(l => l.valorBienes + valorHeredable <= cuotaIdeal + margenEuros + 0.01)
      .sort((a, b) => a.valorBienes - b.valorBienes);

    if (candidatos.length > 0) {
      const lote = candidatos[0];
      lote.activos.push({
        id: activo.id,
        nombre: activo.nombre,
        valor: valorHeredable,
        fraccion: valorHeredable / activo.valorTotal,
        tipo: 'herencia'
      });
      lote.valorBienes += valorHeredable;
    } else {
      if (!activo.divisible) {
        // Indivisible: forzar al heredero que menos tenga (NO cónyuge)
        const lote = [...lotesHerederos].sort((a, b) => a.valorBienes - b.valorBienes)[0];
        lote.activos.push({
          id: activo.id,
          nombre: activo.nombre,
          valor: valorHeredable,
          fraccion: valorHeredable / activo.valorTotal,
          tipo: 'herencia'
        });
        lote.valorBienes += valorHeredable;
      } else {
        // Divisible: repartir entre herederos con déficit (NO cónyuge)
        let restante = valorHeredable;
        while (restante > 0.01) {
          const conDeficit = lotesHerederos.filter(l => l.valorBienes < cuotaIdeal - 0.01);
          if (conDeficit.length === 0) {
            const aCadaUno = restante / lotesHerederos.length;
            lotesHerederos.forEach(l => {
              l.activos.push({
                id: `${activo.id}_sob_${l.id}`,
                nombre: activo.nombre,
                valor: aCadaUno,
                fraccion: aCadaUno / activo.valorTotal,
                tipo: 'herencia'
              });
              l.valorBienes += aCadaUno;
            });
            restante = 0;
          } else {
            const deficitTotal = conDeficit.reduce((acc, l) => acc + (cuotaIdeal - l.valorBienes), 0);
            const aRepartirAhora = Math.min(restante, deficitTotal);
            conDeficit.forEach(l => {
              const miParte = ((cuotaIdeal - l.valorBienes) / deficitTotal) * aRepartirAhora;
              if (miParte > 0.01) {
                l.activos.push({
                  id: `${activo.id}_bal_${l.id}`,
                  nombre: activo.nombre,
                  valor: miParte,
                  fraccion: miParte / activo.valorTotal,
                  tipo: 'herencia'
                });
                l.valorBienes += miParte;
              }
            });
            restante -= aRepartirAhora;
          }
        }
      }
    }
  });

  // ─── PASO 6: BUFFER DE CAJA ───
  // ⚠️ BUG 2 FIX: Solo herederos participan, NO el cónyuge
  const activoCash = todosActivos.find(a => a.id === 'cash');
  if (activoCash && activoCash.asignarA.length === 0) {
    const factorMasa = (fiscalConfig.gananciales && activoCash.esGanancial !== false) ? 0.5 : 1;
    let cashRestante = activoCash.valorTotal * factorMasa;
    const conDeficit = lotesHerederos.filter(l => l.valorBienes < cuotaIdeal - 0.01);

    if (conDeficit.length > 0 && cashRestante > 0) {
      const deficitTotal = conDeficit.reduce((acc, l) => acc + (cuotaIdeal - l.valorBienes), 0);
      const aRepartir = Math.min(cashRestante, deficitTotal);
      conDeficit.forEach(lote => {
        const miParte = ((cuotaIdeal - lote.valorBienes) / deficitTotal) * aRepartir;
        if (miParte > 0.01) {
          lote.activos.push({
            id: `cash_${lote.id}`,
            nombre: activoCash.nombre,
            valor: miParte,
            fraccion: miParte / activoCash.valorTotal,
            tipo: 'herencia'
          });
          lote.valorBienes += miParte;
        }
      });
      cashRestante -= aRepartir;
    }
    // Sobrante de caja: repartir equitativamente solo entre herederos
    if (cashRestante > 0.01) {
      const aCadaUno = cashRestante / lotesHerederos.length;
      lotesHerederos.forEach(l => {
        l.activos.push({
          id: `cash_extra_${l.id}`,
          nombre: activoCash.nombre,
          valor: aCadaUno,
          fraccion: aCadaUno / activoCash.valorTotal,
          tipo: 'herencia'
        });
        l.valorBienes += aCadaUno;
      });
    }
  }

  // ─── PASO 7: Unificación de Activos ───
  lotes.forEach(lote => {
    const unificados: LoteItem[] = [];
    lote.activos.forEach(act => {
      const existente = unificados.find(u => u.nombre === act.nombre && u.tipo === act.tipo);
      if (existente && !act.virtual) {
        existente.valor += act.valor;
        existente.fraccion += act.fraccion;
        if (act.manual) existente.manual = true;
      } else {
        unificados.push({ ...act });
      }
    });
    lote.activos = unificados;
  });

  return lotes;
}

// ═══════════════════════════════════════════════════════════════════
// SCORING — Función de coste mejorada (M1)
// ═══════════════════════════════════════════════════════════════════

/**
 * Evalúa la calidad de una solución (menor coste = mejor).
 * 
 * MEJORA M1: Scoring cuadrático + penalización heredero sin activos.
 */
function calcularCosteSolucion(
  lotes: Lote[],
  cuotaIdeal: number,
  todosActivos: ActivoInput[]
): number {
  let coste = 0;
  const nombresActivos = new Set(todosActivos.map(a => a.nombre));

  // Penalizar proindivisos (activos compartidos entre herederos)
  nombresActivos.forEach(nombre => {
    const comparticiones = lotes.filter(l =>
      l.activos.some(a => a.nombre === nombre && a.tipo === 'herencia')
    ).length;
    if (comparticiones > 1) {
      // Mayor penalización para activos indivisibles en proindiviso
      const activoOriginal = todosActivos.find(a => a.nombre === nombre);
      const pesoIndivisible = (activoOriginal && !activoOriginal.divisible) ? 50 : 10;
      coste += comparticiones * pesoIndivisible;
    }
  });

  // Penalizar desviación respecto a cuota ideal (CUADRÁTICA — penaliza más los extremos)
  lotes.forEach(lote => {
    const valorGananciales = lote.activos
      .filter(a => a.tipo === 'gananciales')
      .reduce((sum, a) => sum + a.valor, 0);
    const totalHerencia = lote.valorBienes - valorGananciales;
    const desviacion = Math.abs(cuotaIdeal - totalHerencia);
    
    // Penalización cuadrática normalizada
    const desviacionNorm = desviacion / (cuotaIdeal || 1);
    coste += desviacionNorm * desviacionNorm * 1000;

    // Penalización fija si necesita compensación sustancial (>1€)
    if (desviacion > 1) coste += 5;
  });

  // Penalizar herederos sin activos físicos de herencia
  const lotesHerederos = lotes.filter(l => l.idHeredero !== CONYUGE_ID);
  lotesHerederos.forEach(lote => {
    const tieneActivosFisicos = lote.activos.some(a => a.tipo === 'herencia' && !a.virtual);
    if (!tieneActivosFisicos) coste += 100;
  });

  return coste;
}

// ═══════════════════════════════════════════════════════════════════
// GENERACIÓN DE ESCENARIOS (M3 — Determinista)
// ═══════════════════════════════════════════════════════════════════

/**
 * Genera múltiples ordenaciones deterministas de los activos
 * para explorar el espacio de soluciones sin aleatoriedad.
 */
function generarOrdenaciones(activos: ActivoInput[]): ActivoInput[][] {
  const ordenaciones: ActivoInput[][] = [];

  // 1. Descendente por valor
  ordenaciones.push([...activos].sort((a, b) => b.valorTotal - a.valorTotal));

  // 2. Ascendente por valor
  ordenaciones.push([...activos].sort((a, b) => a.valorTotal - b.valorTotal));

  // 3. Indivisibles primero (descendente), luego divisibles (descendente)
  ordenaciones.push([...activos].sort((a, b) => {
    if (a.divisible !== b.divisible) return a.divisible ? 1 : -1;
    return b.valorTotal - a.valorTotal;
  }));

  // 4. Divisibles primero
  ordenaciones.push([...activos].sort((a, b) => {
    if (a.divisible !== b.divisible) return a.divisible ? -1 : 1;
    return b.valorTotal - a.valorTotal;
  }));

  // 5. Intercalado: Mayor, menor, siguiente mayor, siguiente menor...
  const sorted = [...activos].sort((a, b) => b.valorTotal - a.valorTotal);
  const intercalado: ActivoInput[] = [];
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    intercalado.push(sorted[lo++]);
    if (lo <= hi) intercalado.push(sorted[hi--]);
  }
  ordenaciones.push(intercalado);

  // 6. Inverso del intercalado
  ordenaciones.push([...intercalado].reverse());

  // 7-20. Permutaciones deterministas con PRNG seeded
  if (activos.length > 3) {
    const seedBase = hashString(activos.map(a => `${a.id}:${a.valorTotal}`).join('|'));
    for (let i = 0; i < 14; i++) {
      const rng = mulberry32(seedBase + i * 7919); // Primos para diversidad
      ordenaciones.push(shuffleDeterministic(activos, rng));
    }
  }

  return ordenaciones;
}

// ═══════════════════════════════════════════════════════════════════
// VALIDACIÓN DE INVARIANTES (M4)
// ═══════════════════════════════════════════════════════════════════

/**
 * Valida las invariantes del reparto y emite warnings.
 * No lanza excepciones para no bloquear la UI.
 */
function validarInvariantes(
  lotes: Lote[],
  compensaciones: Compensacion[],
  caudalRelicto: number
): void {
  // 1. Conservación de masa: total asignado ≈ caudal relicto
  const totalAsignado = lotes.reduce((sum, l) => sum + l.valorBienes, 0);
  if (Math.abs(totalAsignado - caudalRelicto) > 1) {
    console.warn(
      `⚠️ INVARIANTE: Masa no conservada. Asignado: ${totalAsignado.toFixed(2)}, Caudal: ${caudalRelicto.toFixed(2)}, Δ: ${(totalAsignado - caudalRelicto).toFixed(2)}`
    );
  }

  // 2. Compensaciones suman ≈ 0
  const sumaCompensaciones = compensaciones.reduce((sum, c) => sum + c.diferencia, 0);
  if (Math.abs(sumaCompensaciones) > 1) {
    console.warn(
      `⚠️ INVARIANTE: Compensaciones no balanceadas. Suma: ${sumaCompensaciones.toFixed(2)}`
    );
  }

  // 3. Ningún heredero con valor negativo
  lotes.forEach(lote => {
    if (lote.valorBienes < -0.01) {
      console.warn(
        `⚠️ INVARIANTE: Heredero "${lote.nombreHeredero}" tiene valor negativo: ${lote.valorBienes.toFixed(2)}`
      );
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// FUNCIÓN PÚBLICA — Punto de entrada del motor
// ═══════════════════════════════════════════════════════════════════

/**
 * Calcula el reparto óptimo de herencia.
 * 
 * @param totalActivos - Activos con valorTotal precalculado
 * @param herederos - Lista de herederos (sin cónyuge)
 * @param cuotaIdeal - Valor objetivo por heredero
 * @param fiscalConfig - Configuración fiscal/legal
 * @param caudalRelicto - Valor total del caudal (para validación)
 * @returns Lotes asignados y compensaciones
 */
export function calcularReparto(
  totalActivos: ActivoInput[],
  herederos: Heredero[],
  cuotaIdeal: number,
  fiscalConfig: FiscalConfig,
  caudalRelicto: number
): RepartoResult {
  // Generar múltiples escenarios deterministas
  const ordenaciones = generarOrdenaciones(totalActivos);

  let mejorEscenario: Lote[] = [];
  let menorCoste = Infinity;

  for (const ordenacion of ordenaciones) {
    // Deep clone activos para que cada escenario sea independiente
    const activosClon = ordenacion.map(a => ({
      ...a,
      asignarA: [...a.asignarA],
      sub_partidas: [...a.sub_partidas],
      yaConsolidado: undefined as boolean | undefined,
      valorHeredableRestante: undefined as number | undefined
    }));

    const lotes = calcularEscenario(activosClon, herederos, fiscalConfig, cuotaIdeal, totalActivos);
    const coste = calcularCosteSolucion(lotes, cuotaIdeal, totalActivos);

    if (coste < menorCoste) {
      mejorEscenario = lotes;
      menorCoste = coste;
    }
  }

  // 8. Compensaciones finales
  const compensaciones = calcularCompensaciones(mejorEscenario, cuotaIdeal);

  // Validar invariantes (solo warnings, no bloquea)
  validarInvariantes(mejorEscenario, compensaciones, caudalRelicto);

  // Ordenar por idHeredero para consistencia visual
  return {
    lotes: mejorEscenario.sort((a, b) => a.idHeredero - b.idHeredero),
    compensaciones
  };
}

/**
 * Calcula las compensaciones económicas entre herederos.
 * Bug 3 fix: La compensación del cónyuge solo refleja su porción hereditaria.
 */
function calcularCompensaciones(lotes: Lote[], cuotaIdeal: number): Compensacion[] {
  return lotes.map(lote => {
    const valorGananciales = lote.activos
      .filter(a => a.tipo === 'gananciales')
      .reduce((sum, a) => sum + a.valor, 0);
    const totalHerenciaRecibida = lote.valorBienes - valorGananciales;
    return {
      idHeredero: lote.idHeredero,
      heredero: lote.idHeredero,
      nombreHeredero: lote.nombreHeredero,
      diferencia: cuotaIdeal - totalHerenciaRecibida
    };
  });
}
