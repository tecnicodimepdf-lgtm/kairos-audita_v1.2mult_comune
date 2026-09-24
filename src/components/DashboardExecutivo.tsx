/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Users,
  AlertTriangle,
  FileWarning,
  ShieldCheck,
  Building,
  TrendingUp,
  BarChart2,
  PieChart as PieIcon,
  ShieldAlert,
  Maximize2,
  X
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { BIFilters, DashboardKPIs } from '../types';

interface DashboardExecutivoProps {
  filters: BIFilters;
  setFilters: (filters: BIFilters) => void;
  setActiveTab: (tab: string) => void;
  isSyncing: boolean;
  user?: any;
}

export default function DashboardExecutivo({
  filters,
  setFilters,
  setActiveTab,
  isSyncing
}: DashboardExecutivoProps) {
  const [kpis, setKpis] = useState<DashboardKPIs>({
    totalFuncionarios: 0,
    totalOcorrencias: 0,
    funcionariosEmRisco: 0,
    ocorrenciasCriticas: 0,
    empresasMonitoradas: 0,
    scoreGeralConformidade: 100,
    taxaJornadasExcessivas: 0,
    taxaDescansoInadequado: 0,
    taxaIntervaloInsuficiente: 0,
    taxaTrabalhoDomingo: 0,
    taxaDoisDomingos: 0,
    taxaFaltasAtrasos: 0
  });

  const [chartData, setChartData] = useState<{
    evolucaoTemporal: { data: string; ocorrencias: number }[];
    ocorrenciasPorDepto: { name: string; value: number }[];
    ocorrenciasPorCC: { name: string; value: number }[];
    distribuicaoGravidade: { name: string; value: number }[];
    ocorrenciasPorTipo: { name: string; value: number }[];
  }>({
    evolucaoTemporal: [],
    ocorrenciasPorDepto: [],
    ocorrenciasPorCC: [],
    distribuicaoGravidade: [],
    ocorrenciasPorTipo: []
  });

  // Carrega KPIs e Dados de Gráficos do Servidor com base nos filtros de BI ativos
  const carregarDadosDashboard = async () => {
    const t0 = performance.now();
    try {
      // Converte o objeto de filtros em query string
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.append(key, val as string);
      });

      const [kpiRes, chartRes] = await Promise.all([
        fetch(`/api/dashboard/kpis?${params.toString()}`),
        fetch(`/api/dashboard/charts?${params.toString()}`)
      ]);

      if (kpiRes.ok && chartRes.ok) {
        const kpiData = await kpiRes.json();
        const chartDataRaw = await chartRes.json();
        setKpis(kpiData);
        setChartData(chartDataRaw);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do dashboard:', err);
    } finally {
      console.log(`[Performance] Tempo de carregamento dos dados (Dashboard Executivo): ${(performance.now() - t0).toFixed(2)}ms`);
    }
  };

  // Efeito executado apenas na montagem para limpar filtros textuais
  useEffect(() => {
    if (filters.tipoOcorrencia || filters.grauRisco || filters.buscaFuncionario) {
      setFilters({
        ...filters,
        tipoOcorrencia: '',
        grauRisco: '',
        buscaFuncionario: ''
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Efeito executado ao mudar filtros (não textuais)
  useEffect(() => {
    if (!isSyncing) {
      carregarDadosDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.empresaId,
    filters.departamento,
    filters.centroCusto,
    filters.cargo,
    filters.status,
    filters.dataInicio,
    filters.dataFim,
    isSyncing
  ]);

  // Log performance upon rendering
  useEffect(() => {
    const t0 = performance.now();
    return () => {
      console.log(`[Performance] Tempo da renderização dos módulos (Dashboard Executivo): ${(performance.now() - t0).toFixed(2)}ms`);
    };
  });
  const GRAVIDADE_COLORS: Record<string, string> = {
    CRITICO: '#dc2626', // Vermelho 600
    ALTO: '#ea580c',     // Laranja 600
    MEDIO: '#d97706',    // Âmbar 600
    BAIXO: '#2563eb'     // Azul 600
  };

  const BAR_COLORS = ['#3b82f6', '#0d9488', '#f59e0b', '#8b5cf6', '#ec4899', '#10b981', '#64748b'];

  // Função para aplicar filtro cruzado (BI Analítico) ao clicar em um departamento
  const handleDeptoClick = (data: any) => {
    let name = '';
    if (data && data.name) {
      name = data.name;
    } else if (data && data.activePayload && data.activePayload.length > 0) {
      name = data.activePayload[0].payload.name;
    } else if (data && data.activeLabel) {
      name = data.activeLabel;
    }

    if (name) {
      // Se já estiver filtrado por esse depto, desfaz o filtro. Caso contrário, aplica.
      const novoDepto = filters.departamento === name ? '' : name;
      setFilters({
        ...filters,
        departamento: novoDepto
      });
      setActiveTab('rh'); // Atalha para o Dashboard RH
    }
  };

  const [showModalDepto, setShowModalDepto] = useState(false);

  // Função de filtro por grau de risco - Direciona diretamente para a aba Relatórios Exportáveis
  const handleRiscoClick = (data: any) => {
    let riskLevel = '';
    if (typeof data === 'string') {
      riskLevel = data;
    } else if (data && data.name) {
      riskLevel = data.name;
    }

    if (riskLevel) {
      setFilters({
        ...filters,
        grauRisco: riskLevel
      });
      setActiveTab('relatorios'); // Direciona para o módulo Relatórios Exportáveis com o filtro do grau de risco
    }
  };

  return (
    <div className="space-y-6" id="dashboard-executivo-root">
      {/* 1. Grade de Cards de KPIs Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Score Geral de Conformidade */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 text-white flex flex-col justify-between shadow-md lg:col-span-2 relative overflow-hidden">
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
            <ShieldCheck className="h-28 w-28 text-white" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Score Geral de Conformidade
            </span>
            <ShieldCheck className="h-5 w-5 text-teal-400" />
          </div>
          <div className="my-3 flex items-baseline space-x-2">
            <span className="text-4xl font-display font-extrabold tracking-tight">
              {kpis.scoreGeralConformidade}%
            </span>
            <span className="text-xs text-slate-400 font-mono">Índice CLT</span>
          </div>
          {/* Barra de progresso visual */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                kpis.scoreGeralConformidade > 80
                  ? 'bg-teal-400'
                  : kpis.scoreGeralConformidade > 50
                  ? 'bg-amber-400'
                  : 'bg-red-500'
              }`}
              style={{ width: `${kpis.scoreGeralConformidade}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-2">
            Excelente conformidade protege contra multas do MTE e passivos trabalhistas.
          </div>
        </div>

        {/* Funcionários Monitorados */}
        <div
          className="p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-150 flex flex-col justify-between relative overflow-hidden transition-all duration-200 shadow-sm"
        >
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Funcionários Ativos
            </span>
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          
          {/* Funcionários Ativos Clickable Main Link */}
          <div 
            onClick={() => {
              setFilters({
                ...filters,
                status: 'ATIVO'
              });
              setActiveTab('funcionarios');
            }}
            className="my-2 group/total cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 p-1.5 rounded-lg transition-all"
            title="Clique para ver colaboradores ativos"
          >
            <span className="text-2xl font-display font-bold text-slate-800 dark:text-white group-hover/total:text-emerald-600 dark:group-hover/total:text-emerald-400">
              {kpis.totalFuncionarios || 0}
            </span>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Colaboradores em Atividade ➜</p>
          </div>

          {/* Cadastrados e Inativos Sub-Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <button
              onClick={() => {
                setFilters({
                  ...filters,
                  status: 'TODOS'
                });
                setActiveTab('funcionarios');
              }}
              className="flex flex-col items-start p-1 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded border border-transparent hover:border-blue-100 dark:hover:border-blue-900/40 text-left transition-all cursor-pointer"
              title="Clique para ver todos os cadastrados"
            >
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {kpis.totalPessoas || kpis.totalFuncionarios || 0}
              </span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Todos Cadastrados ➜</span>
            </button>
            
            <button
              onClick={() => {
                setFilters({
                  ...filters,
                  status: 'DESLIGADO'
                });
                setActiveTab('funcionarios');
              }}
              className="flex flex-col items-start p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded border border-transparent hover:border-rose-100 dark:hover:border-rose-900/40 text-left transition-all cursor-pointer"
              title="Clique para ver funcionários inativos"
            >
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                {Math.max(0, (kpis.totalPessoas || 0) - (kpis.totalFuncionarios || 0))}
              </span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Inativos ➜</span>
            </button>
          </div>
        </div>

        {/* Total de Ocorrências */}
        <div
          onClick={() => {
            setFilters({
              ...filters,
              tipoOcorrencia: ''
            });
            setActiveTab('auditorias');
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:border-amber-200 dark:hover:border-amber-800 text-slate-800 dark:text-white"
          title="Clique para ver detalhes das ocorrências na tela de Auditorias"
        >
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ocorrências
            </span>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-display font-bold text-slate-800 dark:text-white">
              {kpis.totalOcorrencias}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Desvios CLT identificados</p>
          </div>
          <div className={`text-[10px] py-1 px-2 rounded font-medium inline-block self-start ${kpis.totalOcorrencias > 0 ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' : 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'}`}>
            {kpis.totalOcorrencias > 0 ? 'Ver Auditoria ➜' : 'Totalmente regular'}
          </div>
        </div>

        {/* Funcionários em Risco */}
        <div
          onClick={() => {
            const novoRisco = filters.grauRisco === 'CRITICO' ? '' : 'CRITICO';
            setFilters({
              ...filters,
              grauRisco: novoRisco
            });
            setActiveTab('rh');
          }}
          className={`p-4 rounded-xl border flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${
            filters.grauRisco === 'CRITICO'
              ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800 ring-1 ring-orange-200 text-slate-900 dark:text-white'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-150 hover:border-orange-200'
          }`}
          title="Clique para filtrar por colaboradores críticos e ir para Dashboard RH"
        >
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Colaboradores Críticos
            </span>
            <ShieldAlert className="h-5 w-5 text-orange-500" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-display font-bold text-slate-800 dark:text-white">
              {kpis.funcionariosEmRisco}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Acima de 25 pontos de risco</p>
          </div>
          <div className={`text-[10px] py-1 px-2 rounded font-medium inline-block self-start ${
            filters.grauRisco === 'CRITICO' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300' : 'bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400'
          }`}>
            {filters.grauRisco === 'CRITICO' ? 'Filtro Ativo ✕' : 'Ver no RH ➜'}
          </div>
        </div>

        {/* Ocorrências Críticas */}
        <div
          onClick={() => {
            setFilters({
              ...filters,
              grauRisco: 'CRITICO'
            });
            setActiveTab('auditorias');
          }}
          className={`p-4 rounded-xl border flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${
            filters.grauRisco === 'CRITICO'
              ? 'bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-800 ring-1 ring-red-200 text-slate-900 dark:text-white'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-150 hover:border-red-200'
          }`}
          title="Clique para filtrar por violações críticas na lista de auditoria"
        >
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Violações Críticas
            </span>
            <FileWarning className="h-5 w-5 text-red-500" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-display font-bold text-slate-800 dark:text-white">
              {kpis.ocorrenciasCriticas}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Danos e passivos sérios</p>
          </div>
          <div className={`text-[10px] py-1 px-2 rounded font-medium inline-block self-start ${
            filters.grauRisco === 'CRITICO' ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300' : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
          }`}>
            {filters.grauRisco === 'CRITICO' ? 'Filtro Ativo ✕' : 'Ver na Auditoria ➜'}
          </div>
        </div>
      </div>

      {/* 2. Grade de Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Evolução Temporal (Area) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2 transition-colors duration-150">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <h3 className="font-display font-bold text-slate-800 dark:text-white text-sm">
                Evolução Temporal dos Riscos Trabalhistas
              </h3>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">Últimos 30 dias (clique p/ atalho)</span>
          </div>
          <div className="h-64">
            {chartData.evolucaoTemporal.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                Nenhum dado encontrado para o período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData.evolucaoTemporal}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  onClick={(state) => {
                    if (state && state.activeLabel) {
                      const labelStr = String(state.activeLabel);
                      setFilters({
                        ...filters,
                        dataInicio: labelStr,
                        dataFim: labelStr
                      });
                      setActiveTab('auditorias');
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <defs>
                    <linearGradient id="colorOcs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="data"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(val) => val.substring(8, 10) + '/' + val.substring(5, 7)}
                  />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff' }}
                    labelFormatter={(label) => `Data: ${label.substring(8, 10)}/${label.substring(5, 7)}/${label.substring(0, 4)}`}
                  />
                  <Area type="monotone" dataKey="ocorrencias" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorOcs)" name="Ocorrências" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico de Pizza de Tipos de Ocorrências */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-150">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <PieIcon className="h-5 w-5 text-indigo-500" />
              <h3 className="font-display font-bold text-slate-800 dark:text-white text-sm">
                Tipos de Desvios Detectados
              </h3>
            </div>
          </div>
          <div className="h-64 flex flex-col justify-between">
            <div className="h-44 w-full">
              {chartData.ocorrenciasPorTipo.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                  Sem desvios no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart style={{ cursor: 'pointer' }}>
                    <Pie
                      data={chartData.ocorrenciasPorTipo}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                      onClick={(data) => {
                        if (data && data.name) {
                          setFilters({
                            ...filters,
                            tipoOcorrencia: String(data.name)
                          });
                          setActiveTab('auditorias');
                        }
                      }}
                    >
                      {chartData.ocorrenciasPorTipo.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                      formatter={(value, name) => [`${value} desvios`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Legenda Customizada Simplificada com Links de Atalho */}
            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-600 dark:text-slate-400 mt-2 max-h-16 overflow-y-auto">
              {chartData.ocorrenciasPorTipo.map((entry, index) => (
                <button
                  key={entry.name}
                  onClick={() => {
                    setFilters({
                      ...filters,
                      tipoOcorrencia: entry.name
                    });
                    setActiveTab('auditorias');
                  }}
                  className="flex items-center space-x-1.5 truncate text-left hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded cursor-pointer w-full transition-colors"
                  title={`Atalho para ${entry.name}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }} />
                  <span className="truncate font-semibold text-slate-700 dark:text-slate-300" title={entry.name}>{entry.name.replace(/_/g, ' ')} ({entry.value})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Grade de Ocorrências por Estruturas e Distribuição de Grau de Risco */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ocorrências por Departamento (Barra Horizontal) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2 transition-colors duration-150">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BarChart2 className="h-5 w-5 text-teal-500" />
              <h3 className="font-display font-bold text-slate-800 dark:text-white text-sm">
                Ocorrências por Departamento (Filtro Inteligente)
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded hidden sm:inline-block">
                Clique na barra para filtrar
              </span>
              <button
                type="button"
                onClick={() => setShowModalDepto(true)}
                className="flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold transition-all border border-blue-200 dark:border-blue-800 cursor-pointer shadow-sm"
                title="Abrir gráfico e listagem em modo expandido"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Modo Expandido</span>
              </button>
            </div>
          </div>
          <div className="h-64">
            {chartData.ocorrenciasPorDepto.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                Excelente! Nenhum desvio por departamento.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...chartData.ocorrenciasPorDepto].sort((a, b) => b.value - a.value)}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  onClick={handleDeptoClick}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff' }}
                    formatter={(value) => [`${value} Ocorrências`]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {[...chartData.ocorrenciasPorDepto].sort((a, b) => b.value - a.value).map((entry, index) => {
                      const isFiltered = filters.departamento === entry.name;
                      return (
                        <Cell
                           key={`cell-${index}`}
                           fill={isFiltered ? '#2563eb' : BAR_COLORS[index % BAR_COLORS.length]}
                           className="cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* MODAL MODO EXPANDIDO - OCORRÊNCIAS POR DEPARTAMENTO */}
        {showModalDepto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400">
                    <BarChart2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-slate-900 dark:text-white text-lg">
                      Ocorrências por Departamento — Modo Expandido
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Análise detalhada e totalização de desvios CLT por departamento da empresa.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModalDepto(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
                {/* Totalização Geral */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total de Departamentos</span>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{chartData.ocorrenciasPorDepto.length}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-900/40">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">Total de Ocorrências</span>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-1">
                      {chartData.ocorrenciasPorDepto.reduce((acc, curr) => acc + curr.value, 0)}
                    </p>
                  </div>
                  <div className="bg-teal-50 dark:bg-teal-950/30 p-4 rounded-xl border border-teal-200 dark:border-teal-900/40">
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-300 uppercase">Maior Concentração</span>
                    <p className="text-base font-bold text-teal-900 dark:text-teal-200 truncate mt-1">
                      {chartData.ocorrenciasPorDepto.length > 0 ? [...chartData.ocorrenciasPorDepto].sort((a,b) => b.value - a.value)[0].name : 'Nenhum'}
                    </p>
                  </div>
                </div>

                {/* Gráfico Ampliado */}
                <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-4">Gráfico de Barras Ampliado</h4>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[...chartData.ocorrenciasPorDepto].sort((a, b) => b.value - a.value)}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                        onClick={handleDeptoClick}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={140} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff' }}
                          formatter={(value) => [`${value} Ocorrências`]}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22}>
                          {[...chartData.ocorrenciasPorDepto].sort((a, b) => b.value - a.value).map((entry, index) => (
                            <Cell
                              key={`cell-modal-${index}`}
                              fill={BAR_COLORS[index % BAR_COLORS.length]}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Tabela de Totalização por Departamento */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3">Departamento</th>
                        <th className="p-3 text-center">Total de Ocorrências</th>
                        <th className="p-3 text-center">Representatividade (%)</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {[...chartData.ocorrenciasPorDepto].sort((a, b) => b.value - a.value).map((d) => {
                        const total = chartData.ocorrenciasPorDepto.reduce((acc, curr) => acc + curr.value, 0);
                        const percent = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
                        return (
                          <tr key={d.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 font-semibold text-slate-900 dark:text-white">{d.name}</td>
                            <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">{d.value}</td>
                            <td className="p-3 text-center font-mono">{percent}%</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  setShowModalDepto(false);
                                  handleDeptoClick(d);
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-[11px]"
                              >
                                Filtrar no RH ➜
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Distribuição de Grau de Risco dos Funcionários */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-150">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              <h3 className="font-display font-bold text-slate-800 dark:text-white text-sm">
                Inteligência de Riscos (Grau de Alerta)
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Pessoas</span>
          </div>
          <div className="h-64 flex flex-col justify-between">
            <div className="h-44 w-full">
              {chartData.distribuicaoGravidade.every(v => v.value === 0) ? (
                <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                  Sem dados para classificar.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart onClick={handleRiscoClick} style={{ cursor: 'pointer' }}>
                    <Pie
                      data={chartData.distribuicaoGravidade}
                      cx="50%"
                      cy="50%"
                      innerRadius={0}
                      outerRadius={70}
                      paddingAngle={1}
                      dataKey="value"
                    >
                      {chartData.distribuicaoGravidade.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={GRAVIDADE_COLORS[entry.name] || '#64748b'}
                          className="cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                      formatter={(value, name) => [`${value} colaboradores`, `Risco ${name}`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Legenda Customizada por Gravidade com Links para Relatórios */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 dark:text-slate-400 mt-2 font-medium">
              {chartData.distribuicaoGravidade.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => handleRiscoClick(entry)}
                  className={`flex items-center justify-between p-1.5 rounded hover:bg-blue-50 dark:hover:bg-slate-800 border cursor-pointer text-left transition-all ${
                    filters.grauRisco === entry.name
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-bold'
                      : 'border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                  title={`Navegar para Relatórios Exportáveis com filtro de Risco ${entry.name}`}
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: GRAVIDADE_COLORS[entry.name] || '#64748b' }} />
                    <span className="truncate font-semibold">{entry.name}: {entry.value}</span>
                  </div>
                  <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold hover:underline shrink-0 ml-1">Relatórios ➜</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
