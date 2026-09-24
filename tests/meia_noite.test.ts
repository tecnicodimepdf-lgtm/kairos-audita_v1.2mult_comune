import { calcularJornadaEfetiva } from '../server/engine.js';
import { Funcionario, Marcacao } from '../src/types.js';

const func: Funcionario = {
  id: 'f1',
  nome: 'Teste Meia Noite',
  matricula: '100',
  departamento: 'TI'
} as any;

function assert(msg: string, condition: boolean) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`[PASS] ${msg}`);
}

function runTests() {
  // Meia-noite (22:00->02:00=4h = 240m)
  {
    const marcacoes: Marcacao[] = [
      { id: '1', funcionarioId: 'f1', data: '2026-08-01', hora: '22:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '2', funcionarioId: 'f1', data: '2026-08-02', hora: '02:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const j = calcularJornadaEfetiva(marcacoes);
    assert('22:00 -> 02:00 = 4h', j.totalMinutosTrabalhados === 240);
  }

  // Meia-noite (23:00->05:00=6h = 360m)
  {
    const marcacoes: Marcacao[] = [
      { id: '1', funcionarioId: 'f1', data: '2026-08-02', hora: '23:00', tipo: 'ENTRADA', origem: 'Relógio' },
      { id: '2', funcionarioId: 'f1', data: '2026-08-03', hora: '05:00', tipo: 'SAIDA', origem: 'Relógio' },
    ];
    const j = calcularJornadaEfetiva(marcacoes);
    assert('23:00 -> 05:00 = 6h', j.totalMinutosTrabalhados === 360);
  }
}

runTests();
