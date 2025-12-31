"use client";

import React, { useState } from 'react';
import { X, HelpCircle, Plus, Trash2, Scale } from 'lucide-react';

interface Config {
  gananciales: boolean;
  usufructo: {
    enabled: boolean;
    edadViudo: number;
    valor?: number; // % calculado
  };
  colacion: { id: string; concepto: string; valor: number; herederoId?: number }[];
}

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: Config;
  herederos: { id: number; nombre: string }[];
  onSave: (newConfig: Config) => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, config, herederos, onSave }) => {
  const [localConfig, setLocalConfig] = useState<Config>(config);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  const addColacion = () => {
    const newItem = { id: Date.now().toString(), concepto: "Donación en vida", valor: 0 };
    setLocalConfig({ ...localConfig, colacion: [...localConfig.colacion, newItem] });
  };

  const removeColacion = (id: string) => {
    setLocalConfig({ ...localConfig, colacion: localConfig.colacion.filter(item => item.id !== id) });
  };

  const updateColacion = (id: string, field: string, value: any) => {
    setLocalConfig({
      ...localConfig,
      colacion: localConfig.colacion.map(item => item.id === id ? { ...item, [field]: value } : item)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-indigo-600 p-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6" />
            <h2 className="text-xl font-bold">Configuración Avanzada (Legal/Fiscal)</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 max-h-[70vh] overflow-y-auto overflow-x-visible space-y-8">
          
          {/* Gananciales */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800">Liquidación de Gananciales</h3>
                <div className="tooltip-container">
                  <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
                  <span className="tooltip-text">
                    Si se activa, el sistema entiende que existe un cónyuge sobreviviente y deduce el 50% del valor de los bienes gananciales antes de proceder al reparto hereditario, según la normativa española.
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={localConfig.gananciales}
                  onChange={(e) => setLocalConfig({...localConfig, gananciales: e.target.checked})}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <p className="text-xs text-slate-500 italic">
              * Active esta casilla únicamente en situaciones donde uno de los miembros del matrimonio continúa presente y se deba liquidar la sociedad conyugal de forma previa.
            </p>
          </section>

          <hr className="border-slate-100" />

          {/* Usufructo */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800">Cálculo de Usufructo Viudal</h3>
                <div className="tooltip-container">
                  <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
                  <span className="tooltip-text">
                    Aplica la regla del 89 (89 - edad). El valor del usufructo disminuye la nuda propiedad de los herederos. Mínimo 10%, Máximo 70%.
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={localConfig.usufructo.enabled}
                  onChange={(e) => setLocalConfig({...localConfig, usufructo: {...localConfig.usufructo, enabled: e.target.checked}})}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            
            {localConfig.usufructo.enabled && (
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 animate-fade-in">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Edad del Cónyuge</label>
                  <input 
                    type="number" 
                    value={localConfig.usufructo.edadViudo}
                    onChange={(e) => setLocalConfig({...localConfig, usufructo: {...localConfig.usufructo, edadViudo: parseInt(e.target.value) || 0}})}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ej: 75"
                  />
                </div>
                <div className="flex-1">
                   <label className="text-xs font-bold text-slate-400 uppercase block mb-1">% de Usufructo</label>
                   <div className="text-lg font-bold text-indigo-600 mt-2">
                     {Math.max(10, Math.min(70, 89 - localConfig.usufructo.edadViudo))}%
                   </div>
                </div>
              </div>
            )}
          </section>

          <hr className="border-slate-100" />

          {/* Colación */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800">Masa de Colación (Donaciones en Vida)</h3>
                <div className="tooltip-container">
                  <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
                  <span className="tooltip-text">
                    Importes recibidos por herederos en vida que deben sumarse al total para computar las cuotas legales, aunque no se repartan físicamente.
                  </span>
                </div>
              </div>
              <button 
                onClick={addColacion}
                className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100"
              >
                <Plus className="w-3 h-3" /> Añadir Dato
              </button>
            </div>

            <div className="space-y-3">
              {localConfig.colacion.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No se han registrado donaciones colacionables.
                </p>
              )}
              {localConfig.colacion.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-3 items-end bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <div className="col-span-12 md:col-span-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Concepto</label>
                    <input 
                      value={item.concepto}
                      onChange={(e) => updateColacion(item.id, 'concepto', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                      placeholder="Ej: Pago hipoteca"
                    />
                  </div>
                  <div className="col-span-12 md:col-span-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">A favor de</label>
                    <select 
                      value={item.herederoId || ""}
                      onChange={(e) => updateColacion(item.id, 'herederoId', parseInt(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {herederos.map(h => (
                        <option key={h.id} value={h.id}>{h.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-12 md:col-span-4 relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Valor</label>
                    <div className="relative">
                      <input 
                        type="number"
                        inputMode="decimal"
                        value={item.valor}
                        onChange={(e) => updateColacion(item.id, 'valor', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-right font-bold text-slate-700 pr-8"
                      />
                      <span className="absolute right-3 top-2 text-slate-400 text-sm">€</span>
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-1 flex justify-end pb-2">
                    <button onClick={() => removeColacion(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 flex items-center justify-end gap-3 border-t border-slate-200">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-lg shadow-indigo-200"
          >
            Aplicar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
