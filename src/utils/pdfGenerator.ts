/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { Ocorrencia, Funcionario, BIFilters, DashboardKPIs } from '../types';
import { formatToHHMM } from './hours';

export interface PDFGeneratorOptions {
  reportType: string;
  reportTitle: string;
  ocorrencias: Ocorrencia[];
  funcionarios: Funcionario[];
  kpis: DashboardKPIs | null;
  filters: BIFilters;
  companyInfo?: {
    nome: string;
    cnpj: string;
  };
  userInfo?: {
    nomeCompleto: string;
    email: string;
    perfilAcesso: string;
  };
  localDeptoFilter?: string;
  selectedFuncionarioId?: string;
  groupByDepartment?: boolean;
}

// Formata data ISO (YYYY-MM-DD) para DD/MM/YYYY
export function formatDateBR(dateStr: string | undefined | null): string {
  if (!dateStr) return '--/--/----';
  if (dateStr.length >= 10 && dateStr.includes('-')) {
    const parts = dateStr.substring(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return dateStr;
}

// Registra log de auditoria no servidor
export async function logReportExportServer(
  tipoRelatorio: string,
  periodo: string,
  registrosExportados: number,
  usuarioEmissor: string
) {
  try {
    const sessionToken = localStorage.getItem('audit_kairos_session_token');
    await fetch('/api/audit/log-export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { 'x-session-token': sessionToken } : {})
      },
      body: JSON.stringify({
        tipoRelatorio,
        periodo,
        registrosExportados,
        usuarioEmissor,
        formato: 'PDF'
      })
    });
  } catch (err) {
    console.error('Falha ao registrar log de auditoria de relatório:', err);
  }
}

export function generateAuditPDF(options: PDFGeneratorOptions) {
  const {
    reportType,
    reportTitle,
    ocorrencias,
    funcionarios,
    kpis,
    filters,
    companyInfo = { nome: 'Auditoria Trabalhista', cnpj: '00.000.000/0001-00' },
    userInfo = { nomeCompleto: 'Usuário do Sistema', email: 'usuario@empresa.com', perfilAcesso: 'Administrador' },
    localDeptoFilter,
    selectedFuncionarioId,
    groupByDepartment
  } = options;

  // Obrigatório: A4 Paisagem (Landscape: 297mm x 210mm)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 10;
  const contentWidth = pageWidth - marginX * 2; // 277mm

  const now = new Date();
  const dateEmissao = now.toLocaleDateString('pt-BR');
  const horaEmissao = now.toLocaleTimeString('pt-BR');
  const usuarioEmissorText = `${userInfo.nomeCompleto} (${userInfo.email})`;

  // Período
  let periodoText = 'Período Vigente (Últimos 30 Dias)';
  if (filters.dataInicio && filters.dataFim) {
    periodoText = `${formatDateBR(filters.dataInicio)} a ${formatDateBR(filters.dataFim)}`;
  } else if (filters.dataInicio) {
    periodoText = `A partir de ${formatDateBR(filters.dataInicio)}`;
  }

  // Subclassificação exclusiva do Relatório de Intervalo Intrajornada Insuficiente (PDF).
  // Espelha a mesma lógica usada na pré-visualização em tela (Relatorios.tsx) — não altera
  // o campo `tipo` da ocorrência, é só uma leitura derivada para organizar este PDF.
  const INTERVALO_SUBTIPOS_ORDEM_PDF = [
    'Sem Intervalo Registrado',
    'Intervalo Insuficiente (Jornada 4h–6h)',
    'Intervalo Insuficiente (Jornada > 6h)'
  ];
  const getIntervaloSubtipoPdf = (oc: Ocorrencia): string => {
    const desc = (oc.descricao || '').toLowerCase();
    if (desc.includes('sem intervalo intrajornada registrado')) {
      return 'Sem Intervalo Registrado';
    }
    if (oc.valorPermitido === '00:15' || oc.valorPermitido === '00:15:00') {
      return 'Intervalo Insuficiente (Jornada 4h–6h)';
    }
    return 'Intervalo Insuficiente (Jornada > 6h)';
  };

  // Filtragem de registros de acordo com o relatório e filtros locais
  let records = [...ocorrencias];

  // Aplica regras de tipos de relatórios
  if (reportType === 'jornada') {
    records = records.filter((o) => o.tipo === 'JORNADA_EXCESSIVA');
  } else if (reportType === 'interjornada') {
    records = records.filter((o) => o.tipo === 'INTERJORNADA_INSUFICIENTE');
  } else if (reportType === 'intervalos') {
    records = records.filter((o) => o.tipo === 'INTERVALO_INSUFICIENTE');
  } else if (reportType === 'domingos') {
    records = records.filter((o) => {
      if (o.tipo !== 'DOMINGO_EXCESSIVO' && o.tipo !== 'DOMINGOS_SEGUIDOS') return false;
      const desc = (o.descricao || '').toLowerCase();
      if (desc.includes('folga autorizada') || desc.includes('abono') || desc.includes('afastamento')) {
        return false;
      }
      return true;
    });
  } else if (reportType === 'trabalho_7_dias') {
    records = records.filter((o) => o.tipo === 'SEM_FOLGA_7_DIAS' || o.tipo === 'DOMINGOS_SEGUIDOS');
  } else if (reportType === 'horas_extras') {
    records = records.filter((o) => o.tipo === 'JORNADA_EXCESSIVA' || (o.descricao || '').toLowerCase().includes('extra'));
  } else if (reportType === 'dsr') {
    records = records.filter((o) => o.tipo === 'SEM_FOLGA_7_DIAS' || o.tipo === 'DOMINGO_EXCESSIVO');
  } else if (reportType === 'marcacoes_inconsistentes') {
    records = records.filter((o) => o.tipo === 'MARCACAO_IMPAR' || o.tipo === 'ATRASO_GRAVE');
  } else if (reportType === 'ausencia_marcacao') {
    records = records.filter((o) => o.tipo === 'AUSENCIA' || o.tipo === 'FALTA_RECORRENTE');
  } else if (reportType === 'jornadas_excepcionais') {
    records = records.filter((o) => o.tipo === 'JORNADA_EXCESSIVA' || (o.descricao || '').toLowerCase().includes('noturn'));
  } else if (reportType === 'banco_horas') {
    records = records.filter((o) => (o.descricao || '').toLowerCase().includes('banco') || o.tipo === 'JORNADA_EXCESSIVA');
  } else if (reportType === 'consolidado_funcionario' && selectedFuncionarioId) {
    records = records.filter((o) => o.funcionarioId === selectedFuncionarioId);
  }

  // Filtro por departamento local (caso selecionado)
  if (localDeptoFilter) {
    records = records.filter((r) => {
      const emp = funcionarios.find((f) => f.id === r.funcionarioId);
      return (emp?.departamento || r.funcionarioDepartamento) === localDeptoFilter;
    });
  }

  // Métricas para o Resumo Executivo
  const totalOcorrencias = records.length;
  const affectedEmployeeIds = new Set(records.map((r) => r.funcionarioId));
  const totalFuncionariosAfetados = affectedEmployeeIds.size;
  const totalFuncionariosAuditados = funcionarios.length || kpis?.totalFuncionarios || Math.max(totalFuncionariosAfetados, 1);
  const scoreConformidade = kpis?.scoreGeralConformidade ?? (totalOcorrencias === 0 ? 100 : Math.max(0, Math.round(100 - (totalOcorrencias / totalFuncionariosAuditados) * 15)));
  const percentNaoConformidade = Math.round(100 - scoreConformidade);

  const impactedDeptos = new Set(records.map((r) => {
    const emp = funcionarios.find((f) => f.id === r.funcionarioId);
    return emp?.departamento || r.funcionarioDepartamento || 'Não Informado';
  }));
  const totalDeptosImpactados = impactedDeptos.size;

  // Função para desenhar o Cabeçalho Institucional
  const drawPageHeader = (pNum: number) => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 11, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Auditoria Trabalhista — SISTEMA DE AUDITORIA TRABALHISTA CLT', marginX, 7.5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Página ${pNum}`, pageWidth - marginX - 15, 7.5);

    // Bloco Institucional da Empresa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const companyDisplayName = companyInfo.nome && !companyInfo.nome.toLowerCase().includes('dimep') ? companyInfo.nome.toUpperCase() : 'Auditoria Trabalhista';
    doc.text(companyDisplayName, marginX, 18);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`CNPJ: ${companyInfo.cnpj}  |  Emissão: ${dateEmissao} às ${horaEmissao}  |  Emissor: ${usuarioEmissorText}`, marginX, 23);

    // Título do Relatório
    doc.setFillColor(30, 58, 138); // blue-900
    doc.rect(marginX, 26, contentWidth, 6.5, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`RELATÓRIO: ${reportTitle.toUpperCase()}`, marginX + 3, 30.5);

    // Período e Filtros
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Período Analisado: ${periodoText} ${localDeptoFilter ? ` | Depto: ${localDeptoFilter}` : ''}`, marginX, 36.5);

    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, 38, pageWidth - marginX, 38);
  };

  // Função para desenhar o Rodapé Institucional
  const drawPageFooter = (pNum: number, totalP: number) => {
    const footerY = 202;
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, footerY - 3, pageWidth - marginX, footerY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Auditoria Trabalhista Compliance Guard — Documento Oficial de Auditoria Trabalhista Gerado em ${dateEmissao} ${horaEmissao}`, marginX, footerY);
    doc.text(`Página ${pNum} de ${totalP}`, pageWidth - marginX - 22, footerY);
  };

  // Desenha o Cabeçalho da Página 1
  drawPageHeader(1);

  let y = 42;

  // 1. RESUMO EXECUTIVO (Card Corporativo de KPIs)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, y, contentWidth, 22, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, y, contentWidth, 22, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138);
  doc.text('RESUMO EXECUTIVO DA AUDITORIA TRABALHISTA', marginX + 3, y + 4.5);

  // Linha 1 de KPIs
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);

  doc.text('Colaboradores Auditados:', marginX + 3, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(String(totalFuncionariosAuditados), marginX + 42, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Ocorrências Encontradas:', marginX + 80, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 38, 38);
  doc.text(String(totalOcorrencias), marginX + 118, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Funcionários Afetados:', marginX + 155, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(String(totalFuncionariosAfetados), marginX + 190, y + 10);

  // Linha 2 de KPIs
  doc.setFont('helvetica', 'bold');
  doc.text('Índice de Conformidade:', marginX + 3, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(scoreConformidade >= 80 ? 16 : 220, scoreConformidade >= 80 ? 185 : 38, scoreConformidade >= 80 ? 129 : 38);
  doc.text(`${scoreConformidade}%`, marginX + 42, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Índice Não Conformidade:', marginX + 80, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(`${percentNaoConformidade}%`, marginX + 118, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.text('Departamentos Impactados:', marginX + 155, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(String(totalDeptosImpactados), marginX + 198, y + 16);

  y += 26;

  // Seções específicas por tipo de relatório
  if (reportType === 'resumo') {
    // Distribuição por Gravidade
    doc.setFillColor(30, 58, 138);
    doc.rect(marginX, y, contentWidth, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('1. DISTRIBUIÇÃO DAS OCORRÊNCIAS POR GRAVIDADE', marginX + 3, y + 4);
    y += 7;

    const criticosCount = records.filter(r => r.gravidade === 'CRITICO').length;
    const altosCount = records.filter(r => r.gravidade === 'ALTO').length;
    const mediosCount = records.filter(r => r.gravidade === 'MEDIO').length;
    const baixosCount = records.filter(r => r.gravidade === 'BAIXO').length;

    const cardW = (contentWidth - 9) / 4;
    const drawGravCard = (xPos: number, title: string, val: number, colorRgb: [number, number, number]) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(xPos, y, cardW, 11, 1, 1, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(xPos, y, cardW, 11, 1, 1, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      doc.text(title, xPos + 2, y + 4);

      const pct = totalOcorrencias ? Math.round((val / totalOcorrencias) * 100) : 0;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(colorRgb[0], colorRgb[1], colorRgb[2]);
      doc.text(`${val} (${pct}%)`, xPos + 2, y + 9);
    };

    drawGravCard(marginX, 'CRÍTICO', criticosCount, [185, 28, 28]);
    drawGravCard(marginX + cardW + 3, 'ALTO', altosCount, [194, 65, 12]);
    drawGravCard(marginX + (cardW + 3) * 2, 'MÉDIO', mediosCount, [180, 83, 9]);
    drawGravCard(marginX + (cardW + 3) * 3, 'BAIXO', baixosCount, [21, 128, 61]);
    y += 15;

    // Ranking de Eventos Identificados
    doc.setFillColor(30, 58, 138);
    doc.rect(marginX, y, contentWidth, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('2. RANKING DE EVENTOS / INFRAÇÕES IDENTIFICADAS', marginX + 3, y + 4);
    y += 7;

    const eventosMap: Record<string, { nome: string; count: number; colabs: Set<string> }> = {};
    const EVENTO_LABELS: Record<string, string> = {
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

    records.forEach(o => {
      const key = o.tipo || 'OUTROS';
      if (!eventosMap[key]) {
        eventosMap[key] = {
          nome: EVENTO_LABELS[key] || key.replace(/_/g, ' '),
          count: 0,
          colabs: new Set()
        };
      }
      eventosMap[key].count++;
      eventosMap[key].colabs.add(o.funcionarioId);
    });

    const rankingEventos = Object.values(eventosMap).sort((a, b) => b.count - a.count);

    doc.setFillColor(226, 232, 240);
    doc.rect(marginX, y, contentWidth, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Evento / Tipo de Infração CLT', marginX + 3, y + 3.5);
    doc.text('Ocorrências', marginX + 160, y + 3.5);
    doc.text('% do Total', marginX + 200, y + 3.5);
    doc.text('Colaboradores Afetados', marginX + 235, y + 3.5);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);

    rankingEventos.forEach(ev => {
      if (y > 185) {
        doc.addPage();
        drawPageHeader(doc.getNumberOfPages());
        y = 42;
      }
      const pct = totalOcorrencias ? Math.round((ev.count / totalOcorrencias) * 100) : 0;
      doc.text(ev.nome, marginX + 3, y);
      doc.text(String(ev.count), marginX + 160, y);
      doc.text(`${pct}%`, marginX + 200, y);
      doc.text(String(ev.colabs.size), marginX + 235, y);

      doc.setDrawColor(241, 245, 249);
      doc.line(marginX, y + 1.5, pageWidth - marginX, y + 1.5);
      y += 5;
    });

  } else {
    // Seções específicas para os demais relatórios
    if (reportType === 'interjornada') {
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(252, 165, 165);
      doc.roundedRect(marginX, y, contentWidth, 12, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(153, 27, 27);
      doc.text('ENQUADRAMENTO LEGAL — ART. 66 DA CLT (DESCANSO INTERJORNADA MÍNIMO DE 11 HORAS)', marginX + 3, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text('Entre duas jornadas de trabalho haverá um período mínimo de 11 (onze) horas consecutivas para descanso. A não observância enseja pagamento de horas extras integrais (Súmula 110 do TST).', marginX + 3, y + 9);
      y += 16;
    } else if (reportType === 'intervalos') {
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(252, 165, 165);
      doc.roundedRect(marginX, y, contentWidth, 12, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(153, 27, 27);
      doc.text('ENQUADRAMENTO LEGAL — ART. 71 DA CLT (INTERVALO INTRAJORNADA DE REFEIÇÃO E DESCANSO)', marginX + 3, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text('Jornadas acima de 6h exigem intervalo mínimo de 1h (HH:MM). A supressão total ou parcial gera natureza indenizatória com acréscimo de 50% sobre o valor da hora normal.', marginX + 3, y + 9);
      y += 16;
    }

    // Tabela Detalhada de Ocorrências Padrão em Paisagem (277mm)
    const drawTableHeader = (currY: number) => {
      doc.setFillColor(226, 232, 240);
      doc.rect(marginX, currY, contentWidth, 6.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);

      if (reportType === 'interjornada') {
        doc.text('Data', marginX + 3, currY + 4.5);
        doc.text('Matrícula', marginX + 28, currY + 4.5);
        doc.text('Funcionário', marginX + 52, currY + 4.5);
        doc.text('Departamento', marginX + 130, currY + 4.5);
        doc.text('Saída Ant.', marginX + 185, currY + 4.5);
        doc.text('Entrada Atual', marginX + 210, currY + 4.5);
        doc.text('Efetivo', marginX + 238, currY + 4.5);
        doc.text('Permitido', marginX + 260, currY + 4.5);
      } else if (reportType === 'intervalos') {
        doc.text('Data', marginX + 3, currY + 4.5);
        doc.text('Matrícula', marginX + 28, currY + 4.5);
        doc.text('Funcionário', marginX + 52, currY + 4.5);
        doc.text('Departamento', marginX + 130, currY + 4.5);
        doc.text('Efetivo (HH:MM)', marginX + 190, currY + 4.5);
        doc.text('Mínimo (HH:MM)', marginX + 225, currY + 4.5);
        doc.text('Gravidade', marginX + 255, currY + 4.5);
      } else if (reportType === 'jornada') {
        doc.text('Data', marginX + 3, currY + 4.5);
        doc.text('Matrícula', marginX + 28, currY + 4.5);
        doc.text('Funcionário', marginX + 52, currY + 4.5);
        doc.text('Departamento', marginX + 130, currY + 4.5);
        doc.text('Jornada Realizada', marginX + 190, currY + 4.5);
        doc.text('Limite Legal', marginX + 225, currY + 4.5);
        doc.text('Gravidade', marginX + 255, currY + 4.5);
      } else if (reportType === 'ranking' || reportType === 'criticos') {
        doc.text('Matrícula', marginX + 3, currY + 4.5);
        doc.text('Funcionário', marginX + 28, currY + 4.5);
        doc.text('Cargo / Depto', marginX + 115, currY + 4.5);
        doc.text('Centro de Custo', marginX + 185, currY + 4.5);
        doc.text('Grau Risco', marginX + 235, currY + 4.5);
        doc.text('Score', marginX + 260, currY + 4.5);
      } else {
        doc.text('Data', marginX + 3, currY + 4.5);
        doc.text('Matrícula', marginX + 25, currY + 4.5);
        doc.text('Funcionário', marginX + 48, currY + 4.5);
        doc.text('Departamento', marginX + 115, currY + 4.5);
        doc.text('Gravidade', marginX + 160, currY + 4.5);
        doc.text('Constatado', marginX + 180, currY + 4.5);
        doc.text('Permitido', marginX + 200, currY + 4.5);
        doc.text('Descrição da Irregularidade', marginX + 220, currY + 4.5);
      }
    };

    const isGroupedByDepto = groupByDepartment || filters.departamento === 'AGRUPAR_DEPARTAMENTO' || reportType === 'compilado_deptos';

    if (isGroupedByDepto && reportType !== 'ranking' && reportType !== 'criticos') {
      const deptoMap: Record<string, typeof records> = {};
      records.forEach((r) => {
        const emp = funcionarios.find((f) => f.id === r.funcionarioId);
        const dName = emp?.departamento || r.funcionarioDepartamento || 'Não Informado';
        if (!deptoMap[dName]) deptoMap[dName] = [];
        deptoMap[dName].push(r);
      });

      const deptoEntries = Object.entries(deptoMap);

      if (deptoEntries.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139);
        doc.text('Excelente! Nenhuma ocorrência de irregularidade encontrada para os critérios filtrados.', marginX + 5, y + 5);
        y += 12;
      } else {
        deptoEntries.forEach(([dName, dRecords], groupIdx) => {
          if (groupIdx > 0) {
            doc.addPage();
            drawPageHeader(doc.getNumberOfPages());
            y = 42;
          }

          const affectedFuncs = new Set(dRecords.map((r) => r.funcionarioId)).size;
          const totalOcs = dRecords.length;
          const critCount = dRecords.filter((r) => r.gravidade === 'CRITICO').length;
          const altaCount = dRecords.filter((r) => r.gravidade === 'ALTO').length;
          const mediaCount = dRecords.filter((r) => r.gravidade === 'MEDIO' || r.gravidade === 'BAIXO').length;

          doc.setFillColor(241, 245, 249);
          doc.setDrawColor(203, 213, 225);
          doc.roundedRect(marginX, y, contentWidth, 14, 2, 2, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(30, 58, 138);
          doc.text(`DEPARTAMENTO: ${dName.toUpperCase()}`, marginX + 3, y + 4.5);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(51, 65, 85);
          doc.text(`Colaboradores Afetados: ${affectedFuncs}  |  Total Ocorrências: ${totalOcs}  |  Distribuição: ${critCount} Críticas, ${altaCount} Altas, ${mediaCount} Médias/Baixas`, marginX + 3, y + 9.5);

          y += 17;

          drawTableHeader(y);
          y += 8;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(15, 23, 42);

          dRecords.forEach((r) => {
            if (y > 185) {
              doc.addPage();
              drawPageHeader(doc.getNumberOfPages());
              y = 42;
              drawTableHeader(y);
              y += 8;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(6.5);
              doc.setTextColor(15, 23, 42);
            }

            const emp = funcionarios.find((f) => f.id === r.funcionarioId);
            const matricula = emp?.matricula || r.funcionarioMatricula || 'S/M';
            const nome = emp?.nome || r.funcionarioNome || r.funcionarioId.replace('func_', 'Funcionário ');
            const dataFormatted = formatDateBR(r.data);

            if (reportType === 'interjornada') {
              let horaSaidaAnt = '22:00';
              let horaEntradaAtual = '06:00';
              const desc = r.descricao || '';
              if (desc.includes('saída anterior:')) {
                const m = desc.match(/saída anterior:\s*([0-9]{2}:[0-9]{2})/i);
                if (m) horaSaidaAnt = m[1];
              }
              if (desc.includes('entrada atual:')) {
                const m = desc.match(/entrada atual:\s*([0-9]{2}:[0-9]{2})/i);
                if (m) horaEntradaAtual = m[1];
              }

              doc.text(dataFormatted, marginX + 3, y);
              doc.text(matricula, marginX + 28, y);
              doc.text(nome.substring(0, 38), marginX + 52, y);
              doc.text(horaSaidaAnt, marginX + 185, y);
              doc.text(horaEntradaAtual, marginX + 210, y);
              doc.text(formatToHHMM(r.valorConstatado), marginX + 238, y);
              doc.text(formatToHHMM(r.valorPermitido), marginX + 260, y);

              doc.setDrawColor(241, 245, 249);
              doc.line(marginX, y + 1.5, pageWidth - marginX, y + 1.5);
              y += 5.5;
            } else if (reportType === 'intervalos') {
              doc.text(dataFormatted, marginX + 3, y);
              doc.text(matricula, marginX + 28, y);
              doc.text(nome.substring(0, 38), marginX + 52, y);
              doc.text(formatToHHMM(r.valorConstatado), marginX + 190, y);
              doc.text(formatToHHMM(r.valorPermitido), marginX + 225, y);
              doc.text(String(r.gravidade), marginX + 255, y);

              doc.setDrawColor(241, 245, 249);
              doc.line(marginX, y + 1.5, pageWidth - marginX, y + 1.5);
              y += 5.5;
            } else if (reportType === 'jornada') {
              doc.text(dataFormatted, marginX + 3, y);
              doc.text(matricula, marginX + 28, y);
              doc.text(nome.substring(0, 38), marginX + 52, y);
              doc.text(formatToHHMM(r.valorConstatado), marginX + 190, y);
              doc.text(formatToHHMM(r.valorPermitido), marginX + 225, y);
              doc.text(String(r.gravidade), marginX + 255, y);

              doc.setDrawColor(241, 245, 249);
              doc.line(marginX, y + 1.5, pageWidth - marginX, y + 1.5);
              y += 5.5;
            } else {
              doc.text(dataFormatted, marginX + 3, y);
              doc.text(matricula, marginX + 25, y);
              doc.text(nome.substring(0, 32), marginX + 48, y);
              doc.text(String(r.gravidade), marginX + 160, y);
              doc.text(formatToHHMM(r.valorConstatado), marginX + 180, y);
              doc.text(formatToHHMM(r.valorPermitido), marginX + 200, y);

              const descLines = doc.splitTextToSize(r.descricao, 52);
              doc.text(descLines, marginX + 220, y);

              const rowH = Math.max(5.5, descLines.length * 3);
              doc.setDrawColor(241, 245, 249);
              doc.line(marginX, y + rowH - 1.5, pageWidth - marginX, y + rowH - 1.5);
              y += rowH;
            }
          });
        });
      }
    } else if (records.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text('Excelente! Nenhuma ocorrência de irregularidade encontrada para os critérios filtrados.', marginX + 5, y + 5);
      y += 12;
    } else if (reportType === 'intervalos') {
      // Agrupamento em 3 categorias — exclusivo deste relatório, não afeta os demais reportTypes
      const subtipoMap: Record<string, typeof records> = {};
      records.forEach((r) => {
        const subtipo = getIntervaloSubtipoPdf(r);
        if (!subtipoMap[subtipo]) subtipoMap[subtipo] = [];
        subtipoMap[subtipo].push(r);
      });

      const subtipoEntries = INTERVALO_SUBTIPOS_ORDEM_PDF
        .filter((s) => subtipoMap[s] && subtipoMap[s].length > 0)
        .map((s) => [s, subtipoMap[s]] as [string, typeof records]);

      subtipoEntries.forEach(([subtipo, sRecords], groupIdx) => {
        if (groupIdx > 0) {
          doc.addPage();
          drawPageHeader(doc.getNumberOfPages());
          y = 42;
        }

        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(252, 165, 165);
        doc.roundedRect(marginX, y, contentWidth, 11, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(153, 27, 27);
        doc.text(`CATEGORIA: ${subtipo.toUpperCase()}  (${sRecords.length} ${sRecords.length === 1 ? 'REGISTRO' : 'REGISTROS'})`, marginX + 3, y + 7);

        y += 14;

        drawTableHeader(y);
        y += 8;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(15, 23, 42);

        sRecords.forEach((r) => {
          if (y > 185) {
            doc.addPage();
            drawPageHeader(doc.getNumberOfPages());
            y = 42;
            drawTableHeader(y);
            y += 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(15, 23, 42);
          }

          const emp = funcionarios.find((f) => f.id === r.funcionarioId);
          const matricula = emp?.matricula || r.funcionarioMatricula || 'S/M';
          const nome = emp?.nome || r.funcionarioNome || r.funcionarioId.replace('func_', 'Funcionário ');
          const depto = emp?.departamento || r.funcionarioDepartamento || 'Não Informado';
          const dataFormatted = formatDateBR(r.data);

          doc.text(dataFormatted, marginX + 3, y);
          doc.text(matricula, marginX + 28, y);
          doc.text(nome.substring(0, 32), marginX + 52, y);
          doc.text(depto.substring(0, 24), marginX + 130, y);
          doc.text(formatToHHMM(r.valorConstatado), marginX + 190, y);
          doc.text(formatToHHMM(r.valorPermitido), marginX + 225, y);
          doc.text(String(r.gravidade), marginX + 255, y);

          doc.setDrawColor(241, 245, 249);
          doc.line(marginX, y + 1.5, pageWidth - marginX, y + 1.5);
          y += 5.5;
        });
      });
    } else if (reportType === 'ranking' || reportType === 'criticos') {
      drawTableHeader(y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);

      const list = reportType === 'criticos'
        ? funcionarios.filter((f) => f.grauRisco === 'CRITICO' || f.grauRisco === 'ALTO').sort((a, b) => b.scoreRisco - a.scoreRisco)
        : funcionarios.sort((a, b) => b.scoreRisco - a.scoreRisco);

      list.forEach((f) => {
        if (y > 185) {
          doc.addPage();
          drawPageHeader(doc.getNumberOfPages());
          y = 42;
          drawTableHeader(y);
          y += 8;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(15, 23, 42);
        }

        doc.text(f.matricula || 'S/M', marginX + 3, y);
        doc.text(String(f.nome).substring(0, 38), marginX + 28, y);
        doc.text(`${String(f.cargo || '').substring(0, 22)} / ${String(f.departamento || '').substring(0, 22)}`, marginX + 115, y);
        doc.text(String(f.centroCusto || '').substring(0, 24), marginX + 185, y);
        doc.text(String(f.grauRisco), marginX + 235, y);
        doc.text(`${f.scoreRisco} pts`, marginX + 260, y);

        doc.setDrawColor(241, 245, 249);
        doc.line(marginX, y + 1.5, pageWidth - marginX, y + 1.5);
        y += 5.5;
      });
    } else {
      drawTableHeader(y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);

      records.forEach((r) => {
        if (y > 185) {
          doc.addPage();
          drawPageHeader(doc.getNumberOfPages());
          y = 42;
          drawTableHeader(y);
          y += 8;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(15, 23, 42);
        }

        const emp = funcionarios.find((f) => f.id === r.funcionarioId);
        const matricula = emp?.matricula || r.funcionarioMatricula || 'S/M';
        const nome = emp?.nome || r.funcionarioNome || r.funcionarioId.replace('func_', 'Funcionário ');
        const depto = emp?.departamento || r.funcionarioDepartamento || 'Não Informado';
        const dataFormatted = formatDateBR(r.data);

        if (reportType === 'interjornada') {
          let horaSaidaAnt = '22:00';
          let horaEntradaAtual = '06:00';
          const desc = r.descricao || '';
          if (desc.includes('saída anterior:')) {
            const m = desc.match(/saída anterior:\s*([0-9]{2}:[0-9]{2})/i);
            if (m) horaSaidaAnt = m[1];
          }
          if (desc.includes('entrada atual:')) {
            const m = desc.match(/entrada atual:\s*([0-9]{2}:[0-9]{2})/i);
            if (m) horaEntradaAtual = m[1];
          }

          doc.text(dataFormatted, marginX + 3, y);
          doc.text(matricula, marginX + 28, y);
          doc.text(nome.substring(0, 32), marginX + 52, y);
          doc.text(depto.substring(0, 24), marginX + 130, y);
          doc.text(horaSaidaAnt, marginX + 185, y);
          doc.text(horaEntradaAtual, marginX + 210, y);
          doc.text(formatToHHMM(r.valorConstatado), marginX + 238, y);
          doc.text(formatToHHMM(r.valorPermitido), marginX + 260, y);

          doc.setDrawColor(241, 245, 249);
          doc.line(marginX, y + 1.5, pageWidth - marginX, y + 1.5);
          y += 5.5;
        } else if (reportType === 'intervalos') {
          doc.text(dataFormatted, marginX + 3, y);
          doc.text(matricula, marginX + 28, y);
          doc.text(nome.substring(0, 32), marginX + 52, y);
          doc.text(depto.substring(0, 24), marginX + 130, y);
          doc.text(formatToHHMM(r.valorConstatado), marginX + 190, y);
          doc.text(formatToHHMM(r.valorPermitido), marginX + 225, y);
          doc.text(String(r.gravidade), marginX + 255, y);

          doc.setDrawColor(241, 245, 249);
          doc.line(marginX, y + 1.5, pageWidth - marginX, y + 1.5);
          y += 5.5;
        } else if (reportType === 'jornada') {
          doc.text(dataFormatted, marginX + 3, y);
          doc.text(matricula, marginX + 28, y);
          doc.text(nome.substring(0, 32), marginX + 52, y);
          doc.text(depto.substring(0, 24), marginX + 130, y);
          doc.text(formatToHHMM(r.valorConstatado), marginX + 190, y);
          doc.text(formatToHHMM(r.valorPermitido), marginX + 225, y);
          doc.text(String(r.gravidade), marginX + 255, y);

          doc.setDrawColor(241, 245, 249);
          doc.line(marginX, y + 1.5, pageWidth - marginX, y + 1.5);
          y += 5.5;
        } else {
          doc.text(dataFormatted, marginX + 3, y);
          doc.text(matricula, marginX + 25, y);
          doc.text(nome.substring(0, 28), marginX + 48, y);
          doc.text(depto.substring(0, 20), marginX + 115, y);
          doc.text(String(r.gravidade), marginX + 160, y);
          doc.text(formatToHHMM(r.valorConstatado), marginX + 180, y);
          doc.text(formatToHHMM(r.valorPermitido), marginX + 200, y);

          const descLines = doc.splitTextToSize(r.descricao, 52);
          doc.text(descLines, marginX + 220, y);

          const rowH = Math.max(5.5, descLines.length * 3);
          doc.setDrawColor(241, 245, 249);
          doc.line(marginX, y + rowH - 1.5, pageWidth - marginX, y + rowH - 1.5);
          y += rowH;
        }
      });
    }
  }

  y += 6;

  // PARECER EXECUTIVO / ANÁLISE SINTÉTICA AUTOMÁTICA
  if (y > 170) {
    doc.addPage();
    drawPageHeader(doc.getNumberOfPages());
    y = 42;
  }

  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(marginX, y, contentWidth, 22, 2, 2, 'F');
  doc.setDrawColor(191, 219, 254); // blue-200
  doc.roundedRect(marginX, y, contentWidth, 22, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text('PARECER EXECUTIVO DA AUDITORIA TRABALHISTA (CLT)', marginX + 3, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59); // slate-800

  const topDeptosText = Array.from(impactedDeptos).slice(0, 3).join(', ') || 'Operacionais';
  const parecerText = `Durante o período analisado foram identificadas ${totalOcorrencias} ocorrências relacionadas a intervalos intrajornada, interjornada, jornadas consecutivas e trabalho em domingos. Os resultados indicam necessidade de acompanhamento operacional nos departamentos com maior concentração de desvios (${topDeptosText}), visando redução de riscos trabalhistas, previdenciários e passivos jurídicos. Recomenda-se a readequação das escalas e acompanhamento contínuo dos registros de ponto.`;

  const parecerLines = doc.splitTextToSize(parecerText, contentWidth - 6);
  doc.text(parecerLines, marginX + 3, y + 9.5);

  // Aplica cabeçalho e rodapé em todas as páginas do documento
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter(p, totalPages);
  }

  // Nome do arquivo
  const fileName = `audit_kairos_${reportType}_${now.toISOString().substring(0, 10)}.pdf`;
  doc.save(fileName);

  // Log de Auditoria
  logReportExportServer(reportTitle, periodoText, totalOcorrencias, usuarioEmissorText);
}
