# Modelagem e Estrutura de Banco de Dados - Auditoria Trabalhista

A plataforma Auditoria Trabalhista conta com uma modelagem relacional robusta projetada para reter o histórico de marcações de ponto, consolidar as auditorias calculadas de jornadas de trabalho e registrar as tentativas de sincronização com a API REST do Dimep Kairos.

Este documento apresenta a especificação física e lógica de armazenamento.

---

## 🗄️ Entidades e Atributos Cadastrais

Abaixo estão detalhados os esquemas lógicos utilizados para gerenciar os dados relacionais estruturados.

### 1. Empresas (`Empresas`)
Armazena as corporações e filiais ativas monitoradas pelo motor de conformidade.
* **`id`** (`string`, PK): Identificador único interno.
* **`cnpj`** (`string`): CNPJ da empresa (chave candidata, formatado).
* **`razaoSocial`** (`string`): Nome comercial oficial da empresa no fisco.
* **`nomeFantasia`** (`string`): Nome de fantasia de visualização simplificada.

### 2. Funcionários (`Funcionarios`)
Dossiê completo de informações contratuais e demográficas dos colaboradores indexados.
* **`id`** (`string`, PK): Identificador exclusivo.
* **`nome`** (`string`): Nome completo do funcionário.
* **`cpf`** (`string`): CPF formatado.
* **`pis`** (`string`): Número de PIS/NIT para cruzamento com o REP (Registrador Eletrônico de Ponto).
* **`cargo`** (`string`): Cargo atual (ex: "Operador I", "Motorista").
* **`departamento`** (`string`): Unidade de departamento operacional (ex: "Operação", "Logística").
* **`centroCusto`** (`string`): Centro de custos contábil.
* **`gestor`** (`string`): Nome do supervisor imediato.
* **`empresaId`** (`string`, FK): Aponta para a Empresa detentora do contrato.
* **`grauRisco`** (`enum`): Classificação automática de risco (`BAIXO`, `MEDIO`, `ALTO`, `CRITICO`).
* **`scoreRisco`** (`number`): Pontuação cumulativa de infrações (0 a 100).

### 3. Marcações de Ponto (`Marcacoes`)
Os registros brutos (batidas de ponto) extraídos do Dimep Kairos.
* **`id`** (`string`, PK): Identificador.
* **`funcionarioId`** (`string`, FK): ID do funcionário associado.
* **`data`** (`string`, formato `YYYY-MM-DD`): Data do registro.
* **`hora`** (`string`, formato `HH:MM:SS`): Hora precisa em que o ponto foi batido.
* **`tipo`** (`enum`): Classificação da batida (`ENTRADA`, `SAIDA`, `NEUTRO`).
* **`origem`** (`string`): Canal de batida (`Relógio`, `Manual`, `Mobile`).

### 4. Jornadas Calculadas (`JornadasCalculadas`)
Resultados do pré-processamento diário e agrupado das marcações.
* **`id`** (`string`, PK): Identificador.
* **`funcionarioId`** (`string`, FK): Referência do funcionário.
* **`data`** (`string`, formato `YYYY-MM-DD`): Data auditada.
* **`primeiraEntrada`** (`string | null`): Primeiro horário de entrada detectado.
* **`ultimaSaida`** (`string | null`): Último horário de saída detectado.
* **`marcações`** (`array` de strings): Lista consolidada de horários batidos no dia.
* **`horasTrabalhadas`** (`number`): Total líquido trabalhado (decimal).
* **`horasNoturnas`** (`number`): Total líquido de horas extras noturnas computadas (decimal).
* **`horasTrabalhadasFormat`** (`string`): Formatação amigável do tempo trabalhado (ex: "08:32").
* **`intervaloRealizado`** (`number`): Maior período de repouso registrado entre batidas de trabalho (minutos).
* **`descansoInterjornada`** (`number | null`): Horas decorridas entre a saída do dia anterior e a entrada do dia corrente (decimal).
* **`tipoDia`** (`enum`): Classificação do dia (`UTIL`, `DOMINGO`, `SABADO`, `FERIADO`).

### 5. Ocorrências / Infrações (`Ocorrencias`)
Tabela central de vulnerabilidades e desvios de conformidade localizados na base histórica.
* **`id`** (`string`, PK): Identificador.
* **`funcionarioId`** (`string`, FK): ID do colaborador infrator.
* **`data`** (`string`): Data da violação.
* **`tipo`** (`enum`): Código da violação CLT (`JORNADA_EXCESSIVA`, `SEM_FOLGA_7_DIAS`, etc.).
* **`descricao`** (`string`): Mensagem de apoio legal detalhando as razões fiscais do alerta.
* **`gravidade`** (`enum`): Gravidade do passivo gerado (`BAIXO`, `MEDIO`, `ALTO`, `CRITICO`).
* **`valorConstatado`** (`string`): Métrica identificada pelo motor (ex: "11h30").
* **`valorPermitido`** (`string`): Métrica máxima autorizada pela lei (ex: "10h00").

### 6. Histórico de Sincronizações (`SyncLogs`)
Armazena a trilha de auditoria técnica das chamadas de sincronismo à API Kairos.
* **`id`** (`string`, PK): Identificador do log.
* **`dataHora`** (`string`): Data e hora de execução da tarefa.
* **`status`** (`enum`): Resultado final do processo (`SUCESSO`, `FALHA`, `EM_ANDAMENTO`).
* **`detalhes`** (`string`): Texto explicativo (contendo erro ou sucesso).
* **`registrosColetados`** (`number`): Volume de novos registros indexados.

---

## 🔗 Relacionamentos entre Tabelas

```
[Empresas] (1) <────> (N) [Funcionários]
                             │  (1)
                             ├───> (N) [Marcações]
                             ├───> (N) [JornadasCalculadas]
                             └───> (N) [Ocorrências]
```

---

## 7. Esquema de Segurança, Usuários e Sessões (`Users`, `Profiles`, `ActivityLogs`)

### 7.1 Tabela de Usuários (`users`)
* **`id`** (`string`, PK): Identificador do usuário.
* **`nomeCompleto`** (`string`): Nome do gestor/auditor.
* **`email`** (`string`, UNIQUE): E-mail corporativo único.
* **`salt`** (`string`): Salt aleatório de 16 bytes (`hex`) para derivação de senha.
* **`passwordHash`** (`string`): Hash SHA-256 da senha combinada com o salt (`SHA256(password + ':' + salt)`).
* **`key`** (`string`): Chave REST API principal do Dimep Kairos.
* **`identifier`** (`string`): CNPJ/CPF da empresa.
* **`empresa`** (`string`): Razão Social.
* **`perfilAcesso`** (`string`): `Master`, `Administrador`, `Usuário Comum` ou personalizado.
* **`sincronizarAoEntrar`** (`boolean`): Preferência de sincronização automática de dados ao realizar login (Padrão: `false`).
* **`status`** (`enum`): `ATIVO`, `BLOQUEADO`, `INATIVO`.
* **`tentativasLogin`** (`number`): Contador de falhas de senha.
* **`bloqueadoAte`** (`string | null`): Data/Hora limite de bloqueio temporário (15 min).
* **`perguntasSeguranca`** (`array` de objetos): Array com 3 objetos `{ pergunta: string, respostaHash: string }`.

### 7.2 Controle de Sessões e Estatísticas (`ActiveSessions`, `UsageStats`)
* **`activeSessions`** (`array` de objetos): Registra as sessões autenticadas ativas no sistema, permitindo a desconexão remota e auditoria de IP/Dispositivo.
* **`usageStats`** (`objeto`): Consolida métricas de volumetria de uso, incluindo total de acessos, relatórios gerados e ações por módulo.

---

## 8. Estudo Comparativo Técnico de Persistência de Dados

| Critério / Arquitetura | **JSON Store Relacional Atômica (Atual)** | **SQLite Embutido** | **PostgreSQL (Cloud Database)** |
| :--- | :--- | :--- | :--- |
| **Integridade e Recuperabilidade** | **Excelente** (Atômico `.tmp` + `auto-healing` Master + Backup `.bak` rotativo) | Boa (ACID via arquivo local `.db`) | Altíssima (ACID Cloud DB) |
| **Portabilidade & Deploy** | **Imediata** (Zero dependências externas C/native bindings) | Depende de compiladores e binários nativos | Requer servidor de banco externo ou container |
| **Performance de Leitura** | **Extremamente Rápida** (Sincronizado na RAM + escrita em background) | Rápida (Indexação B-Tree) | Alta (Com latência de rede adicional) |
| **Complexidade de Suporte** | **Baixíssima** (Auto-contido, exportação/restauração em JSON simples) | Média (Ferramentas SQLite necessárias para inspeção) | Alta (Exige DBA, conexões, migrations) |
| **Decisão de Arquitetura** | **SELECIONADO (Produção Actual)** | Alternativa recomendada para volumetria >1M de registros | Alternativa para implantação multi-node |

