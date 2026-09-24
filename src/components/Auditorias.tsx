/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Search,
  ClipboardCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  FileDown,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldAlert,
  Calendar,
  FolderOpen,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { BIFilters, Ocorrencia, TipoOcorrencia } from '../types';
import { generateAuditPDF } from '../utils/pdfGenerator';
import { formatToHHMM } from '../utils/hours';

interface AuditoriasProps {
  filters: BIFilters;
  setFilters: (filters: BIFilters) => void;
  isSyncing: boolean;
  user?: any;
}

const TIPOS_OCORRENCIAS_LABELS: Record<string, string> = {
  JORNADA_EXCESSIVA: 'Jornada Excessiva (> 10h)',
  INTERJORNADA_INSUFICIENTE: 'Descanso Interjornada Insuficiente (< 11h)',
  INTERVALO_INSUFICIENTE: 'Intervalo Intrajornada Curto',
  DOMINGO_EXCESSIVO: 'Escala Abusiva em Domingos',
  DOMINGOS_SEGUIDOS: 'Dois Domingos Seguidos Trabalhados',
  SEM_FOLGA_7_DIAS: 'Trabalho Sem Folga por 7+ Dias',
  MARCACAO_IMPAR: 'Marcação Ímpar / Incompleta',
  AUSENCIA: 'Ausência / Falta Injustificada',
  ATRASO_GRAVE: 'Atraso Grave (> 15min)',
  FALTA_RECORRENTE: 'Faltas Recorrentes'
};

export default function Auditorias({
  filters,
  setFilters,
  isSyncing
}: AuditoriasProps) {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [limit] = useState(15);
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});
  const [groupByDepto, setGroupByDepto] = useState(false);
  const [permitidoFilter, setPermitidoFilter] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  const handleSort = (colKey: string) => {
    if (sortColumn !== colKey) {
      setSortColumn(colKey);
      setSortDirection('asc');
    } else {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    }
  };

  const parseTimeToMinutes = (valStr: string | undefined | null): number => {
    if (!valStr) return 0;
    const str = String(valStr).trim().toLowerCase();
    if (str.includes(':')) {
      const parts = str.split(':');
      return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    }
    if (str.includes('h')) {
      const parts = str.replace('min', '').replace('m', '').split('h');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    }
    if (str.includes('min')) {
      return parseInt(str.replace('min', '').trim(), 10) || 0;
    }
    const num = parseFloat(str);
    if (!isNaN(num)) return Math.round(num * 60);
    return 0;
  };

  const getSeverityRank = (gravidade: string): number => {
    const g = (gravidade || '').toUpperCase();
    if (g.includes('CRITIC') || g.includes('CRÍTICA')) return 1;
    if (g.includes('ALTO') || g.includes('ALTA')) return 2;
    if (g.includes('MEDIO') || g.includes('MÉDIA')) return 3;
    if (g.includes('BAIXO') || g.includes('BAIXA')) return 4;
    return 5;
  };

  const getSortedOcorrencias = (records: Ocorrencia[]) => {
    if (!sortColumn || !sortDirection) return records;

    return [...records].sort((a, b) => {
      let result = 0;
      switch (sortColumn) {
        case 'data':
          result = (a.data || '').localeCompare(b.data || '');
          break;
        case 'funcionario':
          result = (a.funcionarioNome || a.funcionarioId || '').localeCompare(b.funcionarioNome || b.funcionarioId || '');
          break;
        case 'departamento':
          result = (a.funcionarioDepartamento || '').localeCompare(b.funcionarioDepartamento || '');
          break;
        case 'tipo': {
          const labelA = TIPOS_OCORRENCIAS_LABELS[a.tipo] || a.tipo;
          const labelB = TIPOS_OCORRENCIAS_LABELS[b.tipo] || b.tipo;
          result = labelA.localeCompare(labelB);
          break;
        }
        case 'gravidade': {
          const rankA = getSeverityRank(a.gravidade);
          const rankB = getSeverityRank(b.gravidade);
          result = rankA - rankB;
          break;
        }
        case 'constatado': {
          const minA = parseTimeToMinutes(formatConstatado(a));
          const minB = parseTimeToMinutes(formatConstatado(b));
          result = minA - minB;
          break;
        }
        case 'permitido': {
          const minA = parseTimeToMinutes(a.valorPermitido);
          const minB = parseTimeToMinutes(b.valorPermitido);
          result = minA - minB;
          break;
        }
        case 'descricao':
          result = (a.descricao || '').localeCompare(b.descricao || '');
          break;
        default:
          result = 0;
      }
      return sortDirection === 'asc' ? result : -result;
    });
  };

  const formatDateDisplay = (dateStr?: string, fallbackStart?: string) => {
    const str = dateStr || fallbackStart || '';
    if (str.length >= 10) {
      return `${str.substring(8, 10)}/${str.substring(5, 7)}/${str.substring(0, 4)}`;
    }
    return str || 'N/A';
  };

  const formatConstatado = (oc: Ocorrencia) => {
    if (oc.valorConstatado && oc.valorConstatado !== '00:00' && oc.valorConstatado !== '00:00:00') {
      return formatToHHMM(oc.valorConstatado);
    }
    // Resiliência de Fallback para INTERJORNADA_INSUFICIENTE se valorConstatado não veio preenchido no objeto legado
    if (oc.tipo === 'INTERJORNADA_INSUFICIENTE' && oc.descricao) {
      const match = oc.descricao.match(/Descanso realizado:\s*(\d{1,2}:\d{2})h?/i);
      if (match && match[1]) {
        return formatToHHMM(match[1]);
      }
    }
    return formatToHHMM(oc.valorConstatado);
  };

  const formatPermitido = (oc: Ocorrencia) => {
    if (oc.valorPermitido && oc.valorPermitido !== '00:00' && oc.valorPermitido !== '00:00:00') {
      return formatToHHMM(oc.valorPermitido);
    }
    if (oc.tipo === 'INTERJORNADA_INSUFICIENTE') {
      return '11:00';
    }
    return formatToHHMM(oc.valorPermitido);
  };

  const getGroupedOcorrencias = () => {
    const groups: Record<string, Ocorrencia[]> = {};
    const sorted = getSortedOcorrencias(ocorrencias);
    sorted.forEach((oc) => {
      const depto = oc.funcionarioDepartamento || 'Não Informado';
      if (!groups[depto]) {
        groups[depto] = [];
      }
      groups[depto].push(oc);
    });
    return groups;
  };

  const toggleRow = (id: string) => {
    setExpandedRowIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const renderRow = (oc: Ocorrencia) => {
    const isExpanded = !!expandedRowIds[oc.id];
    return (
      <React.Fragment key={oc.id}>
        {/* Linha Principal Interativa */}
        <tr
          onClick={() => toggleRow(oc.id)}
          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800 ${
            isExpanded ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
          }`}
        >
          <td className="px-4 py-3.5 whitespace-nowrap font-mono font-semibold text-slate-600 dark:text-slate-400 flex items-center space-x-1.5 select-none">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-blue-500 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            )}
            <span>
              {formatDateDisplay(oc.data, (oc as any).dataInicio)}
            </span>
          </td>
          <td className="px-4 py-3.5">
            <div className="font-bold text-slate-900 dark:text-white">
              {oc.funcionarioNome || oc.funcionarioId.replace('func_', 'Funcionário ')}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold mt-0.5">
              Matrícula: {oc.funcionarioMatricula || oc.funcionarioId}
            </div>
          </td>
          <td className="px-4 py-3.5 text-slate-800 dark:text-slate-100 font-medium">
            {oc.funcionarioDepartamento || 'Não Informado'}
          </td>
          <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-100">
            {TIPOS_OCORRENCIAS_LABELS[oc.tipo] || oc.tipo}
          </td>
          <td className="px-4 py-3.5 whitespace-nowrap text-center">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getSeverityBadge(oc.gravidade)}`}>
              {oc.gravidade}
            </span>
          </td>
          <td className="px-4 py-3.5 whitespace-nowrap text-center font-mono font-bold text-red-600 dark:text-red-400 bg-red-50/20 dark:bg-red-950/10 rounded">
            {formatConstatado(oc)}
          </td>
          <td className="px-4 py-3.5 whitespace-nowrap text-center font-mono font-bold text-teal-700 dark:text-teal-400 bg-teal-50/20 dark:bg-emerald-950/10 rounded">
            {formatPermitido(oc)}
          </td>
          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs truncate">
            {oc.descricao}
          </td>
        </tr>

        {/* Detalhes Expandidos da Linha */}
        {isExpanded && (
          <tr className="bg-slate-50/50 dark:bg-slate-950/40">
            <td colSpan={8} className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 animate-fade-in text-xs">
                
                {/* Header do card expandido */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-3 gap-2">
                  <span className="flex items-center space-x-1.5 font-bold text-slate-800 dark:text-slate-100">
                    <Clock className="h-4.5 w-4.5 text-blue-500" />
                    <span>Ficha de Análise de Ponto - {formatDateDisplay(oc.data, (oc as any).dataInicio)}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(oc.gravidade)}`}>
                    Nível de Alerta: {oc.gravidade}
                  </span>
                </div>

                {/* Detalhes do Colaborador e do desvio */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 leading-normal">
                  
                  <div className="space-y-1.5">
                    <strong className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Identificação do Colaborador</strong>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{oc.funcionarioNome}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Matrícula: {oc.funcionarioMatricula}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">Departamento: {oc.funcionarioDepartamento || 'Não Informado'}</p>
                  </div>

                  <div className="space-y-1.5">
                    <strong className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Tipo de Infração CLT</strong>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{TIPOS_OCORRENCIAS_LABELS[oc.tipo] || oc.tipo}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{oc.descricao}</p>
                  </div>

                  <div className="space-y-1.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850">
                    <strong className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Valores do Motor de Auditoria</strong>
                    <div className="grid grid-cols-2 gap-1 mt-1 font-mono text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block font-sans">Constatado</span>
                        <span className="font-bold text-red-600 dark:text-red-400">{formatConstatado(oc)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block font-sans">Permitido (CLT)</span>
                        <span className="font-bold text-teal-600 dark:text-teal-400">{formatPermitido(oc)}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Mensagem legal de compliance */}
                <div className="flex items-start space-x-2.5 p-3 bg-red-50/40 dark:bg-red-950/10 border border-red-100/60 dark:border-red-950/30 rounded-lg text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  <ShieldAlert className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-red-800 dark:text-red-400 block font-bold mb-0.5">Implicações Trabalhistas Relevantes:</strong>
                    Este desvio infringe diretamente as consolinações de leis de trabalho (CLT) sob as regras regulamentadas. Recomenda-se ajustar a escala do funcionário e alertar o gestor imediato ({oc.funcionarioNome}) para evitar acúmulo de horas extras indesejadas ou passivo trabalhista futuro.
                  </div>
                </div>

              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  const carregarOcorrencias = async () => {
    const t0 = performance.now();
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.append(key, val as string);
      });
      if (permitidoFilter) {
        params.append('valorPermitido', permitidoFilter);
      }
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const res = await fetch(`/api/ocorrencias?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOcorrencias(data.data);
        setTotalPages(data.totalPages);
        setTotalRecords(data.total);
      }
    } catch (err) {
      console.error('Erro ao buscar ocorrências auditadas:', err);
    } finally {
      console.log(`[Performance] Tempo de carregamento dos dados (Auditorias): ${(performance.now() - t0).toFixed(2)}ms`);
    }
  };

  const exportToCSV = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.append(key, val as string);
      });
      params.append('limit', '10000'); // Solicita todos os registros correspondentes aos filtros de BI
      
      const res = await fetch(`/api/ocorrencias?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const records = data.data || [];
        if (records.length === 0) {
          alert('Nenhum registro encontrado para exportar.');
          return;
        }

        let csvContent = '\ufeff'; // BOM UTF-8 para Excel aceitar acentuação em PT-BR
        csvContent += 'Data;Matricula;Nome;Departamento;Tipo de Desvio;Gravidade;Constatado;Permitido;Descricao Legal\n';
        
        records.forEach((oc: any) => {
          const formattedDate = formatDateDisplay(oc.data, oc.dataInicio);
          const label = TIPOS_OCORRENCIAS_LABELS[oc.tipo as TipoOcorrencia] || oc.tipo;
          const name = oc.funcionarioNome || '';
          const mat = oc.funcionarioMatricula || '';
          const depto = oc.funcionarioDepartamento || 'Não Informado';
          const constatado = formatConstatado(oc);
          const permitido = formatPermitido(oc);
          csvContent += `${formattedDate};${mat};${name};${depto};${label};${oc.gravidade};${constatado};${permitido};"${oc.descricao.replace(/"/g, '""')}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `auditoria_jornadas_${new Date().toISOString().substring(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.append(key, val as string);
      });
      params.append('limit', 'all');

      const [ocRes, funcRes, kpiRes] = await Promise.all([
        fetch(`/api/ocorrencias?${params.toString()}`),
        fetch(`/api/funcionarios?${params.toString()}`),
        fetch(`/api/dashboard/kpis?${params.toString()}`)
      ]);

      if (ocRes.ok && funcRes.ok) {
        const ocsData = await ocRes.json();
        const funcsData = await funcRes.json();
        const kpisData = kpiRes.ok ? await kpiRes.json() : null;

        let userInfo = { nomeCompleto: 'Usuário do Sistema', email: 'usuario@empresa.com', perfilAcesso: 'Administrador' };
        try {
          const sessionUserRaw = localStorage.getItem('audit_kairos_user');
          if (sessionUserRaw) {
            const parsed = JSON.parse(sessionUserRaw);
            if (parsed.nomeCompleto) userInfo = parsed;
          }
        } catch (e) {}

        generateAuditPDF({
          reportType: filters.tipoOcorrencia ? filters.tipoOcorrencia.toLowerCase() : 'todos_eventos',
          reportTitle: 'Relatório Geral de Auditoria Trabalhista (CLT)',
          ocorrencias: ocsData.data || ocorrencias,
          funcionarios: funcsData.data || [],
          kpis: kpisData,
          filters,
          companyInfo: {
            nome: filters.empresaId ? `Empresa ID ${filters.empresaId}` : 'Auditoria Trabalhista',
            cnpj: '00.000.000/0001-00'
          },
          userInfo,
          groupByDepartment: groupByDepto
        });
      }
    } catch (err) {
      console.error('Erro ao gerar PDF de auditoria:', err);
    }
  };

  const handleImprimirTela = async () => {
    try {
      let userInfo = { nomeCompleto: 'Usuário do Sistema', email: 'usuario@empresa.com', perfilAcesso: 'Administrador' };
      try {
        const sessionUserRaw = localStorage.getItem('audit_kairos_user');
        if (sessionUserRaw) {
          const parsed = JSON.parse(sessionUserRaw);
          if (parsed.nomeCompleto) userInfo = parsed;
        }
      } catch (e) {}

      const displayRecords = getSortedOcorrencias(ocorrencias);

      generateAuditPDF({
        reportType: 'todos_eventos',
        reportTitle: 'AUDITORIA DE JORNADAS (IMPRESSÃO DA TELA)',
        ocorrencias: displayRecords,
        funcionarios: [],
        kpis: null,
        filters,
        companyInfo: {
          nome: filters.empresaId ? `Empresa ID ${filters.empresaId}` : 'Auditoria Trabalhista',
          cnpj: '00.000.000/0001-00'
        },
        userInfo,
        groupByDepartment: groupByDepto
      });
    } catch (err) {
      console.error('Erro ao imprimir tela de auditoria:', err);
    }
  };

  const renderSortIcon = (colKey: string) => {
    if (sortColumn !== colKey || !sortDirection) {
      return <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100 transition-opacity inline ml-1 shrink-0" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-blue-600 dark:text-blue-400 inline ml-1 font-bold shrink-0" />
    ) : (
      <ArrowDown className="h-3 w-3 text-blue-600 dark:text-blue-400 inline ml-1 font-bold shrink-0" />
    );
  };

  useEffect(() => {
    // Quando mudamos filtros globais, volta para a página 1
    setPage(1);
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
    filters.dataFim
  ]);

  useEffect(() => {
    if (!isSyncing) {
      carregarOcorrencias();
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
    page,
    isSyncing,
    permitidoFilter
  ]);

  const TIPOS_OCORRENCIAS_LABELS: Record<TipoOcorrencia, string> = {
    JORNADA_EXCESSIVA: 'Jornada Excessiva (> 10h)',
    SEM_FOLGA_7_DIAS: 'Trabalho s/ Folga 7 Dias',
    DOMINGO_EXCESSIVO: 'Domingo Excessivo (> 6h)',
    DOMINGOS_SEGUIDOS: 'Dois Domingos Seguidos Trabalhados',
    INTERVALO_INSUFICIENTE: 'Intervalo Insuficiente',
    INTERJORNADA_INSUFICIENTE: 'Interjornada Curto (< 11h)',
    MARCACAO_IMPAR: 'Marcação Ímpar (Ponto Esquecido)',
    AUSENCIA: 'Ausência não Justificada',
    ATRASO_GRAVE: 'Atraso Superior a 15 Min',
    FALTA_RECORRENTE: 'Absenteísmo Recorrente'
  };

  const getSeverityBadge = (gravidade: string) => {
    switch (gravidade) {
      case 'CRITICO':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'ALTO':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIO':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors duration-150" id="auditorias-root">
      {/* 1. Header do Painel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <ClipboardCheck className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-display font-bold text-slate-800 dark:text-white text-base">
              Relatório Geral de Auditoria Trabalhista (CLT)
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Visualização analítica de todos os desvios de jornada levantados pelo motor de cálculo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1.5">
            Total Encontrado: <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{totalRecords} registros</span>
          </span>
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer shadow-sm"
            title="Exportar dados para Excel/CSV"
            id="btn-export-auditoria-csv"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={handleGeneratePDF}
            className="flex items-center space-x-1 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 dark:bg-teal-950/30 dark:hover:bg-teal-950/50 dark:border-teal-800 dark:text-teal-300 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer shadow-sm"
            title="Gerar Relatório PDF Corporativo de Auditoria Trabalhista"
            id="btn-export-auditoria-pdf"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Gerar PDF</span>
          </button>
          <button
            onClick={handleImprimirTela}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer shadow-sm"
            title="Imprimir Tela Atual em PDF (A4 Paisagem)"
            id="btn-imprimir-tela-auditoria"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir Tela</span>
          </button>
        </div>
      </div>

      {/* 2. Filtros Internos de Tabela */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-150 dark:border-slate-850 text-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 font-bold uppercase shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filtro Rápido de Infração:</span>
          </div>
          <select
            value={filters.tipoOcorrencia}
            onChange={(e) => setFilters({ ...filters, tipoOcorrencia: e.target.value })}
            className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-xs w-full sm:w-64"
            id="filtro-tipo-ocorrencia"
          >
            <option value="">Filtrar por qualquer tipo de desvio</option>
            {Object.entries(TIPOS_OCORRENCIAS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2 shrink-0 select-none no-print">
          <input
            type="checkbox"
            id="checkbox-group-depto"
            checked={groupByDepto}
            onChange={(e) => setGroupByDepto(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
          />
          <label htmlFor="checkbox-group-depto" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            Agrupar por Departamento
          </label>
        </div>
      </div>

      {/* 3. Tabela de Ocorrências */}
      <div className="overflow-x-auto border border-slate-100 rounded-lg">
        <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider select-none">
            <tr>
              <th onClick={() => handleSort('data')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Data</span>
                  {renderSortIcon('data')}
                </div>
              </th>
              <th onClick={() => handleSort('funcionario')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Funcionário</span>
                  {renderSortIcon('funcionario')}
                </div>
              </th>
              <th onClick={() => handleSort('departamento')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Departamento</span>
                  {renderSortIcon('departamento')}
                </div>
              </th>
              <th onClick={() => handleSort('tipo')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Tipo do Desvio</span>
                  {renderSortIcon('tipo')}
                </div>
              </th>
              <th onClick={() => handleSort('gravidade')} className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center justify-center space-x-1">
                  <span>Gravidade</span>
                  {renderSortIcon('gravidade')}
                </div>
              </th>
              <th onClick={() => handleSort('constatado')} className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center justify-center space-x-1">
                  <span>Constatado</span>
                  {renderSortIcon('constatado')}
                </div>
              </th>
              <th className="px-4 py-2 text-center">
                <div className="flex flex-col items-center justify-center space-y-1">
                  <div
                    onClick={() => handleSort('permitido')}
                    className="flex items-center justify-center space-x-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-full py-0.5 rounded"
                  >
                    <span>Permitido</span>
                    {renderSortIcon('permitido')}
                  </div>
                  <select
                    value={permitidoFilter}
                    onChange={(e) => setPermitidoFilter(e.target.value)}
                    className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal cursor-pointer text-center"
                    title="Filtro Dinâmico de Valor Permitido"
                    id="filtro-cabecalho-permitido"
                  >
                    <option value="">Todos</option>
                    {['6 dias', '1 domingo', '10h00', '11h00', '01:00', '00:15', '6h00'].map((val) => (
                      <option key={val} value={val}>
                        {val}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
              <th onClick={() => handleSort('descricao')} className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Descrição Detalhada</span>
                  {renderSortIcon('descricao')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 transition-colors duration-150 animate-fade-in">
            {ocorrencias.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-medium">
                  Excelente! Nenhuma irregularidade ou desvio encontrado na auditoria sob os critérios filtrados.
                </td>
              </tr>
            ) : groupByDepto ? (
              Object.entries(getGroupedOcorrencias()).map(([depto, rows]) => (
                <React.Fragment key={depto}>
                  {/* Linha Divisora do Departamento */}
                  <tr className="bg-slate-100 dark:bg-slate-800/85 text-slate-800 dark:text-slate-200 font-bold border-y border-slate-200 dark:border-slate-750">
                    <td colSpan={8} className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-left flex items-center space-x-1.5 select-none">
                      <FolderOpen className="h-4 w-4 text-blue-500 shrink-0" />
                      <span>Departamento: <strong>{depto}</strong> &nbsp;({rows.length} {rows.length === 1 ? 'registro' : 'registros'})</span>
                    </td>
                  </tr>
                  {rows.map((oc) => renderRow(oc))}
                </React.Fragment>
              ))
            ) : (
              getSortedOcorrencias(ocorrencias).map((oc) => renderRow(oc))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 select-none text-xs text-slate-500">
          <div>
            Exibindo página <span className="font-bold text-slate-800">{page}</span> de <span className="font-bold text-slate-800">{totalPages}</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1.5 border border-slate-200 hover:border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40"
              id="btn-page-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))
              .map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded font-semibold border transition-all cursor-pointer ${
                    p === page
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}

            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-1.5 border border-slate-200 hover:border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40"
              id="btn-page-next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
