/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FirstAccessResetProps {
  email: string;
  onSuccess: (updatedUser?: any) => void;
  onCancel: () => void;
}

export default function FirstAccessReset({ email, onSuccess, onCancel }: FirstAccessResetProps) {
  const [password, setPassword] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!password.trim()) {
      setErrorMsg('Por favor, informe a senha atual ou provisória.');
      return;
    }
    if (novaSenha.length < 6) {
      setErrorMsg('A nova senha precisa ter no mínimo 6 caracteres.');
      return;
    }
    if (novaSenha === password) {
      setErrorMsg('A nova senha não pode ser igual à senha atual.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErrorMsg('A nova senha e a confirmação não coincidem.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/first-access-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          novaSenha,
          confirmarSenha
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.user);
      } else {
        setErrorMsg(data.message || 'Erro ao realizar a troca de senha.');
      }
    } catch (err) {
      console.error('Erro ao trocar senha:', err);
      setErrorMsg('Ocorreu um erro ao conectar ao servidor de autenticação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600" />
        
        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Definição de Nova Senha</h2>
            <p className="text-xs text-slate-600 mt-1 max-w-sm">
              Por política de segurança, cadastre sua nova senha de acesso para utilizar o sistema.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-rose-600" />
            <span className="leading-normal font-medium">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono font-bold text-slate-700">Conta de Usuário</label>
            <input
              type="text"
              disabled
              value={email}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-not-allowed"
            />
          </div>

          <div className="space-y-1 relative">
            <label className="text-[10px] uppercase font-mono font-bold text-slate-700">Senha Atual ou Provisória</label>
            <div className="relative">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha atual ou temporária"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1 relative">
            <label className="text-[10px] uppercase font-mono font-bold text-slate-700">Nova Senha</label>
            <div className="relative">
              <input
                required
                type={showNovaSenha ? 'text' : 'password'}
                placeholder="Mínimo de 6 caracteres"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowNovaSenha(!showNovaSenha)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNovaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1 relative">
            <label className="text-[10px] uppercase font-mono font-bold text-slate-700">Confirmação da Nova Senha</label>
            <div className="relative">
              <input
                required
                type={showConfirmarSenha ? 'text' : 'password'}
                placeholder="Digite a nova senha novamente"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showConfirmarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer hover:bg-slate-100 transition-all duration-150"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all duration-150 disabled:opacity-50 flex items-center space-x-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Gravar Nova Senha'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

