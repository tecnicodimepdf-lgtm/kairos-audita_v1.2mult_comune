# Manual Técnico de Backup e Recuperação de Dados

**Auditoria Trabalhista (CLT Compliance Portal)**  
**Versão**: 2.0.0  
**Data de Atualização**: Julho / 2026  

---

## 1. Visão Geral da Infraestrutura de Persistência

A aplicação **Auditoria Trabalhista** utiliza um modelo híbrido de persistência:
1. **Dados Internos do Sistema (Persistência Relacional / JSON Store)**:
   - Cadastros de Usuários, Salts, Passwords Hashed, Perguntas de Segurança.
   - Perfis de Acesso e Matriz de Permissões.
   - Configurações da API REST Dimep Kairos.
   - Registros de Auditoria de Ações (`ActivityLogs`) e Métricas de Volumetria (`UsageStats`).
   - Localização: `data/db.json` (com réplica atômica `data/db.json.bak` e backups rotativos em `backups/`).

2. **Dados Operacionais de Ponto e Folha (Sincronização Dinâmica REST API)**:
   - Cadastro de Funcionários, Empresas, Marcações Físicas de Ponto, Espelhos de Ponto, Ocorrências e Escalas.
   - Os dados operacionais são consumidos diretamente da API REST do Dimep Kairos e armazenados temporariamente na memória do servidor Node.js/Express, sendo recalculados dinamicamente sem dependência de escrita permanente de arquivos do cliente.

---

## 2. Mecanismos de Backup

### 2.1 Backup Automático com Gravação Atômica (Servidor)
- **Frequência**: Instantânea em cada operação de alteração (salvamento de dados, redefinição de senha, atualização de permissões ou importação/sincronização).
- **Mecanismo de Escrita Atômica**:
  1. Os dados são gravados temporariamente no arquivo `data/db.json.tmp`.
  2. O arquivo atual `data/db.json` é copiado como `data/db.json.bak`.
  3. A operação `fs.renameSync` substitui atômica e seguramente `data/db.json.tmp` por `data/db.json`.
- **Cópia de Backup Rotativo**: A cada alteração salva, o servidor grava uma cópia integral em `backups/latest_auto_backup.json`.

### 2.2 Exportação de Backup Manual (Painel Master)
- **Acesso**: Exclusivo para usuários com Perfil `Master`.
- **Caminho na Interface**: Painel Master -> Aba "Exportação e Restauração de Backup".
- **Endpoint API**: `GET /api/admin/backup/export` (exige cabeçalho `x-session-token` com permissão Master).
- **Formato do Arquivo**: `backup_ambientes_Auditoria Trabalhista_<timestamp>.json`.
- **Conteúdo**: Estrutura JSON completa contendo a totalidade dos usuários, perfis, logs de auditoria e configurações de conexão.

---

## 3. Procedimentos de Restauração de Dados

### 3.1 Restauração Manual via Interface (Painel Master)
1. Acesse o sistema com credenciais de nível **Master** (`tecnicodimepdf@gmail.com`).
2. Navegue até o **Painel Master** -> aba **Exportação e Restauração de Backup**.
3. Clique em **Carregar arquivo de backup...** e selecione o arquivo `.json` exportado previamente.
4. O sistema efetuará a validação de esquema e consistência relacional.
5. Confirme a operação. Um backup automático preventivo será registrado antes da substituição efetiva dos dados.

### 3.2 Recuperação de Emergência de Acesso Master (`Auto-Healing`)
Se o banco `data/db.json` for corrompido ou o usuário Master for desativado acidentalmente:
1. Reinicie o processo Node.js do servidor ou execute uma requisição na rota de login/recuperação.
2. O mecanismo `ensureMasterAccount()` detectará automaticamente a ausência ou inconsistência da conta Master.
3. A conta `tecnicodimepdf@gmail.com` será reativada com status `ATIVO`, perfil `Master`, salt renovado, 3 perguntas de segurança padrão e senha padrão `Dimep@123` (exigindo redefinição no primeiro acesso).

---

## 4. Fluxo de Recuperação de Senha por Perda de Acesso

### 4.1 Etapa 1: Solicitação das Perguntas de Segurança
- Endpoint: `POST /api/auth/recover/step1`
- Informar o e-mail corporativo cadastrado.
- Se o usuário não possuir perguntas cadastradas manualmente, o provedor automático `getDefaultSecurityQuestions` inicializa 3 perguntas corporativas com base nos dados cadastrais da empresa e CNPJ.
- Retorna os enunciados das 3 perguntas ao cliente.

### 4.2 Etapa 2: Validação das Respostas e Redefinição
- Endpoint: `POST /api/auth/recover/complete`
- Informar e-mail, respostas para as 3 perguntas e a nova senha desejada (mínimo de 6 caracteres).
- A validação de respostas é insensível a maiúsculas/minúsculas e ignora espaços extras.
- Após 3 tentativas incorretas, a conta é bloqueada temporariamente por 15 minutos para proteção contra ataques de força bruta.
- Na redefinição com sucesso, a senha é criptografada com um novo `salt` de 16 bytes e armazenada em `data/db.json`.

---

## 5. Modo de Recuperação de Emergência ("Break Glass")

Em situações críticas onde a autenticação padrão fique indisponível (perda total de credenciais, corrupção da base de dados ou falhas de configuração):

1. **Ativação pelo Administrador de Infraestrutura**:
   - Edite o arquivo `data/security.json` no servidor alterando o parâmetro `"EmergencyAccess": true`.
   - Opcionalmente, defina a justificativa em `"Reason": "<motivo>"`.
2. **Acesso ao Console de Emergência**:
   - Ao acessar a URL da aplicação, o sistema redireciona automaticamente para a interface **Modo de Recuperação de Emergência (Break Glass)**.
3. **Execução de Ações**:
   - **Recriar/Restaurar Usuário Master**: Provisiona imediatamente o usuário Master `tecnicodimepdf@gmail.com` com a senha informada no console.
   - **Desbloquear Todos os Usuários**: Zera contadores de tentativas e desativa sinalizadores de bloqueio.
   - **Reparar Permissões**: Reconstrói a matriz de perfis e atribui permissão total ao Master.
4. **Encerramento Automático**:
   - Após a conclusão de qualquer uma das ações, o sistema altera automaticamente `"EmergencyAccess": false` em `data/security.json`, encerrando o modo de emergência e restaurando o fluxo normal.
