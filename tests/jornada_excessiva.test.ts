/**
 * Automated test suite for "Jornada Excessiva (> 10h)" audit algorithm.
 * Tests accuracy and prevents false positives (e.g., 06:56 wrongly flagged).
 */

import { processarAuditoria } from '../server/engine';
import { Funcionario, Marcacao } from '../src/types';

function runJornadaExcessivaTests() {
  console.log('====================================================');
  console.log('   SUÍTE DE TESTES: JORNADA EXCESSIVA (> 10H)');
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

  const funcSintetico: Funcionario = {
    id: 'func_jornada_01',
    nome: 'COLABORADOR TESTE JORNADA',
    cpf: '000.000.000-02',
    pis: '000.00000.00-2',
    cargo: 'Operador',
    departamento: 'Operações',
    centroCusto: 'CC Geral',
    gestor: 'Gestor Teste',
    empresaId: 'emp_1',
    grauRisco: 'BAIXO',
    scoreRisco: 0,
    matricula: '2002',
    sexo: 'MASCULINO'
  };

  // 1. Cenário: Jornada de 06:56 (Ex: 08:00 - 12:00, 13:00 - 15:56)
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_jornada_01', data: '2026-08-01', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_jornada_01', data: '2026-08-01', hora: '12:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_jornada_01', data: '2026-08-01', hora: '13:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_jornada_01', data: '2026-08-01', hora: '15:56:00', tipo: 'SAIDA', origem: 'Relógio' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const exc = ocorrencias.filter(o => o.tipo === 'JORNADA_EXCESSIVA');
    assert('Jornada de 06:56 (416 min) -> NÃO deve gerar JORNADA_EXCESSIVA', exc.length === 0);
  }

  // 2. Cenário: Jornada de 10:00 exatas (Ex: 08:00 - 12:00, 13:00 - 19:00)
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_jornada_01', data: '2026-08-02', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_jornada_01', data: '2026-08-02', hora: '12:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_jornada_01', data: '2026-08-02', hora: '13:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_jornada_01', data: '2026-08-02', hora: '19:00:00', tipo: 'SAIDA', origem: 'Relógio' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const exc = ocorrencias.filter(o => o.tipo === 'JORNADA_EXCESSIVA');
    assert('Jornada de 10:00 exatas (600 min) -> DEVE gerar JORNADA_EXCESSIVA', exc.length === 1 && exc[0].valorConstatado === '10:00');
  }

  // 3. Cenário: Jornada de 10:15 (Ex: 08:00 - 12:00, 13:00 - 19:15)
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_jornada_01', data: '2026-08-03', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_jornada_01', data: '2026-08-03', hora: '12:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_jornada_01', data: '2026-08-03', hora: '13:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_jornada_01', data: '2026-08-03', hora: '19:15:00', tipo: 'SAIDA', origem: 'Relógio' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const exc = ocorrencias.filter(o => o.tipo === 'JORNADA_EXCESSIVA');
    assert('Jornada de 10:15 (615 min) -> DEVE gerar JORNADA_EXCESSIVA', exc.length === 1 && exc[0].valorConstatado === '10:15');
  }

  // 4. Cenário: Jornada de 06:56 com registro extra desprezado ou evento administrativo no mesmo dia
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_jornada_01', data: '2026-08-04', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_jornada_01', data: '2026-08-04', hora: '12:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_jornada_01', data: '2026-08-04', hora: '13:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_jornada_01', data: '2026-08-04', hora: '15:56:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm5', funcionarioId: 'func_jornada_01', data: '2026-08-04', hora: '18:00:00', tipo: 'NEUTRO', origem: 'Evento Administrativo', descricao: 'Desprezada pelo operador' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const exc = ocorrencias.filter(o => o.tipo === 'JORNADA_EXCESSIVA');
    assert('Jornada 06:56 com registro administrativo/desprezado extra -> NÃO deve gerar JORNADA_EXCESSIVA', exc.length === 0);
  }

  // 5. Cenário: Batidas duplicadas no mesmo minuto (08:00, 08:00, 12:00, 13:00, 15:56)
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_jornada_01', data: '2026-08-05', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm1_dup', funcionarioId: 'func_jornada_01', data: '2026-08-05', hora: '08:00:10', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_jornada_01', data: '2026-08-05', hora: '12:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_jornada_01', data: '2026-08-05', hora: '13:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_jornada_01', data: '2026-08-05', hora: '15:56:00', tipo: 'SAIDA', origem: 'Relógio' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const exc = ocorrencias.filter(o => o.tipo === 'JORNADA_EXCESSIVA');
    assert('Batidas duplicadas no mesmo minuto com 06:56 efetivos -> NÃO deve gerar JORNADA_EXCESSIVA', exc.length === 0);
  }

  console.log(`\n====================================================`);
  console.log(`  RESULTADO: ${passed}/${total} testes aprovados.`);
  console.log(`====================================================\n`);
}

runJornadaExcessivaTests();
