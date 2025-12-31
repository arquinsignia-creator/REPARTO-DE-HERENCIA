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
  Copy
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PdfGenerator } from '../utils/PdfGenerator';
import { PasswordModal } from '../components/PasswordModal';
import bcrypt from 'bcryptjs';

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
        textoExplicativo: resumen
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
            {activos.map((activo) => (
              <div key={activo.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 flex-1 w-full">
                    <div className="flex items-center justify-between w-full md:w-auto gap-2">
                      <input 
                        type="text" 
                        value={activo.nombre}
                        onChange={(e) => setActivos(activos.map(a => a.id === activo.id ? {...a, nombre: e.target.value} : a))}
                        className="text-lg md:text-xl font-extrabold text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0 flex-1 md:min-w-[300px] truncate"
                        placeholder="Nombre del activo..."
                      />
                      <button onClick={() => eliminarActivo(activo.id)} className="md:hidden text-slate-300 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
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
                      
                      <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                           <Users className="w-3.5 h-3.5 text-slate-400" />
                           <select 
                               value={activo.asignadoA || ""}
                               onChange={(e) => asignarActivo(activo.id, e.target.value)}
                               className="text-[11px] font-bold text-slate-600 bg-transparent border-none rounded py-0.5 pl-1 pr-5 focus:ring-0 focus:outline-none cursor-pointer"
                           >
                               <option value="">Reparto Automático</option>
                               {herederos.map(h => (
                                   <option key={h.id} value={h.id}>Asignar a {h.nombre}</option>
                               ))}
                           </select>
                       </div>
                    </div>
                  </div>
                  <button onClick={() => eliminarActivo(activo.id)} className="hidden md:block text-slate-300 hover:text-red-500 transition-colors">
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
                                 
                                 {/* Delete Action (Always visible on touch/mobile, hover on desktop) */}
                                 <div className="transition-opacity absolute top-2 right-2 md:static md:opacity-0 group-hover:opacity-100">
                                    <button 
                                      onClick={() => eliminarSubPartida(activo.id, sub.id)}
                                      className="text-slate-300 hover:text-red-500 transition-colors p-2 md:p-1 hover:bg-red-50 rounded-lg md:rounded"
                                      title="Eliminar partida"
                                    >
                                      <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
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
          <div className="bg-[#2D2B55] rounded-2xl p-6 md:p-8 text-white shadow-xl">
            <h3 className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-4">Caudal Relicto Total</h3>
            <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 md:mb-8 tracking-tight">
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
                      <div key={idx} className="flex justify-between items-start text-xs py-1.5 px-2 hover:bg-slate-50 rounded">
                        <span className="text-slate-600 font-medium truncate flex-1 pr-2 flex items-center gap-1">
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

      {/* Password Modal */}
      <PasswordModal
        isOpen={showPasswordModal}
        mode={passwordModalMode}
        onConfirm={handlePasswordConfirm}
        onCancel={handlePasswordCancel}
        error={passwordError}
      />
    </div>
  );
}
