import { Funcionario, Marcacao, VisaoDiaria } from './src/types';
import { auditarJornadaExcessiva, processarAuditoria } from './server/engine';

console.log('=== TESTE CIRÚRGICO DA REGRA JORNADA EXCESSIVA ===\n');

const erlan: Funcionario = {
  id: 'func_5109464537',
  nome: 'ERLAN PEREIRA DA SILVA',
  matricula: '5109464537',
  cpf: '12345678900',
  pis: '12345678901',
  cargo: 'OPERADOR',
  departamento: 'OPERACIONAL',
  centroCusto: 'CC1',
  gestor: 'GESTOR',
  empresaId: 'emp_1',
  grauRisco: 'BAIXO',
  scoreRisco: 0,
  status: 'ATIVO',
  situacao: 'ATIVO',
  cracha: '503'
};

// Batidas reais do relatório oficial do Erlan:
// 17/07/2026: 08:00–13:57 + 14:54–18:11 = 09:14 (554 min)
// 24/07/2026: 08:01–13:56 + 14:49–18:06 = 09:12 (552 min)
// 31/07/2026: 08:09–12:34 + 13:29–18:06 = 09:02 (542 min)

const marcacoesErlan: Marcacao[] = [
  // 17/07/2026
  { id: 'm1', funcionarioId: erlan.id, data: '2026-07-17', hora: '08:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
  { id: 'm2', funcionarioId: erlan.id, data: '2026-07-17', hora: '13:57:00', tipo: 'SAIDA', origem: 'Relógio' },
  { id: 'm3', funcionarioId: erlan.id, data: '2026-07-17', hora: '14:54:00', tipo: 'ENTRADA', origem: 'Relógio' },
  { id: 'm4', funcionarioId: erlan.id, data: '2026-07-17', hora: '18:11:00', tipo: 'SAIDA', origem: 'Relógio' },

  // 24/07/2026
  { id: 'm5', funcionarioId: erlan.id, data: '2026-07-24', hora: '08:01:00', tipo: 'ENTRADA', origem: 'Relógio' },
  { id: 'm6', funcionarioId: erlan.id, data: '2026-07-24', hora: '13:56:00', tipo: 'SAIDA', origem: 'Relógio' },
  { id: 'm7', funcionarioId: erlan.id, data: '2026-07-24', hora: '14:49:00', tipo: 'ENTRADA', origem: 'Relógio' },
  { id: 'm8', funcionarioId: erlan.id, data: '2026-07-24', hora: '18:06:00', tipo: 'SAIDA', origem: 'Relógio' },

  // 31/07/2026
  { id: 'm9', funcionarioId: erlan.id, data: '2026-07-31', hora: '08:09:00', tipo: 'ENTRADA', origem: 'Relógio' },
  { id: 'm10', funcionarioId: erlan.id, data: '2026-07-31', hora: '12:34:00', tipo: 'SAIDA', origem: 'Relógio' },
  { id: 'm11', funcionarioId: erlan.id, data: '2026-07-31', hora: '13:29:00', tipo: 'ENTRADA', origem: 'Relógio' },
  { id: 'm12', funcionarioId: erlan.id, data: '2026-07-31', hora: '18:06:00', tipo: 'SAIDA', origem: 'Relógio' },

  // Caso de Controle Legítimo: 10/08/2026 com 11h30 (690 min) de trabalho
  { id: 'm13', funcionarioId: erlan.id, data: '2026-08-10', hora: '07:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
  { id: 'm14', funcionarioId: erlan.id, data: '2026-08-10', hora: '12:00:00', tipo: 'SAIDA', origem: 'Relógio' },
  { id: 'm15', funcionarioId: erlan.id, data: '2026-08-10', hora: '13:00:00', tipo: 'ENTRADA', origem: 'Relógio' },
  { id: 'm16', funcionarioId: erlan.id, data: '2026-08-10', hora: '19:30:00', tipo: 'SAIDA', origem: 'Relógio' },
];

console.log('Executando processarAuditoria para o funcionário ERLAN...');
const res = processarAuditoria([erlan], marcacoesErlan, '2026-07-01', '2026-08-31');

const ocorrenciasJE = res.ocorrencias.filter(o => o.tipo === 'JORNADA_EXCESSIVA');

console.log('\n--- RESULTADO DA AUDITORIA DE JORNADA EXCESSIVA ---');
console.log(`Total de ocorrências JORNADA_EXCESSIVA geradas: ${ocorrenciasJE.length}`);

ocorrenciasJE.forEach(o => {
  console.log(`- Data: ${o.data} | Valor Constatado: ${o.valorConstatado} | Descrição: ${o.descricao}`);
});

let passou = true;

// Validação 1: Nenhuma ocorrência em 17/07, 24/07 ou 31/07
const falsosPositivos = ocorrenciasJE.filter(o => ['2026-07-17', '2026-07-24', '2026-07-31'].includes(o.data));
if (falsosPositivos.length === 0) {
  console.log('\n✅ SUCESSO: Falsos positivos de ERLAN (17/07, 24/07, 31/07) ELIMINADOS!');
} else {
  console.log('\n❌ FALHA: Falsos positivos ainda detectados:', falsosPositivos);
  passou = false;
}

// Validação 2: Caso de controle legítimo (10/08/2026 com 11:30h) deve ser detectado
const controleLegitimo = ocorrenciasJE.find(o => o.data === '2026-08-10');
if (controleLegitimo && controleLegitimo.valorConstatado === '11:30') {
  console.log('✅ SUCESSO: Caso legítimo (10/08/2026 - 11:30h) DETECTADO CORRETAMENTE!');
} else {
  console.log('❌ FALHA: Caso legítimo não detectado ou com valor incorreto:', controleLegitimo);
  passou = false;
}

if (passou) {
  console.log('\n🎯 TODOS OS TESTES PASSARAM COM SUCESSO!');
} else {
  console.log('\n💥 ALGUNS TESTES FALHARAM!');
}
