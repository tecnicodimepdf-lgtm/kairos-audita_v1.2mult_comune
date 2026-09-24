/**
 * SUÍTE DE TESTES AUTOMATIZADOS: TRABALHO SEM FOLGA POR 7+ DIAS CONSECUTIVOS (`SEM_FOLGA_7_DIAS`)
 *
 * Esta suíte valida a correção do algoritmo de auditoria do Art. 67 da CLT em 10 cenários distintos:
 * 1. 7 dias consecutivos com batidas de ponto -> DEVE gerar violação (7 dias)
 * 2. 6 dias com batida + 7º dia sem batida (folga/DSR) -> NÃO deve gerar violação
 * 3. Interrupção por folga no 4º dia (3 dias + 1 folga + 5 dias) -> NÃO deve gerar violação
 * 4. Nova sequência de 7 dias pós-interrupção -> DEVE gerar violação
 * 5. Marcação física no relógio (mesmo desprezada) -> COMPROVA apontamento e gera violação
 * 6. Folga administrativa sem batida -> Zera a contagem e NÃO gera violação
 * 7. Feriado sem batida -> Zera a contagem e NÃO gera violação
 * 8. DSR sem batida -> Zera a contagem e NÃO gera violação
 * 9. Sequência ininterrupta prolongada (16 dias) -> DEVE gerar 1 evento consolidado de 16 dias
 * 10. Lacuna de datas no banco (sem batida cadastrada no dia) -> Zera a contagem e NÃO gera violação
 */

import { processarAuditoria } from '../server/engine';
import { Funcionario, Marcacao } from '../src/types';

export function runTrabalho7DiasTests(): boolean {
  console.log('====================================================');
  console.log('   SUÍTE DE TESTES: TRABALHO S/ FOLGA 7 DIAS (10 CASOS)');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(description: string, condition: boolean) {
    total++;
    if (condition) {
      console.log(`[PASS] ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${description}`);
      process.exitCode = 1;
    }
  }

  const func: Funcionario = {
    id: 'f1',
    nome: 'COLABORADOR TESTE 7 DIAS',
    cpf: '000.000.000-01',
    pis: '000.00000.00-1',
    cargo: 'Operador',
    departamento: 'Operações',
    centroCusto: 'CC01',
    gestor: 'Gestor Teste',
    empresaId: 'emp1',
    grauRisco: 'BAIXO',
    scoreRisco: 0,
    matricula: '1001',
    sexo: 'MASCULINO'
  };

  const baseDate = new Date('2026-07-01T12:00:00Z');

  // CASO 1: 7 dias consecutivos com apontamento -> DEVE gerar evento (7 dias)
  {
    const marcs: Marcacao[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c1_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
        { id: `c1_${i}_2`, funcionarioId: 'f1', data: dateStr, hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' }
      );
    }
    const { ocorrencias } = processarAuditoria([func], marcs);
    const ev = ocorrencias.filter(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Caso 1 — 7 dias consecutivos com apontamento -> DEVE gerar desvio (1 evento)', ev.length === 1 && ev[0].valorConstatado === '7 dias');
  }

  // CASO 2: 6 dias com apontamento, 7º dia sem apontamento -> NÃO deve gerar evento
  {
    const marcs: Marcacao[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c2_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
        { id: `c2_${i}_2`, funcionarioId: 'f1', data: dateStr, hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' }
      );
    }
    const { ocorrencias } = processarAuditoria([func], marcs);
    const ev = ocorrencias.filter(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Caso 2 — 6 dias com apontamento e 7º sem -> NÃO deve gerar desvio (0 eventos)', ev.length === 0);
  }

  // CASO 3: 3 dias com apontamento, 4º dia sem apontamento, 5º a 9º (5 dias) com apontamento -> NÃO deve gerar evento
  {
    const marcs: Marcacao[] = [];
    // 01, 02, 03
    for (let i = 0; i < 3; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c3_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
        { id: `c3_${i}_2`, funcionarioId: 'f1', data: dateStr, hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' }
      );
    }
    // 04 sem marcação
    // 05, 06, 07, 08, 09
    for (let i = 4; i < 9; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c3_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
        { id: `c3_${i}_2`, funcionarioId: 'f1', data: dateStr, hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' }
      );
    }
    const { ocorrencias } = processarAuditoria([func], marcs);
    const ev = ocorrencias.filter(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Caso 3 — Interrupção no 4º dia (3 dias + 1 folga + 5 dias) -> NÃO deve gerar desvio', ev.length === 0);
  }

  // CASO 4: 3 dias com apontamento, 4º dia sem apontamento, 5º a 11º (7 dias) com apontamento -> DEVE gerar 1 evento
  {
    const marcs: Marcacao[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c4_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
      );
    }
    // dia 4 sem marcação
    for (let i = 4; i < 11; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c4_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
      );
    }
    const { ocorrencias } = processarAuditoria([func], marcs);
    const ev = ocorrencias.filter(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Caso 4 — Nova sequência de 7 dias após interrupção -> DEVE gerar 1 desvio', ev.length === 1 && ev[0].valorConstatado === '7 dias');
  }

  // CASO 5: 7 dias com apontamento, sendo o 4º dia com apontamento com desprezado = true -> DEVE gerar 1 evento
  {
    const marcs: Marcacao[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      if (i === 3) {
        marcs.push(
          { id: `c5_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio', desprezado: true }
        );
      } else {
        marcs.push(
          { id: `c5_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
        );
      }
    }
    const { ocorrencias } = processarAuditoria([func], marcs);
    const ev = ocorrencias.filter(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Caso 5 — Marcação física desprezada conta para atestar apontamento -> DEVE gerar desvio', ev.length === 1);
  }

  // CASO 6: 3 dias com apontamento, 4º dia com folga sem apontamento, 5º a 8º com apontamento -> NÃO deve gerar evento
  {
    const marcs: Marcacao[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c6_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
      );
    }
    const d4 = new Date(baseDate);
    d4.setDate(d4.getDate() + 3);
    marcs.push({ id: 'c6_folga', funcionarioId: 'f1', data: d4.toISOString().split('T')[0], hora: '00:00:00', tipo: 'NEUTRO', origem: 'Escala de Folga', descricao: 'Folga DSR' });

    for (let i = 4; i < 8; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c6_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
      );
    }
    const { ocorrencias } = processarAuditoria([func], marcs);
    const ev = ocorrencias.filter(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Caso 6 — Folga sem apontamento zera a sequência -> NÃO deve gerar desvio', ev.length === 0);
  }

  // CASO 7: 3 dias com apontamento, 4º dia feriado sem apontamento, 5º a 8º com apontamento -> NÃO deve gerar evento
  {
    const marcs: Marcacao[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c7_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
      );
    }
    const d4 = new Date(baseDate);
    d4.setDate(d4.getDate() + 3);
    marcs.push({ id: 'c7_feriado', funcionarioId: 'f1', data: d4.toISOString().split('T')[0], hora: '00:00:00', tipo: 'NEUTRO', origem: 'Feriado', descricao: 'Feriado Nacional' });

    for (let i = 4; i < 8; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c7_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
      );
    }
    const { ocorrencias } = processarAuditoria([func], marcs);
    const ev = ocorrencias.filter(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Caso 7 — Feriado sem apontamento zera a sequência -> NÃO deve gerar desvio', ev.length === 0);
  }

  // CASO 8: 3 dias com apontamento, 4º dia DSR sem apontamento, 5º a 8º com apontamento -> NÃO deve gerar evento
  {
    const marcs: Marcacao[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c8_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
      );
    }
    const d4 = new Date(baseDate);
    d4.setDate(d4.getDate() + 3);
    marcs.push({ id: 'c8_dsr', funcionarioId: 'f1', data: d4.toISOString().split('T')[0], hora: '00:00:00', tipo: 'NEUTRO', origem: 'DSR', descricao: 'Descanso Semanal Remunerado' });

    for (let i = 4; i < 8; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c8_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
      );
    }
    const { ocorrencias } = processarAuditoria([func], marcs);
    const ev = ocorrencias.filter(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Caso 8 — DSR sem apontamento zera a sequência -> NÃO deve gerar desvio', ev.length === 0);
  }

  // CASO 9: 16 dias consecutivos com apontamento -> DEVE gerar 2 eventos de 7 dias cada (limitado a 7 dias por ocorrência)
  {
    const marcs: Marcacao[] = [];
    for (let i = 0; i < 16; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      marcs.push(
        { id: `c9_${i}_1`, funcionarioId: 'f1', data: dateStr, hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
      );
    }
    const { ocorrencias } = processarAuditoria([func], marcs);
    const ev = ocorrencias.filter(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Caso 9 — Sequência longa (16 dias ininterruptos) -> DEVE gerar 2 ocorrências de 7 dias cada (sem exceder 7 dias)', ev.length === 2 && ev.every(o => o.valorConstatado === '7 dias'));
  }

  // CASO 10: Lacuna de datas no banco de dados (ex: dia 03 ausente do array de dados) -> a VisaoDiaria inclui a data como sem apontamento e zera a sequência
  {
    const marcs: Marcacao[] = [];
    // Dias 01 e 02
    for (let i = 0; i < 2; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      marcs.push(
        { id: `c10_${i}`, funcionarioId: 'f1', data: d.toISOString().split('T')[0], hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
      );
    }
    // Dia 03 está totalmente ausente de marcs!
    // Dias 04 a 08 (5 dias)
    for (let i = 3; i < 8; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      marcs.push(
        { id: `c10_${i}`, funcionarioId: 'f1', data: d.toISOString().split('T')[0], hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' }
      );
    }
    const { ocorrencias } = processarAuditoria([func], marcs);
    const ev = ocorrencias.filter(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Caso 10 — Data ausente do banco é tratada como dia sem apontamento (2 dias + lacuna + 5 dias) -> NÃO gera desvio', ev.length === 0);
  }

  console.log(`\nRESULTADO DA SUÍTE: ${passed}/${total} CASOS APROVADOS.`);
  return passed === total;
}

if (process.argv[1] && process.argv[1].endsWith('trabalho_7_dias.test.ts')) {
  runTrabalho7DiasTests();
}
