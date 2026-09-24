/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Settings,
  Database,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  History,
  KeyRound,
  Lock,
  Globe,
  CalendarCheck,
  Trash2,
  Download,
  Upload,
  ShieldCheck,
  AlertCircle,
  Building2,
  Check,
  Sun,
  Moon,
  FileText,
  Terminal,
  Activity,
  ArrowDown,
  Plus,
  Edit3,
  Layers,
  ArrowRight,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles
} from 'lucide-react';
import { DimepConfig, SyncLog, Empresa, EmpresaRestConfig, MAX_COMPANIES } from '../types';
import { useCompany } from '../contexts/CompanyContext';

import { deepCleanLocalData } from '../utils/cleaning';
import { ConfirmationModal } from './ConfirmationModal';

interface ConfiguracaoProps {
  onSyncCompleted: () => void;
  isSyncing: boolean;
  setIsSyncing: (syncing: boolean) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  user?: any;
}

export default function Configuracao({
  onSyncCompleted,
  isSyncing,
  setIsSyncing,
  theme,
  setTheme
}: ConfiguracaoProps) {
  const companyContext = useCompany();
  const {
    config: contextConfig,
    selectActiveEmpresa,
    saveEmpresaRest,
    deleteEmpresaRest,
    refreshCompanyConfig,
    saveConfig
  } = companyContext;

  const [config, setConfig] = useState<DimepConfig>(() => {
    return contextConfig || {
      host: 'https://www.dimepkairos.com.br',
      identifier: '',
      key: '',
      periodoPadrao: 'last_30_days',
      agendamentoSinc: 'manual',
      companyId: 0,
      companyCode: 0
    };
  });

  useEffect(() => {
    if (contextConfig) {
      setConfig(contextConfig);
    }
  }, [contextConfig]);

  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success: boolean | null;
    message: string;
  }>({
    loading: false,
    success: null,
    message: ''
  });

  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);

  const [empresasConectadas, setEmpresasConectadas] = useState<Empresa[]>(() => {
    try {
      const cached = localStorage.getItem('@kairos_empresas_cache');
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.error('Erro ao ler cache de empresas', e);
    }
    return [];
  });
  const [saveMessage, setSaveMessage] = useState('');
  const [dbClearMessage, setDbClearMessage] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeepCleanConfirm, setShowDeepCleanConfirm] = useState(false);
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);
  
  // Estados para Gestão Multiempresa
  const [showManageMultiempresaModal, setShowManageMultiempresaModal] = useState(false);
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [editingEmpresaId, setEditingEmpresaId] = useState<string | null>(null);
  const [empresaForm, setEmpresaForm] = useState({
    cnpj: '',
    key: '',
    razaoSocial: '',
    ativa: false
  });
  const [empresaTestStatus, setEmpresaTestStatus] = useState<{ [id: string]: { loading: boolean; success: boolean | null; message: string } }>({});
  const [deletingEmpresaId, setDeletingEmpresaId] = useState<string | null>(null);

  // Filtro, Pesquisa e Paginação para Gestão Multiempresa
  const [searchCompanyQuery, setSearchCompanyQuery] = useState('');
  const [companyStatusFilter, setCompanyStatusFilter] = useState<'TODOS' | 'ATIVA' | 'INATIVA'>('TODOS');
  const [companyPage, setCompanyPage] = useState(1);
  const [validatingCompanyApi, setValidatingCompanyApi] = useState(false);
  const COMPANY_PAGE_SIZE = 8;

  const filteredEmpresas = useMemo(() => {
    let list = config.empresasRest || [];
    if (searchCompanyQuery.trim()) {
      const q = searchCompanyQuery.toLowerCase().trim();
      list = list.filter(e => 
        (e.razaoSocial && e.razaoSocial.toLowerCase().includes(q)) ||
        (e.cnpj && e.cnpj.includes(q))
      );
    }
    if (companyStatusFilter === 'ATIVA') {
      list = list.filter(e => e.ativa);
    } else if (companyStatusFilter === 'INATIVA') {
      list = list.filter(e => !e.ativa);
    }
    return list;
  }, [config.empresasRest, searchCompanyQuery, companyStatusFilter]);

  const totalCompanyPages = Math.ceil(filteredEmpresas.length / COMPANY_PAGE_SIZE) || 1;
  const paginatedEmpresas = filteredEmpresas.slice((companyPage - 1) * COMPANY_PAGE_SIZE, companyPage * COMPANY_PAGE_SIZE);

  const handleAutoFetchRazaoSocial = async () => {
    if (!empresaForm.cnpj || !empresaForm.key) {
      alert('Preencha o CNPJ e a REST API Key para validar na API Kairos.');
      return;
    }
    setValidatingCompanyApi(true);
    try {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: config.host || 'https://www.dimepkairos.com.br',
          identifier: empresaForm.cnpj,
          key: empresaForm.key
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.companyName) {
          setEmpresaForm(prev => ({ ...prev, razaoSocial: data.companyName }));
          alert(`Conexão validada com sucesso! Razão Social obtida: "${data.companyName}"`);
        } else {
          alert(`Conexão com a API Kairos confirmada com sucesso!`);
        }
      } else {
        alert(data.message || 'Falha ao autenticar credenciais na API Kairos.');
      }
    } catch (err) {
      alert('Erro ao conectar com o servidor.');
    } finally {
      setValidatingCompanyApi(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEmpresaModal) {
          setShowEmpresaModal(false);
        } else if (showManageMultiempresaModal) {
          setShowManageMultiempresaModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showEmpresaModal, showManageMultiempresaModal]);

  const empresaAtiva = config.empresasRest?.find(e => e.ativa) || (config.empresasRest && config.empresasRest.length > 0 ? config.empresasRest[0] : null);

  const handleSelectActiveEmpresa = async (empresaId: string) => {
    setSaveMessage('');
    const res = await selectActiveEmpresa(empresaId);
    if (res.success) {
      setDbClearMessage(res.message || 'Empresa ativa alterada com sucesso!');
      if (res.config) {
        setConfig(res.config);
      }
      setTimeout(() => setDbClearMessage(''), 4000);
    } else {
      alert(res.message || 'Erro ao selecionar empresa ativa.');
    }
  };

  const handleOpenAddEmpresa = () => {
    const t0 = performance.now();
    if (config.empresasRest && config.empresasRest.length >= MAX_COMPANIES) {
      alert(`Limite máximo de ${MAX_COMPANIES} empresas cadastradas atingido.`);
      return;
    }
    setEditingEmpresaId(null);
    setEmpresaForm({
      cnpj: '',
      key: '',
      razaoSocial: '',
      ativa: !config.empresasRest || config.empresasRest.length === 0
    });
    setShowEmpresaModal(true);
    console.log(`[Performance] Tempo da abertura dos pop-ups: ${(performance.now() - t0).toFixed(2)}ms`);
  };

  const handleOpenEditEmpresa = (emp: EmpresaRestConfig) => {
    setEditingEmpresaId(emp.id);
    setEmpresaForm({
      cnpj: emp.cnpj,
      key: emp.key,
      razaoSocial: emp.razaoSocial || '',
      ativa: emp.ativa
    });
    setShowEmpresaModal(true);
  };

  const handleSaveEmpresaModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaForm.cnpj || !empresaForm.key) {
      alert('CNPJ e Rest API Key são obrigatórios.');
      return;
    }

    setShowEmpresaModal(false);

    const payload = {
      id: editingEmpresaId || 'temp-id-' + Date.now(),
      cnpj: empresaForm.cnpj,
      key: empresaForm.key,
      razaoSocial: empresaForm.razaoSocial,
      ativa: empresaForm.ativa
    };

    const res = await saveEmpresaRest(payload);
    if (res.success) {
      setDbClearMessage(res.message || 'Empresa salva com sucesso!');
      if (res.config) {
        setConfig(res.config);
      }
      setTimeout(() => setDbClearMessage(''), 4000);
    } else {
      alert(res.message || 'Erro ao salvar empresa.');
      setShowEmpresaModal(true);
    }
  };

  const handleDeleteEmpresa = async () => {
    if (!deletingEmpresaId) return;
    
    const empresaIdParaDeletar = deletingEmpresaId;
    setDeletingEmpresaId(null);
    
    const res = await deleteEmpresaRest(empresaIdParaDeletar);
    if (res.success) {
      setDbClearMessage('Empresa removida com sucesso!');
      if (res.config) {
        setConfig(res.config);
      }
      setTimeout(() => setDbClearMessage(''), 4000);
    } else {
      alert(res.message || 'Erro ao remover empresa.');
    }
  };

  const handleTestEmpresaConnection = async (emp: EmpresaRestConfig) => {
    setEmpresaTestStatus(prev => ({
      ...prev,
      [emp.id]: { loading: true, success: null, message: '' }
    }));

    try {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: config.host || 'https://www.dimepkairos.com.br',
          identifier: emp.cnpj,
          key: emp.key
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmpresaTestStatus(prev => ({
          ...prev,
          [emp.id]: { loading: false, success: true, message: data.message || 'Conexão estabelecida com sucesso!' }
        }));
      } else {
        setEmpresaTestStatus(prev => ({
          ...prev,
          [emp.id]: { loading: false, success: false, message: data.message || 'Falha na autenticação.' }
        }));
      }
    } catch (err) {
      setEmpresaTestStatus(prev => ({
        ...prev,
        [emp.id]: { loading: false, success: false, message: 'Erro de rede ou servidor inacessível.' }
      }));
    }
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [logsText, setLogsText] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [autoScrollLogs, setAutoScrollLogs] = useState<boolean>(true);
  const [autoScrollHistory, setAutoScrollHistory] = useState<boolean>(true);
  
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const historyContainerRef = useRef<HTMLDivElement>(null);

  const carregarLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogsText(data.logs || '# Nenhum log registrado até o momento.');
      }
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    }
  }, []);

  const [syncMessages, setSyncMessages] = useState<string[]>([]);

  // Efeito para auto-scroll dos logs
  useEffect(() => {
    if (autoScrollLogs && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logsText, autoScrollLogs]);

  // Efeito para auto-scroll do histórico
  useEffect(() => {
    if (autoScrollHistory && historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
    }
  }, [syncHistory, autoScrollHistory]);

  const handleLogsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    setAutoScrollLogs(isAtBottom);
  };

  const handleHistoryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    setAutoScrollHistory(isAtBottom);
  };

  const handleClearLogs = async () => {
    try {
      const token = localStorage.getItem('x-session-token') || '';
      const res = await fetch('/api/logs/clear', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-session-token': token } : {})
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLogsText(''); 
        await carregarLogs();
        setDbClearMessage('Arquivo de logs de utilização limpo com sucesso!');
        setTimeout(() => setDbClearMessage(''), 4000);
      } else {
        alert(data.message || 'Erro ao limpar logs. Permissão insuficiente.');
      }
    } catch (err) {
      console.error('Erro ao limpar logs:', err);
    }
  };

  const handleDeepClean = async () => {
    setIsClearing(true);
    try {
      // 1. Limpeza no Servidor (Base de dados e arquivos temporários)
      await fetch('/api/database/clear', { method: 'POST' });
      
      // 2. Limpeza no Cliente (LocalStorage, Session, IndexedDB, etc.)
      await deepCleanLocalData();
      
      setDbClearMessage('Ambiente local e base de dados limpos integralmente. Reiniciando...');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Erro na limpeza profunda:', err);
      alert('Erro ao realizar a limpeza completa de dados.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleDownloadLogsTxt = () => {
    try {
      const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `logs_auditoria.txt`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar arquivo de logs:', err);
    }
  };

  const carregarHistorico = useCallback(async () => {
    try {
      const histRes = await fetch('/api/sync/history');
      if (histRes.ok) {
        const histData = await histRes.json();
        setSyncHistory(prev => {
          if (JSON.stringify(prev) === JSON.stringify(histData)) {
            return prev;
          }
          return histData;
        });
      }
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    }
  }, []);

  const carregarConfiguracoes = useCallback(async () => {
    const t0 = performance.now();
    try {
      const confData = await refreshCompanyConfig();
      if (confData) {
        setConfig(confData);
      }
      const empRes = await fetch('/api/empresas');
      if (empRes && empRes.ok) {
        const empData = await empRes.json();
        setEmpresasConectadas(empData);
        localStorage.setItem('@kairos_empresas_cache', JSON.stringify(empData));
      }
      console.log(`[Performance] Tempo da leitura das configurações REST: ${(performance.now() - t0).toFixed(2)}ms`);
    } catch (err) {
      console.error('Erro ao buscar configurações:', err);
    }
  }, [refreshCompanyConfig]);

  // Inicializa dados e histórico
  useEffect(() => {
    carregarConfiguracoes();
    carregarHistorico();
  }, [carregarConfiguracoes, carregarHistorico]);

  // Recarrega configurações após sincronização
  useEffect(() => {
    if (!isSyncing) {
      carregarConfiguracoes();
      carregarHistorico();
    }
  }, [isSyncing, carregarConfiguracoes, carregarHistorico]);

  // Polling para atualização automática apenas para logs e histórico
  useEffect(() => {
    const intervalId = setInterval(() => {
      carregarLogs();
      if (!isSyncing) {
        carregarHistorico();
      }
    }, 5000); // 5 segundos

    return () => clearInterval(intervalId);
  }, [carregarLogs, carregarHistorico, isSyncing]);

  useEffect(() => {
    carregarLogs();
  }, [carregarLogs]);

  const handleInputChange = (field: keyof DimepConfig, value: any) => {
    setConfig(prev => {
      const nextConfig = { ...prev, [field]: value };
      if (['identifier', 'key', 'nomeEmpresaConectada'].includes(field as string) && Array.isArray(nextConfig.empresasRest)) {
        nextConfig.empresasRest = nextConfig.empresasRest.map(emp => {
          if (emp.ativa) {
            return {
              ...emp,
              cnpj: field === 'identifier' ? value : emp.cnpj,
              key: field === 'key' ? value : emp.key,
              razaoSocial: field === 'nomeEmpresaConectada' ? value : emp.razaoSocial
            };
          }
          return emp;
        });
      }
      return nextConfig;
    });
  };

  const addSyncMessage = (msg: string) => {
    setSyncMessages(prev => [msg, ...prev]);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage('');
    setSyncMessages([]);
    
    addSyncMessage('Carregando configurações...');
    addSyncMessage('Validando parâmetros...');
    
    try {
      addSyncMessage('Salvando configurações...');
      const result = await saveConfig(config);
      if (result.success && result.config) {
        setConfig(result.config);
        setSaveMessage('Configurações salvas com sucesso! Sincronizando dados automaticamente...');
        addSyncMessage('Configurações salvas.');
        setTimeout(() => setSaveMessage(''), 5000);
        
        // Sincroniza automaticamente após salvar as configurações (Primeira Conexão)
        setIsSyncing(true);
        addSyncMessage('Iniciando sincronização...');
        try {
          addSyncMessage('Conectando ao servidor...');
          addSyncMessage('Obtendo empresas...');
          const syncRes = await fetch('/api/sync', { method: 'POST' });
          if (syncRes.ok) {
            addSyncMessage('Obtendo colaboradores...');
            addSyncMessage('Obtendo horários...');
            addSyncMessage('Obtendo escalas...');
            addSyncMessage('Obtendo jornadas...');
            addSyncMessage('Sincronização concluída.');
            addSyncMessage('Sincronização finalizada com sucesso.');
            onSyncCompleted();
          } else {
            addSyncMessage('Erro durante sincronização.');
          }
        } catch (syncErr) {
          console.error('Erro ao sincronizar automaticamente:', syncErr);
          addSyncMessage('Erro durante sincronização.');
        } finally {
          setIsSyncing(false);
          await carregarConfiguracoes();
          await carregarLogs();
        }
      }
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
      addSyncMessage('Erro ao salvar configurações.');
    }
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true, success: null, message: '' });
    try {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: config.host,
          identifier: config.identifier,
          key: config.key
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus({ loading: false, success: true, message: data.message });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          message: data.message || 'Erro inesperado na autenticação.'
        });
      }
      await carregarLogs();
    } catch (err) {
      setTestStatus({
        loading: false,
        success: false,
        message: 'Erro de rede. Host inacessível ou inválido.'
      });
      await carregarLogs();
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncMessages([]);
    addSyncMessage('Iniciando sincronização...');
    addSyncMessage('Conectando ao servidor...');
    try {
      addSyncMessage('Obtendo empresas...');
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        addSyncMessage('Obtendo colaboradores...');
        addSyncMessage('Obtendo horários...');
        addSyncMessage('Obtendo escalas...');
        addSyncMessage('Obtendo jornadas...');
        addSyncMessage('Sincronização concluída.');
        addSyncMessage('Sincronização finalizada com sucesso.');
        onSyncCompleted();
        await carregarConfiguracoes();
        await carregarLogs();
      } else {
        addSyncMessage('Erro durante sincronização.');
      }
    } catch (err) {
      console.error('Erro ao sincronizar:', err);
      addSyncMessage('Erro durante sincronização.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearDatabase = async () => {
    setIsClearing(true);
    setDbClearMessage('');
    try {
      const res = await fetch('/api/database/clear', { method: 'POST' });
      if (res.ok) {
        setDbClearMessage('Base de dados de demonstração limpa com sucesso!');
        setShowClearConfirm(false);
        onSyncCompleted();
        await carregarConfiguracoes();
        await carregarLogs();
        setTimeout(() => setDbClearMessage(''), 4000);
      } else {
        alert('Falha ao limpar a base de dados.');
      }
    } catch (err) {
      console.error('Erro ao limpar banco de dados:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        host: config.host,
        identifier: config.identifier,
        key: config.key,
        periodoPadrao: config.periodoPadrao,
        agendamentoSinc: config.agendamentoSinc,
        isDemoCleared: config.isDemoCleared ?? false,
        _app: 'AuditoriaTrabalhista',
        _version: '1.0.0',
        _exportDate: new Date().toISOString()
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `auditoria_backup_config_${config.identifier.replace(/[^0-9]/g, '') || 'sistema'}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Erro ao exportar arquivo de backup:', err);
    }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = event.target.files?.[0];
    if (!file) return;

    fileReader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed && typeof parsed === 'object' && 'host' in parsed && 'identifier' in parsed) {
          const newConfig: DimepConfig = {
            host: parsed.host || 'https://www.dimepkairos.com.br',
            identifier: parsed.identifier || '',
            key: parsed.key || '',
            periodoPadrao: parsed.periodoPadrao || 'last_30_days',
            agendamentoSinc: parsed.agendamentoSinc || 'manual',
            isDemoCleared: parsed.isDemoCleared ?? config.isDemoCleared
          };

          setConfig(newConfig);

          const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig)
          });

          if (res.ok) {
            setSaveMessage('Configurações importadas do arquivo de backup com sucesso!');
            setTimeout(() => setSaveMessage(''), 4000);
            onSyncCompleted();
            await carregarConfiguracoes();
          }
        } else {
          alert('Formato de arquivo inválido. O arquivo selecionado não contém uma configuração válida.');
        }
      } catch (err) {
        alert('Erro ao processar o arquivo de backup. Certifique-se de que é um arquivo JSON válido.');
      }
    };
    fileReader.readAsText(file);
    // Limpa o valor para permitir re-seleção do mesmo arquivo se necessário
    event.target.value = '';
  };

  const [isImportingSample, setIsImportingSample] = useState(false);

  const handleImportSample = async () => {
    if (!window.confirm('Deseja ativar e carregar o Ambiente de Demonstração? Os dados simulados isolados serão carregados no painel.')) {
      return;
    }
    setIsImportingSample(true);
    setDbClearMessage('');
    try {
      const token = localStorage.getItem('x-session-token') || '';
      let res = await fetch('/api/database/load-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-session-token': token } : {})
        }
      });
      if (!res.ok) {
        res = await fetch('/api/database/import-sample', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'x-session-token': token } : {})
          }
        });
      }
      const data = await res.json();
      if (data.success) {
        setDbClearMessage('Ambiente de Demonstração ativado com sucesso! Dados isolados de demonstração em execução.');
        onSyncCompleted();
        await carregarConfiguracoes();
        await carregarLogs();
        setTimeout(() => setDbClearMessage(''), 5000);
      } else {
        alert(data.message || 'Erro ao carregar Ambiente de Demonstração.');
      }
    } catch (err) {
      console.error('Erro ao carregar demonstração:', err);
      alert('Erro de rede ao solicitar carga do Ambiente de Demonstração.');
    } finally {
      setIsImportingSample(false);
    }
  };

  const handleRemoveSample = async () => {
    setIsClearing(true);
    setDbClearMessage('');
    try {
      const token = localStorage.getItem('x-session-token') || '';
      let res = await fetch('/api/database/unload-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-session-token': token } : {})
        }
      });
      if (!res.ok) {
        res = await fetch('/api/database/remove-sample', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'x-session-token': token } : {})
          }
        });
      }
      const data = await res.json();
      if (data.success) {
        setDbClearMessage('Ambiente de Demonstração descarregado com sucesso! Retornado ao Ambiente Operacional.');
        setShowClearConfirm(false);
        onSyncCompleted();
        await carregarConfiguracoes();
        await carregarLogs();
        setTimeout(() => setDbClearMessage(''), 5000);
      } else {
        alert(data.message || 'Erro ao desativar ambiente de demonstração.');
      }
    } catch (err) {
      console.error('Erro ao desativar ambiente de demonstração:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const isDemoActive = config.appMode === 'DEMONSTRAÇÃO';

  return (
    <div className="space-y-6" id="config-wrapper">
      {/* 1. PARÂMETROS DE INTEGRAÇÃO REST & LOGS DE UTILIZAÇÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* COLUNA ESQUERDA: PARÂMETROS DE INTEGRAÇÃO */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center space-x-2 bg-[#064e3b] px-5 py-4 border-b border-[#043d2e]">
            <Settings className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="font-display font-bold text-white text-sm">
                Parâmetros de Integração REST
              </h3>
              <p className="text-[10px] text-emerald-200/80 font-medium">
                Gerencie as credenciais corporativas e o agendamento do motor CLT.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveConfig} className="p-5 space-y-4 text-xs flex-1">
            <div className="flex flex-col space-y-1">
              <label className="font-bold text-slate-700 flex items-center space-x-1">
                <Globe className="h-3.5 w-3.5 text-slate-400" />
                <span>Host da API REST</span>
              </label>
              <input
                type="text"
                required
                value={config.host}
                onChange={(e) => handleInputChange('host', e.target.value)}
                placeholder="https://www.dimepkairos.com.br"
                className="p-2.5 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700 flex items-center space-x-1">
                  <Database className="h-3.5 w-3.5 text-slate-400" />
                  <span>Identificador (CNPJ)</span>
                </label>
                <input
                  type="text"
                  required
                  value={config.identifier}
                  onChange={(e) => handleInputChange('identifier', e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="p-2.5 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700 flex items-center space-x-1">
                  <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                  <span>Rest API Key</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                  </span>
                  <input
                    type="password"
                    value={config.key}
                    onChange={(e) => handleInputChange('key', e.target.value)}
                    placeholder="••••••••••••••••"
                    className="p-2.5 pr-9 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white focus:outline-none transition-all w-full font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700 flex items-center space-x-1">
                  <CalendarCheck className="h-3.5 w-3.5 text-slate-400" />
                  <span>Período de Coleta</span>
                </label>
                <select
                  value={config.periodoPadrao}
                  onChange={(e) => handleInputChange('periodoPadrao', e.target.value)}
                  className="p-2.5 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:outline-none cursor-pointer"
                >
                  <option value="last_30_days">Últimos 30 Dias</option>
                  <option value="current_month">Mês Atual</option>
                  <option value="last_month">Mês Anterior</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700 flex items-center space-x-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Sincronização</span>
                </label>
                <select
                  value={config.agendamentoSinc}
                  onChange={(e) => handleInputChange('agendamentoSinc', e.target.value)}
                  className="p-2.5 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 focus:outline-none cursor-pointer"
                >
                  <option value="manual">Manual</option>
                  <option value="daily_00_00">Diário (00:00)</option>
                  <option value="every_6h">A cada 6 horas</option>
                </select>
              </div>
            </div>

            {saveMessage && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg flex items-center space-x-2 font-semibold animate-fade-in">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{saveMessage}</span>
              </div>
            )}

            {syncMessages.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg space-y-2 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                    <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    Sincronização em Tempo Real
                  </span>
                </div>
                <div className="space-y-1 max-h-[80px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 font-mono text-[10px]">
                  {syncMessages.map((msg, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className="text-slate-600">[{new Date().toLocaleTimeString('pt-BR')}]</span>
                      <span className={idx === 0 ? 'text-blue-300 font-bold' : 'text-slate-400'}>{msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-sm cursor-pointer"
              >
                Salvar Configurações
              </button>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus.loading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {testStatus.loading ? 'Testando...' : 'Testar Conexão'}
              </button>

              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow-sm flex items-center space-x-1 cursor-pointer disabled:opacity-50 ml-auto"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sincronizar Agora</span>
              </button>
            </div>
          </form>
        </div>

        {/* COLUNA DIREITA: LOGS DE UTILIZAÇÃO E ERROS */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between bg-[#064e3b] px-5 py-4 border-b border-[#043d2e]">
            <div className="flex items-center space-x-2">
              <Terminal className="h-5 w-5 text-emerald-400" />
              <div>
                <h3 className="font-display font-bold text-white text-sm">
                  Logs de Utilização e Erros
                </h3>
                <p className="text-[10px] text-emerald-200/80 font-medium">
                  Monitoramento em tempo real das operações do motor.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setAutoScrollLogs(!autoScrollLogs)}
                className={`p-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-[10px] font-bold ${
                  autoScrollLogs 
                    ? 'bg-emerald-800/50 border-emerald-500/50 text-emerald-100' 
                    : 'bg-[#043d2e] border-[#064e3b] text-emerald-400'
                }`}
              >
                <ArrowDown className={`h-3.5 w-3.5 ${autoScrollLogs ? 'animate-bounce' : ''}`} />
                {autoScrollLogs ? 'AO VIVO' : 'PAUSADO'}
              </button>
              <button 
                onClick={handleDownloadLogsTxt}
                className="p-1.5 hover:bg-emerald-800 rounded-lg text-white border border-emerald-800/60 shadow-sm transition-all"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setShowClearLogsConfirm(true)}
                className="p-1.5 hover:bg-rose-500 hover:text-white rounded-lg text-emerald-100 border border-emerald-800/60 shadow-sm transition-all"
                title="Limpar Logs"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-5 flex-1 flex flex-col">
            <div 
              ref={logsContainerRef}
              onScroll={handleLogsScroll}
              className="h-[360px] bg-slate-950 rounded-xl p-5 overflow-y-auto font-mono text-[11px] text-slate-300 leading-relaxed border border-slate-800 scrollbar-thin scrollbar-thumb-slate-800"
            >
              {loadingLogs && !logsText ? (
                <div className="flex items-center justify-center h-full space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
                  <span>Carregando logs...</span>
                </div>
              ) : logsText ? (
                <pre className="whitespace-pre-wrap break-words opacity-90 text-white">{logsText}</pre>
              ) : (
                <div className="text-slate-700 italic">Sem registros no momento.</div>
              )}
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider px-1">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Sistema Monitorado
            </span>
            <span>{new Date().toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>
      </div>

      {/* 2. GESTÃO MULTIEMPRESA (INTEGRAÇÃO REST KAIROS) - CARD COMPACTO */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#064e3b] px-5 py-4 border-b border-[#043d2e] gap-3">
          <div className="flex items-center space-x-3">
            <Building2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="font-display font-bold text-white text-sm sm:text-base">
                Gestão Multiempresa (Integração REST Kairos)
              </h3>
              <p className="text-[11px] text-emerald-200/80 font-medium">
                Cadastre as empresas disponíveis para utilização da mesma Rest API Kairos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowManageMultiempresaModal(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm shrink-0 border border-emerald-400/30"
          >
            <Layers className="h-4 w-4" />
            <span>Gerenciar Empresas ({config.empresasRest?.length || 0})</span>
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center space-x-3 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 pr-2">
              <div className="p-2.5 bg-emerald-100/80 rounded-lg text-emerald-800 shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Empresas Cadastradas</span>
                <span className="text-base font-black text-slate-800">
                  {config.empresasRest?.length || 0} <span className="text-xs font-semibold text-slate-400">/ {MAX_COMPANIES}</span>
                </span>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-0 md:pl-2">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 block flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-600" /> Empresa Ativa (Próxima Sincronização)
                </span>
                <div className="font-bold text-xs sm:text-sm text-slate-900 mt-0.5 truncate max-w-md">
                  {empresaAtiva?.razaoSocial || config.nomeEmpresaConectada || 'Nenhuma empresa cadastrada'}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  CNPJ: <span className="font-semibold text-slate-700">{empresaAtiva?.cnpj || config.identifier || '—'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowManageMultiempresaModal(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 shadow-sm"
              >
                <span>Gerenciar Empresas</span>
                <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* HISTÓRICO RECENTE DE COLETAS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm space-y-0 overflow-hidden">
        <div className="flex items-center justify-between bg-[#064e3b] px-5 py-4 border-b border-[#043d2e]">
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="font-display font-bold text-white text-sm">
                Histórico Recente de Coletas
              </h3>
              <p className="text-[10px] text-emerald-200/80 font-medium">
                Últimas sincronizações bem-sucedidas.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setAutoScrollHistory(!autoScrollHistory)}
            className={`p-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-[10px] font-bold ${
              autoScrollHistory 
                ? 'bg-emerald-800/50 border-emerald-500/50 text-emerald-100' 
                : 'bg-[#043d2e] border-[#064e3b] text-emerald-400'
            }`}
          >
            <ArrowDown className={`h-3.5 w-3.5 ${autoScrollHistory ? 'animate-bounce' : ''}`} />
            {autoScrollHistory ? 'AUTO-SCROLL' : 'FIXO'}
          </button>
        </div>

        <div className="p-5">
          <div 
            ref={historyContainerRef}
            onScroll={handleHistoryScroll}
            className="overflow-y-auto max-h-[300px] rounded-lg border border-slate-100 scrollbar-thin scrollbar-thumb-slate-200"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 font-bold text-slate-600 border-b border-slate-100">Data e Hora</th>
                <th className="px-4 py-2 font-bold text-slate-600 border-b border-slate-100">Status</th>
                <th className="px-4 py-2 font-bold text-slate-600 border-b border-slate-100">Total</th>
                <th className="px-4 py-2 font-bold text-slate-600 border-b border-slate-100">Duração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {syncHistory.length > 0 ? (
                syncHistory.map((sync) => (
                  <tr key={sync.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-600 font-medium">
                      {new Date(sync.dataHora).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sync.status === 'SUCESSO'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {sync.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono">
                      {sync.totalFuncionarios} reg.
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {sync.duracaoMs ? `${(sync.duracaoMs / 1000).toFixed(1)}s` : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                    Nenhuma coleta registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* STATUS E OPERAÇÃO DO BANCO (Movido para baixo) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isDemoActive ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <Database className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Ambiente de Dados</span>
              <h3 className="font-display font-bold text-slate-800 text-sm">
                {isDemoActive ? 'Modo Demonstração Ativo' : 'Modo Operacional Real'}
              </h3>
            </div>
          </div>
          
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 space-y-2 text-xs">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-slate-600">Empresa:</span>
              <span className="text-slate-900 font-bold">{isDemoActive ? 'Empresa de Exemplo' : config.nomeEmpresaConectada || 'Não conectada'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-slate-600">Endpoint:</span>
              <span className="text-slate-900 font-mono">{config.host || 'Padrão'}</span>
            </div>
          </div>
        </div>

        <div className="border-l border-slate-100 pl-6 flex flex-col justify-center space-y-3">
          <button
            onClick={() => setShowDeepCleanConfirm(true)}
            disabled={isClearing}
            className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
          >
            Limpar Dados Locais
          </button>
          <button
            onClick={handleImportSample}
            disabled={isImportingSample || isDemoActive}
            className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
          >
            Ativar Modo Demonstração
          </button>
          <button
            onClick={handleRemoveSample}
            disabled={isClearing || !isDemoActive}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
          >
            Desativar Modo Demonstração
          </button>
        </div>
      </div>

      {dbClearMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg flex items-center space-x-2 font-semibold animate-fade-in fixed bottom-6 right-6 z-50 shadow-lg">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{dbClearMessage}</span>
        </div>
      )}

      {/* Modais de Confirmação Centralizados */}
      <ConfirmationModal
        isOpen={showDeepCleanConfirm}
        onClose={() => setShowDeepCleanConfirm(false)}
        onConfirm={handleDeepClean}
        title="Limpeza Completa de Dados Locais"
        message="Esta ação irá remover integralmente o cache da aplicação, Local Storage, IndexedDB e a base de dados do servidor. Todos os estados temporários e sincronizações anteriores serão eliminados. Deseja prosseguir?"
        confirmLabel="Limpar Tudo"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={showClearLogsConfirm}
        onClose={() => setShowClearLogsConfirm(false)}
        onConfirm={handleClearLogs}
        title="Limpar Logs de Utilização"
        message="Deseja realmente remover permanentemente todos os registros de utilização e erros exibidos? Esta ação não pode ser desfeita."
        confirmLabel="Limpar Logs"
        variant="warning"
      />

      {/* POPUP MODAL: GESTÃO MULTIEMPRESA (INTEGRAÇÃO REST KAIROS) */}
      {showManageMultiempresaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full my-4 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#064e3b] px-6 py-4 border-b border-[#043d2e] shrink-0 gap-3">
              <div className="flex items-center space-x-3">
                <Building2 className="h-6 w-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-display font-bold text-white text-base">
                      Gestão Multiempresa (Integração REST Kairos)
                    </h3>
                    <span className="px-2 py-0.5 bg-emerald-800 text-emerald-200 text-[10px] font-bold rounded-full border border-emerald-600/50">
                      Capacidade: {MAX_COMPANIES} Empresas
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/80 font-medium mt-0.5">
                    Cadastre e altere facilmente entre empresas cadastradas para a integração REST.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleOpenAddEmpresa}
                  disabled={config.empresasRest && config.empresasRest.length >= MAX_COMPANIES}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Nova Empresa ({config.empresasRest?.length || 0}/{MAX_COMPANIES})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowManageMultiempresaModal(false);
                    setShowEmpresaModal(false);
                  }}
                  className="text-emerald-200 hover:text-white text-base font-bold p-1 cursor-pointer transition-colors"
                  title="Fechar (ESC)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Capacidade Progress Bar Banner */}
            <div className="bg-slate-900 px-6 py-2 flex items-center justify-between text-xs border-b border-slate-800 text-slate-300 shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-semibold text-slate-400">Total cadastrado:</span>
                <span className="font-bold text-white">{config.empresasRest?.length || 0} de {MAX_COMPANIES}</span>
              </div>
              <div className="w-48 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round(((config.empresasRest?.length || 0) / MAX_COMPANIES) * 100))}%` }}
                />
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* SUB-FORMULÁRIO INLINE PARA INCLUSÃO / EDIÇÃO DENTRO DO MODAL */}
              {showEmpresaModal && (
                <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-5 shadow-sm space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                      <Building2 className="h-4 w-4 text-emerald-700" />
                      <span>{editingEmpresaId ? 'Editar Empresa REST' : 'Cadastrar Nova Empresa REST'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEmpresaModal(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  <form onSubmit={handleSaveEmpresaModal} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700">Razão Social / Nome da Empresa</label>
                        <button
                          type="button"
                          onClick={handleAutoFetchRazaoSocial}
                          disabled={validatingCompanyApi}
                          className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Validar na API Kairos e preencher Razão Social automaticamente"
                        >
                          <Sparkles className="h-3 w-3 text-emerald-600" />
                          {validatingCompanyApi ? 'Buscando...' : 'Autopreencher com API'}
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={empresaForm.razaoSocial}
                        onChange={(e) => setEmpresaForm({ ...empresaForm, razaoSocial: e.target.value })}
                        placeholder="Ex: DF Control Sistemas Ltda"
                        className="p-2.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="font-bold text-slate-700">Identificador (CNPJ)</label>
                      <input
                        type="text"
                        required
                        value={empresaForm.cnpj}
                        onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })}
                        placeholder="00.000.000/0001-00"
                        className="p-2.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="font-bold text-slate-700">REST API Key</label>
                      <input
                        type="password"
                        required
                        value={empresaForm.key}
                        onChange={(e) => setEmpresaForm({ ...empresaForm, key: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="p-2.5 border border-slate-300 rounded-lg text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="md:col-span-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={empresaForm.ativa}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, ativa: e.target.checked })}
                          className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="font-semibold text-slate-700">Definir como empresa ativa para a próxima sincronização</span>
                      </label>

                      <div className="flex space-x-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setShowEmpresaModal(false)}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg cursor-pointer transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-all flex items-center space-x-1.5"
                        >
                          <Check className="h-4 w-4" />
                          <span>Salvar Empresa</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* MENSAGEM SE LIMITE MÁXIMO ATINGIDO */}
              {config.empresasRest && config.empresasRest.length >= MAX_COMPANIES && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>Limite máximo de {MAX_COMPANIES} empresas cadastradas atingido. Para adicionar uma nova empresa, remova uma existente.</span>
                </div>
              )}

              {/* BARRA DE FERRAMENTAS: PESQUISA E FILTROS */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchCompanyQuery}
                    onChange={(e) => {
                      setSearchCompanyQuery(e.target.value);
                      setCompanyPage(1);
                    }}
                    placeholder="Pesquisar por Razão Social ou CNPJ..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {searchCompanyQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchCompanyQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex items-center space-x-1 shrink-0 bg-white p-1 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => { setCompanyStatusFilter('TODOS'); setCompanyPage(1); }}
                    className={`px-3 py-1 rounded-md font-bold transition-all text-[11px] cursor-pointer ${
                      companyStatusFilter === 'TODOS'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Todas ({config.empresasRest?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCompanyStatusFilter('ATIVA'); setCompanyPage(1); }}
                    className={`px-3 py-1 rounded-md font-bold transition-all text-[11px] cursor-pointer ${
                      companyStatusFilter === 'ATIVA'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Ativa (1)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCompanyStatusFilter('INATIVA'); setCompanyPage(1); }}
                    className={`px-3 py-1 rounded-md font-bold transition-all text-[11px] cursor-pointer ${
                      companyStatusFilter === 'INATIVA'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Inativas ({Math.max(0, (config.empresasRest?.length || 0) - 1)})
                  </button>
                </div>
              </div>

              {/* TABELA DE EMPRESAS CADASTRADAS */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="p-3 text-center w-16">Ativa</th>
                        <th className="p-3">Empresa / Razão Social</th>
                        <th className="p-3">CNPJ</th>
                        <th className="p-3">REST API Key</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedEmpresas.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                            {searchCompanyQuery || companyStatusFilter !== 'TODOS'
                              ? 'Nenhuma empresa encontrada com os filtros selecionados.'
                              : 'Nenhuma empresa cadastrada. Clique no botão "+ Nova Empresa" acima para adicionar.'}
                          </td>
                        </tr>
                      ) : (
                        paginatedEmpresas.map((emp) => {
                          const test = empresaTestStatus[emp.id];
                          return (
                            <tr
                              key={emp.id}
                              className={`transition-colors ${
                                emp.ativa ? 'bg-emerald-50/80 font-medium' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="radio"
                                  name="empresa_ativa_radio"
                                  checked={Boolean(emp.ativa)}
                                  onChange={() => handleSelectActiveEmpresa(emp.id)}
                                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                                />
                              </td>
                              <td className="p-3 font-bold text-slate-800">
                                <div className="flex items-center space-x-2">
                                  <Building2 className={`h-4 w-4 shrink-0 ${emp.ativa ? 'text-emerald-600' : 'text-slate-400'}`} />
                                  <span className="truncate max-w-xs">{emp.razaoSocial || 'Empresa sem nome'}</span>
                                  {emp.ativa && (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-300/60">
                                      Ativa
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 font-mono text-slate-600">
                                {emp.cnpj}
                              </td>
                              <td className="p-3 font-mono text-slate-500">
                                {emp.key ? `${emp.key.substring(0, 4)}••••••••` : '—'}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleTestEmpresaConnection(emp)}
                                    disabled={test?.loading}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md transition-all cursor-pointer disabled:opacity-50 text-[10px]"
                                  >
                                    {test?.loading ? 'Testando...' : 'Testar'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditEmpresa(emp)}
                                    className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded-md transition-all cursor-pointer"
                                    title="Editar Credenciais"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingEmpresaId(emp.id)}
                                    disabled={config.empresasRest && config.empresasRest.length <= 1}
                                    className="p-1.5 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700 rounded-md transition-all cursor-pointer disabled:opacity-30"
                                    title="Remover Empresa"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                {test && (
                                  <div className={`mt-1 text-[10px] text-right font-medium ${
                                    test.success ? 'text-emerald-700' : 'text-red-700'
                                  }`}>
                                    {test.message}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginação da Tabela */}
                {totalCompanyPages > 1 && (
                  <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <div>
                      Exibindo <span className="font-bold">{((companyPage - 1) * COMPANY_PAGE_SIZE) + 1}</span> a <span className="font-bold">{Math.min(companyPage * COMPANY_PAGE_SIZE, filteredEmpresas.length)}</span> de <span className="font-bold">{filteredEmpresas.length}</span> empresas
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setCompanyPage(p => Math.max(1, p - 1))}
                        disabled={companyPage === 1}
                        className="p-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="font-bold text-slate-700 text-xs">
                        {companyPage} / {totalCompanyPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCompanyPage(p => Math.min(totalCompanyPages, p + 1))}
                        disabled={companyPage === totalCompanyPages}
                        className="p-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* BANNER DE INFORMAÇÃO DA EMPRESA SELECIONADA PARA PRÓXIMA SINCRONIZAÇÃO */}
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                    Empresa atualmente selecionada para a próxima sincronização:
                  </span>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">
                    {empresaAtiva?.razaoSocial || config.nomeEmpresaConectada || 'Nenhuma empresa ativa selecionada'}
                  </div>
                  <div className="text-xs font-mono text-slate-600 mt-0.5">
                    CNPJ: <span className="font-semibold text-slate-800">{empresaAtiva?.cnpj || config.identifier || '—'}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-lg text-[11px] font-bold self-start sm:self-center shrink-0">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span>Pronta para Coleta</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowManageMultiempresaModal(false);
                  setShowEmpresaModal(false);
                }}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-all cursor-pointer text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Remoção de Empresa */}
      <ConfirmationModal
        isOpen={Boolean(deletingEmpresaId)}
        onClose={() => setDeletingEmpresaId(null)}
        onConfirm={handleDeleteEmpresa}
        title="Remover Empresa REST"
        message="Deseja realmente remover esta empresa da lista de integrações Multiempresa? Esta ação eliminará os parâmetros de conexão salvos para ela."
        confirmLabel="Remover Empresa"
        variant="danger"
      />

      {/* BACKUP */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="h-5 w-5 text-slate-400" />
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Gestão de Backup</h3>
            <p className="text-[10px] text-slate-400">Exportar ou importar chaves de configuração.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportBackup} className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600" title="Exportar"><Upload className="h-4 w-4" /></button>
          <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600" title="Importar"><Download className="h-4 w-4" /></button>
          <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
        </div>
      </div>
    </div>
  );
}
