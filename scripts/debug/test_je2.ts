import fs from 'fs';
import { processarAuditoria } from './server/engine';

const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
const res = processarAuditoria(db.funcionarios, db.marcacoes, '2026-07-01', '2026-08-30');

const je = res.ocorrencias.filter(o => o.tipo === 'JORNADA_EXCESSIVA');

const strange = je.filter(o => {
  const parts = o.valorConstatado.split(':');
  if (parts.length > 0) {
    const horas = parseInt(parts[0], 10);
    return horas > 14;
  }
  return false;
});
console.log('Strange > 14h:');
console.log(strange.map(s => ({ nome: s.funcionarioNome, data: s.descricao, valor: s.valorConstatado, id: s.funcionarioId })));

const first = strange[0];
const m = db.marcacoes.filter((m: any) => m.funcionarioId === first.funcionarioId);
console.log('Marcacoes for', first.funcionarioNome);
console.log(m.filter((x: any) => x.data.includes(first.descricao.split(' ')[0]))); // simplistic date check
