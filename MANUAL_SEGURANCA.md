# Manual de Segurança e Proteção de Dados

**Auditoria Trabalhista (CLT Compliance Portal)**  
**Versão**: 2.0.0  
**Data de Atualização**: Julho / 2026  

---

## 1. Diretrizes Principais de Criptografia e Hashing

1. **Hashing de Senhas com Salt Individual**:
   - As senhas dos usuários nunca são armazenadas em texto puro.
   - Cada usuário recebe um `salt` criptográfico individual de 16 bytes gerado via `crypto.randomBytes(16).toString('hex')`.
   - O hash da senha é gerado combinando a senha e o salt: `SHA256(password + ':' + salt)`.
2. **Proteção e Sanitização de Credenciais de Recuperação**:
   - Respostas de perguntas de segurança são sanitizadas (caixa baixa, remoção de espaços) e armazenadas exclusivamente no formato de hash SHA-256.
   - O mecanismo automático `getDefaultSecurityQuestions` assegura que 3 perguntas corporativas estejam configuradas mesmo se o usuário for cadastrado administrativamente sem preenchimento manual.
3. **Higienização do CNPJ/CPF (Identifier)**:
   - Todo identificador de empresa é higienizado no recebimento para conter apenas números (`10722889000174`), eliminando pontos, barras e traços.

---

## 2. Política do Perfil Master (`tecnicodimepdf@gmail.com`)

- **Provisionamento e Auto-Recuperação (`Auto-Healing`)**:
  - O usuário Master (`tecnicodimepdf@gmail.com`) é o administrador supremo do sistema.
  - O sistema monitora ativamente a conta Master. Em caso de inativação, bloqueio ou inconsistência, o mecanismo `ensureMasterAccount()` restaura o usuário para o status `ATIVO`, perfil `Master` e permissões completas.
- **Inviolabilidade de Permissões**:
  - A conta Master não pode ser excluída, desativada ou ter suas permissões administrativas removidas.
- **Primeiro Acesso Obrigatório**:
  - No primeiro login com a senha inicial provisionada (`Suporte@dimep`), a aplicação exige a alteração da senha e confirmação das 3 perguntas de segurança.

---

## 3. Proteção Contra Ataques e Integridade do Banco

1. **Bloqueio Temporário de Login**:
   - 5 tentativas consecutivas de senha incorreta resultam no bloqueio automático temporário da conta por 15 minutos.
2. **Bloqueio Temporário na Recuperação**:
   - 3 tentativas incorretas nas respostas de segurança bloqueiam temporariamente o fluxo de recuperação por 15 minutos.
3. **Gravação Atômica e Backup Rotativo**:
   - A escrita em disco utiliza arquivo temporário `.tmp` e substituição atômica (`fs.renameSync`), acompanhada de backup rotativo contínuo em `backups/latest_auto_backup.json`.

---

## 5. Controle de Acesso Baseado em Funções (RBAC v2.5.0)

1. **Autorização Centralizada e Duplo Nível (Front & Back)**:
   - Toda requisição no backend passa pelo middleware `hasPermission(user, permission)` que valida sessão ativa, status `ATIVO` e presença da permissão ou `admin_acesso_total` / `*`.
   - No frontend, navegações diretas via URL ou alterações de estado acionam o validador `hasTabPermission`, bloqueando componentes não autorizados com banner de Acesso Restrito.
2. **Matriz Granular de 58 Permissões**:
   - Mapeamento integral de 58 permissões individuais distribuídas em 10 módulos (Login, Executivo, RH, BI, Auditoria, Funcionários, Kairos, Relatórios, Painel Master, Administração).
3. **Imutabilidade e Proteção da Conta Master**:
   - O perfil `Master` (`prof_master`) é protegido contra edição ou exclusão, assegurando `admin_acesso_total` perpétuo.
4. **Clonagem e Edição de Perfis**:
   - Administradores com permissão `perfis_clonar` podem duplicar perfis existentes e adaptar a matriz de permissões para novos grupos de usuários com sincronização em tempo real.

1. **Ativação Controlada**:
   - O Modo de Emergência (Break Glass) permanece **desativado por padrão** (`EmergencyAccess: false` em `data/security.json`).
   - É ativado exclusivamente por alteração deliberada no arquivo de configuração do servidor ou pelo console administrativo.
2. **Operação e Suspensão**:
   - Quando ativado, o login convencional é suspenso temporariamente e a interface redireciona para o **Console de Recuperação de Emergência**.
   - Permite a execução direta das rotinas:
     - **Recriar/Restaurar Usuário Master**: Provisiona e ativa a conta `tecnicodimepdf@gmail.com` com novas credenciais.
     - **Desbloquear Todos os Usuários**: Remove bloqueios temporários/permanentes decorrentes de tentativas de login incorretas.
     - **Reparar Permissões e Perfis**: Restaura os perfis Master, Administrador e Usuário Comum para o estado padrão homologado.
3. **Desativação e Auditoria**:
   - Após a execução com sucesso de qualquer ação de recuperação, o parâmetro `EmergencyAccess` é automaticamente revertido para `false`, reestabelecendo a operação normal.
   - Todas as ativações, ips de origem, motivos e ações executadas são gravadas de forma permanente e auditável no histórico do `data/security.json` e no log geral do sistema.
