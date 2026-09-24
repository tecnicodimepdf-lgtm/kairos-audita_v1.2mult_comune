/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Database, ShieldCheck, ArrowRight, UserCheck, AlertCircle, HelpCircle } from 'lucide-react';

interface SetupWizardProps {
  onSetupComplete: () => void;
}

const OPCOES_PERGUNTAS = [
  "Qual o nome da sua mãe?",
  "Qual o nome do seu pai?",
  "Qual foi seu primeiro emprego?",
  "Qual o nome do seu primeiro animal de estimação?",
  "Em qual cidade você nasceu?",
  "Qual era o nome da sua primeira escola?",
  "Qual foi sua primeira profissão?",
  "Qual é sua comida favorita?"
];

export default function SetupWizard({ onSetupComplete }: SetupWizardProps) {
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [perguntasSeguranca, setPerguntasSeguranca] = useState([
    { pergunta: OPCOES_PERGUNTAS[0], resposta: '' },
    { pergunta: OPCOES_PERGUNTAS[1], resposta: '' },
    { pergunta: OPCOES_PERGUNTAS[2], resposta: '' }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleQuestionChange = (index: number, field: 'pergunta' | 'resposta', value: string) => {
    const updated = [...perguntasSeguranca];
    updated[index][field] = value;
    setPerguntasSeguranca(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nomeCompleto.trim() || !email.trim() || !password) {
      setError('Nome completo, e-mail e senha são obrigatórios.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha de administrador precisa ter no mínimo 6 caracteres por razões de segurança.');
      return;
    }

    // Validar se as 3 perguntas são únicas
    const uniqueQuestions = new Set(perguntasSeguranca.map(p => p.pergunta));
    if (uniqueQuestions.size !== 3) {
      setError('Por favor, selecione 3 perguntas de segurança diferentes.');
      return;
    }

    // Validar se todas as respostas foram preenchidas
    for (const q of perguntasSeguranca) {
      if (!q.resposta.trim()) {
        setError('Por favor, responda a todas as 3 perguntas de segurança.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nomeCompleto, 
          email, 
          password, 
          perguntasSeguranca 
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSetupComplete();
      } else {
        setError(data.message || 'Falha ao concluir configuração inicial.');
      }
    } catch (err: any) {
      setError('Erro de conexão ao servidor: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 py-10 px-4 select-none font-sans" id="setup-wizard-container">
      <div className="max-w-lg w-full bg-slate-800 border border-slate-700/80 rounded-2xl shadow-2xl p-8 space-y-6 animate-scale-in text-white">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)] shrink-0 mb-3">
            <Database className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Auditoria Trabalhista</h2>
          <span className="text-[10px] text-slate-400 font-bold tracking-widest font-mono mt-1">Compliance CLT • Setup</span>
        </div>

        <div className="text-center space-y-1">
          <h3 className="font-bold text-sm text-blue-400 flex items-center justify-center gap-1">
            <UserCheck className="h-4 w-4" />
            <span>Assistente de Primeira Inicialização</span>
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Crie a conta do seu <strong>Usuário Master</strong> principal e configure suas perguntas de segurança para recuperação de senha.
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs flex items-start gap-2">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Nome Completo</label>
              <input
                required
                disabled={loading}
                type="text"
                placeholder="Renato Santos"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700/60 focus:border-blue-500 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-400">E-mail do Administrador</label>
              <input
                required
                disabled={loading}
                type="email"
                placeholder="tecnicodimepdf@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700/60 focus:border-blue-500 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Senha</label>
              <input
                required
                disabled={loading}
                type="password"
                placeholder="******"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700/60 focus:border-blue-500 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Confirmar Senha</label>
              <input
                required
                disabled={loading}
                type="password"
                placeholder="******"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700/60 focus:border-blue-500 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Seção das Perguntas de Segurança */}
          <div className="border-t border-slate-700/60 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase font-mono tracking-wider">
              <HelpCircle className="h-4 w-4" />
              <span>Perguntas de Recuperação de Senha</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Escolha três perguntas exclusivas para garantir que você possa redefinir sua senha de forma segura se esquecê-la.
            </p>

            {perguntasSeguranca.map((item, idx) => (
              <div key={idx} className="bg-slate-900/40 border border-slate-750 p-3.5 rounded-xl space-y-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Pergunta {idx + 1}</label>
                  <select
                    disabled={loading}
                    value={item.pergunta}
                    onChange={(e) => handleQuestionChange(idx, 'pergunta', e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700/60 focus:border-blue-500 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {OPCOES_PERGUNTAS.map((opcao) => (
                      <option key={opcao} value={opcao} className="bg-slate-850 text-slate-200">
                        {opcao}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Resposta {idx + 1}</label>
                  <input
                    required
                    disabled={loading}
                    type="text"
                    placeholder="Sua resposta protegida"
                    value={item.resposta}
                    onChange={(e) => handleQuestionChange(idx, 'resposta', e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700/60 focus:border-blue-500 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/55 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all duration-150 mt-4"
          >
            <span>{loading ? 'Configurando ambiente seguro...' : 'Concluir Configuração e Acessar'}</span>
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
