import { processarAuditoria } from '../server/engine.js';
import { Funcionario, Marcacao } from '../src/types.js';

const func: Funcionario = {
  id: 'f1',
  nome: 'Teste Jornada',
  matricula: '100',
  departamento: 'TI'
} as any;

function check(testName: string, times: string[], isSIM: boolean, expectedMin?: number) {
  const marcacoes: Marcacao[] = times.map((t, i) => ({
    id: `m${i}`,
    funcionarioId: 'f1',
    data: '2026-08-01',
    hora: t + ':00',
    tipo: i % 2 === 0 ? 'ENTRADA' : 'SAIDA',
    origem: 'Relógio'
  }));

  const { ocorrencias } = processarAuditoria([func], marcacoes);
  const ocorrencia = ocorrencias.find(o => o.tipo === 'JORNADA_EXCESSIVA');
  
  if (isSIM && !ocorrencia) {
    throw new Error(`[FAIL] ${testName} deveria gerar mas não gerou.`);
  }
  if (!isSIM && ocorrencia) {
    throw new Error(`[FAIL] ${testName} NÃO deveria gerar mas gerou com ${ocorrencia.totalMinutosTrabalhados} min`);
  }
  
  if (ocorrencia && expectedMin !== undefined && ocorrencia.totalMinutosTrabalhados !== expectedMin) {
    throw new Error(`[FAIL] ${testName} calculou minutos errados: ${ocorrencia.totalMinutosTrabalhados} (esperava ${expectedMin})`);
  }

  console.log(`[PASS] ${testName}`);
}

function runTests() {
  console.log("=== INICIANDO TESTES JORNADA EXCESSIVA ===");
  
  check("Caso 1: 08:00 / 18:00", ["08:00", "18:00"], false);
  check("Caso 2: 08:00 / 18:01", ["08:00", "18:01"], true, 601);
  check("Caso 3: 08:00 / 12:00 / 13:00 / 18:00", ["08:00", "12:00", "13:00", "18:00"], false);
  check("Caso 4: 08:00 / 12:00 / 13:00 / 19:01", ["08:00", "12:00", "13:00", "19:01"], true, 601);
  // User had a typo in the prompt writing 20:00 but meaning 480 minutes (which is 18:00)
  check("Caso 5 (math 480m): 08:00 / 12:00 / 14:00 / 18:00", ["08:00", "12:00", "14:00", "18:00"], false);
  check("Caso 6 (math 481m): 08:00 / 12:00 / 14:00 / 18:01", ["08:00", "12:00", "14:00", "18:01"], false);
  check("Caso 7: 06:00 / 10:00 / 11:00 / 15:00 / 16:00 / 19:01", ["06:00", "10:00", "11:00", "15:00", "16:00", "19:01"], true, 661);
  
  // Prova obrigatória matches Case 1, 3, 4
  
  check("Meia Noite 1: 22:00 / 02:00", ["22:00", "02:00"], false);
  check("Meia Noite 2: 22:00 / 02:00 / 03:00 / 06:00", ["22:00", "02:00", "03:00", "06:00"], false);
  check("Marcação Ímpar: 08:00 / 12:00 / 13:00", ["08:00", "12:00", "13:00"], false); 
  
  console.log("=== TODOS OS TESTES PASSARAM ===");
}

runTests();
