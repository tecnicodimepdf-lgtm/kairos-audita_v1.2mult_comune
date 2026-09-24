/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Clock,
  Coffee,
  CalendarDays,
  UserCheck,
  Percent,
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';
import { BIFilters, DashboardKPIs } from '../types';

interface DashboardRHProps {
  filters: BIFilters;
  setFilters: (filters: BIFilters) => void;
  setActiveTab: (tab: string) => void;
  isSyncing: boolean;
  user?: any;
}

export default function DashboardRH({
  filters,
  setFilters,
  setActiveTab,
  isSyncing
}: DashboardRHProps) {
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

  const [criticalEmployees, setCriticalEmployees] = useState<any[]>([]);

  const handleIndicatorClick = (id: string) => {
    let tipo = '';
    if (id === 'exc') tipo = 'JORNADA_EXCESSIVA';
    else if (id === 'int') tipo = 'INTERJORNADA_INSUFICIENTE';
    else if (id === 'alm') tipo = 'INTERVALO_INSUFICIENTE';
    else if (id === 'dom') tipo = 'DOMINGO_EXCESSIVO';
    else if (id === 'dom_seg') tipo = 'DOMINGOS_SEGUIDOS';

    setFilters({
      ...filters,
      tipoOcorrencia: tipo
    });
    setActiveTab('auditorias');
  };

  const handleEmployeeClick = (nome: string) => {
    setFilters({
      ...filters,
      buscaFuncionario: nome
    });
    setActiveTab('auditorias');
  };

  const carregarDadosRH = async () => {
    const t0 = performance.now();
    try {
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
        const chartData = await chartRes.json();
        setKpis(kpiData);
        // Filtrar funcionários que possuem grau de risco alto ou crítico
        setCriticalEmployees(chartData.rankingFuncionarios || []);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do Dashboard RH:', err);
    } finally {
      console.log(`[Performance] Tempo de carregamento dos dados (Dashboard RH): ${(performance.now() - t0).toFixed(2)}ms`);
    }
  };

  // Efeito executado apenas na montagem para limpar filtros textuais
  useEffect(() => {
    if (filters.tipoOcorrencia || filters.buscaFuncionario) {
      setFilters({
        ...filters,
        tipoOcorrencia: '',
        buscaFuncionario: ''
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Efeito executado ao mudar filtros (não textuais)
  useEffect(() => {
    if (!isSyncing) {
      carregarDadosRH();
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

  // Lista dos indicadores com suas especificações legais
  const metatagsIndicadores = [
    {
      id: 'exc',
      titulo: 'Jornadas Excessivas (> 10h)',
      lei: 'CLT Art. 59',
      descricao: 'Limite diário de 8 horas acrescido de no máximo 2 horas extras.',
      taxa: kpis.taxaJornadasExcessivas,
      limitePrudencial: 10, // Máximo aceitável em %
      icon: Clock,
      color: 'red'
    },
    {
      id: 'int',
      titulo: 'Descanso Interjornada (< 11h)',
      lei: 'CLT Art. 66',
      descricao: 'Intervalo obrigatório mínimo de 11 horas consecutivas de repouso entre dois turnos.',
      taxa: kpis.taxaDescansoInadequado,
      limitePrudencial: 5,
      icon: CalendarDays,
      color: 'orange'
    },
    {
      id: 'alm',
      titulo: 'Intervalo Intrajornada Curto',
      lei: 'CLT Art. 71',
      descricao: 'Mínimo de 1 hora de descanso/refeição para jornadas de trabalho superiores a 6 horas.',
      taxa: kpis.taxaIntervaloInsuficiente,
      limitePrudencial: 3,
      icon: Coffee,
      color: 'red'
    },
    {
      id: 'dom',
      titulo: 'Escala Abusiva em Domingos',
      lei: 'CLT Art. 67',
      descricao: 'Risco de jornadas superiores a 6 horas no domingo ou mais de 6 dias seguidos sem folga (DSR).',
      taxa: kpis.taxaTrabalhoDomingo,
      limitePrudencial: 8,
      icon: ShieldAlert,
      color: 'amber'
    },
    {
      id: 'dom_seg',
      titulo: 'Dois Domingos Seguidos Trabalhados',
      lei: 'CLT Art. 67 / CF Art. 7, XV',
      descricao: 'Trabalho prestado em dois domingos consecutivos sem a devida folga quinzenal dominical.',
      taxa: kpis.taxaDoisDomingos || 0,
      limitePrudencial: 5,
      icon: CalendarDays,
      color: 'orange'
    }
  ];

  return (
    <div className="space-y-6" id="dashboard-rh-root">
      {/* 1. Header Informativo */}
      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-xl">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-blue-900 font-display">
              Auditoria de Compliance Trabalhista (Auditoria Trabalhista)
            </h3>
            <p className="text-xs text-blue-800 leading-relaxed">
              Os KPIs abaixo calculam o percentual de colaboradores afetados por cada infração legal nas datas selecionadas.
              O limite prudencial representa a margem aceitável de flutuação operacional tolerada pelo departamento jurídico da empresa.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Monitor de Obrigações Legais (KPIs e Barras de Risco) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 space-y-5">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <UserCheck className="h-5 w-5 text-teal-600" />
            <h3 className="font-display font-bold text-slate-800 text-sm">
              Relação de Compliance Legal (CLT)
            </h3>
          </div>

          <div className="space-y-3">
            {metatagsIndicadores.map((ind) => {
              const Icon = ind.icon;
              const ehCritico = ind.taxa > ind.limitePrudencial;
              return (
                <div
                  key={ind.id}
                  onClick={() => handleIndicatorClick(ind.id)}
                  className="space-y-1.5 cursor-pointer hover:bg-slate-50/80 p-3.5 rounded-xl border border-transparent hover:border-slate-150 transition-all duration-150"
                  title="Clique para filtrar este desvio legal na Auditoria ➜"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1.5 rounded-lg ${ehCritico ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 font-display">{ind.titulo}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-2 font-mono">{ind.lei}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold font-display ${ehCritico ? 'text-red-600' : 'text-teal-600'}`}>
                        {ind.taxa}%
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">Meta: &lt;{ind.limitePrudencial}%</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-tight">
                    {ind.descricao}
                  </p>

                  {/* Barra de progresso */}
                  <div className="w-full bg-slate-100 rounded-full h-2 relative">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        ehCritico ? 'bg-red-500' : 'bg-teal-500'
                      }`}
                      style={{ width: `${Math.min(100, ind.taxa * (100 / Math.max(1, ind.limitePrudencial * 2)))}%` }}
                    />
                    {/* Linha pontilhada marcando o limite legal prudencial */}
                    <div
                      className="absolute top-0 bottom-0 border-l border-dashed border-red-400 w-px"
                      style={{ left: '50%' }}
                      title="Limite Prudencial"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Colaboradores Críticos (Grau de Alerta) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              <h3 className="font-display font-bold text-slate-800 text-sm">
                Colaboradores Críticos
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Top Risco</span>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {criticalEmployees.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Nenhum colaborador com alto risco. Excelente conformidade!
              </div>
            ) : (
              criticalEmployees.map((emp) => {
                const isCrit = emp.grauRisco === 'CRITICO';
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleEmployeeClick(emp.nome)}
                    className={`p-3 rounded-lg border text-xs flex flex-col justify-between space-y-2 cursor-pointer transition-all duration-150 hover:scale-[1.01] hover:shadow-sm ${
                      isCrit ? 'bg-red-50/50 border-red-100 hover:border-red-300' : 'bg-orange-50/40 border-orange-100 hover:border-orange-300'
                    }`}
                    title={`Clique para filtrar desvios de ${emp.nome} ➜`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-800 block truncate max-w-[150px]" title={emp.nome}>
                          {emp.nome}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">{emp.departamento} | {emp.centroCusto}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        isCrit ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {emp.grauRisco}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] border-t border-slate-100 pt-1.5 mt-1 font-mono">
                      <div className="text-slate-500">
                        Score: <span className="font-mono font-bold text-slate-700">{emp.scoreRisco} pts</span>
                      </div>
                      <div className="text-slate-500 font-medium">
                        {emp.totalOcorrencias} desvios
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center space-x-1 font-mono pt-1">
            <FileText className="h-3 w-3" />
            <span>Score acima de 25 aponta passivo imediato.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
