# Manual do Usuário Final - Plataforma Auditoria Trabalhista

Bem-vindo à plataforma **Auditoria Trabalhista**! Este manual foi escrito especialmente para gestores de Recursos Humanos, Auditores e Diretores de Operações. Ele guiará você passo a passo sobre como operar e extrair o máximo de valor da plataforma.

---

## 🎯 Visão Geral da Plataforma

A plataforma automatiza o trabalho complexo de auditar folhas de ponto do sistema **Dimep Kairos**, destacando riscos ocultos de passivo trabalhista que poderiam gerar multas e processos de fiscalização do trabalho (MTE).

Ao entrar no sistema, você navegará através do menu lateral esquerdo:
1. **Painel Executivo**: Panorama geral para diretores.
2. **Dashboard RH**: Informações técnicas sobre violações de artigos específicos da CLT.
3. **BI Analítico**: Gráficos dinâmicos para isolar problemas por gerência e localidade.
4. **Relatório Geral**: Base de dados de todas as infrações encontradas.
5. **Relatórios Fiscais (PDF)**: Exportação de documentos prontos para reuniões de conselho e fiscalizações.
6. **Configurações**: Onde você integra o sistema à sua conta do Dimep Kairos.

---

## 🧭 Como Usar o Filtro Geral e Recursos de BI

No topo da maioria das telas, há uma **Barra de Filtros Inteligente**:
* **Filtros por Empresa/Filial, Departamento e Gestor**: Selecione valores para que os gráficos e tabelas de todo o sistema se adaptem em tempo real.
* **Busca por Nome/PIS/CPF**: Digite para auditar um colaborador específico de maneira instantânea.
* **Período**: Escolha datas personalizadas para ver o comportamento das jornadas em determinado mês ou safra.

---

## 🚨 Interpretando os Desvios da CLT

No **Dashboard RH (CLT)**, monitoramos três regras críticas de conformidade trabalhista:

1. **Jornada Excessiva (Art. 59 da CLT)**:
   * **O que significa**: Nenhum colaborador pode estender o seu expediente diário além de 10 horas totais (8 horas normais + 2 horas extras), a menos que haja acordo coletivo especial.
   * **Como agir**: No painel, identifique quais equipes ultrapassam frequentemente essa marca e realoque pessoal ou limite as horas extras.

2. **Repouso Interjornada de 11 Horas (Art. 66 da CLT)**:
   * **O que significa**: Entre a saída de um dia de trabalho e a entrada do dia seguinte, deve haver um descanso de no mínimo 11 horas seguidas.
   * **Como agir**: Fique alerta para turnos em esquema de "dobra" ou escalas mal planejadas que infringem essa norma fiscal.

3. **Intervalo para Almoço/Refeição (Art. 71 da CLT)**:
   * **O que significa**: Para expedientes maiores de 6 horas, é obrigatório registrar um intervalo para descanso e refeição de no mínimo 1 hora.
   * **Como agir**: Treine os colaboradores para que não façam "almoços curtos" (ex: bater o ponto com 45 minutos de intervalo).

---

## 📥 Como Gerar Relatórios PDF e Excel

1. Clique na aba **Relatórios Fiscais (PDF)**.
2. Na lista à esquerda, selecione o relatório que deseja gerar (ex: *Resumo Executivo* ou *Auditoria de Jornada*).
3. O sistema gerará um rascunho de página A4 impecável.
4. Clique no botão verde **Exportar Excel (CSV)** se desejar baixar as linhas de dados brutos e abri-las para realizar cálculos personalizados em planilhas como Microsoft Excel ou Google Planilhas.
5. Clique no botão preto **Imprimir / PDF** para abrir a caixa de impressão padrão do seu computador. Você poderá escolher "Salvar como PDF" ou mandar diretamente para a impressora física da sua sala.

---

## ⚙️ Integrando com o seu Dimep Kairos

Se o seu sistema estiver operando no modo de demonstração com dados de exemplo, você pode conectá-lo ao banco real da sua empresa:
1. Acesse **Configurações** no menu lateral.
2. No painel superior, verifique qual **Origem dos Dados** está ativa ("Ambiente de Demonstração" ou "Base de Dados de Produção").
3. **Limpar Base de Exemplo**: Caso queira remover completamente as marcações e funcionários fictícios que vêm pré-carregados no sistema para iniciar a importação de dados limpos, clique no botão vermelho **Limpar Base de Exemplo** e confirme a ação.
4. Preencha o campo **Identificador** com o CNPJ cadastrado no seu Dimep Kairos.
5. Preencha a **Rest API Key** gerada pelo suporte da Dimep para a sua conta.
6. Clique em **Testar Conexão** para checar se as credenciais estão válidas.
7. Clique em **Sincronizar Agora** para importar as marcações reais e ver os painéis se atualizarem com a realidade da sua corporação de forma 100% automatizada!
8. Use o campo **Agendamento** se desejar que o sistema faça essa coleta sozinho durante as madrugadas, garantindo que o painel amanheça atualizado todos os dias.

---

## 🛡️ Segurança e Proteção dos Dados Reais (Modo Read-Only)

O Auditoria Trabalhista foi concebido sob um rigoroso padrão de segurança de dados (LGPD):
* **Modo Exclusivo de Leitura (Read-Only)**: A aplicação possui acesso estritamente passivo à API do Dimep Kairos. Ela **nunca** realiza gravações, alterações ou exclusões de batidas ou cadastros nos servidores oficiais da Dimep. Seus dados originais na nuvem estão 100% protegidos e intocados.
* **Intenção de Auditoria**: O sistema funciona puramente para identificação automática de riscos trabalhistas e apoio a decisões estratégicas.

---

---

## 🔐 Cadastro Inicial, Controle de Acesso e Segurança (Módulo Administrativo)

A Auditoria Trabalhista possui uma arquitetura de usuários e controle de segurança que garante a governança e o controle absoluto dos dados corporativos.

### 1. Criação Automática do Usuário Master de Implantação
Se o sistema for iniciado em um novo ambiente onde nenhuma conta de usuário existe, a plataforma **criará de forma totalmente automática o primeiro usuário com Perfil Master**:
1. **Nome**: Renato Santos
2. **E-mail**: `tecnicodimepdf@gmail.com`
3. **Perfil**: Master (Autoridade Suprema do sistema)
4. **Status**: Ativo
5. **Senha Inicial Padrão**: `Dimep@123`

### 2. Fluxo de Primeiro Acesso (Troca Obrigatória de Senha)
Para garantir a conformidade com as melhores práticas de segurança corporativa, o primeiro login do usuário Master exige a redefinição das credenciais padrão antes de liberar o acesso aos dashboards do sistema:
1. Ao fazer o login com `tecnicodimepdf@gmail.com` e a senha inicial `Dimep@123`, o sistema redireciona o usuário para a tela de **Troca Obrigatória de Senha**.
2. O usuário deve digitar a **Senha Inicial de Implantação**, definir uma **Nova Senha Forte** (mínimo de 6 caracteres) e confirmá-la.
3. O usuário deve selecionar e responder a **3 Perguntas de Segurança** distintas que servirão para recuperação de conta.
4. Ao clicar em **Finalizar e Acessar**, a senha padrão é substituída por um hash seguro SHA-256 e as respostas são criptografadas na base.
5. A operação de troca obrigatória de senha é registrada no log de auditoria do sistema contendo a data, hora e o endereço IP do acesso.

### 3. Recuperação de Senha por Perguntas de Segurança
Caso você esqueça sua senha de acesso pós-configuração:
1. Na tela de login, clique no link **"Esqueci minha senha"**.
2. Digite seu e-mail cadastrado e clique em **Verificar E-mail**.
3. O sistema carregará na tela as **3 perguntas de segurança** configuradas para o seu usuário.
4. Responda-as com exatidão (letras maiúsculas/minúsculas e acentos são avaliados de forma idêntica à do cadastro) e defina sua **Nova Senha**.
5. Clique em **Redefinir Senha** para concluir e acessar o sistema imediatamente.

### 4. Bloqueio Temporário de Conta (Prevenção de Força Bruta)
Como barreira de proteção contra acessos não autorizados:
* Se forem realizadas **5 tentativas consecutivas de login com senha incorreta**, a conta associada será **bloqueada automaticamente por 15 minutos**.
* Durante esse intervalo, qualquer tentativa de login exibirá um alerta vermelho de bloqueio, informando o tempo restante em minutos para que a conta seja reaberta pelo servidor.

### 5. Perfis de Usuário e Restrições Administrativas
A plataforma divide os colaboradores nos seguintes papéis de acesso:
* **Perfil Master**: É o administrador proprietário do sistema. Possui direitos absolutos para cadastrar novos usuários, redefinir senhas, editar ou excluir contas existentes, visualizar gráficos detalhados de estatísticas de auditoria e gerenciar as cópias de segurança (Backup e Restauração).
* **Perfil Administrador**: Possui acesso integral para configurar as conexões com o Dimep Kairos, sincronizar dados e analisar todos os dashboards, porém **não pode** criar novos usuários ou acessar funções de backup/restauração da base de dados.
* **Perfil Comum**: Perfil operacional corporativo. Este usuário está limitado a visualizar exclusivamente os funcionários, ocorrências e dashboards associados ao **CNPJ** cadastrado no seu vínculo de dados, promovendo o isolamento de dados entre filiais ou empresas de um mesmo grupo (Multitenancy). A aba administrativa de gerenciamento de usuários é exibida em modo de apenas leitura.

