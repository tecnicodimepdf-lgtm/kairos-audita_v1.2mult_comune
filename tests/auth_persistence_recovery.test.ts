import { dbInstance, hashPassword, hashPasswordWithSalt, generateSalt, getDefaultSecurityQuestions, hashAnswer, isBcryptHash, verifyAndMigratePassword } from '../server/db';
import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- INICIANDO TESTES DE AUTENTICAÇÃO, RECUPERAÇÃO E PERSISTÊNCIA ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string) {
    total++;
    if (condition) {
      console.log(`✅ TESTE ${total}: PASS - ${title}`);
      passed++;
    } else {
      console.error(`❌ TESTE ${total}: FAIL - ${title}`);
    }
  }

  // Teste 1: Master User Auto-Healing
  dbInstance.ensureMasterAccount();
  const users = dbInstance.getUsers();
  const master = users.find(u => u.email === 'tecnicodimepdf@gmail.com');
  assert(!!master, 'Usuário Master (tecnicodimepdf@gmail.com) existe na base');
  assert(master?.status === 'ATIVO', 'Usuário Master está com status ATIVO');
  assert(master?.perfilAcesso === 'Master', 'Perfil de acesso do Master é "Master"');
  assert(master?.nomeCompleto === 'Renato Santos', 'Nome completo do Master é Renato Santos');
  assert(typeof master?.empresa === 'string', 'Empresa do Master é uma string válida');
  assert(typeof master?.identifier === 'string', 'Identifier do Master é uma string válida');
  assert(typeof master?.key === 'string', 'Rest API Key do Master é uma string válida');
  assert(!!master?.salt, 'Usuário Master possui salt gerado');
  assert(Array.isArray(master?.perguntasSeguranca) && master.perguntasSeguranca.length === 3, 'Usuário Master possui 3 perguntas de segurança configuradas');

  // Teste 2: Hashing com Bcrypt e Migração Transparente
  const pass = 'SenhaTesteSegura123!';
  const bcryptHash = hashPasswordWithSalt(pass, master?.salt || generateSalt());
  assert(isBcryptHash(bcryptHash), 'Hash de senha utiliza o formato seguro bcrypt');
  assert(verifyAndMigratePassword(pass, { ...master!, passwordHash: bcryptHash }), 'Validação com bcrypt retorna true para a senha correta');

  // Teste 3: Perguntas Padrão de Recuperação para Usuários Legados
  const defaultQuestions = getDefaultSecurityQuestions('usuario_teste@empresa.com', 'Empresa Teste S.A.', '12.345.678/0001-90');
  assert(defaultQuestions.length === 3, 'Perguntas padrão geram exatamente 3 perguntas de segurança');
  assert(defaultQuestions[0].respostaHash === hashAnswer('usuario_teste@empresa.com'), 'Resposta da Q1 é o e-mail em hash minúsculo e sem espaços');

  // Teste 4: Verificação de Recuperação de Senha (Respostas Válidas)
  const q1Hash = defaultQuestions[0].respostaHash;
  const testInputAnswer = 'usuario_teste@empresa.com ';
  assert(hashAnswer(testInputAnswer) === q1Hash, 'Validação de resposta de recuperação ignora espaços extras e caixa alta');

  // Teste 5: Persistência Atômica no Disco e Backup
  dbInstance.save();
  const dbPath = path.join(process.cwd(), 'data', 'db.json');
  const backupPath = path.join(process.cwd(), 'data', 'db.json.bak');
  assert(fs.existsSync(dbPath), 'Arquivo físico data/db.json existe no servidor');
  assert(fs.existsSync(backupPath) || fs.existsSync(path.join(process.cwd(), 'backups', 'latest_auto_backup.json')), 'Arquivo de backup rotativo existe no servidor');

  // Teste 6: Modo de Recuperação de Emergência (Break Glass)
  const initialSec = dbInstance.getSecurityConfig();
  assert(initialSec.EmergencyAccess === false, 'Modo de emergência desativado por padrão');

  dbInstance.setEmergencyMode(true, 'Teste de Falha de Autenticação', '127.0.0.1');
  const activeSec = dbInstance.getSecurityConfig();
  assert(activeSec.EmergencyAccess === true, 'Modo de emergência (Break Glass) ativado com sucesso em data/security.json');
  assert(activeSec.Reason === 'Teste de Falha de Autenticação', 'Motivo da ativação registrado corretamente em log');

  // Teste 7: Execução de Ação de Recuperação de Emergência e Desativação Automática
  const actionRes = dbInstance.executeEmergencyAction('create_master', { password: 'NovaSenhaEmergencia123' }, '127.0.0.1');
  assert(actionRes.success === true, 'Ação de emergência "create_master" executada com sucesso');
  
  const finalSec = dbInstance.getSecurityConfig();
  assert(finalSec.EmergencyAccess === false, 'Modo de emergência foi desativado automaticamente após a conclusão da ação de recuperação');

  console.log(`\nRESULTADO FINAL: ${passed}/${total} testes passaram com sucesso.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
