/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Shield,
  Activity,
  Download,
  Upload,
  UserPlus,
  Trash2,
  Edit2,
  Search,
  CheckCircle,
  XCircle,
  Lock,
  BarChart2,
  FileSpreadsheet,
  AlertCircle,
  Key,
  Database,
  Copy,
  Clock,
  Globe,
  LogOut,
  RefreshCw,
  Server,
  Zap,
  Check,
  AlertTriangle,
  Cpu,
  HardDrive,
  Power,
  Sliders,
  ShieldAlert,
  History,
  Send,
  KeyRound,
  Ban,
  UserCheck,
  Terminal,
  Unlock
} from 'lucide-react';
import { User, Profile, ActivityLog, UsageStats, UserSession } from '../types';
import { useCompany } from '../contexts/CompanyContext';

interface AdminPanelProps {
  currentUser: {
    id: string;
    email: string;
    nomeCompleto: string;
    perfilAcesso: string;
  } | null;
}

export const PERMISSOES_DISPONIVEIS = [
  {
    categoria: 'Acesso Geral & Autenticação',
    itens: [
      { id: 'admin_acesso_total', nome: 'Acesso Total (Administração)', desc: 'Concede todos os privilégios operacionais e administrativos no sistema.' },
      { id: 'login_acesso', nome: 'Acesso ao Sistema', desc: 'Permite realizar login e acessar a plataforma.' },
      { id: 'login_recuperacao', nome: 'Recuperação de Senha', desc: 'Permite utilizar o fluxo de recuperação de senha por perguntas.' },
      { id: 'login_alteracao_senha', nome: 'Alteração de Senha', desc: 'Permite alterar a própria senha no perfil.' }
    ]
  },
  {
    categoria: 'Dashboard Executivo',
    itens: [
      { id: 'dashboard_executivo_visualizar', nome: 'Visualizar Dashboard Executivo', desc: 'Permite visualizar o Dashboard Executivo e seus gráficos.' },
      { id: 'dashboard_executivo_filtros', nome: 'Utilizar Filtros no Executivo', desc: 'Permite aplicar filtros dinâmicos no Dashboard Executivo.' },
      { id: 'dashboard_executivo_expandir_graficos', nome: 'Expandir Gráficos', desc: 'Permite abrir gráficos em modo expandido / detalhado.' },
      { id: 'dashboard_executivo_exportar', nome: 'Exportar Informações', desc: 'Permite exportar dados do Dashboard Executivo.' },
      { id: 'dashboard_executivo_atalhos', nome: 'Navegar pelos Atalhos', desc: 'Permite utilizar os atalhos rápidos do Dashboard.' }
    ]
  },
  {
    categoria: 'Dashboard RH / CLT',
    itens: [
      { id: 'dashboard_rh_visualizar', nome: 'Visualizar Dashboard RH / CLT', desc: 'Permite visualizar o Dashboard de indicadores de RH.' },
      { id: 'dashboard_rh_filtros', nome: 'Aplicar Filtros no RH', desc: 'Permite filtrar dados de passivo trabalhista e horas extras.' },
      { id: 'dashboard_rh_relatorios', nome: 'Acessar Relatórios do RH', desc: 'Permite navegar diretamente aos relatórios analíticos de RH.' },
      { id: 'dashboard_rh_navegar', nome: 'Navegar entre Módulos', desc: 'Permite alternar entre visualizações do Dashboard RH.' }
    ]
  },
  {
    categoria: 'BI / Analítico (Dashboard Gerencial)',
    itens: [
      { id: 'dashboard_gerencial_visualizar', nome: 'Visualizar Dashboard Gerencial', desc: 'Permite visualizar gráficos e KPIs de BI Gerencial.' },
      { id: 'dashboard_gerencial_filtros', nome: 'Aplicar Filtros no BI', desc: 'Permite filtrar métricas por departamento, período e empresa.' },
      { id: 'dashboard_gerencial_exportar', nome: 'Exportar Dados do BI', desc: 'Permite exportar os relatórios e métricas de BI.' }
    ]
  },
  {
    categoria: 'Auditoria de Jornadas',
    itens: [
      { id: 'auditoria_visualizar', nome: 'Visualizar Auditoria', desc: 'Visualização da lista de cartões de ponto e não conformidades.' },
      { id: 'auditoria_filtrar', nome: 'Filtrar e Classificar', desc: 'Permite aplicar filtros por período, setor, turno ou alerta.' },
      { id: 'auditoria_executar', nome: 'Executar Motor de Auditoria', desc: 'Permite disparar motor de cálculo CLT e recalcular jornadas.' },
      { id: 'auditoria_exportar_csv', nome: 'Exportar Resultados em CSV', desc: 'Permite exportar dados brutos da auditoria em CSV.' },
      { id: 'auditoria_gerar_pdf', nome: 'Gerar Relatório em PDF', desc: 'Permite emitir espelho e consolidado de auditoria em PDF.' },
      { id: 'auditoria_imprimir', nome: 'Imprimir Tela', desc: 'Permite enviar tela de auditoria para impressão.' },
      { id: 'auditoria_agrupar_departamento', nome: 'Agrupar por Departamento', desc: 'Permite agrupar os relatórios de auditoria por departamento.' },
      { id: 'auditoria_detalhes', nome: 'Visualizar Detalhes do Ponto', desc: 'Permite abrir os marcadores individuais do cartão de ponto.' }
    ]
  },
  {
    categoria: 'Funcionários',
    itens: [
      { id: 'funcionarios_visualizar', nome: 'Visualizar Funcionários', desc: 'Acesso de leitura à base de colaboradores.' },
      { id: 'funcionarios_consultar', nome: 'Consultar Funcionários', desc: 'Permite pesquisar e consultar fichas cadastrais.' },
      { id: 'funcionarios_ativos', nome: 'Visualizar Colaboradores Ativos', desc: 'Permite filtrar e visualizar funcionários em atividade.' },
      { id: 'funcionarios_desligados', nome: 'Visualizar Colaboradores Desligados', desc: 'Permite visualizar histórico de funcionários desligados.' },
      { id: 'funcionarios_exportar', nome: 'Exportar Lista de Funcionários', desc: 'Permite exportar cadastros de funcionários.' },
      { id: 'funcionarios_historico', nome: 'Visualizar Histórico do Colaborador', desc: 'Permite visualizar movimentações e alterações de cadastro.' },
      { id: 'funcionarios_pesquisa', nome: 'Pesquisar Funcionários', desc: 'Permite utilizar o campo de busca rápida de funcionários.' }
    ]
  },
  {
    categoria: 'Configurações do Sistema',
    itens: [
      { id: 'configuracao_visualizar', nome: 'Visualizar Configurações', desc: 'Leitura das configurações de integração.' },
      { id: 'configuracao_empresa', nome: 'Visualizar Empresa Conectada', desc: 'Permite consultar a empresa e CNPJ parametrizados.' },
      { id: 'configuracao_sincronizar', nome: 'Executar Sincronização', desc: 'Permite iniciar a sincronização em lote com a API externa.' },
      { id: 'configuracao_rest_api', nome: 'Configurar REST API (API Key e Host)', desc: 'Permite alterar a URL da API e chaves de acesso.' },
      { id: 'configuracao_logs', nome: 'Visualizar Logs de Sincronização', desc: 'Permite consultar o histórico de sincronizações de lote.' },
      { id: 'configuracao_atualizar', nome: 'Atualização de Dados do Sistema', desc: 'Permite atualizar tabelas mestre de horário e parâmetros.' },
      { id: 'configuracao_multiempresa', nome: 'Gerenciar Empresas da Integração REST (Multiempresa)', desc: 'Permite cadastrar, editar, excluir e alternar empresas conectadas da integração REST.' }
    ]
  },
  {
    categoria: 'Relatórios Exportáveis',
    itens: [
      { id: 'relatorios_visualizar', nome: 'Visualizar Módulo Relatórios', desc: 'Acesso ao painel principal de relatórios.' },
      { id: 'relatorios_auditoria_pessoa', nome: 'Auditoria Consolidada por Pessoa', desc: 'Permite emitir o relatório individualizado por trabalhador.' },
      { id: 'relatorios_auditoria_departamento', nome: 'Auditoria Consolidada por Depto', desc: 'Permite emitir relatório agrupado por setor.' },
      { id: 'relatorios_auditoria_geral', nome: 'Auditoria Geral Trabalhista', desc: 'Permite emitir relatório sintético de toda a empresa.' },
      { id: 'relatorios_resumo_executivo', nome: 'Resumo Executivo', desc: 'Permite emitir a síntese gerencial de conformidade CLT.' },
      { id: 'relatorios_ocorrencias', nome: 'Ocorrências e Divergências CLT', desc: 'Permite emitir relatório de erros de marcação e faltas.' },
      { id: 'relatorios_gerar_pdf', nome: 'Gerar PDF', desc: 'Permite exportar qualquer relatório em formato PDF.' },
      { id: 'relatorios_gerar_csv', nome: 'Gerar CSV', desc: 'Permite exportar relatórios em planilha CSV.' },
      { id: 'relatorios_exportar_dados', nome: 'Exportar Dados Brutos', desc: 'Permite baixar dados brutos dos relatórios.' }
    ]
  },
  {
    categoria: 'Painel Master',
    itens: [
      { id: 'painel_master_acesso', nome: 'Acessar Painel Master', desc: 'Permite abrir a interface do Painel Master.' },
      { id: 'painel_master_usuarios', nome: 'Gestão de Usuários', desc: 'Acesso à aba de gerenciamento de usuários.' },
      { id: 'painel_master_perfis', nome: 'Gestão de Perfis', desc: 'Acesso à aba de perfis de permissão.' },
      { id: 'painel_master_permissoes', nome: 'Matriz de Permissões', desc: 'Permite alterar a matriz global de permissões.' },
      { id: 'painel_master_backup', nome: 'Exportar Backup', desc: 'Permite realizar o download do banco de dados completo.' },
      { id: 'painel_master_restauracao', nome: 'Restaurar Backup', desc: 'Permite restaurar backups do banco de dados.' },
      { id: 'painel_master_logs', nome: 'Visualizar Logs Técnicos', desc: 'Acesso ao log detalhado de auditoria de operações.' },
      { id: 'painel_master_stats', nome: 'Estatísticas e Métricas de Uso', desc: 'Permite visualizar estatísticas de acessos e volumetria.' },
      { id: 'painel_master_configuracoes', nome: 'Alterar Configurações Avançadas', desc: 'Permite configurar parâmetros globais do sistema.' },
      { id: 'painel_master_administracao', nome: 'Administração do Sistema', desc: 'Acesso a ferramentas avançadas de administração.' },
      { id: 'painel_master_auditoria', nome: 'Auditoria de Acessos', desc: 'Consultar tentativas e ips de acesso.' },
      { id: 'painel_master_banco_dados', nome: 'Banco de Dados / Limpeza', desc: 'Acesso a funções de manutenção e limpeza de base.' },
      { id: 'painel_master_empresa', nome: 'Gestão de Empresa Conectada', desc: 'Permite alterar a empresa mestre e parâmetro de CNPJ.' },
      { id: 'painel_master_seguranca', nome: 'Configurações de Segurança', desc: 'Configuração de bloqueios, expiração e parâmetros.' },
      { id: 'painel_master_break_glass', nome: 'Modo de Emergência (Break Glass)', desc: 'Permite ativar o modo de emergência isolado.' }
    ]
  },
  {
    categoria: 'Administração de Usuários & Perfis',
    itens: [
      { id: 'usuarios_criar', nome: 'Criar Usuários', desc: 'Permite cadastrar novos usuários no sistema.' },
      { id: 'usuarios_editar', nome: 'Editar Usuários', desc: 'Permite editar dados e permissões de usuários.' },
      { id: 'usuarios_excluir', nome: 'Excluir Usuários', desc: 'Permite remover usuários cadastrados.' },
      { id: 'usuarios_bloquear', nome: 'Bloquear Usuários', desc: 'Permite suspender ou desbloquear acessos.' },
      { id: 'usuarios_ativar', nome: 'Ativar Usuários', desc: 'Permite reativar usuários inativos.' },
      { id: 'usuarios_reset_senha', nome: 'Resetar Senha', desc: 'Permite redefinir a senha de qualquer usuário.' },
      { id: 'usuarios_alterar_perfil', nome: 'Alterar Perfil do Usuário', desc: 'Permite alterar o perfil de acesso associado ao usuário.' },
      { id: 'perfis_criar', nome: 'Criar Perfil', desc: 'Criação de perfis de acesso personalizados.' },
      { id: 'perfis_editar', nome: 'Editar Perfil', desc: 'Edição de permissões e escopos de perfis criados.' },
      { id: 'perfis_excluir', nome: 'Excluir Perfil', desc: 'Exclusão de perfis sem usuários vinculados.' },
      { id: 'perfis_clonar', nome: 'Clonar Perfil', desc: 'Permite duplicar um perfil existente como modelo.' }
    ]
  },
  {
    categoria: 'Logs do Sistema',
    itens: [
      { id: 'logs_visualizar', nome: 'Visualizar Logs', desc: 'Leitura do histórico de operações e alterações por usuário.' },
      { id: 'logs_exportar', nome: 'Exportar Logs', desc: 'Permite exportar o histórico de auditoria e logs do sistema.' }
    ]
  }
];

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

export default function AdminPanel({ currentUser }: AdminPanelProps) {
  const companyContext = useCompany();
  const { empresaCnpj, apiKey, empresaNome, refreshCompanyConfig } = companyContext;
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'sessions' | 'profiles' | 'logs' | 'stats' | 'backup' | 'diagnostics'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([]);
  const [blockNewConnections, setBlockNewConnections] = useState<boolean>(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  // States para Logs Centralizados (Requisito 4)
  const [centralizedLogs, setCentralizedLogs] = useState<{
    auditoria: ActivityLog[];
    tecnico: any[];
    sistema: string;
    usage: any;
  }>({
    auditoria: [],
    tecnico: [],
    sistema: '',
    usage: null
  });
  const [logCategory, setLogCategory] = useState<'auditoria' | 'tecnico' | 'sistema' | 'usage'>('auditoria');
  const [isClearingLogs, setIsClearingLogs] = useState(false);

  // States para Diagnóstico da Aplicação
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState<boolean>(false);

  // States para o CRUD de Usuários
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userPasswordInput, setUserPasswordInput] = useState('');
  const [userQuestions, setUserQuestions] = useState([
    { pergunta: OPCOES_PERGUNTAS[0], resposta: '' },
    { pergunta: OPCOES_PERGUNTAS[1], resposta: '' },
    { pergunta: OPCOES_PERGUNTAS[2], resposta: '' }
  ]);

  // States para Redefinição de Senha e Histórico do Usuário
  const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; user: User | null; newPassword: string; forceChange: boolean }>({ open: false, user: null, newPassword: '', forceChange: false });
  const [userHistoryModal, setUserHistoryModal] = useState<{ open: boolean; user: User | null; data: any; loading: boolean }>({ open: false, user: null, data: null, loading: false });
  const [userTestingState, setUserTestingState] = useState<{ userId: string; loading: boolean; result: any }>({ userId: '', loading: false, result: null });

  // States para o CRUD de Perfis
  const [editingProfile, setEditingProfile] = useState<Partial<Profile> | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [permSearch, setPermSearch] = useState('');

  // States para Busca de Logs
  const [logSearch, setLogSearch] = useState('');

  // Feedback visual do Backup
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isUserModalOpen) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isUserModalOpen]);

  const currentUserProfile = profiles.find(p => p.nome === currentUser?.perfilAcesso || p.id === currentUser?.perfilAcesso);

  const hasClientPermission = (permission: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.perfilAcesso === 'Master') return true;
    if (!currentUserProfile) return false;
    if (currentUserProfile.status === 'INATIVO') return false;
    return currentUserProfile.permissoes.includes('*') || currentUserProfile.permissoes.includes(permission);
  };

  // Carregar dados de acordo com a sub-tab ativa
  useEffect(() => {
    switch(activeSubTab) {
      case 'users':
        fetchUsers();
        fetchProfiles(); // Needed for roles mapping
        break;
      case 'sessions':
        fetchSessions();
        break;
      case 'profiles':
        fetchProfiles();
        break;
      case 'logs':
        fetchLogs();
        break;
      case 'stats':
        fetchStats();
        break;
      case 'backup':
        // No specific fetch required on load for backup
        break;
      case 'diagnostics':
        fetchDiagnostics();
        break;
    }
  }, [activeSubTab]);

  const getHeaders = () => {
    const token = localStorage.getItem('x-session-token') || '';
    return {
      'Content-Type': 'application/json',
      'x-session-token': token
    };
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/admin/sessions', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.sessions) {
          setActiveSessions(data.sessions);
        }
        if (data.blockNewConnections !== undefined) {
          setBlockNewConnections(data.blockNewConnections);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar sessões ativas:', err);
    }
  };

  const fetchDiagnostics = async () => {
    setIsLoadingDiagnostics(true);
    try {
      const res = await fetch('/api/admin/diagnostics', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDiagnosticsData(data);
      }
    } catch (err) {
      console.error('Erro ao carregar diagnósticos:', err);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  };

  const handleUpdateUserStatus = async (userId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok) {
        fetchUsers();
        fetchSessions();
      } else {
        alert(data.message || 'Erro ao alterar status.');
      }
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  const handleResetPasswordConfirm = async () => {
    if (!resetPasswordModal.user || !resetPasswordModal.newPassword) return;
    try {
      const res = await fetch(`/api/admin/users/${resetPasswordModal.user.id}/reset-password`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          novaSenha: resetPasswordModal.newPassword,
          exigirTrocaNoProximoAcesso: resetPasswordModal.forceChange
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Senha redefinida com sucesso! Acesso liberado.');
        setResetPasswordModal({ open: false, user: null, newPassword: '', forceChange: false });
        fetchUsers();
      } else {
        alert(data.message || 'Erro ao redefinir senha.');
      }
    } catch (err) {
      console.error('Erro ao redefinir senha:', err);
    }
  };

  const handleUnlockUser = async (u: User) => {
    if (!confirm(`Deseja desbloquear e zerar imediatamente as tentativas de login do usuário "${u.nomeCompleto}" (${u.email})?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${u.id}/unlock`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Usuário ${u.nomeCompleto} desbloqueado e tentativas de login zeradas!`);
        fetchUsers();
      } else {
        alert(data.message || 'Erro ao desbloquear usuário.');
      }
    } catch (err) {
      console.error('Erro ao desbloquear usuário:', err);
      alert('Erro de conexão ao tentar desbloquear usuário.');
    }
  };

  const handleOpenUserHistory = async (u: User) => {
    setUserHistoryModal({ open: true, user: u, data: null, loading: true });
    try {
      const res = await fetch(`/api/admin/users/${u.id}/history`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUserHistoryModal({ open: true, user: u, data, loading: false });
      } else {
        setUserHistoryModal({ open: true, user: u, data: null, loading: false });
      }
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      setUserHistoryModal({ open: true, user: u, data: null, loading: false });
    }
  };

  const handleTestUserConnection = async (userId: string) => {
    setUserTestingState({ userId, loading: true, result: null });
    try {
      const res = await fetch(`/api/admin/users/${userId}/test-connection`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      setUserTestingState({ userId, loading: false, result: data });
    } catch (err: any) {
      setUserTestingState({ userId, loading: false, result: { success: false, message: 'Falha de comunicação com o servidor' } });
    }
  };

  const handleUserManualSync = async (userId: string) => {
    setUserTestingState({ userId, loading: true, result: null });
    try {
      const res = await fetch(`/api/admin/users/${userId}/sync`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      setUserTestingState({ userId, loading: false, result: data });
    } catch (err: any) {
      setUserTestingState({ userId, loading: false, result: { success: false, message: 'Falha ao executar sincronização' } });
    }
  };

  const handleTerminateAllSessions = async () => {
    if (!confirm('Atenção: Deseja realmente encerrar todas as outras sessões ativas no sistema? Todos os outros usuários conectados serão desconectados imediatamente.')) return;
    try {
      const res = await fetch('/api/admin/sessions/terminate-all', {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Todas as outras sessões foram encerradas com sucesso.');
        fetchSessions();
      } else {
        alert(data.message || 'Erro ao encerrar sessões.');
      }
    } catch (err) {
      console.error('Erro ao encerrar sessões:', err);
    }
  };

  const handleToggleBlockNewConnections = async () => {
    try {
      const res = await fetch('/api/admin/sessions/toggle-block-new', {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setBlockNewConnections(data.blockNewConnections);
        alert(data.message);
      } else {
        alert(data.message || 'Erro ao alterar regra.');
      }
    } catch (err) {
      console.error('Erro ao alterar bloqueio de conexões:', err);
    }
  };

  const handleRevokeSession = async (sessionId: string, userEmail: string) => {
    if (!confirm(`Deseja realmente revogar a sessão ativa do usuário ${userEmail}? O acesso será desconectado imediatamente.`)) return;
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        fetchSessions();
      } else {
        alert(data.message || 'Erro ao revogar sessão.');
      }
    } catch (err) {
      console.error('Erro ao revogar sessão:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  };

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/admin/profiles', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (err) {
      console.error('Erro ao carregar perfis:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs/centralized', { headers: getHeaders() });
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setCentralizedLogs(result.data);
          // Manter compatibilidade com componentes que usam o estado 'logs' antigo
          setLogs(result.data.auditoria);
        }
      } else {
        // Fallback para endpoint legado se o novo falhar
        const resOld = await fetch('/api/admin/logs', { headers: getHeaders() });
        if (resOld.ok) {
          const data = await resOld.json();
          setLogs(data);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    }
  };

  const handleClearLogs = async (category: string) => {
    if (!window.confirm(`Tem certeza que deseja limpar permanentemente todos os registros da categoria "${category}"? Esta operação não pode ser desfeita.`)) {
      return;
    }

    setIsClearingLogs(true);
    try {
      const res = await fetch('/api/admin/logs/clear', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ category })
      });
      
      if (res.ok) {
        await fetchLogs();
        setBackupMessage({ type: 'success', text: `Logs da categoria ${category} limpos com sucesso.` });
      } else {
        const error = await res.json();
        setBackupMessage({ type: 'error', text: error.message || 'Erro ao limpar logs.' });
      }
    } catch (err) {
      console.error('Erro ao limpar logs:', err);
      setBackupMessage({ type: 'error', text: 'Erro de comunicação com o servidor.' });
    } finally {
      setIsClearingLogs(false);
      setTimeout(() => setBackupMessage(null), 5000);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/usage', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  // Salvar Usuário (Criar ou Editar)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Se for criação, validar se escolheu e respondeu as perguntas de forma válida
    if (!editingUser.id) {
      const uniqueQs = new Set(userQuestions.map(q => q.pergunta));
      if (uniqueQs.size !== 3) {
        alert('Por favor, selecione 3 perguntas de segurança diferentes.');
        return;
      }
      if (userQuestions.some(q => !q.resposta.trim())) {
        alert('Por favor, preencha as respostas de todas as 3 perguntas de segurança.');
        return;
      }
    }

    const payload = {
      ...editingUser,
      password: userPasswordInput || undefined,
      perguntasSeguranca: !editingUser.id || userQuestions.some(q => q.resposta.trim()) ? userQuestions : undefined
    };

    const isEdit = !!editingUser.id;
    const url = isEdit ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setIsUserModalOpen(false);
        setEditingUser(null);
        setUserPasswordInput('');
        setUserQuestions([
          { pergunta: OPCOES_PERGUNTAS[0], resposta: '' },
          { pergunta: OPCOES_PERGUNTAS[1], resposta: '' },
          { pergunta: OPCOES_PERGUNTAS[2], resposta: '' }
        ]);
        fetchUsers();
        refreshCompanyConfig();
      } else {
        alert(data.message || 'Erro ao salvar usuário.');
      }
    } catch (err) {
      console.error('Erro ao salvar usuário:', err);
    }
  };

  // Excluir Usuário
  const handleDeleteUser = async (id: string) => {
    if (!confirm('Deseja realmente excluir este usuário? Esta ação invalidará sessões vigentes de forma imediata.')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        fetchUsers();
        refreshCompanyConfig();
      } else {
        alert(data.message || 'Erro ao excluir usuário.');
      }
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
    }
  };

  // Salvar Perfil de Permissões
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    try {
      const res = await fetch('/api/admin/profiles', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(editingProfile)
      });
      const data = await res.json();
      if (res.ok) {
        setIsProfileModalOpen(false);
        setEditingProfile(null);
        fetchProfiles();
      } else {
        alert(data.message || 'Erro ao salvar perfil.');
      }
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
    }
  };

  // Excluir Perfil de Permissões
  const handleDeleteProfile = async (id: string) => {
    if (!confirm('Deseja realmente excluir este perfil de acesso personalizado?')) return;
    try {
      const res = await fetch(`/api/admin/profiles/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        fetchProfiles();
      } else {
        alert(data.message || 'Erro ao excluir perfil.');
      }
    } catch (err) {
      console.error('Erro ao excluir perfil:', err);
    }
  };

  // Exportar Backup
  const handleExportBackup = () => {
    const token = localStorage.getItem('x-session-token') || '';
    window.open(`/api/admin/backup/export?token=${token}`, '_blank');
  };

  // Importar Backup - Validação do arquivo e abertura do modal de confirmação
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupMessage(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object' || !parsed.config || !Array.isArray(parsed.users)) {
          setBackupMessage({ type: 'error', text: 'Arquivo de backup inválido. Chaves de segurança ou estrutura relacional ausentes.' });
          return;
        }

        setPendingRestoreData(parsed);
        setIsRestoreConfirmOpen(true);
      } catch (err: any) {
        setBackupMessage({ type: 'error', text: 'Arquivo inválido. Certifique-se de carregar um JSON de backup válido gerado pelo sistema.' });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset do input de arquivo
  };

  // Confirmação explícita do usuário e restauração efetiva com backup automático pré-restauração
  const confirmRestoreBackup = async () => {
    if (!pendingRestoreData) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/admin/backup/import', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(pendingRestoreData)
      });
      const data = await res.json();

      if (res.ok) {
        setBackupMessage({
          type: 'success',
          text: 'Banco de dados restaurado integralmente com sucesso! Um backup automático de segurança pré-restauração foi registrado no servidor.'
        });
        fetchUsers();
        fetchProfiles();
        fetchLogs();
        fetchStats();
      } else {
        setBackupMessage({ type: 'error', text: data.message || 'Erro ao processar restauração do banco de dados.' });
      }
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: 'Erro de comunicação ao efetuar restauração no servidor.' });
    } finally {
      setIsImporting(false);
      setIsRestoreConfirmOpen(false);
      setPendingRestoreData(null);
    }
  };

  // Filtros de busca em memória
  const filteredUsers = users.filter(u =>
    u.nomeCompleto.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.empresa && u.empresa.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const filteredLogs = logs.filter(l =>
    l.usuario.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.operacao.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.modulo.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.detalhes.toLowerCase().includes(logSearch.toLowerCase())
  );

  return (
    <div className="space-y-6" id="admin-panel-root">
      {/* Título de Cabeçalho */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-500" />
          <span>Painel Master & Administração Segura</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Gerenciamento centralizado de usuários, perfis de permissões granulares, auditoria completa, volumetria de utilização e exportação de backups.
        </p>

        {/* Abas Internas */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mt-6 gap-2">
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'users'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Controle de Usuários</span>
          </button>
          <button
            onClick={() => setActiveSubTab('sessions')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'sessions'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Sessões Ativas</span>
            {activeSessions.length > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[10px] font-black">
                {activeSessions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('profiles')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'profiles'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Perfis & Permissões</span>
          </button>
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'logs'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Logs de Auditoria</span>
          </button>
          <button
            onClick={() => setActiveSubTab('stats')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'stats'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            <span>Métricas de Uso</span>
          </button>
          <button
            onClick={() => setActiveSubTab('backup')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'backup'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Database className="h-4 w-4" />
            <span>Backup & Restauração</span>
          </button>
          <button
            onClick={() => setActiveSubTab('diagnostics')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'diagnostics'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Server className="h-4 w-4 text-emerald-500" />
            <span>Diagnóstico da Aplicação</span>
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 overflow-hidden">
        {activeSubTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome, e-mail ou empresa..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                />
              </div>
              {hasClientPermission('admin_acesso_total') || currentUser?.perfilAcesso === 'Master' ? (
                <button
                  onClick={() => {
                    const defaultProfile = profiles.find(p => p.status === 'ATIVO' && p.nome !== 'Master')?.nome || profiles[0]?.nome || 'Consulta';
                    setEditingUser({
                      nomeCompleto: '',
                      email: '',
                      perfilAcesso: defaultProfile,
                      status: 'ATIVO',
                      key: apiKey || '',
                      identifier: empresaCnpj || '',
                      empresa: empresaNome || ''
                    });
                    setUserPasswordInput('');
                    setUserQuestions([
                      { pergunta: OPCOES_PERGUNTAS[0], resposta: '' },
                      { pergunta: OPCOES_PERGUNTAS[1], resposta: '' },
                      { pergunta: OPCOES_PERGUNTAS[2], resposta: '' }
                    ]);
                    setIsUserModalOpen(true);
                  }}
                  className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow transition-all duration-150"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Adicionar Usuário</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] text-slate-500 border border-slate-200 dark:border-slate-700 font-bold uppercase font-mono">
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Acesso Restrito</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-mono text-[10px] tracking-wider font-bold">
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Perfil</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Empresa Conectada / CNPJ</th>
                    <th className="py-3 px-4">Cadastro / Último Acesso</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                        Nenhum usuário correspondente encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{u.nomeCompleto}</div>
                          <div className="text-[10px] text-slate-500 font-medium">{u.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.perfilAcesso === 'Master'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/30'
                              : u.perfilAcesso === 'Administrador'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/30'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50'
                          }`}>
                            {u.perfilAcesso}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                              u.status === 'ATIVO' ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                              {u.status === 'ATIVO' ? (
                                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span>{u.status}</span>
                            </span>
                            {u.bloqueadoAte && new Date(u.bloqueadoAte) > new Date() && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-[9px] font-bold" title={`Bloqueado até ${new Date(u.bloqueadoAte).toLocaleTimeString()}`}>
                                Bloqueio Temporário
                              </span>
                            )}
                            {(!u.bloqueadoAte || new Date(u.bloqueadoAte) <= new Date()) && (u.tentativasLogin || 0) > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[9px] font-bold">
                                {u.tentativasLogin}/5 falhas
                              </span>
                            )}
                            {(u.precisaTrocarSenha || u.forcarTrocaSenha) && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[9px] font-bold">
                                Troca Pendente
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {u.empresa ? (
                            <div className="max-w-[180px] truncate" title={u.empresa}>
                              <div className="font-bold">{u.empresa}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{u.identifier}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Global (Acesso Total)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[10px]">
                          <div>Cad: {new Date(u.dataCadastro).toLocaleDateString()}</div>
                          <div className="text-slate-400 mt-0.5">
                            Acesso: {u.dataUltimoAcesso ? new Date(u.dataUltimoAcesso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {hasClientPermission('admin_acesso_total') || currentUser?.perfilAcesso === 'Master' ? (
                            <div className="flex justify-end items-center gap-1">
                              {/* Desbloqueio e Reset Rápido de Tentativas */}
                              {u.email !== 'tecnicodimepdf@gmail.com' && (
                                <button
                                  onClick={() => handleUnlockUser(u)}
                                  className={`p-1 rounded cursor-pointer transition-colors ${
                                    (u.tentativasLogin && u.tentativasLogin > 0) || (u.bloqueadoAte && new Date(u.bloqueadoAte) > new Date()) || u.status === 'BLOQUEADO'
                                      ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                      : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                  title="Desbloquear e Zerar Tentativas de Login Imediatamente"
                                >
                                  <Unlock className="h-4 w-4" />
                                </button>
                              )}

                              {/* Status Quick Toggle */}
                              {u.email !== 'tecnicodimepdf@gmail.com' && u.id !== currentUser?.id && (
                                <button
                                  onClick={() => handleUpdateUserStatus(u.id, u.status === 'ATIVO' ? 'BLOQUEADO' : 'ATIVO')}
                                  className={`p-1 rounded cursor-pointer transition-colors ${
                                    u.status === 'ATIVO'
                                      ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                      : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                  }`}
                                  title={u.status === 'ATIVO' ? 'Bloquear usuário' : 'Ativar usuário'}
                                >
                                  {u.status === 'ATIVO' ? <Ban className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                </button>
                              )}

                              {/* Redefinir Senha */}
                              <button
                                onClick={() => setResetPasswordModal({ open: true, user: u, newPassword: '', forceChange: false })}
                                className="p-1 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="Redefinir Senha do Usuário"
                              >
                                <KeyRound className="h-4 w-4" />
                              </button>

                              {/* Histórico & Auditoria */}
                              <button
                                onClick={() => handleOpenUserHistory(u)}
                                className="p-1 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="Ver Histórico de Acessos e Alterações"
                              >
                                <History className="h-4 w-4" />
                              </button>

                              {/* Testar REST Connection */}
                              <button
                                onClick={() => handleTestUserConnection(u.id)}
                                disabled={userTestingState.loading && userTestingState.userId === u.id}
                                className="p-1 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                                title="Testar Conexão REST do Usuário com Kairos API"
                              >
                                <Send className="h-4 w-4" />
                              </button>

                              {/* Editar */}
                              <button
                                onClick={() => {
                                  setEditingUser({
                                    ...u,
                                    key: (u.perfilAcesso === 'Master' || u.perfilAcesso === 'Administrador' || !u.key) ? (apiKey || u.key || '') : u.key,
                                    identifier: (u.perfilAcesso === 'Master' || u.perfilAcesso === 'Administrador' || !u.identifier) ? (empresaCnpj || u.identifier || '') : u.identifier,
                                    empresa: (u.perfilAcesso === 'Master' || u.perfilAcesso === 'Administrador' || !u.empresa) ? (empresaNome || u.empresa || '') : u.empresa
                                  });
                                  setUserPasswordInput('');
                                  const qs = u.perguntasSeguranca && u.perguntasSeguranca.length === 3
                                    ? u.perguntasSeguranca.map(pq => ({ pergunta: pq.pergunta, resposta: '' }))
                                    : [
                                        { pergunta: OPCOES_PERGUNTAS[0], resposta: '' },
                                        { pergunta: OPCOES_PERGUNTAS[1], resposta: '' },
                                        { pergunta: OPCOES_PERGUNTAS[2], resposta: '' }
                                      ];
                                  setUserQuestions(qs);
                                  setIsUserModalOpen(true);
                                }}
                                className="p-1 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="Editar usuário"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>

                              {/* Excluir */}
                              <button
                                disabled={u.email === 'tecnicodimepdf@gmail.com' || u.id === currentUser?.id}
                                onClick={() => handleDeleteUser(u.id)}
                                className={`p-1 rounded cursor-pointer ${
                                  u.email === 'tecnicodimepdf@gmail.com' || u.id === currentUser?.id
                                    ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                    : 'text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                                title="Excluir usuário"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-550 text-[10px] italic">Somente leitura</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Gerenciamento Ativo de Sessões e Desconexão */}
        {activeSubTab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar sessão por e-mail, IP, ID de sessão ou navegador..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleToggleBlockNewConnections}
                  className={`px-3 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors border ${
                    blockNewConnections
                      ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                  title={blockNewConnections ? 'Conexões atualmente bloqueadas' : 'Permitindo novos logins'}
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>{blockNewConnections ? 'Novas Conexões: BLOQUEADAS' : 'Bloquear Novas Conexões'}</span>
                </button>

                <button
                  onClick={handleTerminateAllSessions}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  title="Encerrar todas as outras sessões ativas do sistema"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Desconectar Todas as Outras Sessões</span>
                </button>

                <button
                  onClick={fetchSessions}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Atualizar</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-mono text-[10px] tracking-wider font-bold">
                    <th className="py-3 px-4">Sessão ID / Usuário</th>
                    <th className="py-3 px-4">Empresa / Perfil</th>
                    <th className="py-3 px-4">Origem / Endereço IP</th>
                    <th className="py-3 px-4">Horário de Login</th>
                    <th className="py-3 px-4">Última Atividade</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  {activeSessions.filter(s =>
                    s.userEmail.toLowerCase().includes(sessionSearch.toLowerCase()) ||
                    s.nomeCompleto.toLowerCase().includes(sessionSearch.toLowerCase()) ||
                    s.ip.includes(sessionSearch) ||
                    s.sessionId.includes(sessionSearch)
                  ).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400 font-medium">
                        Nenhuma sessão ativa encontrada para os critérios informados.
                      </td>
                    </tr>
                  ) : (
                    activeSessions
                      .filter(s =>
                        s.userEmail.toLowerCase().includes(sessionSearch.toLowerCase()) ||
                        s.nomeCompleto.toLowerCase().includes(sessionSearch.toLowerCase()) ||
                        s.ip.includes(sessionSearch) ||
                        s.sessionId.includes(sessionSearch)
                      )
                      .map((sess) => (
                        <tr key={sess.sessionId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="py-3.5 px-4 font-medium">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{sess.nomeCompleto}</span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-400 font-mono font-bold px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                                ATIVA
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{sess.userEmail} • ID: {sess.sessionId}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{sess.empresa || 'Master Global'}</div>
                            <div className="text-[10px] text-slate-400">{sess.perfilAcesso}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-bold">
                              <Globe className="h-3 w-3 text-slate-400" />
                              <span>{sess.ip}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 truncate max-w-[150px]" title={sess.userAgent}>{sess.userAgent}</div>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                            {new Date(sess.loginTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3.5 px-4 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                            {new Date(sess.lastActivityTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleRevokeSession(sess.sessionId, sess.userEmail)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold text-[11px] rounded-lg border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                              title="Encerrar sessão imediatamente"
                            >
                              <LogOut className="h-3 w-3" />
                              <span>Encerrar Sessão</span>
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'profiles' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 p-4 rounded-xl flex-1 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <strong>Gerenciamento de Perfis de Permissões:</strong> Os perfis definem as políticas de controle e visualização da plataforma. O perfil <strong>Master</strong> possui acesso irrestrito às bases, logs e configurações. O perfil <strong>Administrador</strong> gerencia usuários, mas não exclui logs. O perfil <strong>Comum</strong> fica restrito à sua empresa/CNPJ de vínculo.
                </div>
              </div>

              {(hasClientPermission('perfis_criar') || currentUser?.perfilAcesso === 'Master') && (
                <button
                  onClick={() => {
                    setEditingProfile({
                      nome: '',
                      descricao: '',
                      permissoes: [],
                      status: 'ATIVO'
                    });
                    setIsProfileModalOpen(true);
                  }}
                  className="flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow transition-all duration-150"
                >
                  <Shield className="h-4 w-4" />
                  <span>Novo Perfil</span>
                </button>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {profiles.map((p) => {
                const isMasterProfile = p.id === 'prof_master' || p.nome.toLowerCase() === 'master';
                const isNativeSystem = ['prof_master', 'prof_admin', 'prof_comum'].includes(p.id);
                return (
                  <div key={p.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 relative flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span>{p.nome}</span>
                        </h4>
                        <div className="flex items-center gap-1.5">
                          {isNativeSystem && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5" />
                              <span>Sistema</span>
                            </span>
                          )}
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                            p.status === 'INATIVO'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 border-rose-200 dark:border-rose-900/30'
                              : 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300 border-green-200 dark:border-green-900/30'
                          }`}>
                            {p.status || 'ATIVO'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 h-8 overflow-hidden line-clamp-2 leading-tight">
                        {p.descricao}
                      </p>

                      {/* Auditoria do Perfil */}
                      <div className="bg-white dark:bg-slate-900/50 rounded-lg p-2.5 border border-slate-150 dark:border-slate-850/50 mb-4 space-y-1 text-[9px] font-mono text-slate-400">
                        <div>Criador: <span className="text-slate-600 dark:text-slate-300 font-bold">{p.criadorEmail || 'Sistema (Nativo)'}</span></div>
                        <div className="flex justify-between">
                          <span>Criado em: <span className="text-slate-500 dark:text-slate-300 font-semibold">{p.dataCriacao ? new Date(p.dataCriacao).toLocaleDateString() : 'Nativo'}</span></span>
                          {p.dataUltimaAlteracao && (
                            <span>Modif: <span className="text-slate-500 dark:text-slate-300 font-semibold">{new Date(p.dataUltimaAlteracao).toLocaleDateString()}</span></span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 border-t border-slate-200/60 dark:border-slate-800/60 pt-3">
                        <div className="text-[10px] font-bold uppercase font-mono text-slate-400 mb-1 tracking-wider">Acessos Permitidos ({p.permissoes.length})</div>
                        <div className="max-h-[140px] overflow-y-auto pr-1 space-y-1">
                          {p.permissoes.map((perm, idx) => {
                            let readableName = perm;
                            if (perm === '*') {
                              readableName = 'Acesso Administrativo Total (*)';
                            } else {
                              for (const cat of PERMISSOES_DISPONIVEIS) {
                                const matched = cat.itens.find(it => it.id === perm);
                                if (matched) {
                                  readableName = matched.nome;
                                  break;
                                }
                              }
                            }
                            return (
                              <div key={idx} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/20 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-850">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                <span className="truncate">{readableName}</span>
                              </div>
                            );
                          })}
                          {p.permissoes.length === 0 && (
                            <div className="text-[10px] italic text-slate-400 py-2">Nenhuma permissão associada.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-250/60 dark:border-slate-800/60 flex justify-end items-center gap-2">
                      {(hasClientPermission('perfis_clonar') || hasClientPermission('perfis_criar') || currentUser?.perfilAcesso === 'Master') && (
                        <button
                          onClick={() => {
                            setEditingProfile({
                              id: 'prof_' + Date.now(),
                              nome: `${p.nome} (Cópia)`,
                              descricao: `Cópia das permissões do perfil ${p.nome}`,
                              permissoes: [...p.permissoes],
                              status: 'ATIVO'
                            });
                            setIsProfileModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-200/50 dark:hover:bg-slate-850 cursor-pointer"
                          title="Clonar Perfil"
                        >
                          <Copy className="h-3.5 w-3.5 text-blue-500" />
                          <span>Clonar</span>
                        </button>
                      )}
                      {!isMasterProfile && (hasClientPermission('perfis_editar') || currentUser?.perfilAcesso === 'Master') && (
                        <button
                          onClick={() => {
                            setEditingProfile(p);
                            setIsProfileModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 rounded hover:bg-slate-200/50 dark:hover:bg-slate-850 cursor-pointer"
                          title="Editar Perfil"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!isNativeSystem && !isMasterProfile && (hasClientPermission('perfis_excluir') || currentUser?.perfilAcesso === 'Master') && (
                        <button
                          onClick={() => handleDeleteProfile(p.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 rounded hover:bg-slate-200/50 dark:hover:bg-slate-850 cursor-pointer"
                          title="Excluir Perfil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeSubTab === 'logs' && (
          <div className="space-y-6">
            {/* Seletor de Categoria de Logs (Requisito 4) */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2">
              <button
                onClick={() => setLogCategory('auditoria')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
                  logCategory === 'auditoria'
                    ? 'border-emerald-500 text-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Auditoria Administrativa</span>
              </button>
              <button
                onClick={() => setLogCategory('tecnico')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
                  logCategory === 'tecnico'
                    ? 'border-blue-500 text-blue-600 bg-blue-50/30 dark:bg-blue-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Sincronização & Técnico</span>
              </button>
              <button
                onClick={() => setLogCategory('sistema')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
                  logCategory === 'sistema'
                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                }`}
              >
                <Server className="h-3.5 w-3.5" />
                <span>Logs de Sistema (OpLogs)</span>
              </button>
              
              <div className="ml-auto flex items-center gap-2">
                {currentUser?.perfilAcesso === 'Master' && (
                  <button
                    onClick={() => handleClearLogs(logCategory)}
                    disabled={isClearingLogs}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-900/50 rounded-lg transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Limpar Categoria</span>
                  </button>
                )}
                <button
                  onClick={fetchLogs}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all"
                  title="Atualizar Logs"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {logCategory === 'auditoria' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Pesquisar logs por e-mail do usuário, IP, operação, módulo ou detalhe..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 dark:border-slate-850 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-mono text-[10px] tracking-wider font-bold">
                        <th className="py-3 px-4">Horário (ISO)</th>
                        <th className="py-3 px-4">Usuário / IP</th>
                        <th className="py-3 px-4">Módulo</th>
                        <th className="py-3 px-4">Operação</th>
                        <th className="py-3 px-4">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-mono">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-400 font-medium font-sans text-xs">
                            Nenhum registro de log encontrado para esta categoria.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.slice(0, 200).map((log, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              {new Date(log.dataHora).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-bold text-slate-900 dark:text-white font-sans">{log.usuario}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">IP: {log.ip}</div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-sans">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-700/50">
                                {log.modulo}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap font-sans">
                              {log.operacao}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-sans leading-tight max-w-sm truncate" title={log.detalhes}>
                              {log.detalhes}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {logCategory === 'tecnico' && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold text-xs mb-1">
                      <Zap className="h-4 w-4" />
                      <span>Monitoramento de Sincronia</span>
                    </div>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">
                      Rastreamento em tempo real das comunicações REST com o Kairos. Falhas recorrentes podem indicar bloqueio de credenciais ou instabilidade externa.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 dark:border-slate-850 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-mono text-[10px] tracking-wider font-bold">
                        <th className="py-3 px-4">Data/Hora</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Registros</th>
                        <th className="py-3 px-4">Detalhes Técnicos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-mono">
                      {centralizedLogs.tecnico.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-10 text-slate-400 font-medium font-sans text-xs">
                            Nenhum registro técnico de sincronização.
                          </td>
                        </tr>
                      ) : (
                        centralizedLogs.tecnico.map((log, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              {new Date(log.dataHora).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                log.status === 'SUCESSO'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800'
                                  : log.status === 'ERRO' || log.status === 'FALHA'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800'
                                  : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800'
                              }`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold">{log.registrosColetados || 0}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 leading-tight">
                              {log.detalhes}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {logCategory === 'sistema' && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-slate-400" />
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Saída de Log Bruto (data/logs.txt)</h4>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">Consolidação de eventos operacionais de baixo nível</div>
                  </div>
                  <pre className="bg-black text-slate-300 p-4 rounded-lg font-mono text-[10px] overflow-auto max-h-[500px] leading-relaxed border border-slate-800 selection:bg-blue-900">
                    {centralizedLogs.sistema || '# Nenhum log operacional registrado.'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'stats' && stats && (
          <div className="space-y-6">
            {/* Bento Grid de Estatísticas Rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl">
                <div className="text-slate-400 text-[10px] font-bold uppercase font-mono tracking-wider">Total de Usuários</div>
                <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{stats.usersCount}</div>
                <div className="text-[10px] text-green-500 mt-1 font-bold">● {stats.activeUsersCount} ativos</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl">
                <div className="text-slate-400 text-[10px] font-bold uppercase font-mono tracking-wider">Empresas Monitoradas</div>
                <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{stats.empresasCount}</div>
                <div className="text-[10px] text-blue-500 mt-1 font-bold">Multitenancy Isolado</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl">
                <div className="text-slate-400 text-[10px] font-bold uppercase font-mono tracking-wider">Relatórios Gerados</div>
                <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{(stats.usageStats?.relatoriosGerados || 0)}</div>
                <div className="text-[10px] text-slate-400 mt-1 font-bold">Arquivos PDF / CSV</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl">
                <div className="text-slate-400 text-[10px] font-bold uppercase font-mono tracking-wider">Acessos e Logins</div>
                <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{(stats.usageStats?.totalAcessos || 0)}</div>
                <div className="text-[10px] text-slate-400 mt-1 font-bold">Tentativas com Sucesso</div>
              </div>
            </div>

            {/* Bento Grid de Segurança e Controle de Acesso */}
            <div className="border-t border-slate-100 dark:border-slate-850 pt-5 space-y-3">
              <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-400 flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-blue-500 animate-pulse" />
                <span>Indicadores de Segurança e Auditoria de Acessos</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-slate-400 text-[10px] font-bold uppercase font-mono tracking-wider">Tentativas de Login</div>
                    <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{(stats.securityStats?.tentativasLoginTotal || 0)}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Auditado pelo SIEM</div>
                  </div>
                  <Activity className="h-8 w-8 text-blue-500/20" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-slate-400 text-[10px] font-bold uppercase font-mono tracking-wider">Recuperações de Senha</div>
                    <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{(stats.securityStats?.recuperacoesSenhaTotal || 0)}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Via Perguntas de Segurança</div>
                  </div>
                  <Key className="h-8 w-8 text-yellow-500/20" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-slate-400 text-[10px] font-bold uppercase font-mono tracking-wider">Bloqueios Realizados</div>
                    <div className="text-2xl font-black mt-1 text-rose-600 dark:text-rose-400">{(stats.securityStats?.bloqueiosRealizadosTotal || 0)}</div>
                    <div className="text-[10px] text-rose-500 mt-0.5">Por limite de tentativas excedido</div>
                  </div>
                  <Lock className="h-8 w-8 text-rose-500/20" />
                </div>
              </div>
            </div>

            {/* Módulos Mais Populares & Consumo por Usuário */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl">
                <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-400 mb-4">Interações por Módulo</h4>
                <div className="space-y-3">
                  {Object.entries(stats.usageStats?.modulosAcessados || {}).map(([mod, cnt]: any) => (
                    <div key={mod} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="capitalize">{mod}</span>
                        <span>{cnt} ações</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, (cnt / (stats.usageStats?.totalAcessos || 100)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {Object.keys(stats.usageStats?.modulosAcessados || {}).length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400 font-bold">Nenhum dado de volumetria de módulo ainda.</div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl">
                <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-400 mb-4">Ações Realizadas por Conta de Usuário</h4>
                <div className="space-y-4 max-h-[220px] overflow-y-auto">
                  {stats.consumoPorUsuario?.map((usr: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/40 pb-2.5 last:border-0 last:pb-0">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{usr.nome}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{usr.email} • Perfil: {usr.perfil}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-900 dark:text-white px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/40 dark:border-blue-900/40 rounded">
                          {usr.acoes} ações
                        </span>
                      </div>
                    </div>
                  ))}
                  {stats.consumoPorUsuario?.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400 font-bold">Sem dados de usuários.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'backup' && (
          currentUser?.perfilAcesso === 'Master' ? (
            <div className="space-y-6 animate-fade-in">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Seção de Exportação */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Download className="h-5 w-5 text-green-500" />
                      <span>Exportar Backup do Ambiente</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      A exportação de backup baixa um arquivo formatado `.json` completo contendo toda a base relacional do sistema: lista de usuários, senhas encriptadas de segurança, perfis de permissão customizados, logs de auditoria e configurações Dimep.
                    </p>
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={handleExportBackup}
                      className="w-full flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow transition-all duration-150 cursor-pointer"
                    >
                      <Download className="h-4.5 w-4.5" />
                      <span>Baixar Backup Completo (.json)</span>
                    </button>
                  </div>
                </div>

                {/* Seção de Importação */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Upload className="h-5 w-5 text-blue-500" />
                      <span>Restaurar Banco de Dados</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      Para restaurar um backup prévio, carregue o arquivo de backup `.json` correspondente. O sistema realizará verificações de consistência relacional e chaves de segurança antes de subscrever o banco local `db.json` com sucesso.
                    </p>
                  </div>
                  <div className="mt-6 space-y-4">
                    <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-350 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-4 transition-all cursor-pointer bg-white dark:bg-slate-900 shadow-sm">
                      <Upload className="h-6 w-6 text-slate-400 mb-1" />
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Carregar arquivo de backup...</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportBackup}
                        className="hidden"
                        disabled={isImporting}
                      />
                    </label>

                    {backupMessage && (
                      <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                        backupMessage.type === 'success'
                          ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900/30'
                          : 'bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/30'
                      }`}>
                        <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                        <span>{backupMessage.text}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 animate-scale-in">
              <div className="w-14 h-14 bg-rose-550/10 border border-rose-500/35 rounded-full flex items-center justify-center text-rose-550 shadow-sm">
                <Lock className="h-6 w-6 text-rose-500" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">Acesso Restrito ao Usuário Master</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  A importação e exportação de backups completos exige privilégios de nível Master. Entre em contato com o administrador responsável pelo sistema para redefinir as configurações.
                </p>
              </div>
            </div>
          )
        )}

        {/* Diagnóstico da Aplicação */}
        {activeSubTab === 'diagnostics' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
                  <span>Diagnóstico Técnico da Aplicação e Servidor</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Monitoramento em tempo real do estado de saúde das APIs, persistência de banco de dados, motor de sincronização, consumo de recursos e segurança.
                </p>
              </div>
              <button
                onClick={fetchDiagnostics}
                disabled={isLoadingDiagnostics}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition-all shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingDiagnostics ? 'animate-spin' : ''}`} />
                <span>{isLoadingDiagnostics ? 'Verificando...' : 'Atualizar Diagnóstico'}</span>
              </button>
            </div>

            {/* Grid de KPIs de Diagnóstico */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: API Kairos REST */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                  <span className="uppercase">API Dimep Kairos</span>
                  <Zap className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-lg font-black ${diagnosticsData?.apiStatus?.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {diagnosticsData?.apiStatus?.status || 'VERIFICANDO'}
                  </span>
                  {diagnosticsData?.apiStatus?.latencyMs !== undefined && (
                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                      {diagnosticsData.apiStatus.latencyMs}ms
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 font-mono">
                  <div>Modo: <strong className="text-slate-700 dark:text-slate-300">{diagnosticsData?.apiStatus?.mode || 'REAL'}</strong></div>
                  <div>URL: <span className="truncate block max-w-[180px]">{diagnosticsData?.apiStatus?.host || 'dimep.com.br'}</span></div>
                </div>
              </div>

              {/* Card 2: Banco de Dados & Persistência */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                  <span className="uppercase">Banco de Dados</span>
                  <HardDrive className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {diagnosticsData?.database?.status || 'ONLINE'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    {diagnosticsData?.database?.sizeKb || 0} KB
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 font-mono">
                  <div>Usuários: <strong className="text-slate-700 dark:text-slate-300">{diagnosticsData?.database?.usersCount || 0}</strong></div>
                  <div>Logs Registrados: <strong className="text-slate-700 dark:text-slate-300">{diagnosticsData?.database?.logsCount || 0}</strong></div>
                </div>
              </div>

              {/* Card 3: Sessões & Circuito de Segurança */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                  <span className="uppercase">Sessões & Conexões</span>
                  <ShieldAlert className="h-4 w-4 text-purple-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                    {diagnosticsData?.sessions?.activeCount || 0} ativas
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 font-mono">
                  <div>Novas Conexões: <strong className={diagnosticsData?.sessions?.blockNewConnections ? 'text-rose-600' : 'text-emerald-600'}>
                    {diagnosticsData?.sessions?.blockNewConnections ? 'BLOQUEADAS' : 'LIBERADAS'}
                  </strong></div>
                  <div>Heartbeat: <strong className="text-slate-700 dark:text-slate-300">OK (Ativo)</strong></div>
                </div>
              </div>

              {/* Card 4: Memória & Processo Server */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                  <span className="uppercase">Servidor Node.js</span>
                  <Cpu className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {diagnosticsData?.server?.memoryUsageMb?.rss || 0} MB
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">RAM RSS</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 font-mono">
                  <div>Uptime: <strong className="text-slate-700 dark:text-slate-300">{Math.floor((diagnosticsData?.server?.uptimeSeconds || 0) / 60)} min</strong></div>
                  <div>PID: <strong className="text-slate-700 dark:text-slate-300">{diagnosticsData?.server?.pid || process.pid}</strong></div>
                </div>
              </div>
            </div>

            {/* Checklist de Integridade do Sistema */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-400 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>Auditoria de Integridade de Componentes</span>
              </h4>

              <div className="grid md:grid-cols-2 gap-3">
                {diagnosticsData?.integrityChecks?.map((chk: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 text-xs">
                    <div className="flex items-center gap-2">
                      {chk.status === 'PASS' ? (
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{chk.component}</div>
                        <div className="text-[10px] text-slate-400">{chk.details}</div>
                      </div>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                      chk.status === 'PASS'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                    }`}>
                      {chk.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Log Recente de Exceções de Sistema */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Últimos Eventos Críticos de Diagnóstico</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-mono font-bold text-slate-400">
                      <th className="py-2 px-3">Data / Hora</th>
                      <th className="py-2 px-3">Origem</th>
                      <th className="py-2 px-3">Mensagem / Diagnóstico</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                    {diagnosticsData?.recentErrors?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 italic font-sans">
                          Nenhum erro crítico registrado recentemente no servidor.
                        </td>
                      </tr>
                    ) : (
                      diagnosticsData?.recentErrors?.map((err: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                          <td className="py-2 px-3 text-slate-500">{new Date(err.timestamp).toLocaleString()}</td>
                          <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">{err.source}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{err.message}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                              ALERTA
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE REDEFINIÇÃO DE SENHA */}
      {resetPasswordModal.open && resetPasswordModal.user && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl animate-scale-in space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <KeyRound className="h-5 w-5 text-amber-500" />
              <span>Redefinir Senha e Liberar Acesso</span>
            </h3>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">{resetPasswordModal.user.nomeCompleto}</div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{resetPasswordModal.user.email}</div>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <Unlock className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                <strong>Acesso Imediato:</strong> Ao redefinir a senha, eventuais contagens de erros de digitação e bloqueios temporários serão <strong>zerados no mesmo instante</strong>.
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Nova Senha de Acesso</label>
              <input
                type="text"
                placeholder="Digite a nova senha de acesso (mínimo 6 caracteres)..."
                value={resetPasswordModal.newPassword}
                onChange={(e) => setResetPasswordModal({ ...resetPasswordModal, newPassword: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetPasswordModal.forceChange}
                  onChange={(e) => setResetPasswordModal({ ...resetPasswordModal, forceChange: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Exigir que o usuário recrie a senha ao fazer login
                </span>
              </label>
              <p className="text-[10px] text-slate-400 mt-0.5 ml-6">
                Deixe desmarcado para que o usuário entre imediatamente com esta senha, sem precisar recriá-la.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setResetPasswordModal({ open: false, user: null, newPassword: '', forceChange: false })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetPasswordConfirm}
                disabled={!resetPasswordModal.newPassword || resetPasswordModal.newPassword.length < 6}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Salvar e Liberar Acesso</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO DO USUÁRIO */}
      {userHistoryModal.open && userHistoryModal.user && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl animate-scale-in space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <History className="h-5 w-5 text-purple-500" />
              <span>Histórico e Auditoria do Usuário</span>
            </h3>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex justify-between items-center">
              <div>
                <div className="font-bold text-slate-900 dark:text-white">{userHistoryModal.user.nomeCompleto}</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{userHistoryModal.user.email} • ID: {userHistoryModal.user.id}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                userHistoryModal.user.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {userHistoryModal.user.status}
              </span>
            </div>

            {userHistoryModal.loading ? (
              <div className="py-12 text-center text-xs font-bold text-slate-400">
                Carregando registros de auditoria do usuário...
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase font-mono text-slate-400">Últimas Operações Registradas</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {userHistoryModal.data?.history?.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 italic">
                      Nenhuma atividade registrada no histórico de logs para este usuário.
                    </div>
                  ) : (
                    userHistoryModal.data?.history?.map((log: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800/60 text-xs space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                          <span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{log.modulo}</span>
                        </div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{log.operacao}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{log.detalhes}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setUserHistoryModal({ open: false, user: null, data: null, loading: false })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO CRUD DE USUÁRIO */}
      {isUserModalOpen && editingUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-xl animate-scale-in max-h-[95vh] overflow-y-auto">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <UserPlus className="h-5 w-5 text-blue-500" />
              <span>{editingUser.id ? 'Editar Informações do Usuário' : 'Cadastrar Novo Usuário'}</span>
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4">
              {/* Linha 1: Informações de Acesso Básicas (4 colunas) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Nome Completo</label>
                  <input
                    ref={nameInputRef}
                    required
                    type="text"
                    value={editingUser.nomeCompleto || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, nomeCompleto: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400">E-mail</label>
                  <input
                    required
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400">
                    {editingUser.id ? 'Nova Senha' : 'Senha de Acesso'}
                  </label>
                  <input
                    required={!editingUser.id}
                    type="password"
                    placeholder={editingUser.id ? 'Manter atual' : 'Definir senha'}
                    value={userPasswordInput}
                    onChange={(e) => setUserPasswordInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Perfil de Acesso</label>
                  <select
                    value={editingUser.perfilAcesso || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, perfilAcesso: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                  >
                    <option value="" disabled>Selecione o perfil...</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.nome}>{p.nome} {p.status === 'INATIVO' ? '(Inativo)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linha 2: Vínculo de Dados Dimep API & Status (4 colunas) */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="text-[10px] font-bold uppercase font-mono text-slate-400 mb-2">Vínculo de Integração Dimep & Status</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Status da Conta</label>
                    <select
                      value={editingUser.status || 'ATIVO'}
                      onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as 'ATIVO' | 'BLOQUEADO' | 'INATIVO' })}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                    >
                      <option value="ATIVO">ATIVO</option>
                      <option value="BLOQUEADO">BLOQUEADO</option>
                      <option value="INATIVO">INATIVO</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Rest API Key</label>
                    <input
                      type="text"
                      placeholder="Ex: UUID da Rest API Key"
                      value={editingUser.key || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, key: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono font-bold text-slate-400">CNPJ do Cliente</label>
                    <input
                      type="text"
                      placeholder="Ex: 00.000.000/0001-00"
                      value={editingUser.identifier || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, identifier: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Empresa Conectada</label>
                    <input
                      type="text"
                      placeholder="Horai Auditoria S.A."
                      value={editingUser.empresa || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, empresa: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="md:col-span-1 flex items-center pt-5">
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={editingUser.forcarTrocaSenha || false}
                          onChange={(e) => setEditingUser({ ...editingUser, forcarTrocaSenha: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:bg-blue-600 transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-500 transition-colors">Forçar troca de senha</span>
                    </label>
                  </div>
                  <div className="md:col-span-1 flex items-center pt-5">
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={editingUser.sincronizarAoEntrar || false}
                          onChange={(e) => setEditingUser({ ...editingUser, sincronizarAoEntrar: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:bg-emerald-600 transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-600 transition-colors">Sincronizar ao entrar</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Linha 3: Perguntas de Segurança para Recuperação (3 colunas lado a lado) */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="text-[10px] font-bold uppercase font-mono text-slate-400 mb-1">Perguntas de Segurança para Recuperação de Senha</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  {userQuestions.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="space-y-0.5">
                        <label className="text-[9px] uppercase font-mono font-bold text-slate-400">Pergunta {idx + 1}</label>
                        <select
                          value={item.pergunta}
                          onChange={(e) => {
                            const updated = [...userQuestions];
                            updated[idx].pergunta = e.target.value;
                            setUserQuestions(updated);
                          }}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none"
                        >
                          {OPCOES_PERGUNTAS.map(op => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] uppercase font-mono font-bold text-slate-400">Resposta {idx + 1}</label>
                        <input
                          required={!editingUser.id}
                          type="text"
                          placeholder={editingUser.id ? 'Manter resposta' : 'Resposta do usuário'}
                          value={item.resposta}
                          onChange={(e) => {
                            const updated = [...userQuestions];
                            updated[idx].resposta = e.target.value;
                            setUserQuestions(updated);
                          }}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  {editingUser.id ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE RESTAURAÇÃO DE BACKUP */}
      {isRestoreConfirmOpen && pendingRestoreData && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scale-in">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-500 shrink-0">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Confirmar Restauração do Banco de Dados
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Atenção: A restauração irá substituir a base de dados atual pelos dados contidos no arquivo importado.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-2 mb-5">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase font-mono border-b border-slate-200 dark:border-slate-800 pb-1">
                Conteúdo do Arquivo de Backup:
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                <div>• Usuários: <strong className="text-slate-900 dark:text-white">{pendingRestoreData.users?.length || 0}</strong></div>
                <div>• Perfis: <strong className="text-slate-900 dark:text-white">{pendingRestoreData.profiles?.length || 0}</strong></div>
                <div>• Registros de Audit: <strong className="text-slate-900 dark:text-white">{pendingRestoreData.activityLogs?.length || 0}</strong></div>
                <div>• Funcionários: <strong className="text-slate-900 dark:text-white">{pendingRestoreData.funcionarios?.length || 0}</strong></div>
              </div>
              <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-900/30 mt-2">
                🔒 Um backup de segurança pré-restauração será criado automaticamente no servidor antes da substituição.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsRestoreConfirmOpen(false);
                  setPendingRestoreData(null);
                }}
                disabled={isImporting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRestoreBackup}
                disabled={isImporting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5"
              >
                {isImporting ? (
                  <span>Restaurando...</span>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Confirmar e Restaurar Agora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO CRUD DE PERFIL */}
      {isProfileModalOpen && editingProfile && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl animate-scale-in">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Shield className="h-5 w-5 text-blue-500" />
              <span>{editingProfile.id ? 'Editar Perfil de Permissões' : 'Criar Perfil Personalizado'}</span>
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Coluna da Esquerda: Dados Principais */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Nome do Perfil</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Auditor Senior, RH Consultor"
                      value={editingProfile.nome || ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, nome: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Descrição do Escopo</label>
                    <textarea
                      placeholder="Descreva o objetivo deste perfil de acesso..."
                      value={editingProfile.descricao || ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, descricao: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 h-24 resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Status do Perfil</label>
                    <select
                      value={editingProfile.status || 'ATIVO'}
                      onChange={(e) => setEditingProfile({ ...editingProfile, status: e.target.value as 'ATIVO' | 'INATIVO' })}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                    >
                      <option value="ATIVO">ATIVO (Liberado para usuários)</option>
                      <option value="INATIVO">INATIVO (Bloqueia acessos vinculados)</option>
                    </select>
                  </div>
                  
                  <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-150 dark:border-blue-900/30 rounded-xl p-3 text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
                    <strong>Atenção:</strong> Ao inativar um perfil, todos os usuários comuns que estiverem vinculados a ele perderão temporariamente o acesso às seções protegidas do sistema até que o perfil seja reativado ou eles sejam migrados.
                  </div>
                </div>

                {/* Coluna da Direita: Seleção de Permissões Granulares */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Permissões Granulares</label>
                    <div className="flex items-center gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          const allIds: string[] = [];
                          PERMISSOES_DISPONIVEIS.forEach(c => c.itens.forEach(i => allIds.push(i.id)));
                          setEditingProfile({ ...editingProfile, permissoes: allIds });
                        }}
                        className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                      >
                        Marcar Todas
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProfile({ ...editingProfile, permissoes: [] });
                        }}
                        className="text-rose-600 dark:text-rose-400 font-bold hover:underline"
                      >
                        Desmarcar Todas
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Filtrar permissões..."
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                  />

                  <div className="max-h-[280px] overflow-y-auto pr-1 space-y-3 border border-slate-150 dark:border-slate-850/80 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/20">
                    {PERMISSOES_DISPONIVEIS.map((cat) => {
                      const filteredItens = cat.itens.filter(item =>
                        item.nome.toLowerCase().includes(permSearch.toLowerCase()) ||
                        item.desc.toLowerCase().includes(permSearch.toLowerCase()) ||
                        item.id.toLowerCase().includes(permSearch.toLowerCase())
                      );

                      if (filteredItens.length === 0) return null;

                      const catIds = cat.itens.map(i => i.id);
                      const currentPerms = editingProfile.permissoes || [];
                      const isCatAllChecked = catIds.every(id => currentPerms.includes(id));

                      return (
                        <div key={cat.categoria} className="space-y-1.5 bg-white dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                            <span className="text-[9px] uppercase font-bold text-blue-600 dark:text-blue-400 font-mono tracking-wider">{cat.categoria}</span>
                            <button
                              type="button"
                              onClick={() => {
                                let updated = [...currentPerms];
                                if (isCatAllChecked) {
                                  updated = updated.filter(id => !catIds.includes(id));
                                } else {
                                  catIds.forEach(id => {
                                    if (!updated.includes(id)) updated.push(id);
                                  });
                                }
                                setEditingProfile({ ...editingProfile, permissoes: updated });
                              }}
                              className="text-[9px] font-bold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              {isCatAllChecked ? 'Desmarcar Categoria' : 'Marcar Categoria'}
                            </button>
                          </div>
                          <div className="space-y-2 pt-1">
                            {filteredItens.map((item) => {
                              const checked = editingProfile.permissoes?.includes(item.id);
                              return (
                                <label key={item.id} className="flex items-start gap-2 text-xs text-slate-750 dark:text-slate-300 cursor-pointer select-none py-0.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const prev = editingProfile.permissoes || [];
                                      const updated = e.target.checked
                                        ? [...prev, item.id]
                                        : prev.filter((x) => x !== item.id);
                                      setEditingProfile({ ...editingProfile, permissoes: updated });
                                    }}
                                    className="rounded text-blue-600 focus:ring-blue-500 mt-0.5 shrink-0"
                                  />
                                  <div>
                                    <div className="font-semibold text-slate-850 dark:text-slate-200 text-[10.5px] leading-tight">{item.nome}</div>
                                    <div className="text-[9px] text-slate-400 dark:text-slate-500 leading-normal">{item.desc}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Salvar Perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
