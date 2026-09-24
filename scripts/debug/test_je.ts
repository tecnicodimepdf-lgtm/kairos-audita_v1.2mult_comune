import fs from 'fs';
import { processarAuditoria } from './server/engine';

const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
const res = processarAuditoria(db.funcionarios, db.marcacoes, '2026-07-01', '2026-08-30');

const je = res.ocorrencias.filter(o => o.tipo === 'JORNADA_EXCESSIVA');
console.log('Jornada Excessiva total:', je.length);

const strange = je.filter(o => {
  const parts = o.valorConstatado.split(':');
  if (parts.length > 0) {
    const horas = parseInt(parts[0], 10);
    return horas > 14;
  }
  return false;
});
console.log('>14h total:', strange.length);
