import fs from 'fs';

const dbPath = './data/db.json';
if (!fs.existsSync(dbPath)) {
  console.log('db.json does not exist');
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
console.log('Total funcionarios:', db.funcionarios?.length);
console.log('Total marcacoes:', db.marcacoes?.length);

const f = db.funcionarios?.find((x) => 
  x.matricula === '5109464537' || 
  (x.nome && x.nome.toUpperCase().includes('ERLAN'))
);

console.log('Funcionario Erlan:', f);

if (f) {
  const m = db.marcacoes.filter((x) => x.funcionarioId === f.id || String(x.funcionarioId) === String(f.id));
  console.log('Marcacoes count:', m.length);
  
  const targetDates = ['2026-07-17', '2026-07-24', '2026-07-31'];
  targetDates.forEach(d => {
    const md = m.filter((x) => x.data && x.data.startsWith(d));
    console.log(`--- Marcacoes on ${d} ---`);
    console.log(md);
  });
} else {
  console.log('Searching by name/matricula in all funcionarios:');
  db.funcionarios?.forEach(x => {
    if (x.nome?.includes('ERLAN') || x.matricula?.includes('5109') || x.nome?.includes('SILVA')) {
      console.log(x);
    }
  });
}
