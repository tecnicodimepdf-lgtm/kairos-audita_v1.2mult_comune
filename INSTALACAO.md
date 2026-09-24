# Guia de Instalação e Execução - Auditoria Trabalhista

Este documento orienta desenvolvedores e administradores de sistemas a instalar, configurar e colocar em produção a plataforma Auditoria Trabalhista.

---

## 📋 Pré-requisitos do Sistema

* **Runtime**: Node.js v20+ ou v22+
* **Gerenciador de Pacotes**: npm v10+ ou yarn
* **Memória Recomendada**: 1 GB RAM (mínimo) para processar volumes de até 50.000 marcações. 2 GB+ para suporte a 10 milhões de marcações.

---

## 🛠️ Passo 1: Instalação das Dependências

Clone o repositório para o seu ambiente local e instale todas as dependências do pacote listadas no manifesto `package.json`:

```bash
# Clone o repositório
git clone https://github.com/empresa/Auditoria Trabalhista.git
cd Auditoria Trabalhista

# Instale os pacotes necessários
npm install
```

---

## ⚙️ Passo 2: Configuração do Ambiente (.env)

Crie o arquivo de variáveis de ambiente `.env` na raiz do projeto com base no modelo `.env.example`:

```bash
cp .env.example .env
```

Edite o arquivo recém-criado:

```env
# URL de host da aplicação (Injetada automaticamente no Cloud Run)
APP_URL="http://localhost:3000"

# Se houver chaves de criptografia ou chaves da API do Dimep Kairos, cadastre-as aqui ou use a interface de configurações
GEMINI_API_KEY="MY_GEMINI_API_KEY"
```

---

## 🚀 Passo 3: Executando em Desenvolvimento

Para iniciar o servidor full-stack local em modo de desenvolvimento com hot-reload automático de código e compilação em tempo real:

```bash
npm run dev
```

O terminal indicará que a aplicação está rodando. Abra o seu navegador e acesse:
👉 **`http://localhost:3000`**

---

## 📦 Passo 4: Compilação para Produção (Build)

Para otimizar o frontend e agrupar os scripts de backend em arquivos minificados de alta performance antes de implantar em nuvem (como Cloud Run, AWS ou VPS):

```bash
# Executa a compilação do Vite e esbuild
npm run build
```

Este comando gera a pasta `/dist` contendo:
* Ativos estáticos otimizados (CSS/JS minificados, HTML e ativos vetoriais).
* O arquivo do servidor unificado em `/dist/server.cjs` para evitar checagens lentas de importação de runtime no Node.

---

## 🚀 Passo 5: Inicializando em Produção

Após realizar a compilação de produção com o comando acima, inicie o servidor:

```bash
npm run start
```

O servidor escutará por padrão no host `0.0.0.0` e na porta `3000`, pronto para receber tráfego por meio de balanceadores de carga ou proxies reversos como Nginx.

---

## 🔐 Inicialização e Criação Automática do Usuário Master

Durante a primeira execução do sistema, caso a base de dados em `data/db.json` não contenha usuários cadastrados, o Auditoria Trabalhista **cria automaticamente o Usuário Master de implantação**:

* **Nome**: `Renato Santos`
* **E-mail**: `tecnicodimepdf@gmail.com`
* **Perfil**: `Master` (Acesso irrestrito a configurações de segurança, integrações, auditoria e backups)
* **Status**: `Ativo`
* **Senha Inicial Padrão**: `Dimep@123`

### 🛡️ Fluxo de Segurança no Primeiro Acesso
Ao efetuar o login pela primeira vez com as credenciais iniciais:
1. O sistema interceptará o acesso e exigirá a **troca de senha obrigatória** e a **confirmação da nova senha** (mínimo de 6 caracteres).
2. O usuário também deverá obrigatoriamente selecionar e responder a **3 Perguntas de Segurança** distintas que servirão para recuperação autônoma de senha.
3. Todas as senhas e respostas são codificadas com algoritmo de hash seguro **SHA-256**, garantindo que não possam ser lidas diretamente do banco de dados.
4. O primeiro acesso, o IP, a data/hora e a alteração de senha obrigatória são integralmente registrados no **Log de Auditoria** do sistema.

