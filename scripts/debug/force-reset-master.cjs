/**
 * force-reset-master.cjs
 *
 * Reset FORÇADO da senha do usuário Master em data/db.json para "senha".
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const TARGET_EMAIL = 'tecnicodimepdf@gmail.com';
const NEW_PASSWORD = 'senha';
const DB_PATH = path.join(process.cwd(), 'data', 'db.json');
const BCRYPT_ROUNDS = 10;

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[ERRO] Não encontrei ${DB_PATH}. Rode a partir da raiz do projeto.`);
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const user = db.users.find(
    (u) => (u.email || '').toLowerCase().trim() === TARGET_EMAIL
  );

  if (!user) {
    console.error(`[ERRO] Usuário ${TARGET_EMAIL} não encontrado. Nada foi alterado.`);
    process.exit(1);
  }

  console.log('[ANTES] passwordHash atual:', user.passwordHash);

  const newHash = bcrypt.hashSync(NEW_PASSWORD, BCRYPT_ROUNDS);
  user.passwordHash = newHash;
  user.tentativasLogin = 0;
  user.bloqueadoAte = null;
  user.status = 'ATIVO';
  user.precisaTrocarSenha = true;

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

  console.log('[DEPOIS] Novo passwordHash:', newHash);
  console.log('[OK] Senha do usuário Master redefinida com sucesso para "senha" em data/db.json!');
}

main();
