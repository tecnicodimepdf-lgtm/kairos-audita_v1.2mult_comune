import { dbInstance } from '../server/db';
import { ALL_PERMISSIONS_IDS } from '../server';

async function runRbacTests() {
  console.log('=== INICIANDO SUÍTE DE TESTES: CONTROLE DE ACESSO RBAC ===\n');

  // Garante que perfis padrão estejam propagados
  dbInstance.ensureDefaultProfiles();

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`✅ TESTE ${total}: PASS - ${message}`);
      passed++;
    } else {
      console.error(`❌ TESTE ${total}: FAIL - ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. Verificar se perfis padrão foram criados no banco
  const profiles = dbInstance.getProfiles();
  assert(profiles.length >= 4, `Banco possui ${profiles.length} perfis padrão (${profiles.map(p => p.nome).join(', ')})`);

  // 2. Perfil Master
  const masterProf = profiles.find(p => p.nome === 'Master');
  assert(!!masterProf, 'Perfil Master existe no banco de dados');
  assert(masterProf?.permissoes.includes('admin_acesso_total') === true, 'Perfil Master possui permissão "admin_acesso_total"');

  // 3. Usuários padrão vinculados a perfis válidos
  const users = dbInstance.getUsers();
  const masterUser = users.find(u => u.email === 'tecnicodimepdf@gmail.com');
  assert(!!masterUser, 'Usuário Master existe');
  assert(masterUser?.perfilAcesso === 'Master', 'Usuário Master tem perfil "Master"');

  // 4. Teste de Clonagem de Perfil
  const novoPerfilClonado = dbInstance.saveProfile({
    id: 'prof_clone_test_' + Date.now(),
    nome: 'Supervisor Clonado Teste',
    descricao: 'Perfil criado via teste de clonagem',
    permissoes: ['login_acesso', 'dashboard_executivo_visualizar', 'auditoria_visualizar'],
    status: 'ATIVO',
    dataCriacao: new Date().toISOString(),
    dataUltimaAlteracao: new Date().toISOString(),
    criadorEmail: 'tecnicodimepdf@gmail.com'
  });
  assert(!!novoPerfilClonado && novoPerfilClonado.nome === 'Supervisor Clonado Teste', 'Clonagem de perfil salva no banco com sucesso');

  // 5. Verificar total de permissões na matriz global
  assert(ALL_PERMISSIONS_IDS.length >= 50, `Matriz global de permissões contém ${ALL_PERMISSIONS_IDS.length} permissões granuladas`);

  // 6. Teste de limpeza do perfil de teste
  const resultDelete = dbInstance.deleteProfile(novoPerfilClonado.id);
  assert(resultDelete === true, 'Exclusão de perfil sem usuários vinculados realizada com sucesso');

  console.log(`\n====================================================`);
  console.log(`  RESULTADO RBAC: ${passed}/${total} testes aprovados.`);
  console.log(`====================================================\n`);
}

runRbacTests().catch(err => {
  console.error('Erro na execução dos testes RBAC:', err);
  process.exit(1);
});
