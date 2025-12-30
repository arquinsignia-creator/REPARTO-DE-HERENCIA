"use client";

import React, { useState, useMemo } from 'react';
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
  Info
} from 'lucide-react';
import { PdfGenerator } from '../utils/PdfGenerator';

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
      id: '1',
      nombre: "Finca La Dehesa",
      divisible: true,
      asignadoA: null as number | null,
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
      asignadoA: null as number | null,
      sub_partidas: [
        { id: 's4', concepto: "Almendro Secano", cantidad: 400000, unidad: "m2", valor_unitario: 12 },
        { id: 's5', concepto: "Barbecho", cantidad: 100000, unidad: "m2", valor_unitario: 5 }
      ]
    },
    {
      id: '3',
      nombre: "Casa en el Pueblo",
      divisible: false,
      asignadoA: null as number | null,
      sub_partidas: [
        { id: 's6', concepto: "Superficie", cantidad: 150, unidad: "m2", valor_unitario: 800 }
      ]
    }
  ]);

  const [analisisIA, setAnalisisIA] = useState("");
  const [isAnalizando, setIsAnalizando] = useState(false);

  // --- Cálculos de Lógica de Negocio ---
  
  const totalActivos = useMemo(() => {
    return activos.map(a => ({
      ...a,
      valorTotal: a.sub_partidas.reduce((acc, sub) => acc + (sub.cantidad * sub.valor_unitario), 0)
    }));
  }, [activos]);

  const caudalRelicto = useMemo(() => {
    return totalActivos.reduce((acc, a) => acc + a.valorTotal, 0);
  }, [totalActivos]);

  const cuotaIdeal = useMemo(() => caudalRelicto / numHerederos, [caudalRelicto, numHerederos]);

  /* 
   * LÓGICA DE REPARTO
   * 1. Respetar asignaciones manuales.
   * 2. Repartir el resto para intentar igualar.
   */
  const reparto = useMemo(() => {
    // Inicializar lotes con nombres
    let lotes = herederos.map(h => ({
      id: h.id,
      nombreHeredero: h.nombre,
      activos: [] as any[],
      valorBienes: 0
    }));

    // Separar activos asignados y pendientes
    let activosAsignados = totalActivos.filter(a => a.asignadoA !== null);
    let activosPendientes = totalActivos.filter(a => a.asignadoA === null).sort((a, b) => b.valorTotal - a.valorTotal);

    // 1. Procesar Asignaciones Manuales
    activosAsignados.forEach(activo => {
      const lote = lotes.find(l => l.id === activo.asignadoA);
      // Solo asignar si el heredero existe (por si se borró)
      if (lote) {
        lote.activos.push({ nombre: activo.nombre, valor: activo.valorTotal, fraccion: 1, manual: true });
        lote.valorBienes += activo.valorTotal;
      } else {
        // Fallback: si el heredero asignado no existe, lo tratamos como pendiente
        activosPendientes.push(activo);
      }
    });

    // Re-ordenar pendientes por valor descendente para mejor ajuste
    activosPendientes.sort((a, b) => b.valorTotal - a.valorTotal);

    // 2. Asignar indivisibles pendientes (a quien tenga menos valor acumulado)
    activosPendientes.filter(a => !a.divisible).forEach(activo => {
      lotes.sort((a, b) => a.valorBienes - b.valorBienes);
      lotes[0].activos.push({ nombre: activo.nombre, valor: activo.valorTotal, fraccion: 1, manual: false });
      lotes[0].valorBienes += activo.valorTotal;
    });

    // 3. Asignar divisibles pendientes para equilibrar
    activosPendientes.filter(a => a.divisible).forEach(activo => {
      let valorRestanteActivo = activo.valorTotal;
      
      while (valorRestanteActivo > 0.01) {
        // Siempre buscar el más pobre para darle
        lotes.sort((a, b) => a.valorBienes - b.valorBienes);
        
        let deficit = cuotaIdeal - lotes[0].valorBienes;
        
        if (deficit <= 0) {
          // Todos excedidos (posible con asignaciones manuales grandes). 
          // Repartir equitativamente entre todos para minimizar desvío, o dárselo al que menos tiene.
          // Estrategia: dárselo al que menos tiene aunque se pase.
          let aAsignar = valorRestanteActivo; // Asignar todo lo que queda
          // O repartir entre todos? Repartirlo reduce la "injusticia" individual
          // Vamos a repartir el resto entre todos proporcionalmente (simple)
           let porcion = valorRestanteActivo / lotes.length;
           lotes.forEach(l => {
             l.activos.push({ nombre: activo.nombre, valor: porcion, fraccion: porcion / activo.valorTotal, manual: false });
             l.valorBienes += porcion;
           });
           valorRestanteActivo = 0;
        } else {
          // Llenar el vacío del más pobre sin pasarse del valor restante del activo
          let aAsignar = Math.min(deficit, valorRestanteActivo);
          lotes[0].activos.push({ nombre: activo.nombre, valor: aAsignar, fraccion: aAsignar / activo.valorTotal, manual: false });
          lotes[0].valorBienes += aAsignar;
          valorRestanteActivo -= aAsignar;
        }
      }
    });

    // 4. Calcular compensaciones
    const compensaciones = lotes.map(l => ({
      heredero: l.id,
      nombreHeredero: l.nombreHeredero,
      diferencia: cuotaIdeal - l.valorBienes
    }));

    // 5. Ordenar por ID para visualización
    lotes.sort((a, b) => a.id - b.id);

    return { lotes, compensaciones };
  }, [totalActivos, herederos, cuotaIdeal]);

  // --- Funciones de Gestión ---

  const agregarActivo = () => {
    const nuevo = {
      id: Math.random().toString(36).substr(2, 9),
      nombre: "Nuevo Activo",
      divisible: true,
      asignadoA: null,
      sub_partidas: [{ id: Date.now().toString(), concepto: "General", cantidad: 1, unidad: "ud", valor_unitario: 0 }]
    };
    setActivos([...activos, nuevo]);
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

  const asignarActivo = (activoId: string, herederoId: string) => {
    const hId = herederoId === "" ? null : parseInt(herederoId);
    setActivos(activos.map(a => a.id === activoId ? { ...a, asignadoA: hId } : a));
  };

  const eliminarActivo = (id: string) => setActivos(activos.filter(a => a.id !== id));

  const actualizarSubpartida = (activoId: string, subId: string, campo: string, valor: any) => {
    setActivos(activos.map(a => {
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

    lineas.push(`Se ha analizado un caudal relicto total de ${formatCurrency(caudalRelicto)} a repartir entre ${numHerederos} herederos, resultando en una cuota ideal de ${formatCurrency(cuotaIdeal)} por partícipe.`);

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
      lineas.push(`Se ha priorizado la adjudicación íntegra de activos indivisibles (${indivisibles.map(a => a.nombre).join(", ")}) para evitar condominios, lo cual genera los principales desequilibrios.`);
    }

    // 3. Compensaciones
    const debenCompensar = compensaciones.filter(c => c.diferencia < -1); // Tienen de más, pagan (diferencia negativa)
    const debenRecibir = compensaciones.filter(c => c.diferencia > 1); // Tienen de menos, cobran (diferencia positiva)

    if (debenCompensar.length > 0) {
      const totalCompensar = debenCompensar.reduce((acc, c) => acc + Math.abs(c.diferencia), 0);
      lineas.push(`Para perfeccionar la partición, es necesario establecer compensaciones en metálico por un total de ${formatCurrency(totalCompensar)}.`);
      lineas.push(`Concretamente, los herederos con exceso de adjudicación (${debenCompensar.map(c => c.nombreHeredero).join(", ")}) deberán abonar la diferencia a aquellos con defecto de adjudicación.`);
    } else {
      lineas.push("No se requieren compensaciones en metálico significativas.");
    }

    return lineas.join(" ");
  };

  const solicitarAnalisisIA = async () => {
    setIsAnalizando(true);
    setAnalisisIA("");
    
    // Simular un pequeño tiempo de "procesamiento" para feedback visual
    setTimeout(() => {
      const resumen = generarResumenLocal();
      setAnalisisIA(resumen);
      
      // Generar PDF
      const generator = new PdfGenerator(moneda);
      generator.generate({
        config: {
          numHerederos,
          moneda,
          fecha: new Date().toLocaleDateString('es-ES')
        },
        metricas: {
          caudalRelicto,
          cuotaIdeal
        },
        inventario: activos,
        reparto: reparto,
        textoExplicativo: resumen
      });

      setIsAnalizando(false);
    }, 600);
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
      </header>

      <main className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Inventario */}
        <div className="lg:col-span-7 space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-700">
              <Home className="w-5 h-5" /> Inventario de Activos
            </h2>

          <div className="space-y-6">
            {activos.map((activo) => (
              <div key={activo.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 flex items-center justify-between border-b border-slate-100">
                  <div className="flex items-center gap-4 flex-1">
                    <input 
                      type="text" 
                      value={activo.nombre}
                      onChange={(e) => setActivos(activos.map(a => a.id === activo.id ? {...a, nombre: e.target.value} : a))}
                      className="text-base md:text-lg font-bold text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full max-w-[200px] md:max-w-md truncate"
                    />
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
                    {/* Selector de Asignación */}
                    <div className="flex items-center gap-2">
                         <Users className="w-4 h-4 text-slate-400" />
                         <select 
                             value={activo.asignadoA || ""}
                             onChange={(e) => asignarActivo(activo.id, e.target.value)}
                             className="text-xs font-bold text-slate-600 bg-slate-50 border-none rounded py-1 pl-2 pr-6 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                         >
                             <option value="">Reparto Automático</option>
                             {herederos.map(h => (
                                 <option key={h.id} value={h.id}>Asignar a {h.nombre}</option>
                             ))}
                         </select>
                     </div>
                  </div>
                  <button onClick={() => eliminarActivo(activo.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-5">
                  <div className="mb-4">
                    <div className="hidden md:grid grid-cols-12 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 gap-4">
                      <div className="col-span-4">Concepto</div>
                      <div className="col-span-2 text-right">Cant.</div>
                      <div className="col-span-2">Unidad</div>
                      <div className="col-span-2 text-right">Val. Unit.</div>
                      <div className="col-span-2 text-right">Total</div>
                    </div>
                    
                    <div className="space-y-2">
                      {activo.sub_partidas.map(sub => (
                        <div key={sub.id} className="grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-2 md:gap-4 hover:bg-slate-50 p-3 md:p-2 rounded-lg transition-colors group border border-slate-100 md:border-transparent mb-2 md:mb-0">
                          
                          {/* Concepto - Full width on mobile */}
                          <div className="col-span-1 md:col-span-4 w-full">
                            <span className="md:hidden text-[10px] font-bold text-indigo-400 uppercase mb-1 block">Concepto</span>
                            <input 
                              value={sub.concepto}
                              onChange={(e) => actualizarSubpartida(activo.id, sub.id, 'concepto', e.target.value)}
                              placeholder="Descripción..."
                              className="w-full bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300"
                            />
                          </div>

                          <div className="col-span-1 md:col-span-8 grid grid-cols-2 md:grid-cols-8 gap-4 w-full">
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
                                  className="w-full bg-slate-100 rounded border-none text-xs font-medium text-slate-600 focus:ring-1 focus:ring-indigo-500 py-1"
                                >
                                  <option value="ud">Unidades (ud)</option>
                                  <option value="m2">Superficie (m²)</option>
                                  <option value="ha">Hectáreas (ha)</option>
                                  <option value="global">Partida Alzada (€)</option>
                                </select>
                              </div>

                              {/* Valor Unitario */}
                              <div className="col-span-1 md:col-span-2 relative flex flex-col md:flex-row items-start md:items-center justify-end">
                                <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block w-full">Valor Unit.</span>
                                <div className="relative w-full">
                                    <FormattedNumberInput 
                                      value={sub.valor_unitario || 0}
                                      onChange={(val) => actualizarSubpartida(activo.id, sub.id, 'valor_unitario', val)}
                                      className="w-full text-left md:text-right bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none text-sm font-medium text-indigo-600 pr-8"
                                    />
                                    <span className="absolute right-0 top-0 md:top-auto text-[10px] text-slate-400 pointer-events-none">
                                    {sub.unidad === 'm2' ? '€/m²' : 
                                    sub.unidad === 'ha' ? '€/ha' : 
                                    sub.unidad === 'global' ? '€' : '€/ud'}
                                    </span>
                                </div>
                              </div>

                              {/* Total */}
                              <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row items-end md:items-center justify-end gap-2">
                                 <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block w-full text-right">Total</span>
                                 <div className="text-sm font-bold text-slate-900 shrink-0">
                                   {formatCurrency(sub.cantidad * sub.valor_unitario)}
                                 </div>
                                 
                                 {/* Delete Action (Visible on mobile always, hover on desktop) */}
                                 <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity absolute top-2 right-2 md:static">
                                    <button 
                                      onClick={() => eliminarSubPartida(activo.id, sub.id)}
                                      className="text-slate-300 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded"
                                      title="Eliminar partida"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                              </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
                    <button 
                      onClick={() => {
                        const nuevaSub = { id: Date.now().toString(), concepto: "Nueva partida", cantidad: 1, unidad: "ud", valor_unitario: 0 };
                        setActivos(activos.map(a => a.id === activo.id ? {...a, sub_partidas: [...a.sub_partidas, nuevaSub]} : a));
                      }}
                      className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:text-indigo-800"
                    >
                      <Plus className="w-3 h-3" /> Añadir partida
                    </button>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">Total:</span>
                      <span className="text-lg font-bold text-slate-900">
                        {formatCurrency(activo.sub_partidas.reduce((a, s) => a + (s.cantidad * s.valor_unitario), 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

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
        <aside className="lg:col-span-5 space-y-6">
          
          {/* Main Stats Card */}
          <div className="bg-[#2D2B55] rounded-2xl p-8 text-white shadow-xl">
            <h3 className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-4">Caudal Relicto Total</h3>
            <div className="text-5xl font-bold mb-8 tracking-tight">
              {formatCurrency(caudalRelicto)}
            </div>
            
            <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
              <div>
                <p className="text-indigo-300 text-xs font-medium mb-1">Cuota Individual</p>
                <p className="text-2xl font-bold">{formatCurrency(cuotaIdeal)}</p>
              </div>
              <div>
                <p className="text-indigo-300 text-xs font-medium mb-1">Herederos</p>
                <p className="text-2xl font-bold">{numHerederos}</p>
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
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" /> Distribución de Lotes
            </h3>
            
            <div className="space-y-4">
              {reparto.lotes.map((lote) => (
                <div key={lote.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                    <input 
                      value={lote.nombreHeredero}
                      onChange={(e) => updateNombreHeredero(lote.id, e.target.value)}
                      className="font-bold text-slate-800 bg-transparent border-none focus:outline-none hover:bg-slate-50 rounded px-1 -ml-1 w-full max-w-[200px]"
                    />
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                      Bienes: {formatCurrency(lote.valorBienes)}
                    </span>
                  </div>
                  
                  <div className="space-y-1 mb-4">
                    {lote.activos.length === 0 && <p className="text-xs text-slate-400 italic">Sin bienes asignados</p>}
                    {lote.activos.map((act: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start text-xs py-1 px-2 hover:bg-slate-50 rounded">
                        <span className="text-slate-600 font-medium truncate max-w-[60%] flex items-center gap-1">
                          {act.manual && <span className="text-[10px] text-amber-500 font-bold" title="Asignado Manualmente">★</span>}
                          {act.nombre}
                        </span>
                        <span className="font-bold text-slate-700 shrink-0">{formatCurrency(act.valor)}</span>
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const comp = reparto.compensaciones.find(c => c.heredero === lote.id);
                    if (!comp || Math.abs(comp.diferencia) <= 0.01) return null;
                    return (
                      <div className="border-t border-slate-100 pt-3 mt-2 flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Compensación</span>
                        <span className={`font-bold ${comp.diferencia > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {comp.diferencia > 0 ? '+' : ''}
                          {formatCurrency(comp.diferencia)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>

        </aside>
      </main>
    </div>
  );
}
