import fs from 'fs';
import { processarAuditoria } from './server/engine';

const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
const res = processarAuditoria(db.funcionarios, db.marcacoes, '2026-07-01', '2026-08-30');
const ocorrencias = res.ocorrencias.filter(o => o.tipo === 'INTERJORNADA_INSUFICIENTE');

const strange = ocorrencias.filter(o => {
  const parts = o.valorConstatado.split(':');
  if (parts.length > 0) {
    const horas = parseInt(parts[0], 10);
    return horas >= 11;
  }
  return false;
});

console.log('Interjornadas >= 11h:', strange.length, strange.map(o => o.valorConstatado).slice(0, 10));
