import fs from 'fs';

const db = JSON.parse(fs.readFileSync('data/db.json.bak', 'utf8'));
console.log('Keys in db.json.bak:', Object.keys(db));
for (const key of Object.keys(db)) {
  if (Array.isArray(db[key])) {
    console.log(`db.${key} length:`, db[key].length);
  }
}
if (db.funcionarios && db.funcionarios.length > 0) {
  console.log('Sample funcionario:', db.funcionarios[0]);
}
