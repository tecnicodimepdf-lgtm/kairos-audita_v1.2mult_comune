import { processarAuditoria } from '../server/engine.js';
import { Funcionario, Marcacao } from '../src/types.js';

const func: Funcionario = {
  id: 'f1',
  nome: 'Teste Interjornada',
  matricula: '100',
  departamento: 'TI'
} as any;

function assert(msg: string, condition: boolean) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`[PASS] ${msg}`);
}

function runTests() {
  // 10:59 -> SIM
  {
    const marcacoes: Marcacao[] = [
      { id: '1', funcionarioId: 'f1', data: '2026-08-01', hora: '13:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '2', funcionarioId: 'f1', data: '2026-08-01', hora: '22:00', tipo: 'SAIDA', origem: 'Relógio' },
      
      { id: '3', funcionarioId: 'f1', data: '2026-08-02', hora: '08:59', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '4', funcionarioId: 'f1', data: '2026-08-02', hora: '17:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    // Descanso: 22:00 to 08:59 = 10h59m
    const { ocorrencias } = processarAuditoria([func], marcacoes);
    assert('10:59 -> SIM (insuficiente)', ocorrencias.some(o => o.tipo === 'INTERJORNADA_INSUFICIENTE'));
  }

  // 11:00 -> NÃO
  {
    const marcacoes: Marcacao[] = [
      { id: '1', funcionarioId: 'f1', data: '2026-08-03', hora: '13:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '2', funcionarioId: 'f1', data: '2026-08-03', hora: '22:00', tipo: 'SAIDA', origem: 'Relógio' },
      
      { id: '4', funcionarioId: 'f1', data: '2026-08-04', hora: '09:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '5', funcionarioId: 'f1', data: '2026-08-04', hora: '17:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    // Descanso: 22:00 to 09:00 = 11h
    const { ocorrencias } = processarAuditoria([func], marcacoes);
    assert('11:00 -> NÃO (suficiente)', !ocorrencias.some(o => o.tipo === 'INTERJORNADA_INSUFICIENTE'));
  }

  // 11:01 -> NÃO
  {
    const marcacoes: Marcacao[] = [
      { id: '1', funcionarioId: 'f1', data: '2026-08-05', hora: '13:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '2', funcionarioId: 'f1', data: '2026-08-05', hora: '22:00', tipo: 'SAIDA', origem: 'Relógio' },
      
      { id: '3', funcionarioId: 'f1', data: '2026-08-06', hora: '09:01', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '4', funcionarioId: 'f1', data: '2026-08-06', hora: '17:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    // Descanso: 22:00 to 09:01 = 11h01m
    const { ocorrencias } = processarAuditoria([func], marcacoes);
    assert('11:01 -> NÃO (suficiente)', !ocorrencias.some(o => o.tipo === 'INTERJORNADA_INSUFICIENTE'));
  }
}

runTests();
