// diagnostico-senha.js
// Testa se a senha "senha" realmente bate com o hash armazenado no banco,
// usando bcrypt puro (sem depender de nenhuma função customizada do projeto
// que possa estar com bug).

const fs = require('fs');

const STORED_HASH = '$2b$10$KufiCTlwVGGQ.Mz0VVrFoeEuX13G/fjT.URxVabLLhutRXzeTmVUK';
const STORED_SALT = '5233cd32255018ef06ba7e8a7942a7f6';
const PASSWORD_TO_TEST = 'senha';

console.log('--- Qual pacote bcrypt está instalado? ---');
let bcryptLib = null;
let libName = null;
try {
  bcryptLib = require('bcrypt');
  libName = 'bcrypt';
} catch (e1) {
  try {
    bcryptLib = require('bcryptjs');
    libName = 'bcryptjs';
  } catch (e2) {
    console.error('[ERRO] Nem "bcrypt" nem "bcryptjs" foram encontrados em node_modules.');
    process.exit(1);
  }
}
console.log('Usando pacote:', libName);

console.log('');
console.log('--- Teste 1: comparar "senha" direto contra o hash (ignorando salt) ---');
const match1 = bcryptLib.compareSync(PASSWORD_TO_TEST, STORED_HASH);
console.log('bcrypt.compareSync("senha", hash) =>', match1);

console.log('');
console.log('--- Teste 2: comparar "senha:salt" (caso o projeto concatene salt manualmente) ---');
const combined = PASSWORD_TO_TEST + ':' + STORED_SALT;
const match2 = bcryptLib.compareSync(combined, STORED_HASH);
console.log('bcrypt.compareSync("senha:salt", hash) =>', match2);

console.log('');
console.log('--- Teste 3: comparar "senha" + salt sem dois pontos ---');
const combined2 = PASSWORD_TO_TEST + STORED_SALT;
const match3 = bcryptLib.compareSync(combined2, STORED_HASH);
console.log('bcrypt.compareSync("senha"+salt, hash) =>', match3);

console.log('');
if (match1 || match2 || match3) {
  console.log('[RESULTADO] A senha "senha" BATE com o hash em pelo menos um formato.');
  console.log('Isso significa que o problema está na ROTA DE LOGIN (server.ts), não no hash.');
} else {
  console.log('[RESULTADO] A senha "senha" NÃO bate com o hash armazenado em nenhum formato testado.');
  console.log('O hash salvo não corresponde a a senha "senha". Precisamos resetar de verdade.');
}