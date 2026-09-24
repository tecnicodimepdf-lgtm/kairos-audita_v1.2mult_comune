/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BarChart3, Users, Landmark, Briefcase, ChevronRight, X } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { BIFilters } from '../types';

interface DashboardGerencialProps {
  filters: BIFilters;
  setFilters: (filters: BIFilters) => void;
  setActiveTab?: (tab: string) => void;
  isSyncing: boolean;
  user?: any;
}

export default function DashboardGerencial({
  filters,
  setFilters,
  setActiveTab,
  isSyncing
}: DashboardGerencialProps) {
  const [charts, setCharts] = useState<{
    ocorrenciasPorCC: { name: string; value: number }[];
    rankingGestores: { name: string; value: number }[];
    ocorrenciasPorTipo: { name: string; value: number }[];
    ocorrenciasPorDepto: { name: string; value: number }[];
  }>({
    ocorrenciasPorCC: [],
    rankingGestores: [],
    ocorrenciasPorTipo: [],
    ocorrenciasPorDepto: []
  });

  const carregarDadosGerenciais = async () => {
    const t0 = performance.now();
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.append(key, val as string);
      });

      const res = await fetch(`/api/dashboard/charts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCharts(data);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do BI Gerencial:', err);
    } finally {
      console.log(`[Performance] Tempo de carregamento dos dados (Dashboard Gerencial): ${(performance.now() - t0).toFixed(2)}ms`);
    }
  };

  useEffect(() => {
    if (!isSyncing) {
      carregarDadosGerenciais();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.empresaId,
    filters.departamento,
    filters.centroCusto,
    filters.cargo,
    filters.status,
    filters.buscaFuncionario,
    filters.tipoOcorrencia,
    filters.dataInicio,
    filters.dataFim,
    isSyncing
  ]);

  const COLORS = ['#3b82f6', '#0d9488', '#ea580c', '#8b5cf6', '#06b6d4', '#e11d48', '#64748b'];

  // Handlers para clique e cross-filtering (BI Analítico)
  const handleCcClick = (data: any) => {
    if (data && data.name) {
      setFilters({
        ...filters,
        centroCusto: filters.centroCusto === data.name ? '' : data.name
      });
    }
  };

  const handleGestorClick = (data: any) => {
    if (data && data.name) {
      setFilters({
        ...filters,
        gestor: filters.gestor === data.name ? '' : data.name
      });
    }
  };

  const handleDeptoClick = (data: any) => {
    if (data && data.name) {
      setFilters({
        ...filters,
        departamento: data.name
      });
      if (setActiveTab) {
        setActiveTab('relatorios');
      }
    }
  };

  const clearSpecificFilter = (key: keyof BIFilters) => {
    setFilters({
      ...filters,
      [key]: ''
    });
  };

  const hasAnyActiveFilter = !!(filters.centroCusto || filters.gestor || filters.departamento || filters.cargo || filters.empresaId);

  return (
    <div className="space-y-6" id="dashboard-gerencial-root">
      {/* 1. Barra de Filtros Ativos (Breadcrumbs de BI) */}
      {hasAnyActiveFilter && (
        <div className="bg-slate-100 border border-slate-200 p-3 rounded-lg flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-700">Filtros Cruzados Aplicados:</span>
          {filters.empresaId && (
            <span className="bg-blue-600 text-white px-2.5 py-1 rounded-full flex items-center space-x-1 font-semibold">
              <span>Empresa</span>
              <button onClick={() => clearSpecificFilter('empresaId')} className="hover:text-red-200 cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.departamento && (
            <span className="bg-teal-600 text-white px-2.5 py-1 rounded-full flex items-center space-x-1 font-semibold">
              <span>Depto: {filters.departamento}</span>
              <button onClick={() => clearSpecificFilter('departamento')} className="hover:text-red-200 cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.centroCusto && (
            <span className="bg-orange-600 text-white px-2.5 py-1 rounded-full flex items-center space-x-1 font-semibold">
              <span>CC: {filters.centroCusto}</span>
              <button onClick={() => clearSpecificFilter('centroCusto')} className="hover:text-red-200 cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.gestor && (
            <span className="bg-violet-600 text-white px-2.5 py-1 rounded-full flex items-center space-x-1 font-semibold">
              <span>Gestor: {filters.gestor}</span>
              <button onClick={() => clearSpecificFilter('gestor')} className="hover:text-red-200 cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => setFilters({
              empresaId: '',
              departamento: '',
              centroCusto: '',
              cargo: '',
              gestor: '',
              grauRisco: '',
              dataInicio: filters.dataInicio, // Preserva período global
              dataFim: filters.dataFim,       // Preserva período global
              buscaFuncionario: '',
              tipoOcorrencia: ''
            })}
            className="text-red-600 hover:text-red-800 font-bold ml-auto cursor-pointer"
          >
            Limpar Todos
          </button>
        </div>
      )}

      {/* 2. Bento Grid de Análise Multidimensional */}
      <div className="space-y-6">
        {/* Distribuição por Estrutura Organizacional */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
            <div className="flex items-center space-x-2">
              <Landmark className="h-5 w-5 text-teal-500" />
              <h3 className="font-display font-bold text-slate-800 text-sm">
                Estrutura de Departamento por Incidentes (Conformidade Direta)
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {charts.ocorrenciasPorDepto.map((depto, index) => {
              const totalDepto = depto.value;
              const isFiltered = filters.departamento === depto.name;
              return (
                <div
                  key={depto.name}
                  onClick={() => handleDeptoClick(depto)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    isFiltered
                      ? 'bg-blue-50 border-blue-300 shadow-sm scale-[1.02]'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-display font-bold text-slate-800 text-xs">
                      {depto.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      totalDepto > 15
                        ? 'bg-red-100 text-red-800'
                        : totalDepto > 5
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {totalDepto > 15 ? 'Risco Elevado' : totalDepto > 5 ? 'Médio Risco' : 'Seguro'}
                    </span>
                  </div>

                  <div className="my-3 flex items-baseline space-x-1">
                    <span className="text-2xl font-bold font-display text-slate-800">{depto.value}</span>
                    <span className="text-[10px] text-slate-500">desvios CLT</span>
                  </div>

                  <div className="flex items-center text-[10px] text-blue-600 font-semibold">
                    <span>{isFiltered ? 'Filtro Ativo' : 'Ver Detalhes do Depto'}</span>
                    <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
