"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  Plus, 
  Trash2, 
  Users, 
  Home, 
  Coins, 
  ArrowRightLeft, 
  FileText,
  ChevronDown,
  AlertCircle,
  Brain,
  Scale,
  Sparkles,
  Info,
  Search,
  Save,
  CheckCircle2,
  Copy,
  HelpCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PdfGenerator } from '../utils/PdfGenerator';
import { PasswordModal } from '../components/PasswordModal';
import { ConfigModal } from '../components/ConfigModal';
import bcrypt from 'bcryptjs';

// --- Constantes y Ayudantes ---
const CONYUGE_ID = 999;

// --- Componente de Input Numérico Formateado (Miles y Decimales) ---
const FormattedNumberInput = ({ value, onChange, className, placeholder }: { value: number, onChange: (val: number) => void, className?: string, placeholder?: string }) => {
  const [localValue, setLocalValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Al montar o recibir nuevo valor externo, formatear para mostrar (si no se está editando)
  React.useEffect(() => {
    if (!isEditing) {
      setLocalValue(new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value));
    }
  }, [value, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permitir solo números, comas y puntos
    const raw = e.target.value;
    // Filtrar caracteres inválidos (solo permitir digitos, coma y punto)
    if (/^[0-9.,]*$/.test(raw)) {
      setLocalValue(raw);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Parsear el valor local (español: puntos miles, coma decimal)
    // 1. Quitar puntos de miles
    let normalized = localValue.replace(/\./g, '');
    // 2. Reemplazar coma decimal por punto standard
    normalized = normalized.replace(',', '.');
    
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else {
       // Si es inválido, revertir al valor original
       setLocalValue(new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value));
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
    // Al editar, quitar puntos de miles para facilitar la edición, pero mantener la coma
    // O mejor, dejarlo como está y dejar que el usuario edite el string
    // Estrategia simple: mostrar el valor raw sin formato miles pero con coma decimal
    if (value === 0) {
        setLocalValue(""); 
    } else {
        setLocalValue(value.toString().replace('.', ',')); 
    }
  };

  return (
    <input 
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default function Page() {
  const [herederos, setHerederos] = useState(
    Array.from({ length: 6 }, (_, i) => ({ id: i + 1, nombre: `Heredero ${i + 1}` }))
  );
  const numHerederos = herederos.length;
  const [moneda, setMoneda] = useState('EUR');
  const [activos, setActivos] = useState([
    {
      id: 'cash',
      nombre: "Caja / Dinero en Efectivo",
      divisible: true,
      esGanancial: true,
      isFixed: true, // Asset cannot be deleted
      asignarA: [] as number[],
      sub_partidas: [
        { id: 'scash', concepto: "Efectivo y Bancos", cantidad: 1, unidad: "€", valor_unitario: 0 }
      ]
    },
    {
      id: '1',
      nombre: "Finca La Dehesa",
      divisible: true,
      esGanancial: true,
      asignarA: [] as number[],
      sub_partidas: [
        { id: 's1', concepto: "Barbecho", cantidad: 2000, unidad: "m2", valor_unitario: 5 },
        { id: 's2', concepto: "Cultivo Almendro", cantidad: 5000, unidad: "m2", valor_unitario: 12 },
        { id: 's3', concepto: "Casa de campo", cantidad: 200, unidad: "m2", valor_unitario: 400 }
      ]
    },
    {
      id: '2',
      nombre: "Gran Explotación Agrícola",
      divisible: true,
      esGanancial: true,
      asignarA: [] as number[],
      sub_partidas: [
        { id: 's4', concepto: "Almendro Secano", cantidad: 400000, unidad: "m2", valor_unitario: 12 },
        { id: 's5', concepto: "Barbecho", cantidad: 100000, unidad: "m2", valor_unitario: 5 }
      ]
    },
    {
      id: '3',
      nombre: "Casa en el Pueblo",
      divisible: false,
      esGanancial: true,
      asignarA: [] as number[],
      sub_partidas: [
        { id: 's6', concepto: "Superficie", cantidad: 150, unidad: "m2", valor_unitario: 800 }
      ]
    }
  ]);

  const [expandedAssets, setExpandedAssets] = useState<string[]>(['cash', '1', '2', '3']);

  const toggleAssetExpansion = (id: string) => {
    setExpandedAssets(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const [analisisIA, setAnalisisIA] = useState("");
  const [isAnalizando, setIsAnalizando] = useState(false);
  
  // --- Estado de Sesión ---
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionLoadInput, setSessionLoadInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // --- Estado de Modal de Contraseña ---
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalMode, setPasswordModalMode] = useState<'set' | 'verify'>('set');
  const [passwordError, setPasswordError] = useState<string>('');
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  const [pendingSessionCode, setPendingSessionCode] = useState<string | null>(null);
  const [isSessionProtected, setIsSessionProtected] = useState(false);

  // --- Estado de Configuración Fiscal ---
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [fiscalConfig, setFiscalConfig] = useState({
    gananciales: false,
    usufructo: { enabled: false, edadViudo: 0 },
    colacion: [] as { id: string; concepto: string; valor: number }[]
  });

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // --- Detección de Parámetro URL para Auto-Carga ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      loadSession(code);
      // Limpiar URL después de cargar
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // --- Cálculos de Lógica de Negocio ---
  
  const totalActivos = useMemo(() => {
    return activos.map(a => ({
      ...a,
      asignarA: a.asignarA || [], // Asegurar que sea array
      valorTotal: a.sub_partidas.reduce((acc, sub) => acc + (sub.cantidad * sub.valor_unitario), 0)
    }));
  }, [activos]);

  const caudalRelicto = useMemo(() => {
    let base = 0;
    totalActivos.forEach(a => {
      if (fiscalConfig.gananciales && a.esGanancial !== false) {
        base += a.valorTotal * 0.5;
      } else {
        base += a.valorTotal;
      }
    });
    
    const colacionTotal = fiscalConfig.colacion.reduce((acc, c) => acc + (c.valor || 0), 0);
    return base + colacionTotal;
  }, [totalActivos, fiscalConfig]);

  const numHerederosEfectivos = useMemo(() => {
    return herederos.length + (fiscalConfig.gananciales ? 1 : 0);
  }, [herederos, fiscalConfig.gananciales]);

  const cuotaIdeal = useMemo(() => caudalRelicto / numHerederosEfectivos, [caudalRelicto, numHerederosEfectivos]);

  const valueAUsufructuar = useMemo(() => {
    if (!fiscalConfig.usufructo.enabled) return 0;
    const porc = Math.max(10, Math.min(70, 89 - fiscalConfig.usufructo.edadViudo));
    
    // El usufructo se calcula sobre la masa herencial física (caudal relicto sin colación)
    let baseHerenciaFisica = 0;
    totalActivos.forEach(a => {
      if (fiscalConfig.gananciales && a.esGanancial !== false) {
        baseHerenciaFisica += a.valorTotal * 0.5;
      } else {
        baseHerenciaFisica += a.valorTotal;
      }
    });
    
    return baseHerenciaFisica * (porc / 100);
  }, [totalActivos, fiscalConfig]);

  const reparto = useMemo(() => {
    // 1. Inicializar lotes
    let lotesBase = herederos.map(h => ({
      id: h.id,
      idHeredero: h.id,
      nombreHeredero: h.nombre,
      activos: [] as any[],
      valorBienes: 0
    }));

    if (fiscalConfig.gananciales) {
      lotesBase.push({
        id: CONYUGE_ID,
        idHeredero: CONYUGE_ID,
        nombreHeredero: "Cónyuge Viudo/a",
        activos: [] as any[],
        valorBienes: 0
      });
    }

    let lotes = lotesBase;

    // 1b. Si hay Gananciales, asignar el 50% de los bienes GANANCIALES al cónyuge primero
    if (fiscalConfig.gananciales) {
      const loteConyuge = lotes.find(l => l.idHeredero === CONYUGE_ID);
      if (loteConyuge) {
        totalActivos.forEach(activo => {
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

    // 2. Procesar asignaciones manuales (Simples y Múltiples)
    const asignados = totalActivos.filter(a => (a as any).asignarA && (a as any).asignarA.length > 0);
    asignados.forEach(activo => {
      const pActivo = activo as any;
      const numParticipantes = pActivo.asignarA.length;
      
      // La masa a repartir es el 50% si es ganancial, o el 100% si es privativo
      const factorMasa = (fiscalConfig.gananciales && activo.esGanancial !== false) ? 0.5 : 1;
      const valorPorHeredero = (activo.valorTotal * factorMasa) / numParticipantes;
      
      pActivo.asignarA.forEach((hId: number) => {
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

    // 2b. Integrar Donaciones como "Activos Virtuales" para equilibrar el lote
    fiscalConfig.colacion.forEach((donacion: any) => {
      if (donacion.herederoId) {
        const lote = lotes.find(l => l.idHeredero === donacion.herederoId);
        if (lote) {
          lote.activos.push({
            id: "don_" + donacion.id,
            nombre: donacion.concepto,
            valor: donacion.valor,
            fraccion: 1,
            virtual: true // Marca para UI
          });
          lote.valorBienes += donacion.valor;
        }
      }
    });

    // 2c. CONSOLIDACIÓN DE PROPIEDAD PARA EL CÓNYUGE
    // Si hay Gananciales, priorizamos dar el otro 50% (herencia) al cónyuge 
    // para que sea dueño del 100% del activo, hasta completar su cuota ideal.
    if (fiscalConfig.gananciales) {
      const loteConyuge = lotes.find(l => l.idHeredero === CONYUGE_ID);
      if (loteConyuge) {
        // Considerar activos sin asignar manualmente
        const candidatos = totalActivos.filter(a => a.asignarA.length === 0).sort((a, b) => a.valorTotal - b.valorTotal);
        
        for (const activo of candidatos) {
          if (activo.esGanancial === false) continue; // Si es privativo, no consolidamos (ya es 100% herencia)
          
          const totalPropiedad = loteConyuge.activos.filter(a => a.tipo === 'gananciales').reduce((s, a) => s + a.valor, 0);
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
          
          // Si asignamos menos del total heredable (el 50%), marcamos la diferencia 
          // para que se reparta en el siguiente paso. Si asignamos todo, lo quitamos de pendientes.
          if (aAsignar >= valorHeredable - 0.01) {
            (activo as any).yaConsolidado = true;
          } else {
            (activo as any).valorHeredableRestante = valorHeredable - aAsignar;
          }
        }
      }
    }

    // 3. Repartir pendientes (automático)
    // EXCLUIMOS "Caja / Dinero en Efectivo" para que actúe como buffer al final
    
    const pendientesFisicos = totalActivos.filter(a => 
      a.id !== 'cash' &&
      a.asignarA.length === 0 && 
      !(a as any).yaConsolidado
    ).sort((a, b) => b.valorTotal - a.valorTotal);

    pendientesFisicos.forEach(activo => {
      const factorMasa = (fiscalConfig.gananciales && activo.esGanancial !== false) ? 0.5 : 1;
      let valorHeredable = (activo as any).valorHeredableRestante !== undefined 
        ? (activo as any).valorHeredableRestante 
        : (activo.valorTotal * factorMasa);

      if (valorHeredable <= 0.01) return;

      // Intentar asignar el 100% a alguien que tenga "hueco" en su cuota ideal
      const candidatosQueCaben = lotes
        .filter(l => l.valorBienes + valorHeredable <= cuotaIdeal + 0.01)
        .sort((a, b) => a.valorBienes - b.valorBienes);

      if (candidatosQueCaben.length > 0) {
        // Cabe entero en al menos un heredero. Se lo damos al que menos tenga.
        const lote = candidatosQueCaben[0];
        lote.activos.push({ 
          id: activo.id, 
          nombre: activo.nombre, 
          valor: valorHeredable, 
          fraccion: valorHeredable / activo.valorTotal, 
          tipo: 'herencia' 
        });
        lote.valorBienes += valorHeredable;
      } else {
        // No cabe entero en nadie sin superar su cuota ideal.
        if (!activo.divisible) {
          // Si es indivisible, se lo damos al que menos tenga aunque se pase.
          const lote = [...lotes].sort((a, b) => a.valorBienes - b.valorBienes)[0];
          lote.activos.push({ 
            id: activo.id, 
            nombre: activo.nombre, 
            valor: valorHeredable, 
            fraccion: valorHeredable / activo.valorTotal, 
            tipo: 'herencia' 
          });
          lote.valorBienes += valorHeredable;
        } else {
          // Si es divisible, repartimos entre los que tienen déficit para equilibrar.
          let restante = valorHeredable;
          while (restante > 0.01) {
            const conDeficit = lotes.filter(l => l.valorBienes < cuotaIdeal - 0.01);
            if (conDeficit.length === 0) {
              // Nadie tiene déficit, repartir el resto a partes iguales
              const aCadaUno = restante / lotes.length;
              lotes.forEach(lote => {
                lote.activos.push({ 
                  id: `${activo.id}_sob_${lote.id}`, 
                  nombre: activo.nombre, 
                  valor: aCadaUno, 
                  fraccion: aCadaUno / activo.valorTotal, 
                  tipo: 'herencia' 
                });
                lote.valorBienes += aCadaUno;
              });
              restante = 0;
            } else {
              // Repartir proporcionalmente al déficit
              const deficitTotal = conDeficit.reduce((acc, l) => acc + (cuotaIdeal - l.valorBienes), 0);
              const aRepartirAhora = Math.min(restante, deficitTotal);
              conDeficit.forEach(lote => {
                const miDeficit = cuotaIdeal - lote.valorBienes;
                const miParte = (miDeficit / deficitTotal) * aRepartirAhora;
                if (miParte > 0.01) {
                  lote.activos.push({ 
                    id: `${activo.id}_bal_${lote.id}`, 
                    nombre: activo.nombre, 
                    valor: miParte, 
                    fraccion: miParte / activo.valorTotal, 
                    tipo: 'herencia' 
                  });
                  lote.valorBienes += miParte;
                }
              });
              restante -= aRepartirAhora;
            }
          }
        }
      }
    });

    // 4. Reparto de "Caja / Dinero en Efectivo" como buffer de equilibrio
    const activoCash = totalActivos.find(a => a.id === 'cash');
    if (activoCash && activoCash.asignarA.length === 0 && !(activoCash as any).yaConsolidado) {
      const factorMasa = (fiscalConfig.gananciales && activoCash.esGanancial !== false) ? 0.5 : 1;
      let cashRestante = activoCash.valorTotal * factorMasa;

      // Primero: Intentar llenar los déficits de los herederos
      const conDeficit = lotes.filter(l => l.valorBienes < cuotaIdeal - 0.01)
                             .sort((a, b) => b.valorBienes - a.valorBienes); // Empezar por los que casi llegan o proporcional? Mejor proporcional.
      
      if (conDeficit.length > 0 && cashRestante > 0) {
        const deficitTotal = conDeficit.reduce((acc, l) => acc + (cuotaIdeal - l.valorBienes), 0);
        const aRepartir = Math.min(cashRestante, deficitTotal);
        
        conDeficit.forEach(lote => {
          const miDeficit = cuotaIdeal - lote.valorBienes;
          const miParte = (miDeficit / deficitTotal) * aRepartir;
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

      // Segundo: Si aún sobra cash (raro si hay deudas, pero posible), repartir a partes iguales entre todos
      if (cashRestante > 0.01) {
        const aCadaUno = cashRestante / lotes.length;
        lotes.forEach(lote => {
          lote.activos.push({ 
            id: `cash_extra_${lote.id}`, 
            nombre: activoCash.nombre, 
            valor: aCadaUno, 
            fraccion: aCadaUno / activoCash.valorTotal, 
            tipo: 'herencia' 
          });
          lote.valorBienes += aCadaUno;
        });
      }
    } else if (activoCash && activoCash.asignarA.length > 0) {
       // Si fue asignado manualmente, ya se procesó en el paso 2
    }

    // 5. UNIFICACIÓN DE ACTIVOS (Evitar filas duplicadas del mismo bien)
    lotes.forEach(lote => {
      const unificados: any[] = [];
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

    // 6. AJUSTE DE COMPENSACIONES FÍSICAS (Especial Gananciales)
    // Tras el reparto, si algún heredero tiene exceso y el cónyuge defecto,
    // transferimos valor de sus bienes de herencia al cónyuge.
    if (fiscalConfig.gananciales) {
      const loteConyuge = lotes.find(l => l.idHeredero === CONYUGE_ID);
      if (loteConyuge) {
        lotes.forEach(lote => {
          if (lote.idHeredero === CONYUGE_ID) return;
          
          let diferencia = lote.valorBienes - cuotaIdeal;
          if (diferencia > 0.01) {
             // Buscar un activo divisible de herencia para transferir
             const activosHerencia = lote.activos.filter(a => a.tipo === 'herencia' && !a.virtual);
             for (const act of activosHerencia) {
                if (diferencia <= 0) break;
                const aTransferir = Math.min(diferencia, act.valor - 0.01);
                if (aTransferir <= 0) continue;
                
                // Mermar del heredero
                act.valor -= aTransferir;
                const totalOriginal = totalActivos.find(ta => ta.nombre === act.nombre)?.valorTotal || 1;
                act.fraccion -= aTransferir / totalOriginal;
                lote.valorBienes -= aTransferir;
                
                // Añadir al cónyuge
                const existenteConyuge = loteConyuge.activos.find(a => a.nombre === act.nombre && a.tipo === 'herencia');
                if (existenteConyuge) {
                  existenteConyuge.valor += aTransferir;
                  existenteConyuge.fraccion += aTransferir / totalOriginal;
                } else {
                  loteConyuge.activos.push({
                    id: "trans_" + act.id,
                    nombre: act.nombre,
                    valor: aTransferir,
                    fraccion: aTransferir / totalOriginal,
                    tipo: 'herencia'
                  });
                }
                loteConyuge.valorBienes += aTransferir;
                diferencia -= aTransferir;
             }
          }
        });
      }
    }

    // 7. Calcular compensaciones finales
    const compensaciones = lotes.map(lote => {
      const valorGananciales = lote.activos.filter(a => a.tipo === 'gananciales').reduce((sum, a) => sum + a.valor, 0);
      const totalHerenciaRecibida = lote.valorBienes - valorGananciales;
      
      return {
        idHeredero: lote.idHeredero,
        heredero: lote.idHeredero,
        nombreHeredero: lote.nombreHeredero,
        diferencia: cuotaIdeal - totalHerenciaRecibida
      };
    });

    return { lotes: lotes.sort((a, b) => a.idHeredero - b.idHeredero), compensaciones };
  }, [totalActivos, herederos, cuotaIdeal, fiscalConfig]);

  /* 
   * LÓGICA DE REPARTO
   * El reparto se calcula automáticamente en el useMemo superior 
   * considerando asignaciones manuales, indivisibilidad y colación.
   */

  // --- Funciones de Gestión ---

  const agregarActivo = () => {
    const nextId = activos.length > 0 ? (Math.max(...activos.map(a => parseInt(a.id) || 0)) + 1).toString() : "1";
    setActivos([...activos, { 
      id: nextId, 
      nombre: `Nuevo Activo ${nextId}`, 
      divisible: true, 
      esGanancial: true,
      asignarA: [], 
      sub_partidas: [{ id: Date.now().toString(), concepto: "Concepto inicial", cantidad: 1, unidad: "ud", valor_unitario: 0 }] 
    }]);
    setExpandedAssets(prev => [...prev, nextId]);
  };

  const agregarHeredero = () => {
    const nextId = herederos.length > 0 ? Math.max(...herederos.map(h => h.id)) + 1 : 1;
    setHerederos([...herederos, { id: nextId, nombre: `Heredero ${nextId}` }]);
  };

  const eliminarHeredero = () => {
    if (herederos.length <= 1) return;
    setHerederos(herederos.slice(0, -1));
  };

  const updateNombreHeredero = (id: number, nombre: string) => {
    setHerederos(herederos.map(h => h.id === id ? { ...h, nombre } : h));
  };

  const sortearHerederos = () => {
    // Solo barajamos los nombres de los herederos reales.
    // El cónyuge es inamovible y no participa en el sorteo de nombres.
    
    const conRestricciones = new Set([
      ...activos.filter(a => a.asignarA && a.asignarA.length > 0).flatMap(a => a.asignarA),
      ...fiscalConfig.colacion.filter(c => (c as any).herederoId !== undefined).map(c => (c as any).herederoId)
    ]);

    // Filtrar solo los herederos de la lista principal
    const libres = herederos.filter(h => !conRestricciones.has(h.id));
    
    if (libres.length > 1) {
      const nombresBarajados = [...libres.map(h => h.nombre)].sort(() => Math.random() - 0.5);
      
      const nuevosHerederos = herederos.map(h => {
        const libreIdx = libres.findIndex(l => l.id === h.id);
        if (libreIdx !== -1) {
          return { ...h, nombre: nombresBarajados[libreIdx] };
        }
        return h;
      });
      setHerederos(nuevosHerederos);
    }
  };

  const asignarActivo = (activoId: string, hId: number) => {
    setActivos(activos.map(a => {
      if (a.id !== activoId) return a;
      const current = a.asignarA || [];
      const exists = current.includes(hId);
      return { 
        ...a, 
        asignarA: exists ? current.filter(id => id !== hId) : [...current, hId] 
      };
    }));
  };

  const eliminarActivo = (id: string) => {
    const activo = activos.find(a => a.id === id);
    if (activo && (activo as any).isFixed) return;
    setActivos(activos.filter(a => a.id !== id));
  };

  const actualizarSubpartida = (activoId: string, subId: string, campo: string, valor: any) => {
    setActivos(prev => prev.map(a => {
      if (a.id !== activoId) return a;
      return {
        ...a,
        sub_partidas: a.sub_partidas.map(s => s.id === subId ? { ...s, [campo]: valor } : s)
      };
    }));
  };

  const eliminarSubPartida = (activoId: string, subId: string) => {
    setActivos(activos.map(a => {
      if (a.id !== activoId) return a;
      return {
        ...a,
        sub_partidas: a.sub_partidas.filter(s => s.id !== subId)
      };
    }));
  };

  const toggleDivisible = (id: string) => {
    setActivos(activos.map(a => a.id === id ? { ...a, divisible: !a.divisible } : a));
  };

  const generarResumenLocal = () => {
    const { lotes, compensaciones } = reparto;
    const lineas: string[] = [];

    // 0. Contexto Fiscal
    if (fiscalConfig.gananciales) {
      lineas.push("Se ha procedido a la liquidación previa de la sociedad de gananciales, deduciendo el 50% de la masa común a favor del cónyuge supérstite antes de determinar el caudal relicto hereditario.");
    }

    lineas.push(`Se ha analizado un caudal relicto total de ${formatCurrency(caudalRelicto)} a repartir entre ${numHerederos} herederos, resultando en una cuota ideal de ${formatCurrency(cuotaIdeal)} por partícipe.`);

    if (fiscalConfig.colacion.length > 0) {
      const totalCol = fiscalConfig.colacion.reduce((a, b) => a + b.valor, 0);
      lineas.push(`Este importe incluye ${formatCurrency(totalCol)} en concepto de masa de colación por donaciones realizadas en vida (Art. 1035 CC), las cuales se computan a efectos del cálculo de cuotas.`);
    }

    if (fiscalConfig.usufructo.enabled) {
      lineas.push(`Se ha tenido en cuenta el usufructo vitalicio del cónyuge (calculado mediante la regla del 89), lo que representa una carga latente sobre la nuda propiedad de los bienes adjudicados.`);
    }

    // 1. Análisis de Ajuste
    const lotesDesviados = lotes.filter(l => Math.abs(l.valorBienes - cuotaIdeal) > 1);
    if (lotesDesviados.length === 0) {
      lineas.push("El reparto de bienes realizado es matemáticamente exacto, coincidiendo el valor de los bienes adjudicados con la cuota ideal.");
    } else {
      lineas.push(`Debido a la naturaleza fraccionaria o indivisible de los activos, el reparto de bienes físicos presenta desviaciones respecto a la cuota ideal.`);
    }

    // 2. Justificación de Indivisibles
    const indivisibles = activos.filter(a => !a.divisible);
    if (indivisibles.length > 0) {
      lineas.push(`Se ha priorizado la adjudicación íntegra de activos indivisibles (${indivisibles.map(a => a.nombre).join(", ")}) para evitar situaciones de proindiviso (copropiedad), las cuales suelen derivar en conflictos familiares y pérdida del valor económico del activo.`);
    }

    // 3. Compensaciones
    const debenCompensar = compensaciones.filter(c => c.diferencia < -1); // Tienen de más, pagan (diferencia negativa)
    const debenRecibir = compensaciones.filter(c => c.diferencia > 1); // Tienen de menos, cobran (diferencia positiva)

    if (debenCompensar.length > 0) {
      const totalCompensar = debenCompensar.reduce((acc, c) => acc + Math.abs(c.diferencia), 0);
      lineas.push(`Para perfeccionar la partición, es necesario establecer compensaciones en metálico por un total de ${formatCurrency(totalCompensar)}.`);
      lineas.push(`Concretamente, los herederos con exceso de adjudicación (${debenCompensar.map(c => c.nombreHeredero).join(", ")}) deberán abonar la diferencia a aquellos con defecto de adjudicación.`);
    }

    // 4. Advertencia Fiscal
    lineas.push("IMPORTANTE: Este informe es una estimación técnica. La valoración final y el Impuesto de Sucesiones pueden variar significativamente según la normativa específica de cada Comunidad Autónoma.");

    return lineas.join(" ");
  };

  const solicitarAnalisisIA = async () => {
    // Si la sesión ya tiene contraseña, no preguntar de nuevo
    if (isSessionProtected) {
      ejecutarGeneracionConPassword(null);
    } else {
      setPasswordModalMode('set');
      setPasswordError('');
      setShowPasswordModal(true);
    }
  };

  const ejecutarGeneracionConPassword = async (password: string | null) => {
    setPendingPassword(password);
    
    // Continuar con generación de informe
    setIsAnalizando(true);
    setAnalisisIA("");
    
    // Guardar sesión con contraseña (o sin ella)
    const savedCode = await saveSession(password);

    setTimeout(() => {
      const resumen = generarResumenLocal();
      setAnalisisIA(resumen);
      
      // Generar PDF con enlace directo
      const currentUrl = window.location.origin;
      const generator = new PdfGenerator(moneda);
      generator.generate({
        config: {
          numHerederos,
          moneda,
          fecha: new Date().toLocaleDateString('es-ES'),
          sessionCode: savedCode || sessionCode || "PENDIENTE",
          sessionUrl: savedCode ? `${currentUrl}/?code=${savedCode}` : undefined,
          hasPassword: password !== null || isSessionProtected
        },
        metricas: {
          caudalRelicto,
          cuotaIdeal
        },
        inventario: activos,
        reparto: reparto,
        textoExplicativo: resumen,
        fiscal: {
          ...fiscalConfig,
          usufructo: {
            ...fiscalConfig.usufructo,
            valor: valueAUsufructuar
          }
        }
      });

      setIsAnalizando(false);
      setPendingPassword(null);
    }, 600);
  };

  // --- Funciones de Contraseña ---
  
  const hashPassword = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  };

  const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
  };

  const handlePasswordConfirm = async (password: string | null) => {
    if (passwordModalMode === 'set') {
      // Modo: Establecer contraseña al generar informe
      setShowPasswordModal(false);
      ejecutarGeneracionConPassword(password);
    } else {
      // Modo: Verificar contraseña al cargar sesión
      if (!password || !pendingSessionCode) {
        setPasswordError('Por favor ingrese una contraseña');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('code', pendingSessionCode)
          .single();

        if (error) throw error;

        if (data && data.password_hash) {
          const isValid = await verifyPassword(password, data.password_hash);
          
          if (isValid) {
            // Contraseña correcta, cargar sesión
            setHerederos(data.data.herederos);
            setActivos(data.data.activos);
            setMoneda(data.data.moneda);
            if (data.data.fiscalConfig) {
              setFiscalConfig(data.data.fiscalConfig);
            }
            setSessionCode(data.code);
            setSessionLoadInput("");
            setAnalisisIA("");
            setIsSessionProtected(true);
            setShowPasswordModal(false);
            setPasswordError('');
            setPendingSessionCode(null);
          } else {
            setPasswordError('Contraseña incorrecta. Inténtelo de nuevo.');
          }
        } else {
          // No debería llegar aquí, pero por si acaso
          setPasswordError('Error al verificar contraseña');
        }
      } catch (err) {
        console.error("Error verifying password:", err);
        setPasswordError('Error al verificar contraseña');
      }
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordModal(false);
    setPasswordError('');
    setPendingPassword(null);
    setPendingSessionCode(null);
    setIsAnalizando(false);
  };

  // --- Lógica de Persistencia (Supabase) ---

  const generateSessionCode = () => {
    // Generar código alfanumérico de 8 caracteres (mayúsculas y minúsculas)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const saveSession = async (password: string | null = null) => {
    setSaveStatus('saving');
    try {
      let code = sessionCode;
      
      // Si no existe código, generarlo
      if (!code) {
        code = generateSessionCode();
        setSessionCode(code); // Actualiza estado UI
      }

      const dataToSave = {
        herederos,
        activos,
        moneda,
        fiscalConfig,
        version: 1
      };

      // Preparar payload de Supabase
      const payload: any = { 
        code: code, 
        data: dataToSave,
        updated_at: new Date().toISOString()
      };

      // Manejo de contraseña para evitar sobrescrituras
      if (password) {
        payload.password_hash = await hashPassword(password);
        setIsSessionProtected(true);
      } else if (!isSessionProtected) {
        // Solo si la sesión NO estaba protegida, nos aseguramos de que siga siendo NULL
        // Si ya estaba protegida (isSessionProtected === true), omitimos el campo 
        // para que Supabase mantenga el hash existente.
        payload.password_hash = null;
      }

      const { error } = await supabase
        .from('sessions')
        .upsert(payload, { onConflict: 'code' });

      if (error) throw error;

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
      return code; // Retorna el código seguro para usarlo inmediatamente
    } catch (err) {
      console.error("Error saving session:", err);
      setSaveStatus('error');
      return null;
    }
  };

  const loadSession = async (codeToLoad: string) => {
    if (!codeToLoad) return;
    setIsLoadingSession(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('code', codeToLoad) // Buscar exactamente como se ingresó (case-sensitive)
        .single();

      if (error) throw error;
      if (data && data.data) {
        // Verificar si tiene contraseña
        if (data.password_hash) {
          // Requiere contraseña, mostrar modal
          setPendingSessionCode(codeToLoad);
          setPasswordModalMode('verify');
          setPasswordError('');
          setShowPasswordModal(true);
          setIsLoadingSession(false);
        } else {
          // Sin contraseña, cargar directamente
          setHerederos(data.data.herederos);
          setActivos(data.data.activos);
          setMoneda(data.data.moneda);
          if (data.data.fiscalConfig) {
            setFiscalConfig(data.data.fiscalConfig);
          }
          setSessionCode(data.code);
          setSessionLoadInput("");
          setAnalisisIA(""); // Reset analisis anterior
          setIsSessionProtected(false);
          setIsLoadingSession(false);
        }
      } else {
        alert("Sesión no encontrada");
        setIsLoadingSession(false);
      }
    } catch (err) {
      console.error("Error loading session:", err);
      alert("Error al cargar la sesión. Verifica el código (distingue mayúsculas/minúsculas).");
      setIsLoadingSession(false);
    }
  };

  const formatCurrency = (amount: number) => {
    // Mapeo manual de símbolos si se prefiere o Intl standard
    const currencyMap: Record<string, string> = { 'EUR': '€', 'USD': '$', 'MXN': '$' };
    const symbol = currencyMap[moneda] || moneda;
    
    return new Intl.NumberFormat('es-ES', { 
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' ' + symbol;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-10">
      
      {/* Header */}
      <header className="max-w-[1400px] mx-auto mb-6 md:mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg shrink-0">
              <Calculator className="text-indigo-600 w-5 h-5 md:w-6 md:h-6" />
            </div>
            Optimizador de Herencias
          </h1>
          <p className="text-slate-500 mt-1 ml-12 text-sm hidden md:block">Cálculo técnico y equitativo de lotes patrimoniales</p>
        </div>
        
        <div className="flex items-center justify-between md:justify-start gap-4 bg-white p-2 pr-4 md:pr-6 rounded-xl shadow-sm border border-slate-200 w-full md:w-auto">
          <div className="flex items-center gap-3 px-2 md:px-4 py-1 md:py-2 border-r border-slate-100">
            <Users className="w-5 h-5 text-slate-400" />
            <span className="text-lg font-bold text-indigo-600">{numHerederos}</span>
            <span className="text-sm text-slate-500 font-medium hidden sm:inline">Herederos</span>
            <div className="flex flex-col ml-2">
               <button onClick={agregarHeredero} className="text-slate-400 hover:text-indigo-600"><ChevronDown className="w-3 h-3 rotate-180" /></button>
               <button onClick={eliminarHeredero} className="text-slate-400 hover:text-indigo-600"><ChevronDown className="w-3 h-3" /></button>
            </div>
          </div>
          <select 
            value={moneda} 
            onChange={(e) => setMoneda(e.target.value)}
            className="font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer text-sm"
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="MXN">MXN ($)</option>
          </select>
        </div>

        {/* Botones de Acción Global */}
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setShowConfigModal(true)}
             className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
           >
             <Scale className="w-4 h-4 text-indigo-600" />
             <span className="hidden sm:inline">Config. Avanzada</span>
           </button>

           {sessionCode && (
             <button 
               onClick={() => saveSession()}
               className={`
                 flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm border text-sm font-bold transition-all
                 ${saveStatus === 'saved' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}
               `}
             >
               <Save className={`w-4 h-4 ${saveStatus === 'saved' ? 'text-emerald-500' : 'text-indigo-600'}`} />
               <span className="hidden sm:inline">{saveStatus === 'saved' ? 'Guardado' : 'Guardar'}</span>
             </button>
           )}
        </div>

        {/* Carga de Sesión */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200 w-full md:w-auto">
          {sessionCode ? (
             <div className="flex items-center gap-2 px-3">
               <span className="text-xs text-slate-400 font-bold uppercase">Sesión:</span>
               <span className="text-lg font-bold text-indigo-600 tracking-wider">{sessionCode}</span>
               <button
                 onClick={() => {
                   navigator.clipboard.writeText(sessionCode);
                   // Visual feedback
                   const btn = document.activeElement as HTMLButtonElement;
                   if (btn) {
                     const originalHTML = btn.innerHTML;
                     btn.innerHTML = '<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                     setTimeout(() => {
                       btn.innerHTML = originalHTML;
                     }, 1500);
                   }
                 }}
                 className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                 title="Copiar código"
               >
                 <Copy className="w-4 h-4" />
               </button>
               {saveStatus === 'saved' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
             </div>
          ) : (
             <div className="flex items-center gap-2">
               <input 
                 value={sessionLoadInput}
                 onChange={(e) => setSessionLoadInput(e.target.value)}
                 placeholder="CÓDIGO (ej: aB3xY9Zk)"
                 className="text-xs font-bold text-slate-700 bg-slate-50 border-none rounded py-1.5 pl-3 pr-2 focus:ring-1 focus:ring-indigo-500 w-[140px]"
                 maxLength={8}
               />
               <button 
                onClick={() => loadSession(sessionLoadInput)}
                disabled={!sessionLoadInput || isLoadingSession}
                className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 disabled:opacity-50"
                title="Cargar Sesión"
               >
                 <Search className="w-4 h-4" />
               </button>
             </div>
          )}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Inventario */}
        <div className="lg:col-span-7 space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-700">
              <Home className="w-5 h-5" /> Inventario de Activos
            </h2>

          <div className="space-y-6">
            {activos.map((activo) => {
              const isExpanded = expandedAssets.includes(activo.id);
              const isFixed = (activo as any).isFixed;

              return (
                <div key={activo.id} className={`rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 ${isFixed ? 'bg-blue-50/40' : 'bg-white'}`}>
                  {/* Asset Header - Clickable for Accordion */}
                  <div 
                    onClick={() => toggleAssetExpansion(activo.id)}
                    className={`p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors ${!isExpanded ? 'border-b-transparent' : ''}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 flex-1 w-full">
                      <div className="flex items-center justify-between w-full md:w-auto gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? '' : '-rotate-90'}`} />
                          </div>
                          <input 
                            type="text" 
                            value={activo.nombre}
                            onClick={(e) => e.stopPropagation()} // Prevent expansion when renaming
                            onChange={(e) => {
                              if (isFixed) return;
                              setActivos(activos.map(a => a.id === activo.id ? {...a, nombre: e.target.value} : a));
                            }}
                            readOnly={isFixed}
                            className={`text-lg md:text-xl font-extrabold text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0 flex-1 md:min-w-[300px] truncate ${ isFixed ? 'select-none cursor-default' : '' }`}
                            placeholder="Nombre del activo..."
                          />
                        </div>
                        {!isFixed && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              eliminarActivo(activo.id);
                            }} 
                            className="md:hidden text-slate-300 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {!isFixed && (
                          <button 
                            onClick={() => toggleDivisible(activo.id)}
                            className={`
                              text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg tracking-wider transition-all transform active:scale-95
                              border-b-4
                              ${activo.divisible 
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 hover:border-emerald-300 shadow-sm' 
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:border-slate-300 shadow-sm'
                              }
                            `}
                          >
                            {activo.divisible ? 'DIVISIBLE' : 'INDIVISIBLE'}
                          </button>
                        )}

                        {fiscalConfig.gananciales && (
                          <button 
                            onClick={() => setActivos(activos.map(a => a.id === activo.id ? { ...a, esGanancial: a.esGanancial === false ? true : false } : a))}
                            className={`
                              text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg tracking-wider transition-all transform active:scale-95
                              border-b-4
                              ${activo.esGanancial !== false
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200 hover:border-indigo-300 shadow-sm' 
                                : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 hover:border-amber-300 shadow-sm'
                              }
                            `}
                          >
                            {activo.esGanancial !== false ? 'GANANCIAL' : 'PRIVATIVO'}
                          </button>
                        )}
                        
                        <div className="relative">
                          <button 
                            onClick={() => setActiveDropdown(activeDropdown === activo.id ? null : activo.id)}
                            className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors text-[11px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-100"
                          >
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {activo.asignarA.length === 0 
                              ? "Reparto Automático" 
                              : `${activo.asignarA.length} Asignado${activo.asignarA.length > 1 ? 's' : ''}`
                            }
                            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${activeDropdown === activo.id ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {/* Dropdown Menu */}
                          {activeDropdown === activo.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setActiveDropdown(null)}
                              />
                              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in duration-200">
                                <div className="space-y-1">
                                  {/* Participantes: Herederos + Cónyuge opcional */}
                                  {[...herederos, ...(fiscalConfig.gananciales ? [{ id: CONYUGE_ID, nombre: "Cónyuge Viudo/a" }] : [])].map(p => {
                                    const isChecked = activo.asignarA.includes(p.id);
                                    return (
                                      <button
                                        key={p.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          asignarActivo(activo.id, p.id);
                                        }}
                                        className={`
                                          flex items-center gap-3 w-full px-2 py-2 rounded-lg text-left transition-colors
                                          ${isChecked ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}
                                        `}
                                      >
                                        <div className={`
                                          w-4 h-4 rounded border flex items-center justify-center transition-colors
                                          ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}
                                        `}>
                                          {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        <span className="text-xs font-medium truncate">{p.nombre}</span>
                                      </button>
                                    );
                                  })}
                                  
                                  {activo.asignarA.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActivos(activos.map(a => a.id === activo.id ? { ...a, asignarA: [] } : a));
                                      }}
                                      className="w-full text-center py-1 mt-1 text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wider border-t border-slate-100 pt-2"
                                    >
                                      Limpiar selección
                                    </button>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Valor total</span>
                        <span className="text-lg font-black text-indigo-600">
                          {formatCurrency(activo.sub_partidas.reduce((acc, sub) => acc + (sub.cantidad * sub.valor_unitario), 0))}
                        </span>
                      </div>
                      {!isFixed && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarActivo(activo.id);
                          }}
                          className="hidden md:flex items-center justify-center w-10 h-10 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors shadow-sm"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Content (Details) */}
                  {isExpanded && (
                    <div className="p-5 animate-in slide-in-from-top-2 duration-300 ease-out fill-mode-forwards">
                      <div className="mb-4">
                        <div className="hidden md:grid grid-cols-12 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 gap-4 border-b border-slate-50 pb-2">
                          <div className={isFixed ? "col-span-8" : "col-span-4"}>Concepto</div>
                          {!isFixed && (
                            <>
                              <div className="col-span-2 text-right">Cant.</div>
                              <div className="col-span-2">Unidad</div>
                            </>
                          )}
                          <div className="col-span-2 text-right">{isFixed ? "Importe" : "Val. Unit."}</div>
                          <div className="col-span-2 text-right">Total</div>
                        </div>
                        
                        <div className="space-y-4 md:space-y-2 mt-2">
                          {activo.sub_partidas.map(sub => (
                            <div key={sub.id} className={`grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-2 md:gap-4 hover:bg-slate-50 p-3 md:p-2 rounded-lg transition-colors group border border-slate-100 md:border-transparent ${sub.valor_unitario < 0 ? 'highlight-carga' : ''}`}>
                              
                              {/* Concepto */}
                              <div className={`col-span-1 ${isFixed ? 'md:col-span-8' : 'md:col-span-4'} w-full`}>
                                <span className="md:hidden text-[10px] font-bold text-indigo-400 uppercase mb-1 block">Concepto</span>
                                <input 
                                  value={sub.concepto}
                                  onChange={(e) => actualizarSubpartida(activo.id, sub.id, 'concepto', e.target.value)}
                                  placeholder="Descripción..."
                                  className="w-full bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300"
                                />
                              </div>

                              <div className={`col-span-1 ${isFixed ? 'md:col-span-4' : 'md:col-span-8'} grid ${isFixed ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-8'} gap-4 w-full`}>
                                  {!isFixed && (
                                    <>
                                      {/* Cantidad */}
                                      <div className="col-span-1 md:col-span-2">
                                        <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">Cantidad</span>
                                        <FormattedNumberInput 
                                          value={sub.cantidad || 0}
                                          onChange={(val) => actualizarSubpartida(activo.id, sub.id, 'cantidad', val)}
                                          className="w-full text-left md:text-right bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none text-sm font-bold text-slate-600"
                                        />
                                      </div>

                                      {/* Unidad Selector */}
                                      <div className="col-span-1 md:col-span-2">
                                        <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">Unidad</span>
                                        <select 
                                          value={sub.unidad}
                                          onChange={(e) => actualizarSubpartida(activo.id, sub.id, 'unidad', e.target.value)}
                                          className="w-full bg-slate-100 rounded border-none text-xs font-medium text-slate-600 focus:ring-1 focus:ring-indigo-500 py-1 px-2"
                                        >
                                          <option value="ud">Unidades (ud)</option>
                                          <option value="m2">Superficie (m²)</option>
                                          <option value="ha">Hectáreas (ha)</option>
                                          <option value="global">Partida Alzada (€)</option>
                                        </select>
                                      </div>
                                    </>
                                  )}

                                  {/* Valor Unitario / Importe */}
                                  <div className={`col-span-1 ${isFixed ? 'md:col-span-2' : 'md:col-span-2'} relative flex flex-col md:flex-row items-start md:items-center justify-end`}>
                                    <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block w-full">{isFixed ? "Importe" : "Valor Unit."}</span>
                                    <div className="relative w-full">
                                        <FormattedNumberInput 
                                          value={sub.valor_unitario || 0}
                                          onChange={(val) => {
                                            if (isFixed) {
                                              // Ensure quantity is 1 for fixed cash items
                                              actualizarSubpartida(activo.id, sub.id, 'cantidad', 1);
                                            }
                                            actualizarSubpartida(activo.id, sub.id, 'valor_unitario', val);
                                          }}
                                          className="w-full text-left md:text-right bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none text-sm font-medium text-indigo-600 pr-6"
                                        />
                                        <span className="absolute right-0 top-0 text-[10px] text-slate-400 pointer-events-none mt-1">€</span>
                                    </div>
                                  </div>

                                  {/* Total */}
                                  <div className={`col-span-1 ${isFixed ? 'md:col-span-2' : 'md:col-span-2'} flex flex-col md:flex-row items-end md:items-center justify-end gap-2`}>
                                     <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block w-full text-right">Total</span>
                                     <div className="text-sm font-bold text-slate-900 shrink-0">
                                       {formatCurrency(sub.cantidad * sub.valor_unitario)}
                                     </div>
                                     
                                     {/* Delete Action (Always visible on touch/mobile, hover on desktop) */}
                                     {(!isFixed || activo.sub_partidas.length > 1) && (
                                       <div className="transition-opacity absolute top-2 right-2 md:static md:opacity-0 group-hover:opacity-100">
                                          <button 
                                            onClick={() => eliminarSubPartida(activo.id, sub.id)}
                                            className="text-slate-300 hover:text-red-500 transition-colors p-2 md:p-1 hover:bg-red-50 rounded-lg md:rounded"
                                            title="Eliminar partida"
                                          >
                                            <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
                                          </button>
                                        </div>
                                     )}
                                  </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          const id = Date.now().toString();
                          setActivos(activos.map(a => {
                            if (a.id !== activo.id) return a;
                            return {
                              ...a,
                              sub_partidas: [...a.sub_partidas, { id, concepto: isFixed ? "Nueva entrada de efectivo" : "Nuevo concepto", cantidad: 1, unidad: isFixed ? "global" : "ud", valor_unitario: 0 }]
                            };
                          }));
                        }}
                        className="w-full py-3 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 text-sm font-bold hover:bg-slate-50 hover:border-indigo-100 hover:text-indigo-400 transition-all flex items-center justify-center gap-2 group"
                      >
                        <div className="bg-slate-100 p-1 rounded-lg group-hover:bg-indigo-100 transition-colors">
                          <Plus className="w-4 h-4" />
                        </div>
                        {isFixed ? "Añadir partida de efectivo" : "Añadir sub-partida / concepto"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Main Add Asset Button at the bottom */}
            <button 
              onClick={agregarActivo}
              className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-6 h-6" /> Añadir Nuevo Activo al Inventario
            </button>
          </div>
        </div>

        {/* Right Column: Análisis */}
        {/* Columna de Resultados */}
        <aside className="lg:col-span-5 space-y-6 results-column">
          
          {/* Main Stats Card */}
          <div className="bg-[#2D2B55] rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Calculator className="w-24 h-24" />
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Caudal Relicto Total</h3>
              <div className="tooltip-container">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-300 opacity-60 cursor-help" />
                <span className="tooltip-text">
                  Suma total de los bienes (menos cargas) más las donaciones colacionables. No incluye el 50% ganancial si está activo.
                </span>
              </div>
            </div>

            <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 md:mb-8 tracking-tight">
              {formatCurrency(caudalRelicto)}
            </div>
            
            <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-indigo-300 text-xs font-medium">Cuota Individual</p>
                  <div className="tooltip-container">
                    <HelpCircle className="w-3 h-3 text-indigo-300 opacity-60 cursor-help" />
                    <span className="tooltip-text">Valor que corresponde por ley a cada heredero según el reparto equitativo.</span>
                  </div>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(cuotaIdeal)}</p>
              </div>
              <div>
                <p className="text-indigo-300 text-xs font-medium mb-1">Participantes</p>
                <p className="text-2xl font-bold">{numHerederosEfectivos}</p>
              </div>
            </div>
          </div>

          {/* AI Justification */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" /> Justificación Experta
              </h3>
              <button 
                onClick={solicitarAnalisisIA}
                disabled={isAnalizando}
                className="text-xs border border-indigo-200 text-indigo-600 font-bold px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                {isAnalizando ? 'Generando...' : 'Generar Informe'}
              </button>
            </div>
            
            <div className="min-h-[120px] flex items-center justify-center text-center">
              {analisisIA ? (
                <div className="text-sm text-slate-600 leading-relaxed text-left w-full">
                  {analisisIA}
                </div>
              ) : (
                <div className="text-slate-400 max-w-[200px]">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">Haz clic en "Generar Informe" para obtener una explicación técnica del reparto actual.</p>
                </div>
              )}
            </div>
          </div>

          {/* Distribution List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600" /> Distribución de Lotes
              </h3>
              <button 
                onClick={sortearHerederos}
                className="text-xs bg-indigo-50 text-indigo-600 font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2"
                title="Sorteo aleatorio de adjudicaciones"
              >
                <Sparkles className="w-3.5 h-3.5" /> Sorteo
              </button>
            </div>
            
            <div className="space-y-4">
              {(() => {
                const lotesOrdenados = [...reparto.lotes].sort((a, b) => {
                  if (a.idHeredero === CONYUGE_ID) return -1;
                  if (b.idHeredero === CONYUGE_ID) return 1;
                  return a.idHeredero - b.idHeredero;
                });
                
                return lotesOrdenados.map((lote) => {
                  const esConyuge = lote.idHeredero === CONYUGE_ID;
                  const activosGananciales = lote.activos.filter(a => a.tipo === 'gananciales');
                  const activosHerencia = lote.activos.filter(a => a.tipo !== 'gananciales');
                  
                  return (
                    <div key={lote.id} className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${esConyuge ? 'border-indigo-400 bg-indigo-50/10 ring-1 ring-indigo-400/20' : 'border-slate-200'}`}>
                      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <input 
                            value={lote.nombreHeredero}
                            onChange={(e) => updateNombreHeredero(lote.id, e.target.value)}
                            readOnly={esConyuge}
                            className={`font-bold text-slate-800 bg-transparent border-none focus:outline-none rounded px-1 -ml-1 w-full max-w-[200px] ${esConyuge ? 'text-indigo-700 cursor-default' : 'hover:bg-slate-50'}`}
                          />
                          {esConyuge && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Titular Ganancial</span>}
                        </div>
                        <span className={`text-xs font-bold whitespace-nowrap ${esConyuge ? 'text-indigo-600' : 'text-slate-500'}`}>
                          Total: {formatCurrency(lote.valorBienes)}
                        </span>
                      </div>
                      
                      <div className="space-y-4 mb-4">
                        {activosGananciales.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest pl-1">Propiedad (Gananciales)</h4>
                            {activosGananciales.map((act) => (
                              <div key={act.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-indigo-100 group">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-slate-700">{act.nombre}</span>
                                  <span className="text-[10px] text-indigo-400 font-bold">50.0% (Privativo)</span>
                                </div>
                                <span className="text-sm font-bold text-indigo-600">{formatCurrency(act.valor)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-2">
                          {activosGananciales.length > 0 && <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Adjudicación (Herencia)</h4>}
                          {activosHerencia.length === 0 && !activosGananciales.length && <p className="text-xs text-slate-400 italic text-center py-2">Sin bienes asignados</p>}
                          {activosHerencia.map((act) => (
                            <div key={act.id} className="flex justify-between items-center bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 hover:bg-indigo-50/30 transition-colors group">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-700">{act.nombre}</span>
                                  {act.manual && (
                                    <div title="Asignación manual">
                                      <Sparkles className="w-3 h-3 text-amber-400" />
                                    </div>
                                  )}
                                  {act.virtual && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold">Donación en vida</span>}
                                </div>
                                <span className="percentage-badge w-fit mt-1">
                                  {((act.valor / (totalActivos.reduce((a, b) => a + b.valorTotal, 0) * (fiscalConfig.gananciales ? 0.5 : 1) || 1)) * 100).toFixed(1)}% de la herencia física
                                </span>
                              </div>
                              <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-700 transition-colors">
                                {formatCurrency(act.valor)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {!esConyuge && (() => {
                        const compensacion = reparto.compensaciones.find(c => c.heredero === lote.id);
                        const diferencia = compensacion?.diferencia || 0;
                        if (Math.abs(diferencia) < 0.01) return null;

                        return (
                          <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-300 uppercase">Equilibrio</span>
                            <span className={`text-xs font-bold ${diferencia >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {diferencia >= 0 ? '+' : ''}
                              {formatCurrency(diferencia)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </aside>
      </main>

      {/* Password Modal */}
      <PasswordModal
        isOpen={showPasswordModal}
        mode={passwordModalMode}
        onConfirm={handlePasswordConfirm}
        onCancel={handlePasswordCancel}
        error={passwordError}
      />

      {/* Configuración Avanzada Modal */}
      <ConfigModal 
        isOpen={showConfigModal}
        config={fiscalConfig}
        herederos={herederos}
        onClose={() => setShowConfigModal(false)}
        onSave={(newConfig) => setFiscalConfig(newConfig)}
      />
    </div>
  );
}
