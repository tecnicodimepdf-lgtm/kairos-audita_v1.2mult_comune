/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Filter, X, RefreshCw, Calendar, Search } from 'lucide-react';
import { BIFilters, Empresa } from '../types';

interface FiltrosGeraisProps {
  filters: BIFilters;
  setFilters: (filters: BIFilters) => void;
  onSyncNow: () => void;
  isSyncing: boolean;
}

export default function FiltrosGerais({
  filters,
  setFilters,
  onSyncNow,
  isSyncing
}: FiltrosGeraisProps) {
  const [filterOptions, setFilterOptions] = useState<{
    empresas: Empresa[];
    departamentos: string[];
    centrosCusto: string[];
    cargos: string[];
    gestores: string[];
  }>({
    empresas: [],
    departamentos: [],
    centrosCusto: [],
    cargos: [],
    gestores: []
  });

  // Busca as opções de filtros atualizadas com base nos dados reais do BD
  const carregarOpcoesFiltros = async () => {
    try {
      const res = await fetch(`/api/filtros/valores?empresaId=${filters.empresaId || ''}`);
      if (res.ok) {
        const data = await res.json();
        setFilterOptions(data);
      }
    } catch (err) {
      console.error('Erro ao carregar opções de filtros:', err);
    }
  };

  useEffect(() => {
    carregarOpcoesFiltros();
  }, [isSyncing, filters.empresaId]); // Atualiza as opções sempre que houver sincronização ou alteração de empresa

  const [buscaFuncionarioLocal, setBuscaFuncionarioLocal] = useState(filters.buscaFuncionario || '');

  // Sincroniza estado local com filtros globais se vierem de fora
  useEffect(() => {
    setBuscaFuncionarioLocal(filters.buscaFuncionario || '');
  }, [filters.buscaFuncionario]);

  // Debounce para a busca textual
  useEffect(() => {
    const handler = setTimeout(() => {
      if (filters.buscaFuncionario !== buscaFuncionarioLocal) {
        handleSelectChange('buscaFuncionario', buscaFuncionarioLocal);
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [buscaFuncionarioLocal]);

  const handleSelectChange = (key: keyof BIFilters, value: string) => {
    setFilters({
      ...filters,
      [key]: value
    });
  };

  const handleClearFilters = () => {
    setBuscaFuncionarioLocal('');
    setFilters({
      empresaId: '',
      departamento: '',
      centroCusto: '',
      cargo: '',
      gestor: '',
      grauRisco: '',
      dataInicio: filters.dataInicio, // Preserva o período global
      dataFim: filters.dataFim,       // Preserva o período global
      buscaFuncionario: '',
      tipoOcorrencia: '',
      status: 'ATIVO'
    });
  };

  const hasActiveFilters = Boolean(
    filters.empresaId ||
    filters.departamento ||
    filters.centroCusto ||
    filters.cargo ||
    filters.gestor ||
    filters.grauRisco ||
    filters.buscaFuncionario ||
    filters.tipoOcorrencia ||
    (filters.status && filters.status !== 'ATIVO')
  );

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 no-print transition-colors duration-200" id="filtros-container">
      {/* Linha Superior: Título, Busca Rápida e Botões de Ação */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <h2 className="font-display font-semibold text-slate-800 dark:text-white text-base">
            Filtros Avançados & BI Operacional
          </h2>
          {hasActiveFilters && (
            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Filtro Ativo
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Busca por funcionário */}
          <div className="relative flex-1 sm:flex-initial">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="Buscar por Nome, CPF ou PIS..."
              value={buscaFuncionarioLocal}
              onChange={(e) => setBuscaFuncionarioLocal(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-full sm:w-64 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all duration-150"
              id="filtro-busca"
            />
          </div>

          {/* Botões de Limpeza e Sincronização */}
          <button
            onClick={handleClearFilters}
            className={`flex items-center space-x-1 px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer shadow-sm ${
              hasActiveFilters
                ? 'bg-amber-500 hover:bg-amber-600 text-white font-bold border border-amber-600 ring-2 ring-amber-400/30'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            id="btn-limpar-filtros"
            title={hasActiveFilters ? "Filtros ativos detectados! Clique para limpar e selecionar Funcionários Ativos." : "Limpar filtros e restaurar padrão"}
          >
            <X className="h-3.5 w-3.5" />
            <span>Limpar Filtros</span>
          </button>

          <button
            onClick={onSyncNow}
            disabled={isSyncing}
            className={`flex items-center space-x-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50`}
            id="btn-sync-topo"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
          </button>
        </div>
      </div>

      {/* Grid de Filtros Cruzados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Filtro Empresa */}
        <div className="flex flex-col space-y-1">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Empresa</label>
          <select
            value={filters.empresaId}
            onChange={(e) => handleSelectChange('empresaId', e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            id="filtro-empresa"
          >
            <option value="">Todas as Empresas</option>
            {filterOptions.empresas.map((emp) => (
              <option key={emp.id} value={emp.id} className="dark:bg-slate-900">
                {emp.nomeFantasia} ({emp.cnpj})
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Departamento */}
        <div className="flex flex-col space-y-1">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Departamento</label>
          <select
            value={filters.departamento}
            onChange={(e) => handleSelectChange('departamento', e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            id="filtro-departamento"
          >
            <option value="">Todos os Deptos</option>
            {filterOptions.departamentos.map((d) => (
              <option key={d} value={d} className="dark:bg-slate-900">
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Centro de Custo */}
        <div className="flex flex-col space-y-1">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Centro de Custo</label>
          <select
            value={filters.centroCusto}
            onChange={(e) => handleSelectChange('centroCusto', e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            id="filtro-centro-custo"
          >
            <option value="">Todos os CCs</option>
            {filterOptions.centrosCusto.map((cc) => (
              <option key={cc} value={cc} className="dark:bg-slate-900">
                {cc}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Cargo */}
        <div className="flex flex-col space-y-1">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cargo</label>
          <select
            value={filters.cargo}
            onChange={(e) => handleSelectChange('cargo', e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            id="filtro-cargo"
          >
            <option value="">Todos os Cargos</option>
            {filterOptions.cargos.map((cg) => (
              <option key={cg} value={cg} className="dark:bg-slate-900">
                {cg}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Gestor */}
        <div className="flex flex-col space-y-1">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gestor</label>
          <select
            value={filters.gestor}
            onChange={(e) => handleSelectChange('gestor', e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            id="filtro-gestor"
          >
            <option value="">Todos os Gestores</option>
            {filterOptions.gestores.map((g) => (
              <option key={g} value={g} className="dark:bg-slate-900">
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Período (Datas - Contexto Global) */}
        <div className="flex flex-col space-y-1">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between space-x-1">
            <span className="flex items-center space-x-1">
              <Calendar className="h-3 w-3 text-emerald-500" />
              <span>Período</span>
            </span>
            <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              Contexto Global
            </span>
          </label>
          <div className="flex items-center space-x-1">
            <input
              type="date"
              value={filters.dataInicio}
              onChange={(e) => handleSelectChange('dataInicio', e.target.value)}
              className="w-1/2 p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              id="filtro-data-inicio"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="date"
              value={filters.dataFim}
              onChange={(e) => handleSelectChange('dataFim', e.target.value)}
              className="w-1/2 p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              id="filtro-data-fim"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
