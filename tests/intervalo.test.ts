import { processarAuditoria } from '../server/engine.js';
import { Funcionario, Marcacao } from '../src/types.js';

const func: Funcionario = {
  id: 'f1',
  nome: 'Teste Intervalo',
  matricula: '100',
  departamento: 'TI'
} as any;

function assert(msg: string, condition: boolean) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`[PASS] ${msg}`);
}

function runTests() {
  // 14 min -> insuficiente (jornada 4-6h)
  {
    const marcacoes: Marcacao[] = [
      { id: '1', funcionarioId: 'f1', data: '2026-08-01', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '2', funcionarioId: 'f1', data: '2026-08-01', hora: '10:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: '3', funcionarioId: 'f1', data: '2026-08-01', hora: '10:14', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '4', funcionarioId: 'f1', data: '2026-08-01', hora: '13:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    // worked: 2h + 2h46m = 4h46m. Interval: 14 min.
    const { ocorrencias } = processarAuditoria([func], marcacoes);
    assert('14 min -> INSUFICIENTE', ocorrencias.some(o => o.tipo === 'INTERVALO_INSUFICIENTE'));
  }

  // 15 min -> suficiente (jornada 4-6h)
  {
    const marcacoes: Marcacao[] = [
      { id: '1', funcionarioId: 'f1', data: '2026-08-02', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '2', funcionarioId: 'f1', data: '2026-08-02', hora: '10:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: '3', funcionarioId: 'f1', data: '2026-08-02', hora: '10:15', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '4', funcionarioId: 'f1', data: '2026-08-02', hora: '13:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    // worked: 4h45m. Interval: 15 min.
    const { ocorrencias } = processarAuditoria([func], marcacoes);
    assert('15 min -> SUFICIENTE', !ocorrencias.some(o => o.tipo === 'INTERVALO_INSUFICIENTE'));
  }

  // 59 min -> insuficiente (jornada > 6h)
  {
    const marcacoes: Marcacao[] = [
      { id: '1', funcionarioId: 'f1', data: '2026-08-03', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '2', funcionarioId: 'f1', data: '2026-08-03', hora: '12:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: '3', funcionarioId: 'f1', data: '2026-08-03', hora: '12:59', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '4', funcionarioId: 'f1', data: '2026-08-03', hora: '17:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    // worked: 4h + 4h01m = 8h01m. Interval: 59 min.
    const { ocorrencias } = processarAuditoria([func], marcacoes);
    assert('59 min -> INSUFICIENTE', ocorrencias.some(o => o.tipo === 'INTERVALO_INSUFICIENTE'));
  }

  // 60 min -> suficiente (jornada > 6h)
  {
    const marcacoes: Marcacao[] = [
      { id: '1', funcionarioId: 'f1', data: '2026-08-04', hora: '08:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '2', funcionarioId: 'f1', data: '2026-08-04', hora: '12:00', tipo: 'SAIDA', origem: 'Relógio' },
      { id: '3', funcionarioId: 'f1', data: '2026-08-04', hora: '13:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '4', funcionarioId: 'f1', data: '2026-08-04', hora: '17:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    // worked: 8h. Interval: 60 min.
    const { ocorrencias } = processarAuditoria([func], marcacoes);
    assert('60 min -> SUFICIENTE', !ocorrencias.some(o => o.tipo === 'INTERVALO_INSUFICIENTE'));
  }
}

runTests();
