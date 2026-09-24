/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { resolverEConsolidarVinculos } from '../utils/funcionarios';
import { 
  Users, 
  Search, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  Calendar, 
  Building, 
  Clock, 
  AlertTriangle,
  Briefcase,
  FileText,
  Download
} from 'lucide-react';
import { BIFilters, Funcionario, Ocorrencia } from '../types';
import { jsPDF } from 'jspdf';
import { formatToHHMM } from '../utils/hours';

interface FuncionariosProps {
  filters: BIFilters;
  setFilters: React.Dispatch<React.SetStateAction<BIFilters>>;
  setActiveTab: (tab: string) => void;
  isSyncing: boolean;
  user?: any;
}

export default function Funcionarios({
  filters,
  setFilters,
  setActiveTab,
  isSyncing
}: FuncionariosProps) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [allOcorrencias, setAllOcorrencias] = useState<Ocorrencia[]>([]);
  const [selectedFuncId, setSelectedFuncId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ATIVO' | 'DESLIGADO'>('ATIVO');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Carrega funcionários e ocorrências toda vez que sincroniza ou altera filtros globais
  const loadData = async () => {
    const t0 = performance.now();
    setLoading(true);
    try {
      // Carrega funcionários para pesquisa interativa livre (sem limite de 1000)
      const qParams = new URLSearchParams();
      if (filters.empresaId) qParams.append('empresaId', filters.empresaId);
      if (filters.departamento) qParams.append('departamento', filters.departamento);
      if (filters.centroCusto) qParams.append('centroCusto', filters.centroCusto);
      if (filters.cargo) qParams.append('cargo', filters.cargo);
      if (filters.gestor) qParams.append('gestor', filters.gestor);
      qParams.append('limit', 'all');

      const [resFunc, resOcs] = await Promise.all([
        fetch(`/api/funcionarios?${qParams.toString()}`),
        fetch(`/api/ocorrencias?limit=all`)
      ]);

      if (resFunc.ok) {
        const json = await resFunc.json();
        setFuncionarios(json.data || []);
        
        // Se houver funcionários e nenhum selecionado, seleciona o primeiro por padrão
        if (json.data && json.data.length > 0 && !selectedFuncId) {
          setSelectedFuncId(json.data[0].id);
        }
      }

      if (resOcs.ok) {
        const jsonOcs = await resOcs.json();
        setAllOcorrencias(jsonOcs.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do módulo Funcionários:', err);
    } finally {
      setLoading(false);
      console.log(`[Performance] Tempo de carregamento dos dados (Funcionários): ${(performance.now() - t0).toFixed(2)}ms`);
    }
  };

  useEffect(() => {
    if (!isSyncing) {
      loadData();
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

  useEffect(() => {
    if (filters.status === 'ATIVO' || filters.status === 'DESLIGADO' || filters.status === 'TODOS') {
      setStatusFilter(filters.status);
    } else if (!filters.status) {
      setStatusFilter('ATIVO');
    }
  }, [filters.status]);

  // Remove acentos e caracteres especiais para comparação insensível a acentuação e caixa
  const removeAccents = (str: string) => {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  };

  const consolidacao = useMemo(() => resolverEConsolidarVinculos(funcionarios), [funcionarios]);

  const baseList = useMemo(() => {
    if (statusFilter === 'DESLIGADO') return consolidacao.desligados;
    if (statusFilter === 'TODOS') return consolidacao.todos;
    return consolidacao.ativos;
  }, [consolidacao, statusFilter]);

  // Filtra funcionários localmente por busca avançada
  const filteredFuncionarios = useMemo(() => {
    return baseList.filter((func) => {
      if (!searchTerm) return true;

      // Busca avançada: remove acentos, normaliza caixa e remove espaços excedentes
      const cleanSearch = removeAccents(searchTerm);
      const searchTerms = cleanSearch.split(' ').filter(Boolean);
      
      if (searchTerms.length === 0) return true;

      const cleanNome = removeAccents(func.nome);
      const cleanMatricula = removeAccents(func.matricula || '');
      const cleanCPF = (func.cpf || '').replace(/\D/g, '');
      const cleanPIS = (func.pis || '').replace(/\D/g, '');
      const cleanCracha = removeAccents(func.cracha || '');
      const cleanID = removeAccents(func.id || '');
      
      // Estruturas organizacionais e adicionais
      const cleanDepto = removeAccents(func.departamento || '');
      const cleanCC = removeAccents(func.centroCusto || '');
      const cleanCargo = removeAccents(func.cargo || '');
      const cleanGestor = removeAccents(func.gestor || '');

      return searchTerms.every(term => 
        cleanNome.includes(term) ||
        cleanMatricula.includes(term) ||
        cleanCPF.includes(term) ||
        cleanPIS.includes(term) ||
        cleanCracha.includes(term) ||
        cleanID.includes(term) ||
        cleanDepto.includes(term) ||
        cleanCC.includes(term) ||
        cleanCargo.includes(term) ||
        cleanGestor.includes(term)
      );
    });
  }, [baseList, searchTerm]);

  // Mantém a seleção em sincronia com os funcionários visíveis
  useEffect(() => {
    if (filteredFuncionarios.length > 0) {
      const isStillVisible = filteredFuncionarios.some(f => f.id === selectedFuncId);
      if (!isStillVisible) {
        setSelectedFuncId(filteredFuncionarios[0].id);
      }
    } else {
      setSelectedFuncId(null);
    }
  }, [statusFilter, searchTerm, funcionarios, selectedFuncId]);

  // Funções de Exportação de Dados (CSV e PDF, Individual e Coletiva)
  const exportIndividualCSV = () => {
    if (!selectedFunc) return;
    const headers = ['Campo', 'Valor'];
    const rows = [
      ['ID', selectedFunc.id],
      ['Matricula', selectedFunc.matricula || ''],
      ['Nome', selectedFunc.nome],
      ['CPF', selectedFunc.cpf || ''],
      ['PIS', selectedFunc.pis || ''],
      ['Cargo', selectedFunc.cargo || ''],
      ['Departamento', selectedFunc.departamento || ''],
      ['Centro de Custo', selectedFunc.centroCusto || ''],
      ['Gestor', selectedFunc.gestor || ''],
      ['Score de Risco', selectedFunc.scoreRisco],
      ['Grau de Risco', selectedFunc.grauRisco],
      ['Status', selectedFunc.status || ''],
      [],
      ['Historico de Desvios CLT'],
      ['Data', 'Tipo', 'Descricao', 'Constatado', 'Permitido', 'Gravidade']
    ];

    selectedFuncOcorrencias.forEach(oc => {
      rows.push([
        oc.data,
        oc.tipo,
        oc.descricao,
        formatToHHMM(oc.valorConstatado),
        formatToHHMM(oc.valorPermitido),
        oc.gravidade
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(';'), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ficha_funcionario_${selectedFunc.matricula || selectedFunc.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportIndividualPDF = () => {
    if (!selectedFunc) return;
    const doc = new jsPDF();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('AUDITKAIROS COMPLIANCE - FICHA INDIVIDUAL', 14, 20);
    
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 25, 196, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO COLABORADOR', 14, 33);
    
    doc.setFont('helvetica', 'normal');
    let y = 40;
    const fields = [
      ['Nome:', selectedFunc.nome, 'Matricula:', selectedFunc.matricula || 'S/M'],
      ['CPF:', selectedFunc.cpf || 'S/M', 'PIS:', selectedFunc.pis || 'S/M'],
      ['Cargo:', selectedFunc.cargo || 'S/M', 'Departamento:', selectedFunc.departamento || 'S/M'],
      ['Centro Custo:', selectedFunc.centroCusto || 'S/M', 'Gestor:', selectedFunc.gestor || 'S/M'],
      ['Conformidade:', `${selectedFunc.scoreRisco} pts`, 'Risco:', selectedFunc.grauRisco],
      ['Status:', selectedFunc.status || 'ATIVO', 'Cracha:', selectedFunc.cracha || 'S/M']
    ];
    
    fields.forEach(row => {
      doc.setFont('helvetica', 'bold');
      doc.text(row[0], 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(row[1]), 44, y);
      
      doc.setFont('helvetica', 'bold');
      doc.text(row[2], 105, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(row[3]), 130, y);
      
      y += 6;
    });
    
    doc.line(14, y + 2, 196, y + 2);
    y += 10;
    
    doc.setFont('helvetica', 'bold');
    doc.text('HISTORICO DE DESVIOS CLT AUDITADOS', 14, y);
    y += 7;
    
    if (selectedFuncOcorrencias.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.text('Nenhum desvio ou irregularidade CLT foi identificado no periodo de apuracao.', 14, y);
    } else {
      // Header da Tabela
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('Data', 16, y + 5);
      doc.text('Tipo de Desvio', 36, y + 5);
      doc.text('Constatado', 85, y + 5);
      doc.text('Permitido', 110, y + 5);
      doc.text('Descricao', 132, y + 5);
      y += 12;
      doc.setFont('helvetica', 'normal');
      
      selectedFuncOcorrencias.forEach(oc => {
        if (y > 270) {
          doc.addPage();
          y = 20;
          doc.setFillColor(241, 245, 249);
          doc.rect(14, y, 182, 7, 'F');
          doc.setFont('helvetica', 'bold');
          doc.text('Data', 16, y + 5);
          doc.text('Tipo de Desvio', 36, y + 5);
          doc.text('Constatado', 85, y + 5);
          doc.text('Permitido', 110, y + 5);
          doc.text('Descricao', 132, y + 5);
          y += 12;
          doc.setFont('helvetica', 'normal');
        }
        
        const dateFormatted = new Date(oc.data + 'T12:00:00').toLocaleDateString('pt-BR');
        doc.text(dateFormatted, 16, y);
        doc.text(oc.tipo.substring(0, 20), 36, y);
        doc.text(String(formatToHHMM(oc.valorConstatado)), 85, y);
        doc.text(String(formatToHHMM(oc.valorPermitido)), 110, y);
        
        const descWrapped = doc.splitTextToSize(oc.descricao, 60);
        doc.text(descWrapped, 132, y);
        
        const rowHeight = Math.max(6, descWrapped.length * 4);
        doc.setDrawColor(241, 245, 249);
        doc.line(14, y + rowHeight - 2, 196, y + rowHeight - 2);
        y += rowHeight;
      });
    }
    
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Pagina ${i} de ${pageCount}`, 170, 287);
      doc.text(`Ficha Individual gerada em ${new Date().toLocaleString('pt-BR')}`, 14, 287);
    }
    
    doc.save(`ficha_${selectedFunc.matricula || selectedFunc.id}.pdf`);
  };

  const exportCollectiveCSV = () => {
    const headers = ['Matricula', 'Nome', 'CPF', 'PIS', 'Cargo', 'Departamento', 'Centro de Custo', 'Gestor', 'Score de Risco', 'Grau de Risco', 'Status'];
    const rows = filteredFuncionarios.map(f => [
      f.matricula || '',
      f.nome,
      f.cpf || '',
      f.pis || '',
      f.cargo || '',
      f.departamento || '',
      f.centroCusto || '',
      f.gestor || '',
      f.scoreRisco,
      f.grauRisco,
      f.status || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(';'), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_coletivo_funcionarios.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCollectivePDF = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('AUDITKAIROS COMPLIANCE - RELATORIO COLETIVO', 14, 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Filtro Categoria: ${statusFilter} | Total de Registros: ${filteredFuncionarios.length}`, 14, 26);
    
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 29, 196, 29);
    
    let y = 36;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Matr.', 16, y + 5.5);
    doc.text('Nome Completo', 32, y + 5.5);
    doc.text('Cargo / Departamento', 85, y + 5.5);
    doc.text('Score', 145, y + 5.5);
    doc.text('Grau Risco', 165, y + 5.5);
    y += 13;
    doc.setFont('helvetica', 'normal');
    
    filteredFuncionarios.forEach(f => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y, 182, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('Matr.', 16, y + 5.5);
        doc.text('Nome Completo', 32, y + 5.5);
        doc.text('Cargo / Departamento', 85, y + 5.5);
        doc.text('Score', 145, y + 5.5);
        doc.text('Grau Risco', 165, y + 5.5);
        y += 13;
        doc.setFont('helvetica', 'normal');
      }
      
      doc.text(f.matricula || 'S/M', 16, y);
      doc.text(f.nome.substring(0, 25), 32, y);
      doc.text(`${String(f.cargo).substring(0, 15)} / ${String(f.departamento).substring(0, 15)}`, 85, y);
      doc.text(`${f.scoreRisco} pts`, 145, y);
      doc.text(f.grauRisco, 165, y);
      
      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 2, 196, y + 2);
      y += 7;
    });
    
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Pagina ${i} de ${pageCount}`, 170, 287);
      doc.text(`Relatorio Coletivo gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 287);
    }
    
    doc.save(`relatorio_coletivo_${statusFilter.toLowerCase()}.pdf`);
  };

  const selectedFunc = funcionarios.find(f => f.id === selectedFuncId);
  const selectedFuncOcorrencias = allOcorrencias.filter(o => o.funcionarioId === selectedFuncId);

  // Estatísticas do funcionário selecionado
  const totalOcorrencias = selectedFuncOcorrencias.length;
  const criticasCount = selectedFuncOcorrencias.filter(o => o.gravidade === 'CRITICO' || o.gravidade === 'ALTO').length;

  return (
    <div className="space-y-6" id="funcionarios-module">
      {/* Cabeçalho do módulo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-500" />
            <span>Gestão e Ficha Auditiva de Funcionários</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pesquise por matrícula, nome ou CPF para analisar a conformidade legal e o histórico detalhado de ocorrências do colaborador.
          </p>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Painel Esquerdo: Lista de Funcionários com filtros de categoria */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-[650px] transition-colors duration-200">
          
          {/* Cabeçalho de Busca e Categorias */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
            
            {/* Campo de Pesquisa */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, matrícula ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Abas de Categorias: Ativos, Desligados, Todos */}
            <div className="flex bg-slate-150 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-850">
              <button
                onClick={() => {
                  setStatusFilter('ATIVO');
                  setFilters({ ...filters, status: 'ATIVO' });
                }}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md tracking-wider transition-all duration-150 flex items-center justify-center space-x-1 cursor-pointer ${
                  statusFilter === 'ATIVO'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Ativos ({consolidacao.ativos.length})</span>
              </button>
              <button
                onClick={() => {
                  setStatusFilter('DESLIGADO');
                  setFilters({ ...filters, status: 'DESLIGADO' });
                }}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md tracking-wider transition-all duration-150 flex items-center justify-center space-x-1 cursor-pointer ${
                  statusFilter === 'DESLIGADO'
                    ? 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <UserX className="h-3.5 w-3.5" />
                <span>Desligados ({consolidacao.desligados.length})</span>
              </button>
              <button
                onClick={() => {
                  setStatusFilter('TODOS');
                  setFilters({ ...filters, status: 'TODOS' });
                }}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md tracking-wider transition-all duration-150 flex items-center justify-center space-x-1 cursor-pointer ${
                  statusFilter === 'TODOS'
                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>Todos ({consolidacao.todos.length})</span>
              </button>
            </div>

            {/* Botões de Exportação Coletiva */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={exportCollectiveCSV}
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-[10px] font-bold uppercase rounded-md text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center space-x-1 cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <Download className="h-3 w-3" />
                <span>Exportar Lista (CSV)</span>
              </button>
              <button
                onClick={exportCollectivePDF}
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-[10px] font-bold uppercase rounded-md text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center space-x-1 cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <FileText className="h-3 w-3" />
                <span>Exportar Lista (PDF)</span>
              </button>
            </div>
          </div>

          {/* Lista de colaboradores */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Carregando colaboradores...</div>
            ) : filteredFuncionarios.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum colaborador encontrado nesta categoria ou busca.
              </div>
            ) : (
              filteredFuncionarios.map((func) => {
                const isSelected = func.id === selectedFuncId;
                const scoreColor = func.scoreRisco >= 80 ? 'text-green-600' : func.scoreRisco >= 50 ? 'text-yellow-600' : 'text-red-600';
                
                return (
                  <div
                    key={func.id}
                    onClick={() => setSelectedFuncId(func.id)}
                    className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-150 cursor-pointer flex items-center justify-between ${
                      isSelected ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          M: {func.matricula || func.id.replace(/\D/g, '') || func.id}
                        </span>
                        {func.status === 'DESLIGADO' && (
                          <span className="text-[9px] font-bold text-red-600 bg-red-100 dark:bg-red-950/40 px-1 rounded">
                            Desligado
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate mt-1">
                        {func.nome}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {func.cargo} • {func.departamento}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`text-xs font-bold ${scoreColor}`}>
                        {func.scoreRisco} pts
                      </div>
                      <span className="text-[8px] uppercase font-bold text-slate-400">conformidade</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Painel Direito: Ficha detalhada e Auditorias */}
        <div className="lg:col-span-8 space-y-6">
          {selectedFunc ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6 space-y-6 transition-colors duration-200">
              
              {/* Header da Ficha */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between border-b border-slate-150 dark:border-slate-800 pb-5 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono">
                      MATRÍCULA: {selectedFunc.matricula || selectedFunc.id.replace(/\D/g, '') || selectedFunc.id}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      selectedFunc.status === 'DESLIGADO' 
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' 
                        : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                    }`}>
                      {selectedFunc.status || 'ATIVO'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {selectedFunc.nome}
                  </h3>
                  
                  {/* Botões de Exportação Individual */}
                  <div className="flex gap-2 my-2.5">
                    <button
                      onClick={exportIndividualCSV}
                      className="py-1 px-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400 rounded-md border border-blue-200/60 dark:border-blue-900/40 flex items-center space-x-1 transition-all cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Exportar Ficha (CSV)</span>
                    </button>
                    <button
                      onClick={exportIndividualPDF}
                      className="py-1 px-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400 rounded-md border border-blue-200/60 dark:border-blue-900/40 flex items-center space-x-1 transition-all cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Exportar Ficha (PDF)</span>
                    </button>
                  </div>

                  {/* Dados adicionais */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 mt-2">
                    <span className="flex items-center space-x-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <strong className="text-slate-700 dark:text-slate-300">Cargo:</strong> {selectedFunc.cargo}
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <strong className="text-slate-700 dark:text-slate-300">Departamento:</strong> {selectedFunc.departamento}
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <strong className="text-slate-700 dark:text-slate-300">Centro de Custo:</strong> {selectedFunc.centroCusto}
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <strong className="text-slate-700 dark:text-slate-300">Gestor:</strong> {selectedFunc.gestor}
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <strong className="text-slate-700 dark:text-slate-300">CPF:</strong> {selectedFunc.cpf}
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <strong className="text-slate-700 dark:text-slate-300">PIS:</strong> {selectedFunc.pis}
                    </span>
                  </div>
                </div>

                {/* Score de risco grande */}
                <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shrink-0 w-32 shadow-sm text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Conformidade</span>
                  <span className={`text-2xl font-black mt-1 ${
                    selectedFunc.scoreRisco >= 80 ? 'text-green-600' : selectedFunc.scoreRisco >= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {selectedFunc.scoreRisco} pts
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase">
                    Risco: {selectedFunc.grauRisco}
                  </span>
                </div>
              </div>

              {/* KPIs rápidas do colaborador */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-150 dark:border-slate-800 rounded-xl p-4 flex items-center space-x-3.5">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center font-bold">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-[10px] uppercase font-bold text-slate-400 leading-tight">Total de Desvios CLT</h5>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{totalOcorrencias}</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-150 dark:border-slate-800 rounded-xl p-4 flex items-center space-x-3.5">
                  <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center font-bold">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-[10px] uppercase font-bold text-slate-400 leading-tight">Casos Críticos / Altos</h5>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{criticasCount}</p>
                  </div>
                </div>
              </div>

              {/* Histórico detalhado de desvios CLT */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>Histórico de Desvios Auditados</span>
                </h4>

                {selectedFuncOcorrencias.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    Excelente! Este colaborador possui 100% de conformidade nas batidas de ponto auditadas.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {selectedFuncOcorrencias.map((oc) => {
                      const gravBg = 
                        oc.gravidade === 'CRITICO' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                        oc.gravidade === 'ALTO' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300';

                      return (
                        <div 
                          key={oc.id}
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl shadow-sm space-y-2.5 transition-colors duration-150"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-[10px] font-mono font-bold text-slate-500 flex items-center gap-1.5 flex-wrap">
                              <span className="flex items-center space-x-1 shrink-0">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                <span>{new Date(oc.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                              </span>
                              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
                              <span className="text-blue-700 dark:text-blue-400 font-extrabold uppercase tracking-wider text-[9px] bg-blue-50/80 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                                {(() => {
                                  switch (oc.tipo) {
                                    case 'JORNADA_EXCESSIVA': return 'Jornada Excessiva';
                                    case 'INTERVALO_INSUFICIENTE': return 'Refeição Insuficiente';
                                    case 'INTERJORNADA_INSUFICIENTE': return 'Interjornada Curto';
                                    case 'MARCACAO_IMPAR': return 'Marcação Ímpar';
                                    case 'DOMINGO_EXCESSIVO': return 'Escala Domingo';
                                    case 'SEM_FOLGA_7_DIAS': return 'Acima 6 dias s/ folga';
                                    case 'AUSENCIA': return 'Falta / Ausência';
                                    case 'ATRASO_GRAVE': return 'Atraso Grave';
                                    case 'FALTA_RECORRENTE': return 'Faltas Recorrentes';
                                    default: return oc.tipo.replace(/_/g, ' ');
                                  }
                                })()}
                              </span>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${gravBg}`}>
                              {oc.gravidade}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {oc.descricao}
                          </p>

                          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-900 text-[10px] leading-tight">
                            <span className="text-slate-500">
                              <strong className="text-slate-600 dark:text-slate-400">Constatado:</strong> {formatToHHMM(oc.valorConstatado)}
                            </span>
                            <span className="text-slate-500">
                              <strong className="text-slate-600 dark:text-slate-400">Permitido (CLT):</strong> {formatToHHMM(oc.valorPermitido)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 text-slate-400 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              Selecione um funcionário no menu ao lado para visualizar os detalhes.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
