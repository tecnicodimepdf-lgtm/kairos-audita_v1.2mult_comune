import fs from 'fs';
import { dbInstance } from './server/db';
const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));

const m = db.marcacoes.filter((m: any) => m.funcionarioId === '14931');
console.log('Marcacoes for 14931:', m.length);
m.sort((a,b) => a.data.localeCompare(b.data));
console.log(m.slice(0, 15).map(x => x.data));
