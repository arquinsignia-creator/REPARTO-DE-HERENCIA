"use client";

import React, { useState } from 'react';
import { Eye, EyeOff, AlertTriangle, Lock, ShieldAlert, X } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  mode: 'set' | 'verify';
  onConfirm: (password: string | null) => void;
  onCancel: () => void;
  error?: string;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  mode,
  onConfirm,
  onCancel,
  error
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (mode === 'set') {
      if (password && password !== confirmPassword) {
        return; // Las contraseñas no coinciden
      }
      onConfirm(password || null); // null = omitir contraseña
    } else {
      onConfirm(password);
    }
    
    // Reset
    setPassword('');
    setConfirmPassword('');
  };

  const handleSkip = () => {
    onConfirm(null);
    setPassword('');
    setConfirmPassword('');
  };

  const passwordsMatch = password === confirmPassword;
  const canSubmit = mode === 'verify' 
    ? password.length > 0 
    : (password.length === 0 || (password.length > 0 && passwordsMatch));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={mode === 'set' ? onCancel : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-200">
        {/* Close button (solo en modo set) */}
        {mode === 'set' && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-3 rounded-xl ${mode === 'set' ? 'bg-amber-100' : 'bg-indigo-100'}`}>
            {mode === 'set' ? (
              <ShieldAlert className="w-6 h-6 text-amber-600" />
            ) : (
              <Lock className="w-6 h-6 text-indigo-600" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {mode === 'set' ? 'Proteger Sesión' : 'Sesión Protegida'}
            </h2>
            <p className="text-sm text-slate-500">
              {mode === 'set' ? 'Opcional pero recomendado' : 'Ingrese su contraseña'}
            </p>
          </div>
        </div>

        {/* Warnings (solo en modo set) */}
        {mode === 'set' && (
          <div className="space-y-3 mb-6">
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-amber-900 mb-1">⚠️ Riesgo de Seguridad</p>
                  <p className="text-amber-800">
                    Si <strong>omite la contraseña</strong>, cualquier persona con el enlace del PDF puede establecer una contraseña y <strong>bloquearle el acceso permanentemente</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-red-900 mb-1">⚠️ Sin Recuperación</p>
                  <p className="text-red-800">
                    Si <strong>pierde su contraseña</strong>, perderá el acceso a esta sesión de forma <strong>permanente</strong>. No hay forma de recuperarla.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border-l-4 border-emerald-400 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-emerald-900 mb-1">✅ Recomendación</p>
                  <p className="text-emerald-800">
                    <strong>Siempre establezca una contraseña</strong> para proteger sus datos y evitar accesos no autorizados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Password Input */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {mode === 'set' ? 'Contraseña (opcional)' : 'Contraseña'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'set' ? 'Dejar vacío para omitir' : 'Ingrese su contraseña'}
                className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (solo en modo set) */}
          {mode === 'set' && password.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita su contraseña"
                  className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900 ${
                    confirmPassword && !passwordsMatch ? 'border-red-400' : 'border-slate-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-600 mt-1">Las contraseñas no coinciden</p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {mode === 'set' && (
            <button
              onClick={handleSkip}
              className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Omitir (No Recomendado)
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 px-4 py-3 font-bold rounded-lg transition-colors ${
              mode === 'set'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed'
            }`}
          >
            {mode === 'set' 
              ? (password ? 'Establecer Contraseña' : 'Continuar Sin Contraseña')
              : 'Verificar'
            }
          </button>
        </div>
      </div>
    </div>
  );
};
