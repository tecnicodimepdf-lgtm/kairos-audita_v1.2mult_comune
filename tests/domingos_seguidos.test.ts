/**
 * Automated test suite for the "Dois Domingos Seguidos Trabalhados" audit algorithm.
 * Validates all required test scenarios using synthetic, anonymized test data (LGPD compliant).
 */

import { processarAuditoria } from '../server/engine';
import { Funcionario, Marcacao } from '../src/types';

function runTests() {
  console.log('====================================================');
  console.log('   SUÍTE DE TESTES: DOIS DOMINGOS SEGUIDOS TRABALHADOS');
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
    id: 'func_sintetico_01',
    nome: 'COLABORADOR SINTÉTICO TESTE 01',
    cpf: '000.000.000-01',
    pis: '000.00000.00-1',
    cargo: 'Analista de Operações',
    departamento: 'Departamento Operacional',
    centroCusto: 'CC Geral',
    gestor: 'Gestor Sintético',
    empresaId: 'emp_1',
    grauRisco: 'BAIXO',
    scoreRisco: 0,
    matricula: '1001',
    sexo: 'FEMININO'
  };

  // 1. Cenário: Dois Domingos com Lançamento de Folga
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Folga', descricao: 'Folga / DSR' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Folga', descricao: 'Folga / DSR' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('Dois domingos com lançamento de Folga -> NÃO deve gerar DOMINGOS_SEGUIDOS', domSeg.length === 0);
  }

  // 2. Cenário: Dois Domingos com Dia Livre
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Dia Livre', descricao: 'Dia Livre' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Dia Livre', descricao: 'Dia Livre' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('Dois domingos com Dia Livre -> NÃO deve gerar DOMINGOS_SEGUIDOS', domSeg.length === 0);
  }

  // 3. Cenário: Um domingo trabalhado e outro com Folga
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Folga', descricao: 'Folga' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('1º domingo trabalhado e 2º com Folga -> NÃO deve gerar DOMINGOS_SEGUIDOS', domSeg.length === 0);
  }

  // 4. Cenário: Um domingo trabalhado e outro com Justificativa/Abono
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Manual', descricao: 'Abono Justificado' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('1º domingo trabalhado e 2º com Abono/Justificativa -> NÃO deve gerar DOMINGOS_SEGUIDOS', domSeg.length === 0);
  }

  // 5. Cenário: Domingo com Falta
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Manual', descricao: 'Falta Injustificada' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('Domingo com Falta -> NÃO deve gerar DOMINGOS_SEGUIDOS', domSeg.length === 0);
  }

  // 6. Cenário: Domingo sem qualquer marcação registrada
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' }
      // 2026-07-19 sem marcações
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('2º domingo sem qualquer marcação -> NÃO deve gerar DOMINGOS_SEGUIDOS', domSeg.length === 0);
  }

  // 7. Cenário: Dois Domingos Efetivamente Trabalhados
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('Dois domingos efetivamente trabalhados -> DEVE gerar DOMINGOS_SEGUIDOS', domSeg.length === 1);
  }

  // 8. Cenário B: Folga/Justificativa cadastrada MAS HOUVE marcação física de ponto em ambos os domingos
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Folga', descricao: 'Folga Prevista' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm3', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Escala', descricao: 'DSR Semanal' },
      { id: 'm5', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm6', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('Cenário B: Folga cadastrada mas COM batida física de ponto -> Prevalece marcação e DEVE gerar DOMINGOS_SEGUIDOS', domSeg.length === 1);
  }

  // 9. Cenário: Domingos Alternados (Trabalha Dom 1, Descansa Dom 2, Trabalha Dom 3)
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-05', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-05', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      // 2026-07-12 folga
      { id: 'm3', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Folga', descricao: 'Folga Regulamentar' },
      // 2026-07-19 trabalha
      { id: 'm4', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm5', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('Domingos Alternados (Trabalho - Folga - Trabalho) -> NÃO deve gerar DOMINGOS_SEGUIDOS', domSeg.length === 0);
  }

  // 10. Cenário: Múltiplos eventos administrativos simultâneos sem batida
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Folga', descricao: 'Folga de Escala / Dia Livre / DSR / Feriado' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Manual', descricao: 'Abono / Afastamento / Atestado' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('Múltiplos eventos administrativos sem batida -> NÃO deve gerar DOMINGOS_SEGUIDOS', domSeg.length === 0);
  }

  // 11. Cenário: Domingo contendo apenas marcações desprezadas
  {
    const marcacoes: Marcacao[] = [
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio', descricao: 'Desprezada pelo operador' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio', descricao: 'Desprezada pelo operador' },
      { id: 'm3', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('Domingo contendo apenas marcações desprezadas -> DEVE gerar DOMINGOS_SEGUIDOS (conforme diretriz de que marcação desprezada comprova registro de ponto)', domSeg.length === 1);
  }

  // 12. Cenário: Domingos trabalhados separados por eventos diversos no meio da semana (Folgas/Férias/Faltas/Afastamentos)
  {
    const marcacoes: Marcacao[] = [
      // Domingo 1 (12/07) trabalhado
      { id: 'm1', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm2', funcionarioId: 'func_sintetico_01', data: '2026-07-12', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' },
      // Segunda a Sábado com folga/férias/afastamento/falta
      { id: 'm_mid1', funcionarioId: 'func_sintetico_01', data: '2026-07-13', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Folga', descricao: 'Folga Semanal' },
      { id: 'm_mid2', funcionarioId: 'func_sintetico_01', data: '2026-07-14', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Férias', descricao: 'Férias Regulamentares' },
      { id: 'm_mid3', funcionarioId: 'func_sintetico_01', data: '2026-07-15', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Afastamento', descricao: 'Afastamento Médio' },
      { id: 'm_mid4', funcionarioId: 'func_sintetico_01', data: '2026-07-16', hora: '00:00:00', tipo: 'NEUTRO', origem: 'Falta', descricao: 'Falta Unjustified' },
      // Domingo 2 (19/07) trabalhado
      { id: 'm3', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: 'm4', funcionarioId: 'func_sintetico_01', data: '2026-07-19', hora: '17:00:00', tipo: 'SAIDA', origem: 'Relógio' }
    ];
    const { ocorrencias } = processarAuditoria([funcSintetico], marcacoes);
    const domSeg = ocorrencias.filter(o => o.tipo === 'DOMINGOS_SEGUIDOS');
    assert('Domingos trabalhados separados por eventos diversos na semana -> DEVE gerar DOMINGOS_SEGUIDOS', domSeg.length === 1);
  }

  console.log(`\n====================================================`);
  console.log(`  RESULTADO: ${passed}/${total} testes aprovados.`);
  console.log(`====================================================\n`);
}

runTests();

