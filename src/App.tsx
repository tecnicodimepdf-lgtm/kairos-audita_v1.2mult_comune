/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Database, ShieldCheck, Mail, Calendar, LogOut, ArrowLeft, ShieldAlert, X, Bell, Menu, RefreshCw } from 'lucide-react';
import { BIFilters, DimepConfig } from './types';
import { PeriodProvider, usePeriod } from './contexts/PeriodContext';
import { CompanyProvider, useCompany } from './contexts/CompanyContext';
import Sidebar from './components/Sidebar';
import FiltrosGerais from './components/FiltrosGerais';
import DashboardExecutivo from './components/DashboardExecutivo';
import DashboardRH from './components/DashboardRH';
import DashboardGerencial from './components/DashboardGerencial';
import Funcionarios from './components/Funcionarios';
import Auditorias from './components/Auditorias';
import Relatorios from './components/Relatorios';
import Configuracao from './components/Configuracao';
import AdminPanel from './components/AdminPanel';
import SetupWizard from './components/SetupWizard';
import Login from './components/Login';
import FirstAccessReset from './components/FirstAccessReset';
import { hasPermission } from './utils/permissions';

function AppContent() {
  const { empresaNome, empresaCnpj, isDemoActive, refreshCompanyConfig, clearCompanyState } = useCompany();
  const [activeTab, setActiveTabRaw] = useState<string>('executivo');
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Estados de Autenticação e Controle de Sessão
  const [user, setUserState] = useState<{ id: string; email: string; nomeCompleto: string; perfilAcesso: string; status: string; precisaTrocarSenha?: boolean; sincronizarAoEntrar?: boolean } | null>(null);

  const setUser = (newUser: any) => {
    setUserState(prev => {
      const isFunction = typeof newUser === 'function';
      const nextValue = isFunction ? newUser(prev) : newUser;
      
      // Deep comparison simplificada para evitar loops de renderização
      if (JSON.stringify(prev) === JSON.stringify(nextValue)) {
        return prev;
      }
      return nextValue;
    });
  };
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [sessionChecked, setSessionChecked] = useState<boolean>(false);

  const checkSessionAndSetup = async () => {
    const t0 = performance.now();
    try {
      // 1. Verifica se o ambiente necessita de instalação inicial do usuário Master
      const setupRes = await fetch('/api/auth/needs-setup');
      if (setupRes.ok) {
        const setupData = await setupRes.json();
        if (setupData.needsSetup) {
          setNeedsSetup(true);
          setSessionChecked(true);
          console.log(`[Performance] Tempo da autenticação (Setup Check): ${(performance.now() - t0).toFixed(2)}ms`);
          return;
        } else {
          setNeedsSetup(false);
        }
      }

      // 2. Verifica se existe uma sessão válida gravada no armazenamento do navegador
      const token = localStorage.getItem('x-session-token');
      if (token) {
        const t1 = performance.now();
        const res = await fetch('/api/auth/session', {
          headers: { 'x-session-token': token }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setUser(data.user);
            console.log(`[Performance] Tempo da autenticação (Session Restore): ${(performance.now() - t1).toFixed(2)}ms`);
            console.log(`[Performance] Tempo do carregamento das permissões: 0ms (Incluso no objeto user)`);
          } else {
            localStorage.removeItem('x-session-token');
          }
        } else {
          localStorage.removeItem('x-session-token');
        }
      }
    } catch (err) {
      console.error('Erro ao autenticar sessão do usuário:', err);
    } finally {
      setSessionChecked(true);
      console.log(`[Performance] Tempo total de inicialização da sessão: ${(performance.now() - t0).toFixed(2)}ms`);
    }
  };

  useEffect(() => {
    checkSessionAndSetup();
  }, []);

  // Estado de Mensagem de Expiração de Sessão e Feedback de Logout
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);
  const [sessionConfig, setSessionConfig] = useState<{ sessionTimeoutMinutes: number; heartbeatIntervalMinutes: number }>({
    sessionTimeoutMinutes: 30,
    heartbeatIntervalMinutes: 5
  });

  const lastUserActivityRef = React.useRef<number>(Date.now());

  const handleLogout = async (reason?: any) => {
    setIsLoggingOut(true);
    const token = localStorage.getItem('x-session-token') || '';
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'x-session-token': token }
      });
    } catch (err) {
      console.error('Erro ao efetuar logout:', err);
    }
    
    // Limpeza rigorosa e isolamento completo de contexto
    localStorage.clear();
    sessionStorage.clear();
    
    setSyncNotification(null);
    setNavigationHistory([]);
    setFilters({
      empresaId: '',
      departamento: '',
      centroCusto: '',
      cargo: '',
      gestor: '',
      grauRisco: '',
      dataInicio: '',
      dataFim: '',
      buscaFuncionario: '',
      tipoOcorrencia: '',
      status: ''
    });
    setActiveTabRaw('executivo');
    
    if (reason && typeof reason === 'string') {
      setSessionExpiredNotice(reason);
    }
    clearCompanyState();
    setIsLoggingOut(false);
    setUser(null);
  };

  // Monitoramento de Atividade do Usuário no Cliente (Inatividade)
  useEffect(() => {
    if (!user) return;
    lastUserActivityRef.current = Date.now();

    const handleUserActivity = () => {
      lastUserActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('click', handleUserActivity, { passive: true });
    window.addEventListener('scroll', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
    };
  }, [!!user]);

  // Loop do Heartbeat e Validação Ativa de Inatividade
  useEffect(() => {
    if (!user) {
      return;
    }

    const runHeartbeat = async () => {
      const token = localStorage.getItem('x-session-token');
      if (!token) {
        handleLogout('Sessão encerrada por ausência de token de autorização.');
        return;
      }

      // Validação de Inatividade local antes de chamar o servidor (Master é isento)
      const isMaster = user.perfilAcesso === 'Master' || user.email?.toLowerCase() === 'tecnicodimepdf@gmail.com';
      const inactiveMs = Date.now() - lastUserActivityRef.current;
      const timeoutMs = (sessionConfig.sessionTimeoutMinutes || 30) * 60 * 1000;
      
      if (!isMaster && inactiveMs > timeoutMs) {
        handleLogout(`Sessão expirada por inatividade (${sessionConfig.sessionTimeoutMinutes} minutos sem interação).`);
        return;
      }

      try {
        const res = await fetch('/api/auth/heartbeat', {
          method: 'POST',
          headers: { 'x-session-token': token }
        });

        if (!res.ok) {
          handleLogout('Sessão expirada ou encerrada no servidor.');
          return;
        }

        const data = await res.json();
        if (!data.valid || !data.success) {
          handleLogout(data.message || 'Sessão inválida.');
          return;
        }

        if (data.sessionTimeoutMinutes || data.heartbeatIntervalMinutes) {
          setSessionConfig(prev => {
            if (prev.sessionTimeoutMinutes === data.sessionTimeoutMinutes && prev.heartbeatIntervalMinutes === data.heartbeatIntervalMinutes) {
              return prev;
            }
            return {
              sessionTimeoutMinutes: data.sessionTimeoutMinutes || 30,
              heartbeatIntervalMinutes: data.heartbeatIntervalMinutes || 5
            };
          });
        }

        if (data.user) {
          setUser(prev => {
            if (!prev) return data.user;
            const keys = Object.keys(data.user) as (keyof typeof data.user)[];
            const hasChanged = keys.some(key => prev[key] !== data.user[key]);
            return hasChanged ? { ...prev, ...data.user } : prev;
          });
        }
      } catch (err) {
        console.warn('Erro ao executar heartbeat de sessão:', err);
      }
    };

    // Executa heartbeat inicial e agenda interval
    runHeartbeat();
    const intervalMs = Math.max((sessionConfig.heartbeatIntervalMinutes || 5) * 60 * 1000, 30000); // Mínimo 30 segundos
    const intervalId = setInterval(runHeartbeat, intervalMs);

    return () => clearInterval(intervalId);
  }, [!!user, sessionConfig.heartbeatIntervalMinutes, sessionConfig.sessionTimeoutMinutes]);
  
  // Sistema de Notificação Visual de Inconsistências
  const [syncNotification, setSyncNotification] = useState<{
    totalOcorrencias: number;
    totalFuncionarios: number;
    timestamp: string;
  } | null>(null);

  // Tema Escuro / Claro
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('app-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Contexto Global de Período
  const { globalPeriod, setPeriodDates } = usePeriod();

  // Filtros Locais do Módulo
  const [localFilters, setLocalFilters] = useState<Omit<BIFilters, 'dataInicio' | 'dataFim'>>({
    empresaId: '',
    departamento: '',
    centroCusto: '',
    cargo: '',
    gestor: '',
    grauRisco: '',
    buscaFuncionario: '',
    tipoOcorrencia: '',
    status: ''
  });

  // Filtros Cruzados Combinados (Período Global + Filtros Locais)
  const filters: BIFilters = useMemo(() => ({
    ...localFilters,
    dataInicio: globalPeriod.dataInicio,
    dataFim: globalPeriod.dataFim
  }), [localFilters, globalPeriod]);

  // Atualização de Filtros garantindo a persistência do Período Global
  const setFilters = (updater: BIFilters | ((prev: BIFilters) => BIFilters)) => {
    let next: BIFilters;
    if (typeof updater === 'function') {
      next = updater(filters);
    } else {
      next = updater;
    }

    // Se as datas foram fornecidas na chamada (ex: alteração explícita do filtro de período),
    // atualizamos o período global!
    if (next.dataInicio !== undefined || next.dataFim !== undefined) {
      setPeriodDates(
        next.dataInicio !== undefined ? next.dataInicio : globalPeriod.dataInicio,
        next.dataFim !== undefined ? next.dataFim : globalPeriod.dataFim
      );
    }

    setLocalFilters({
      empresaId: next.empresaId ?? '',
      departamento: next.departamento ?? '',
      centroCusto: next.centroCusto ?? '',
      cargo: next.cargo ?? '',
      gestor: next.gestor ?? '',
      grauRisco: next.grauRisco ?? '',
      buscaFuncionario: next.buscaFuncionario ?? '',
      tipoOcorrencia: next.tipoOcorrencia ?? '',
      status: next.status ?? 'ATIVO'
    });
  };

  // Limpa automaticamente os filtros transitórios ao retornar para os Dashboards
  const clearTransientFiltersForTab = (targetTab: string) => {
    if (targetTab === 'executivo') {
      setLocalFilters(prev => ({
        ...prev,
        tipoOcorrencia: '',
        grauRisco: '',
        buscaFuncionario: '',
        departamento: '',
        centroCusto: '',
        cargo: '',
        gestor: ''
      }));
    } else if (targetTab === 'rh') {
      setLocalFilters(prev => ({
        ...prev,
        tipoOcorrencia: '',
        buscaFuncionario: '',
        grauRisco: ''
      }));
    }
  };

  // Função customizada que empilha o histórico e limpa filtros transitórios de navegação
  const setActiveTab = (tab: string) => {
    if (tab !== activeTab) {
      setNavigationHistory((prev) => [...prev, activeTab]);
      clearTransientFiltersForTab(tab);
      setActiveTabRaw(tab);
    }
  };

  const handleBack = () => {
    if (navigationHistory.length > 0) {
      const prev = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory((prevList) => prevList.slice(0, -1));
      clearTransientFiltersForTab(prev);
      setActiveTabRaw(prev);
    }
  };

  // Inicialização de estado de dados pós-login (Config, Empresas e Sincronização)
  const hasAttemptedInitialSync = useRef(false);

  useEffect(() => {
    if (!user) return;

    const initializeData = async () => {
      let config: DimepConfig | null = null;
      let empresas: any[] = [];

      try {
        const [confData, empRes, filterRes] = await Promise.all([
          refreshCompanyConfig(),
          fetch('/api/empresas'),
          fetch('/api/filtros/valores').catch(() => null)
        ]);

        config = confData;

        if (empRes.ok) {
          empresas = await empRes.json();
          if (empresas) {
            localStorage.setItem('@kairos_empresas_cache', JSON.stringify(empresas));
          }
        }

        // Pré-selecionar empresa
        if (filterRes && filterRes.ok) {
           const data = await filterRes.json();
           if (data.empresas && data.empresas.length > 0) {
             setFilters((prev) => {
               if (!prev.empresaId) {
                 return { ...prev, empresaId: data.empresas[0].id };
               }
               return prev;
             });
           }
        } else {
           // Fallback ao cache de empresas
           if (empresas && empresas.length > 0) {
              setFilters((prev) => {
                if (!prev.empresaId) {
                  return { ...prev, empresaId: empresas[0].id || empresas[0].cnpj };
                }
                return prev;
              });
           }
        }

        // Auto Sync
        if (!hasAttemptedInitialSync.current) {
          hasAttemptedInitialSync.current = true;
          if (user.sincronizarAoEntrar && config && config.key && config.identifier) {
            console.log('[Auditoria Trabalhista] Iniciando sincronização automática conforme preferência do usuário...');
            setIsSyncing(true);
            try {
              const syncRes = await fetch('/api/sync', { method: 'POST' });
              if (syncRes.ok) {
                handleSyncCompleted();
              }
            } finally {
              setIsSyncing(false);
            }
          }
        }
      } catch (err) {
        console.error('Erro na inicialização de dados:', err);
      }
    };

    initializeData();
  }, [!!user]);

  const handleSyncCompleted = async () => {
    // Atualiza cache e estado visual após sincronização
    try {
      await refreshCompanyConfig();
    } catch (e) {
      console.error(e);
    }
    
    // Busca os KPIs atuais após sincronizar para acionar a notificação de inconsistência
    try {
      const res = await fetch('/api/dashboard/kpis');
      if (res.ok) {
        const kpis = await res.json();
        if (kpis.totalOcorrencias > 0) {
          setSyncNotification({
            totalOcorrencias: kpis.totalOcorrencias,
            totalFuncionarios: kpis.totalFuncionarios,
            timestamp: new Date().toLocaleTimeString('pt-BR')
          });
        }
      }
    } catch (err) {
      console.error('Erro ao acionar notificação visual pós-sincronização:', err);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        handleSyncCompleted();
      }
    } catch (err) {
      console.error('Erro ao sincronizar:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Valida permissão do usuário para renderizar a aba selecionada
  const hasTabPermission = (tab: string): boolean => {
    if (!user) return false;
    switch (tab) {
      case 'executivo':
        return hasPermission(user, 'dashboard_executivo_visualizar');
      case 'rh':
        return hasPermission(user, 'dashboard_rh_visualizar');
      case 'gerencial':
        return hasPermission(user, 'dashboard_gerencial_visualizar');
      case 'funcionarios':
        return hasPermission(user, ['funcionarios_consultar', 'funcionarios_visualizar', 'funcionarios_ativos']);
      case 'auditorias':
        return hasPermission(user, 'auditoria_visualizar');
      case 'relatorios':
        return hasPermission(user, 'relatorios_visualizar');
      case 'configuracao':
        return hasPermission(user, ['configuracao_visualizar', 'configuracao_empresa', 'configuracao_sincronizar', 'configuracao_rest_api']);
      case 'admin_panel':
        return hasPermission(user, ['painel_master_acesso', 'usuarios_criar', 'perfis_criar', 'painel_master_usuarios', 'painel_master_perfis']);
      default:
        return true;
    }
  };

  // Renderizador condicional dos painéis baseados na navegação
  const renderTabContent = () => {
    if (!hasTabPermission(activeTab)) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-sm my-8">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Acesso Restrito pelo Perfil de Acesso</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Seu perfil de acesso (<strong>{user?.perfilAcesso}</strong>) não possui permissão para acessar esta funcionalidade. Solicite a um administrador com perfil Master a liberação da permissão correspondente no Painel Master.
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case 'executivo':
        return (
          <DashboardExecutivo
            filters={filters}
            setFilters={setFilters}
            setActiveTab={setActiveTab}
            isSyncing={isSyncing}
            user={user}
          />
        );
      case 'rh':
        return (
          <DashboardRH
            filters={filters}
            setFilters={setFilters}
            setActiveTab={setActiveTab}
            isSyncing={isSyncing}
            user={user}
          />
        );
      case 'gerencial':
        return (
          <DashboardGerencial
            filters={filters}
            setFilters={setFilters}
            setActiveTab={setActiveTab}
            isSyncing={isSyncing}
            user={user}
          />
        );
      case 'funcionarios':
        return (
          <Funcionarios
            filters={filters}
            setFilters={setFilters}
            setActiveTab={setActiveTab}
            isSyncing={isSyncing}
            user={user}
          />
        );
      case 'auditorias':
        return (
          <Auditorias
            filters={filters}
            setFilters={setFilters}
            isSyncing={isSyncing}
            user={user}
          />
        );
      case 'relatorios':
        return <Relatorios filters={filters} isSyncing={isSyncing} user={user} />;
      case 'admin_panel':
        return <AdminPanel currentUser={user} />;
      case 'configuracao':
        return (
          <Configuracao
            onSyncCompleted={handleSyncCompleted}
            isSyncing={isSyncing}
            setIsSyncing={setIsSyncing}
            theme={theme}
            setTheme={setTheme}
            user={user}
          />
        );
      default:
        return (
          <DashboardExecutivo
            filters={filters}
            setFilters={setFilters}
            setActiveTab={setActiveTab}
            isSyncing={isSyncing}
            user={user}
          />
        );
    }
  };

  // Modal de Feedback Visual de Logout
  const renderLogoutModal = () => {
    if (!isLoggingOut) return null;
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl space-y-4">
          <div className="w-12 h-12 bg-blue-600/15 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-500 mx-auto animate-spin">
            <RefreshCw className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Encerrando a sessão</h3>
            <p className="text-xs text-slate-400 mt-2 whitespace-pre-line leading-relaxed">
              Estamos protegendo seus dados e finalizando sua sessão.{"\n\n"}
              Aguarde alguns instantes...
            </p>
          </div>
        </div>
      </div>
    );
  };

  // 1. Tela de Carregamento Inicial enquanto valida sessões
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 font-sans text-white">
        {renderLogoutModal()}
        <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)] animate-spin">
          <Database className="h-6 w-6 text-white" />
        </div>
        <p className="text-xs text-slate-400 mt-4 font-medium tracking-wide">Iniciando motor de auditoria complacente...</p>
      </div>
    );
  }

  // 2. Assistente de configuração inicial se nenhum administrador estiver cadastrado
  if (needsSetup) {
    return (
      <SetupWizard
        onSetupComplete={() => {
          setNeedsSetup(false);
          checkSessionAndSetup();
        }}
      />
    );
  }

  // 3. Controle de Sessão / Tela de Login
  if (!user) {
    return (
      <div className="relative">
        {sessionExpiredNotice && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4">
            <div className="bg-amber-500 text-slate-950 p-4 rounded-xl shadow-2xl border border-amber-400 flex items-start space-x-3 text-xs font-semibold animate-bounce">
              <ShieldAlert className="h-5 w-5 shrink-0 text-slate-950 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-sm">Sessão Finalizada</p>
                <p className="mt-0.5">{sessionExpiredNotice}</p>
              </div>
              <button
                onClick={() => setSessionExpiredNotice(null)}
                className="text-slate-900 hover:text-black font-bold p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <Login
          onLoginSuccess={(token, loggedUser) => {
            lastUserActivityRef.current = Date.now();
            setSessionExpiredNotice(null);
            localStorage.setItem('x-session-token', token);
            setUser(loggedUser);
          }}
        />
      </div>
    );
  }

  // 4. Fluxo de troca obrigatória de senha e setup de primeiro acesso
  if (user && user.precisaTrocarSenha) {
    return (
      <FirstAccessReset
        email={user.email}
        onSuccess={(updatedUser?: any) => {
          if (updatedUser) {
            setUser(updatedUser);
          }
          checkSessionAndSetup();
        }}
        onCancel={() => {
          handleLogout();
        }}
      />
    );
  }

  const avatarLetters = user.nomeCompleto
    ? user.nomeCompleto.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'US';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-200" id="app-container">
      {/* Sidebar de Navegação */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isDemoActive={isDemoActive}
        empresaNome={empresaNome}
        empresaCnpj={empresaCnpj}
        user={user}
        onLogout={handleLogout}
      />

      {/* Painel de Conteúdo Principal */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Superior Corporativo */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-8 shrink-0 no-print transition-colors duration-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
              title={isCollapsed ? "Expandir menu" : "Ocultar menu"}
              id="header-sidebar-toggle"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight flex flex-wrap items-center gap-2">
                <span>Painel de Inteligência Operacional</span>
                {empresaNome && (
                  <span className="text-[10px] md:text-xs font-bold px-2.5 py-0.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 rounded-md border border-emerald-200 dark:border-emerald-800 shadow-sm">
                    {empresaNome} {empresaCnpj ? `• CNPJ: ${empresaCnpj}` : ''}
                  </span>
                )}
              </h1>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                Auditoria de jornadas e identificação de passivos trabalhistas CLT
              </p>
            </div>
          </div>

          {/* Dados do usuário e Local time de forma polida */}
          <div className="flex items-center space-x-4 text-xs">
            <div className="hidden md:flex flex-col text-right leading-tight">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{user.email}</span>
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center space-x-1 justify-end font-mono mt-0.5">
                <Calendar className="h-3 w-3" />
                <span>{new Date().toLocaleDateString('pt-BR')}</span>
              </span>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />

            {/* Avatar / Perfil rápido */}
            <div className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-2.5 py-1.5 rounded-lg select-none">
              <div className="h-6 w-6 rounded bg-[#064e3b] text-white flex items-center justify-center font-bold font-display text-[11px] shadow-sm">
                {avatarLetters}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100 leading-tight truncate max-w-[120px]">{user.nomeCompleto}</span>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono leading-none font-bold uppercase">{user.perfilAcesso}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Corpo do Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
          {/* Botão para voltar se houver histórico de navegação */}
          {navigationHistory.length > 0 && (
            <div className="flex items-center no-print">
              <button
                onClick={handleBack}
                className="flex items-center space-x-2 text-xs font-semibold px-4 py-2 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-400 dark:hover:bg-emerald-400/15 rounded-lg transition-all duration-150 cursor-pointer shadow-sm border border-emerald-200/40 dark:border-emerald-900/40"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar para o módulo anterior</span>
              </button>
            </div>
          )}

          {/* Barra de Filtros Inteligentes (não exibida na tela de configurações ou do painel administrativo) */}
          {activeTab !== 'configuracao' && activeTab !== 'admin_panel' && (
            <FiltrosGerais
              filters={filters}
              setFilters={setFilters}
              onSyncNow={handleSyncNow}
              isSyncing={isSyncing}
            />
          )}

          {/* Sistema de Notificação Visual de Inconsistências */}
          {syncNotification && (
            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 p-4 rounded-xl shadow-sm flex items-start justify-between gap-4 animate-bounce-subtle no-print transition-all duration-300">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-400 rounded-lg shrink-0 animate-pulse">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-950 dark:text-rose-200 flex items-center gap-2">
                    <span>Inconsistências Detectadas pelo Motor de Auditoria</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 rounded font-mono font-medium">
                      Atualizado às {syncNotification.timestamp}
                    </span>
                  </h4>
                  <p className="text-xs text-rose-800 dark:text-rose-300/90 mt-1 leading-relaxed">
                    Após a sincronização mais recente dos colaboradores da base do cliente, o sistema de Inteligência CLT identificou <strong>{syncNotification.totalOcorrencias} desvios de jornada</strong> ativos de gravidade variável. Recomendamos a análise imediata no relatório para mitigar riscos trabalhistas.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setActiveTabRaw('auditorias');
                        setSyncNotification(null);
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 dark:bg-rose-900/80 dark:hover:bg-rose-800 text-white font-bold text-[11px] rounded-lg shadow-sm hover:shadow transition-all flex items-center space-x-1.5 cursor-pointer border border-rose-600 dark:border-rose-800"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      <span>Ver Relatório de Auditoria</span>
                    </button>
                    <button
                      onClick={() => setSyncNotification(null)}
                      className="px-3 py-1.5 bg-white hover:bg-rose-100/50 dark:bg-slate-900 dark:hover:bg-slate-800 text-rose-700 dark:text-rose-400 font-bold text-[11px] rounded-lg border border-rose-200/50 dark:border-rose-900/30 transition-all cursor-pointer"
                    >
                      Ignorar por enquanto
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSyncNotification(null)}
                className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-200 rounded-lg transition-all cursor-pointer"
                title="Fechar alerta"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Painel Ativo de Renderização */}
          <div className="animate-fade-in">{renderTabContent()}</div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <PeriodProvider>
      <CompanyProvider>
        <AppContent />
      </CompanyProvider>
    </PeriodProvider>
  );
}
