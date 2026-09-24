/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, LogIn, AlertCircle, Calendar, HelpCircle, ArrowRight, X, KeyRound, CheckCircle2, ShieldAlert, Wrench, Unlock, UserCheck, RefreshCw } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Estado do Modo de Emergência (Break Glass)
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [emergencyConfig, setEmergencyConfig] = useState<any>(null);
  const [emergencyMessage, setEmergencyMessage] = useState<string | null>(null);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyMasterPass, setEmergencyMasterPass] = useState('');

  // Estados da Recuperação de Senha
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: Email, 2: Perguntas & Nova Senha, 3: Sucesso
  const [recoveryQuestions, setRecoveryQuestions] = useState<string[]>([]);
  const [recoveryAnswers, setRecoveryAnswers] = useState<string[]>(['', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Verificar status de emergência ao carregar
  useEffect(() => {
    checkEmergencyStatus();
  }, []);

  const checkEmergencyStatus = async () => {
    try {
      const res = await fetch('/api/auth/emergency-status');
      const data = await res.json();
      if (data && data.emergencyMode) {
        setEmergencyMode(true);
        setEmergencyConfig(data.config);
      } else {
        setEmergencyMode(false);
      }
    } catch (e) {
      // Ignorar erro de fetch na verificação
    }
  };

  const handleExecuteEmergencyAction = async (action: string) => {
    setEmergencyLoading(true);
    setEmergencyMessage(null);
    try {
      const token = localStorage.getItem('dimep_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['x-session-token'] = token;
      }
      const res = await fetch('/api/auth/emergency-action', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          payload: { password: emergencyMasterPass }
        })
      });
      const data = await res.json();
      if (data && data.success) {
        setEmergencyMessage(data.message);
        setEmergencyMode(false); // Desativação automática do modo de emergência
      } else {
        setEmergencyMessage('Erro ao executar ação de emergência.');
      }
    } catch (err) {
      setEmergencyMessage('Erro ao comunicar com o servidor de emergência.');
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.status === 503 && data.emergencyMode) {
        setEmergencyMode(true);
        setError(data.message);
      } else if (res.ok && data.success) {
        onLoginSuccess(data.token, data.user);
      } else {
        setError(data.message || 'E-mail ou senha incorretos.');
      }
    } catch (err: any) {
      setError('Erro ao se conectar ao servidor de auditoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecovery = () => {
    setRecoveryEmail('');
    setRecoveryStep(1);
    setRecoveryQuestions([]);
    setRecoveryAnswers(['', '', '']);
    setNewPassword('');
    setConfirmNewPassword('');
    setRecoveryError(null);
    setShowRecovery(true);
  };

  const handleRecoveryStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    if (!recoveryEmail.trim()) {
      setRecoveryError('O e-mail é obrigatório.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const res = await fetch('/api/auth/recover/step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecoveryQuestions(data.perguntas);
        setRecoveryStep(2);
      } else {
        setRecoveryError(data.message || 'Usuário não encontrado no sistema.');
      }
    } catch (err: any) {
      setRecoveryError('Erro de conexão ao servidor.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleRecoveryCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);

    // Validar respostas preenchidas
    if (recoveryAnswers.some(ans => !ans.trim())) {
      setRecoveryError('Por favor, responda a todas as perguntas de segurança.');
      return;
    }

    // Validar nova senha
    if (!newPassword || newPassword.length < 6) {
      setRecoveryError('A nova senha precisa ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setRecoveryError('As senhas não coincidem.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const res = await fetch('/api/auth/recover/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recoveryEmail.trim(),
          respostas: recoveryAnswers,
          novaSenha: newPassword
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecoveryStep(3);
      } else {
        setRecoveryError(data.message || 'Informações de recuperação inválidas.');
      }
    } catch (err: any) {
      setRecoveryError('Erro de conexão ao servidor.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleAnswerChange = (index: number, val: string) => {
    const updated = [...recoveryAnswers];
    updated[index] = val;
    setRecoveryAnswers(updated);
  };

  if (emergencyMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 font-sans select-none" id="emergency-mode-container">
        <div className="max-w-lg w-full bg-slate-900 border-2 border-amber-500/50 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.2)] p-8 space-y-6 text-white">
          {/* Header de Emergência */}
          <div className="flex flex-col items-center text-center border-b border-amber-500/30 pb-4">
            <div className="w-14 h-14 bg-amber-500/20 border border-amber-500/50 rounded-2xl flex items-center justify-center text-amber-400 mb-3 animate-pulse">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-extrabold text-amber-400 uppercase tracking-wide">
              Modo de Recuperação de Emergência (Break Glass)
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              O acesso convencional ao sistema foi suspenso para manutenção e recuperação administrativa emergencial.
            </p>
          </div>

          {emergencyMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
              <span>{emergencyMessage}</span>
            </div>
          )}

          {/* Opções de Recuperação */}
          <div className="space-y-3">
            <div className="text-[11px] font-mono text-amber-300 font-semibold uppercase tracking-wider">
              Ações de Restauração de Emergência:
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-mono">Senha para Usuário Master:</label>
                <input
                  type="password"
                  value={emergencyMasterPass}
                  onChange={(e) => setEmergencyMasterPass(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={() => handleExecuteEmergencyAction('create_master')}
                disabled={emergencyLoading}
                className="w-full flex items-center justify-between p-3.5 bg-slate-950 hover:bg-amber-950/30 border border-amber-500/30 hover:border-amber-500/70 rounded-xl transition-all cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3">
                  <UserCheck className="h-5 w-5 text-amber-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="text-xs font-bold text-slate-100">Recriar/Restaurar Usuário Master</div>
                    <div className="text-[10px] text-slate-400">Restaura Renato Santos (tecnicodimepdf@gmail.com) e redefine acesso.</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-400" />
              </button>

              <button
                onClick={() => handleExecuteEmergencyAction('unlock_users')}
                disabled={emergencyLoading}
                className="w-full flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3">
                  <Unlock className="h-5 w-5 text-blue-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="text-xs font-bold text-slate-100">Desbloquear Todos os Usuários</div>
                    <div className="text-[10px] text-slate-400">Remove bloqueios por tentativas de login incorretas.</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-blue-400" />
              </button>

              <button
                onClick={() => handleExecuteEmergencyAction('repair_permissions')}
                disabled={emergencyLoading}
                className="w-full flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3">
                  <Wrench className="h-5 w-5 text-purple-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="text-xs font-bold text-slate-100">Reparar Permissões e Perfis</div>
                    <div className="text-[10px] text-slate-400">Restaura perfis Master, Administrador e Usuário Comum com permissões corretas.</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-purple-400" />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>Operação auditada em data/security.json</span>
            <button
              onClick={checkEmergencyStatus}
              className="flex items-center gap-1 text-amber-400 hover:underline"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Verificar Status</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 font-sans select-none" id="login-screen-container">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 animate-scale-in text-white">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)] shrink-0 mb-3 animate-pulse-slow">
            <Database className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Auditoria Trabalhista</h2>
          <span className="text-[10px] text-slate-500 font-bold tracking-widest font-mono mt-1">Portal de Compliance CLT</span>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs flex items-start gap-2">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono font-bold text-slate-400">E-mail Corporativo</label>
            <input
              required
              disabled={loading}
              type="email"
              placeholder="seuemail@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-200"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Senha</label>
              <button
                type="button"
                onClick={handleStartRecovery}
                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-semibold"
              >
                Esqueci minha senha
              </button>
            </div>
            <input
              required
              disabled={loading}
              type="password"
              placeholder="******"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/55 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all duration-150 mt-2"
          >
            <LogIn className="h-4 w-4 shrink-0" />
            <span>{loading ? 'Validando acesso...' : 'Entrar no Sistema'}</span>
          </button>
        </form>

        <div className="border-t border-slate-850 pt-4 flex justify-between items-center text-[10px] text-slate-500 font-mono">
          <span>Serviço Integrado à API de Auditoria</span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>UTC-3</span>
          </span>
        </div>
      </div>

      {/* Modal de Recuperação de Senha */}
      {showRecovery && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative text-white animate-scale-in">
            <button
              onClick={() => setShowRecovery(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <KeyRound className="h-5 w-5 text-blue-400" />
              <h3 className="font-bold text-sm text-slate-100">Recuperação de Senha</h3>
            </div>

            {recoveryError && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{recoveryError}</span>
              </div>
            )}

            {recoveryStep === 1 && (
              <form onSubmit={handleRecoveryStep1Submit} className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Digite seu e-mail corporativo cadastrado para recuperar seu acesso através de suas perguntas de segurança.
                </p>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400">E-mail Cadastrado</label>
                  <input
                    required
                    type="email"
                    placeholder="seuemail@empresa.com"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white focus:outline-none focus:ring-1"
                  />
                </div>
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="w-full flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-850 text-white font-bold text-xs rounded-xl shadow transition-colors"
                >
                  <span>{recoveryLoading ? 'Buscando usuário...' : 'Obter Perguntas de Segurança'}</span>
                  {!recoveryLoading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>
            )}

            {recoveryStep === 2 && (
              <form onSubmit={handleRecoveryCompleteSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Responda exatamente às suas 3 perguntas de segurança e defina sua nova senha de acesso.
                </p>

                {recoveryQuestions.map((pergunta, idx) => (
                  <div key={idx} className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl space-y-2">
                    <div className="text-xs font-bold text-slate-300 flex items-start gap-1">
                      <HelpCircle className="h-4 w-4 shrink-0 text-blue-400" />
                      <span>{pergunta}</span>
                    </div>
                    <input
                      required
                      type="text"
                      placeholder="Sua resposta"
                      value={recoveryAnswers[idx]}
                      onChange={(e) => handleAnswerChange(idx, e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg text-xs text-white focus:outline-none"
                    />
                  </div>
                ))}

                <div className="border-t border-slate-800 pt-3 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Nova Senha (min 6 chars)</label>
                    <input
                      required
                      type="password"
                      placeholder="******"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Confirmar Nova Senha</label>
                    <input
                      required
                      type="password"
                      placeholder="******"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="w-full flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-850 text-white font-bold text-xs rounded-xl shadow transition-colors"
                >
                  <span>{recoveryLoading ? 'Verificando respostas...' : 'Redefinir Senha de Acesso'}</span>
                </button>
              </form>
            )}

            {recoveryStep === 3 && (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mx-auto text-green-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-100">Senha Alterada!</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sua nova senha de acesso foi salva e auditada com sucesso no sistema. Você já pode efetuar seu login.
                  </p>
                </div>
                <button
                  onClick={() => setShowRecovery(false)}
                  className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
                >
                  Ir para o Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
