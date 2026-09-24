import { processarAuditoria } from '../server/engine.js';
import { Funcionario, Marcacao } from '../src/types.js';

const funcBase: Funcionario = {
  id: 'func_test_1',
  nome: 'Funcionário Teste 13 Cenários',
  matricula: '1001',
  cpf: '123.456.789-00',
  pis: '123.45678.90-0',
  cargo: 'Analista',
  departamento: 'TI',
  centroCusto: 'Tecnologia',
  gestor: 'Gerente TI',
  empresaId: 'emp1',
  status: 'ATIVO',
  situacao: 'ATIVO',
  scoreRisco: 100,
  grauRisco: 'BAIXO'
};

function assert(scenarioName: string, condition: boolean, details?: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${scenarioName}${details ? `: ${details}` : ''}`);
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${scenarioName}`);
  }
}

function runAllScenarios() {
  console.log('===============================================================');
  console.log(' EXECUÇÃO DOS 13 CENÁRIOS MANDATÓRIOS DE AUDITORIA CLT/MTE');
  console.log('===============================================================');

  // CENÁRIO 1: Intervalo de 1 hora (08:00, 12:00, 13:00, 18:00) -> INTERVALO_INSUFICIENTE = NÃO
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '12:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '13:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '18:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-03', '2026-08-03');
    const temIntervalo = ocorrencias.some(o => o.tipo === 'INTERVALO_INSUFICIENTE');
    assert('Cenário 01 — Intervalo de 1 hora (08:00-12:00 / 13:00-18:00) -> Não deve gerar infração', !temIntervalo);
  }

  // CENÁRIO 2: Intervalo insuficiente em jornada > 6h (08:00, 12:00, 12:40, 18:00) -> INTERVALO_INSUFICIENTE = SIM
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '12:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '12:40', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '18:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-03', '2026-08-03');
    const temIntervalo = ocorrencias.some(o => o.tipo === 'INTERVALO_INSUFICIENTE');
    assert('Cenário 02 — Intervalo de 40 min em jornada de 9h20 -> Deve gerar INTERVALO_INSUFICIENTE', temIntervalo);
  }

  // CENÁRIO 3: Jornada exatamente 10 horas (08:00, 13:00, 14:00, 19:00) -> JORNADA_EXCESSIVA = NÃO
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '13:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '14:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '19:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-03', '2026-08-03');
    const temExcessiva = ocorrencias.some(o => o.tipo === 'JORNADA_EXCESSIVA');
    assert('Cenário 03 — Jornada exatamente 10h (600 min) -> Não deve gerar JORNADA_EXCESSIVA', !temExcessiva);
  }

  // CENÁRIO 4: Jornada superior a 10 horas (08:00, 13:00, 14:00, 19:30) -> JORNADA_EXCESSIVA = SIM
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '13:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '14:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '19:30', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-03', '2026-08-03');
    const temExcessiva = ocorrencias.some(o => o.tipo === 'JORNADA_EXCESSIVA');
    assert('Cenário 04 — Jornada de 10h30 (630 min) -> Deve gerar JORNADA_EXCESSIVA', temExcessiva);
  }

  // CENÁRIO 5: Domingo com 6 horas de trabalho (08:00, 11:00, 12:00, 15:00) -> DOMINGO_EXCESSIVO = NÃO
  {
    // 2026-08-02 é Domingo
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '11:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '12:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '15:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-02', '2026-08-02');
    const temDomingo = ocorrencias.some(o => o.tipo === 'DOMINGO_EXCESSIVO');
    assert('Cenário 05 — Domingo com exatas 6h (360 min) -> Não deve gerar DOMINGO_EXCESSIVO', !temDomingo);
  }

  // CENÁRIO 6: Domingo com mais de 6 horas de trabalho (08:00, 12:00, 13:00, 17:30) -> DOMINGO_EXCESSIVO = SIM
  {
    // 2026-08-02 é Domingo
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '12:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '13:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '17:30', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-02', '2026-08-02');
    const temDomingo = ocorrencias.some(o => o.tipo === 'DOMINGO_EXCESSIVO');
    assert('Cenário 06 — Domingo com 8h30 (510 min) -> Deve gerar DOMINGO_EXCESSIVO', temDomingo);
  }

  // CENÁRIO 7: 6 dias consecutivos de trabalho + folga no 7º dia -> SEM_FOLGA_7_DIAS = NÃO
  {
    // Seg a Sáb (2026-08-03 a 2026-08-08) com batida; Dom (2026-08-09) sem batida
    const marcacoes: Marcacao[] = [];
    const datas = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08'];
    datas.forEach((dt, idx) => {
      marcacoes.push({ id: `e_${idx}`, funcionarioId: 'func_test_1', data: dt, hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' });
      marcacoes.push({ id: `s_${idx}`, funcionarioId: 'func_test_1', data: dt, hora: '17:00', tipo: 'SAIDA', origem: 'Relógio' });
    });
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-03', '2026-08-09');
    const temSemFolga = ocorrencias.some(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Cenário 07 — 6 dias de trabalho e folga no 7º dia -> Não deve gerar SEM_FOLGA_7_DIAS', !temSemFolga);
  }

  // CENÁRIO 8: 7 dias consecutivos de trabalho sem folga -> SEM_FOLGA_7_DIAS = SIM
  {
    // Seg a Dom (2026-08-03 a 2026-08-09) todos com batida
    const marcacoes: Marcacao[] = [];
    const datas = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'];
    datas.forEach((dt, idx) => {
      marcacoes.push({ id: `e_${idx}`, funcionarioId: 'func_test_1', data: dt, hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' });
      marcacoes.push({ id: `s_${idx}`, funcionarioId: 'func_test_1', data: dt, hora: '17:00', tipo: 'SAIDA', origem: 'Relógio' });
    });
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-03', '2026-08-09');
    const temSemFolga = ocorrencias.some(o => o.tipo === 'SEM_FOLGA_7_DIAS');
    assert('Cenário 08 — 7 dias consecutivos trabalhados -> Deve gerar SEM_FOLGA_7_DIAS', temSemFolga);
  }

  // CENÁRIO 9: Domingos alternados (Trabalhou Dom 02/08, Folgou Dom 09/08, Trabalhou Dom 16/08) -> DOMINGOS_SEGUIDOS = NÃO
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '12:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_test_1', data: '2026-08-16', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_test_1', data: '2026-08-16', hora: '12:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-01', '2026-08-17');
    const temDomSeguidos = ocorrencias.some(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('Cenário 09 — Domingos alternados (Trabalho - Folga - Trabalho) -> Não deve gerar DOMINGOS_SEGUIDOS', !temDomSeguidos);
  }

  // CENÁRIO 10: Domingos consecutivos trabalhados (Dom 02/08 e Dom 09/08) -> DOMINGOS_SEGUIDOS = SIM
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_test_1', data: '2026-08-02', hora: '12:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_test_1', data: '2026-08-09', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_test_1', data: '2026-08-09', hora: '12:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-01', '2026-08-10');
    const temDomSeguidos = ocorrencias.some(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('Cenário 10 — Dois domingos consecutivos trabalhados -> Deve gerar DOMINGOS_SEGUIDOS', temDomSeguidos);
  }

  // CENÁRIO 11: Interjornada de exatas 11 horas (Saída 22:00 dia 1, Entrada 09:00 dia 2) -> INTERJORNADA_INSUFICIENTE = NÃO
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '13:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '22:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_test_1', data: '2026-08-04', hora: '09:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_test_1', data: '2026-08-04', hora: '18:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-03', '2026-08-04');
    const temInterjornada = ocorrencias.some(o => o.tipo === 'INTERJORNADA_INSUFICIENTE');
    assert('Cenário 11 — Interjornada de exatas 11:00h (22:00 às 09:00) -> Não deve gerar infração', !temInterjornada);
  }

  // CENÁRIO 12: Interjornada insuficiente (Saída 22:00 dia 1, Entrada 07:30 dia 2) -> INTERJORNADA_INSUFICIENTE = SIM
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '13:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '22:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_test_1', data: '2026-08-04', hora: '07:30', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_test_1', data: '2026-08-04', hora: '17:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const { ocorrencias } = processarAuditoria([funcBase], marcacoes, '2026-08-03', '2026-08-04');
    const temInterjornada = ocorrencias.some(o => o.tipo === 'INTERJORNADA_INSUFICIENTE');
    assert('Cenário 12 — Interjornada de 9h30m (22:00 às 07:30) -> Deve gerar INTERJORNADA_INSUFICIENTE', temInterjornada);
  }

  // CENÁRIO 13: Marcação Ímpar sem contaminação das demais regras (ex: 08:00, 12:00, 13:00 com marcação órfã)
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '12:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_test_1', data: '2026-08-03', hora: '13:00', tipo: 'ENTRADA', origem: 'Relógio' }, // Marcação sem saída correspondente
    ];
    const { ocorrencias, jornadas } = processarAuditoria([funcBase], marcacoes, '2026-08-03', '2026-08-03');
    
    const temMarcacaoImpar = ocorrencias.some(o => o.tipo === 'MARCACAO_IMPAR');
    const temFalsoJornadaExcessiva = ocorrencias.some(o => o.tipo === 'JORNADA_EXCESSIVA');
    const temFalsoIntervalo = ocorrencias.some(o => o.tipo === 'INTERVALO_INSUFICIENTE');

    assert('Cenário 13a — Dia com marcação sem par -> Deve sinalizar MARCACAO_IMPAR', temMarcacaoImpar);
    assert('Cenário 13b — Marcação ímpar não deve gerar falsa JORNADA_EXCESSIVA', !temFalsoJornadaExcessiva);
    assert('Cenário 13c — Marcação ímpar não deve gerar falso INTERVALO_INSUFICIENTE', !temFalsoIntervalo);

    const jornada = jornadas.find(j => j.data === '2026-08-03');
    assert('Cenário 13d — Horas trabalhadas calculadas apenas de pares válidos (08:00-12:00 = 4h)', jornada?.horasTrabalhadas === 4);
  }

  console.log('===============================================================');
  console.log(' ALL 13 CLT AUDIT SCENARIOS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================');
}

runAllScenarios();
