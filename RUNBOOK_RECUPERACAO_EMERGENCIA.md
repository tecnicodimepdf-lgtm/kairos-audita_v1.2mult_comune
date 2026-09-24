# Runbook de Recuperação de Emergência (Break Glass)

Este documento descreve o procedimento operacional padrão para recuperação de acesso administrativo ao sistema de Auditoria Trabalhista CLT em caso de perda total de acesso à conta Master (ex.: senha esquecida e perguntas de segurança inacessíveis, ou conta corrompida).

---

## 1. Pré-requisito: Definir/Confirmar o Segredo de Emergência (`EMERGENCY_ACCESS_SECRET`)

O mecanismo Break Glass utiliza uma chave secreta de emergência configurada via variável de ambiente.

1. Abra o arquivo de ambiente `.env` na raiz do servidor backend (ou defina a variável no seu ambiente de execução / terminal).
2. Certifique-se de que a variável `EMERGENCY_ACCESS_SECRET` está configurada com um valor forte.
   - Exemplo no `.env`:
     ```env
     EMERGENCY_ACCESS_SECRET=SuaChaveSecretaDeEmergenciaSuperSegura123!
     ```
3. Caso a variável não esteja no `.env`, defina-a temporariamente na sessão do terminal onde o servidor está rodando:
   - **PowerShell (Windows):**
     ```powershell
     $env:EMERGENCY_ACCESS_SECRET="SuaChaveSecretaDeEmergenciaSuperSegura123!"
     ```
   - **Bash (Linux/macOS):**
     ```bash
     export EMERGENCY_ACCESS_SECRET="SuaChaveSecretaDeEmergenciaSuperSegura123!"
     ```

---

## 2. Passo 1: Ativar o Modo de Emergência

Com o servidor rodando, execute o comando para ativar o modo de emergência utilizando a chave secreta via header HTTP `x-emergency-secret`.

### Comando cURL:
```bash
curl -X POST http://localhost:3000/api/auth/toggle-emergency \
  -H "Content-Type: application/json" \
  -H "x-emergency-secret: SuaChaveSecretaDeEmergenciaSuperSegura123!" \
  -d '{"enabled": true, "reason": "Recuperação de acesso Master via admin"}'
```

### Comando PowerShell (Windows):
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/toggle-emergency" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "x-emergency-secret" = "SuaChaveSecretaDeEmergenciaSuperSegura123!"
  } `
  -Body '{"enabled": true, "reason": "Recuperação de acesso Master via admin"}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "emergencyMode": true,
  "config": {
    "EmergencyAccess": true,
    "LastEmergencyActivation": "2026-08-23T10:00:00.000Z",
    ...
  }
}
```

---

## 3. Passo 2: Executar a Ação de Recriação/Reset do Usuário Master

Com o Modo de Emergência ativo, execute a chamada para recriar/restaurar a conta Master (`tecnicodimepdf@gmail.com`). 

> **Nota:** Se o campo `password` não for enviado no payload (ou for enviado vazio), o sistema gerará automaticamente uma senha forte aleatória e a retornará na propriedade `tempPassword` da resposta HTTP.

### Comando cURL (Gerando Senha Aleatória Forte):
```bash
curl -X POST http://localhost:3000/api/auth/emergency-action \
  -H "Content-Type: application/json" \
  -H "x-emergency-secret: SuaChaveSecretaDeEmergenciaSuperSegura123!" \
  -d '{"action": "create_master", "payload": {}}'
```

### Comando cURL (Definindo uma Senha Específica):
```bash
curl -X POST http://localhost:3000/api/auth/emergency-action \
  -H "Content-Type: application/json" \
  -H "x-emergency-secret: SuaChaveSecretaDeEmergenciaSuperSegura123!" \
  -d '{"action": "create_master", "payload": {"password": "SuaNovaSenhaForte123!"}}'
```

### Comando PowerShell (Windows):
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/emergency-action" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "x-emergency-secret" = "SuaChaveSecretaDeEmergenciaSuperSegura123!"
  } `
  -Body '{"action": "create_master", "payload": {}}'
```

---

## 4. Passo 3: Capturar a Nova Senha Gerada

Na resposta da requisição HTTP do Passo 2, inspecione a propriedade `tempPassword` (se nenhuma senha customizada foi enviada):

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Usuário Master (tecnicodimepdf@gmail.com) recriado/redefinido com sucesso via Modo de Emergência! Senha temporária: dK9_mx2P-L8qWs1aB0",
  "tempPassword": "dK9_mx2P-L8qWs1aB0"
}
```

Anote o valor de `tempPassword`. Essa senha será exigida no primeiro login e o sistema solicitará a troca obrigatória de senha.

---

## 5. Passo 4: Confirmar a Desativação Automática do Modo de Emergência

O sistema desativa automaticamente o Modo de Emergência assim que a ação é concluída com sucesso.

Para confirmar que a aplicação retornou ao modo de operação normal, faça uma chamada `GET` ao endpoint de status:

### Comando cURL:
```bash
curl -X GET http://localhost:3000/api/auth/emergency-status
```

### Comando PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/emergency-status" -Method GET
```

**Resposta esperada:**
```json
{
  "emergencyMode": false
}
```

Após essa confirmação, acesse a interface web, faça o login com `tecnicodimepdf@gmail.com` e a nova senha gerada, e realize a troca de senha obrigatória.
