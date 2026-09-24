# RELATÓRIO COMPLETO DE ARQUITETURA, FLUXO DE DADOS E AUDITORIA DE REGRAS TRABALHISTAS (CLT / MTE)

**Sistema:** Audit Kairos — Plataforma de Inteligência e Auditoria Trabalhista  
**Empresa / Integração:** Dimep Kairos API REST (`/RestServiceApi/People/SearchPeople` e `/RestServiceApi/Appointment/GetAppointmentsV2`)  
**Tecnologias:** TypeScript, Node.js, Express, React 18, Vite, Tailwind CSS, Recharts  
**Data de Emissão:** 13 de Agosto de 2026  
**Elaborado Por:** Arquiteto de Software Sênior & Auditor de Sistemas de Compliance  

---

## 1. VISÃO GERAL E ARQUITETURA DO SISTEMA

O sistema **Audit Kairos** é uma aplicação web full-stack desenvolvida para automação de compliance trabalhista, ingestão contínua de registros de ponto eletrônico, reconstrução determinística de jornadas de trabalho e diagnóstico de ocorrências com base na legislação brasileira (Consolidação das Leis do Trabalho - CLT e Portarias do Ministério do Trabalho e Emprego - MTE).

### 1.1 Diagrama de Componentes e Camadas da Aplicação

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                1. FONTE EXTERNA DE DADOS                               │
│                         API REST Dimep Kairos (Sistema de Ponto)                       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            │ HTTP POST JSON (Rest API Key + CNPJ/CPF)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        2. CAMADA DE INGESTÃO E ADAPTAÇÃO                               │
│   server/kairos.ts                                                                     │
│   ├── fetchEmployees()           --> Busca paginada de colaboradores                   │
│   ├── fetchAppointments()        --> Coleta de batidas brutas (32 dias)                │
│   └── obterSituacaoDoFuncionario()--> Mapeamento de status (Ativo/Ferias/Afastado/etc) │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                  3. CAMADA DE CONSOLIDAÇÃO E DEDUPLICAÇÃO DE VÍNCULOS                  │
│   src/utils/funcionarios.ts                                                            │
│   └── resolverEConsolidarVinculos() --> Agrupa por CPF/PIS/Nome e elege vínculo Ativo  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                 4. MOTOR CENTRAL DE AUDITORIA E RECONSTRUÇÃO CLT                       │
│   server/engine.ts (Fonte Única da Verdade)                                            │
│   ├── normalizarMarcacoes()     --> Purificação e remoção de duplicatas                │
│   ├── reconstruirJornadas()     --> Emparelhamento sequencial e turnos noturnos        │
│   ├── gerarVisaoDiaria()        --> Construção do calendário consolidado               │
│   ├── [7 Regras de Auditoria]   --> Cálculo determinístico de ocorrências              │
│   └── calcularScoresFuncionarios()--> Scoring de risco (0-100) e classificação         │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         5. CAMADA DE PERSISTÊNCIA EM MEMÓRIA / DISCO                   │
│   server/db.ts (Classe Database)                                                       │
│   └── dbInstance.save()          --> RAM Cache + Gravação em data/db.json              │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        6. SERVIDOR REST API & MOTOR DE FILTROS BI                      │
│   server.ts (Express Framework)                                                        │
│   ├── getFilteredRecords()       --> Filtros dinâmicos server-side (Dept, Risco, Data) │
│   └── /api/dashboard/*           --> Endpoints de KPIs, gráficos e relatórios          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         7. INTERFACE DO USUÁRIO (CLIENTE SPA)                          │
│   src/components/* (React 18 + Vite + Tailwind CSS + Recharts)                         │
│   ├── DashboardExecutivo.tsx     --> KPIs consolidados e visão gerencial               │
│   ├── DashboardRH.tsx            --> Visão operacional de RH e desvios                 │
│   ├── Auditorias.tsx             --> Tabela detalhada de ocorrências e evidências      │
│   └── Relatorios.tsx             --> Exportação em PDF, Excel e CSV                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CADEIA DE EXECUÇÃO E FLUXO DE DADOS PASSO A PASSO

A esteira de processamento percorre 8 etapas sequenciais desde o disparo inicial até a exibição na interface do usuário:

1. **Disparo da Sincronização (`POST /api/sync` ou seleção de empresa):**
   - O usuário aciona a atualização na interface ou altera a empresa ativa em `POST /api/empresas-rest/selecionar`.
   - O servidor recupera os parâmetros de configuração armazenados (`host`, `identifier`, `key`).

2. **Ingestão HTTP REST na API Dimep Kairos (`server/kairos.ts`):**
   - **Purificação do Identificador:** `cleanIdentifier(identifier)` remove pontuações e traços de CNPJ/CPF.
   - **Busca de Pessoas (`fetchEmployees`):** Dispara `POST /RestServiceApi/People/SearchPeople` com paginação iterativa. Protege contra *loops* infinitos com um `Set<string>` de IDs.
   - **Normalização do Cadastral:** `obterSituacaoDoFuncionario(emp)` mapeia as flags originais do Kairos (`Ativo`, `Demitido`, `Excluido`, `Afastado`, `Ferias`, `Situacao`, `PessoaStatus`, `DataDemissao`) para categorizações padronizadas (`status`: `ATIVO`/`DESLIGADO` e `situacao`: `ATIVO`/`INATIVO`/`EXCLUIDO`/`DESLIGADO`/`AFASTADO`/`FERIAS`).
   - **Busca de Marcacões (`fetchAppointments`):** Dispara `POST /RestServiceApi/Appointment/GetAppointmentsV2` com `IdsPessoa: [0]` para o período de 32 dias (`HOJE - 32` a `HOJE`).

3. **Consolidação de Múltiplos Vínculos (`src/utils/funcionarios.ts`):**
   - `resolverEConsolidarVinculos(funcionarios)` agrupa múltiplos cadastros históricos e contratos encerrados da mesma pessoa física com base na chave prioritária: **CPF** $\rightarrow$ **PIS** $\rightarrow$ **Nome Normalizado + Empresa**.
   - Seleciona o cadastro ativo como o **Vínculo Principal** e gera o mapa `mapaHistoricoParaAtivo`, remapeando todas as batidas e ocorrências históricas dos cadastros encerrados para o ID do vínculo ativo atual.

4. **Execução do Motor Central de Auditoria (`server/engine.ts` $\rightarrow$ `processarAuditoria`):**
   - `determinarPeriodoAuditoria()` estabelece o intervalo contínuo de datas no formato `YYYY-MM-DD`.
   - O sistema distribui as marcações brutas no mapa `marcacoesPorFuncionario[activeId][data]`.
   - Para cada colaborador, chama `gerarVisaoDiaria(func, datasAuditoria, porData)`.

5. **Construção da Visão Diária e Reconstrução de Jornadas (`server/engine.ts`):**
   - `normalizarMarcacoes()` filtra batidas válidas (exclui `desprezado === true` e eventos com origem administrativa como `FOLGA`, `DSR`, `FERIAS`, `ABONO`) e elimina duplicatas ocorridas no mesmo minuto.
   - `reconstruirJornadas()` emparelha ordenadamente as entradas e saídas, identificando períodos efetivamente trabalhados, viradas de dia/noite (adicionando $+1440$ min na saída menor que a entrada) e marcando batidas isoladas sem par.
   - `construirContextosDiarios()` atribui os períodos e calcula a soma do tempo trabalhado no dia, bem como o maior intervalo intrajornada do dia.
   - `calcularInterjornadaPorData()` calcula a diferença em horas entre a última saída do dia anterior e a primeira entrada do dia trabalhado seguinte.

6. **Avaliação Determinística das 7 Regras Trabalhistas (`server/engine.ts`):**
   - Executa as auditorias diárias e periódicas para cada colaborador, gerando a coleção de `Ocorrencia`.

7. **Cálculo do Score de Risco e Persistência (`server/engine.ts` e `server/db.ts`):**
   - `calcularScoresFuncionarios()` pondera as ocorrências por gravidade (CRÍTICO: 25pt, ALTO: 10pt, MÉDIO: 4pt, BAIXO: 1pt), atribui o `scoreRisco` (limite 0–100) e classifica o `grauRisco`.
   - Os dados atualizados são armazenados no banco `data/db.json` via `dbInstance.save()`.

8. **Consulta, Filtragem BI e Renderização (`server.ts` e Frontend):**
   - `getFilteredRecords()` realiza a filtragem em memória por empresa, departamento, centro de custo, cargo, gestor, grau de risco e período.
   - Os dados são consumidos pelos componentes do React (`DashboardExecutivo`, `DashboardRH`, `Auditorias`, `Relatorios`).

---

## 3. MAPEAMENTO DETALHADO DAS 7 REGRAS DE AUDITORIA CLT

A tabela a seguir apresenta o resumo executivo das 7 regras auditadas no motor central:

| Código da Regra | Nome da Regra | Artigo Legal | Arquivo | Função Principal | Ordem de Execução |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `MARCACAO_IMPAR` | Marcação Ímpar | Portaria MTE 671/2021 / Art. 74 CLT | `server/engine.ts` | `auditarMarcacaoImpar()` | Execução Diária #1 |
| `JORNADA_EXCESSIVA` | Jornada Excessiva (> 10h) | Art. 59 CLT | `server/engine.ts` | `auditarJornadaExcessiva()` | Execução Diária #2 |
| `INTERVALO_INSUFICIENTE` | Intervalo Intrajornada | Art. 71 CLT | `server/engine.ts` | `auditarIntervaloIntrajornada()` | Execução Diária #3 |
| `DOMINGO_EXCESSIVO` | Domingo Excessivo (> 6h) | Art. 67 CLT | `server/engine.ts` | `auditarDomingoExcessivo()` | Execução Diária #4 |
| `INTERJORNADA_INSUFICIENTE` | Interjornada Insuficiente (< 11h) | Art. 66 CLT | `server/engine.ts` | `auditarInterjornada()` | Execução Periódica #1 |
| `SEM_FOLGA_7_DIAS` | Trabalho sem Folga 7+ Dias | Art. 67 CLT / Art. 7º, XV CF | `server/engine.ts` | `auditarTrabalho7Dias()` | Execução Periódica #2 |
| `DOMINGOS_SEGUIDOS` | Dois Domingos Seguidos | Art. 67 CLT | `server/engine.ts` | `auditarDoisDomingosSeguidos()` | Execução Periódica #3 |

---

### 3.1 Regra 1: Marcação Ímpar (`MARCACAO_IMPAR`)

- **a) Arquivo:** `/server/engine.ts`
- **b) Função:** `auditarMarcacaoImpar(funcOrVisao: Funcionario | VisaoDiaria, data?: string, times?: string[])`
- **c) Dependências Internas:** `reconstruirJornadas()`, `normalizarMarcacoes()`, `baseOcorrencia()`
- **d) Ordem de Execução na Cadeia:** **Execução Diária #1** (Processada dentro do laço de iteração por dia em `processarAuditoria`).
- **e) Condição Matemática e Lógica Exata de Disparo:**
  - `reconstruirJornadas()` processa as batidas válidas do dia e identifica a lista `marcacoesSemPar`.
  - Dispara quando $\text{marcacoesSemPar.length} > 0$, ou seja, quando a sequência de batidas físicas válidas no dia possui uma quantidade ímpar ou desbalanceada que impede a formação completa de pares de Entrada/Saída (ex: 1, 3 ou 5 batidas).
- **f) Evidência Gerada:**
  - `valorConstatado`: `"X marcação(ões) sem par"` (ex: `"1 marcação(ões) sem par"`).
  - `valorPermitido`: `"Entrada e saída em sequência compatível"`.
  - `descricao`: Lista os horários despareados no dia (ex: `"Marcação sem par identificada: 08:00. A sequência de registros não permitiu formar uma jornada completa."`).
  - `gravidade`: `MEDIO`.

---

### 3.2 Regra 2: Jornada Excessiva Superior a 10 Horas (`JORNADA_EXCESSIVA`)

- **a) Arquivo:** `/server/engine.ts`
- **b) Função:** `auditarJornadaExcessiva(visoesOrVisao: VisaoDiaria[] | VisaoDiaria, funcInput?: Funcionario)`
- **c) Dependências Internas:** `converterHoraParaMinutos()`, `formatarMinutosParaHHMM()`, `VisaoDiaria`, `Ocorrencia`
- **d) Ordem de Execução na Cadeia:** **Execução Diária #2** (Processada para cada dia com marcação em `processarAuditoria`).
- **e) Condição Matemática e Lógica Exata de Disparo:**
  - Exige que o dia possua marcação física (`possuiMarcacao === true`) e um número par de marcações válidas ($\ge 2$).
  - Somatório estrito do tempo líquido trabalhado nos pares $(\text{Saída}_i - \text{Entrada}_i)$ em minutos. Se houver virada de noite ($\text{Saída}_i < \text{Entrada}_i$), adiciona $1440$ minutos ($24\text{h}$).
  - **Trava Estrita de Disparo:** Dispara **APENAS** se o tempo líquido de trabalho for estritamente superior a **600 minutos** ($10\text{h}00\text{min}$ exatas):
    $$\text{minutosTrabalhadosNoDia} > 600$$
  - *(Nota: Jornadas de exatamente $10\text{h}00\text{min}$ ou menos são legais conforme Art. 59 da CLT e não geram ocorrência).*
- **f) Evidência Gerada:**
  - `valorConstatado`: Tempo efetivo formatado (ex: `"10:15"` ou `"11:30"`).
  - `valorPermitido`: `"10:00"`.
  - `descricao`: `"Jornada excessiva no dia YYYY-MM-DD. Tempo efetivo trabalhado: 10:15h (Limite legal: 10:00h - Art. 59 CLT). Excedente: 00:15h."`
  - `gravidade`:
    - `MEDIO`: $600 < \text{minutos} \le 720$ ($10\text{h}$ a $12\text{h}$).
    - `ALTO`: $720 < \text{minutos} \le 840$ ($12\text{h}$ a $14\text{h}$).
    - `CRITICO`: $\text{minutos} > 840$ ($> 14\text{h}$).

---

### 3.3 Regra 3: Intervalo Intrajornada Insuficiente (`INTERVALO_INSUFICIENTE`)

- **a) Arquivo:** `/server/engine.ts`
- **b) Função:** `auditarIntervaloIntrajornada(funcOrVisao: Funcionario | VisaoDiaria, data?: string, ...)`
- **c) Dependências Internas:** `baseOcorrencia()`, `minutesToTimeStr()`, `VisaoDiaria`
- **d) Ordem de Execução na Cadeia:** **Execução Diária #3** (Processada quando `totalMinutosTrabalhados > 0`).
- **e) Condição Matemática e Lógica Exata de Disparo:**
  - **Caso 1: Jornada $> 6\text{h}$ ($> 360$ minutos):**
    - Se a quantidade de marcações $< 4$ ou o intervalo intrajornada principal `intervaloRealizado === 0`: gera desvio por ausência total de intervalo (`CRITICO`, constatado `00:00`, permitido `01:00`).
    - Se $0 < \text{intervaloRealizado} < 60$ minutos: gera desvio por intervalo parcial (`CRITICO` se $<30$ min; `ALTO` se $30$ a $59$ min).
  - **Caso 2: Jornada entre $4\text{h}$ e $6\text{h}$ ($240$ a $360$ minutos):**
    - Se quantidade de marcações $< 4$ ou `intervaloRealizado === 0`: gera desvio por ausência de intervalo (`MEDIO`, constatado `00:00`, permitido `00:15`).
    - Se $0 < \text{intervaloRealizado} < 15$ minutos: gera desvio por intervalo parcial (`ALTO`).
- **f) Evidência Gerada:**
  - `valorConstatado`: Tempo de intervalo realizado (ex: `"00:35"` ou `"00:00"`).
  - `valorPermitido`: `"01:00"` (ou `"00:15"`).
  - `descricao`: Refere a CLT Art. 71 e indica a duração apurada frente ao mínimo legal exigido.

---

### 3.4 Regra 4: Trabalho Excessivo em Domingo (`DOMINGO_EXCESSIVO`)

- **a) Arquivo:** `/server/engine.ts`
- **b) Função:** `auditarDomingoExcessivo(funcOrVisao: Funcionario | VisaoDiaria, data?: string, ...)`
- **c) Dependências Internas:** `isSunday()`, `baseOcorrencia()`, `minutesToTimeStr()`, `VisaoDiaria`
- **d) Ordem de Execução na Cadeia:** **Execução Diária #4** (Processada para domingos com trabalho em `processarAuditoria`).
- **e) Condição Matemática e Lógica Exata de Disparo:**
  - Verifica se o dia é um domingo (`visao.domingo === true` ou `isSunday(data) === true`).
  - Dispara **APENAS** se o tempo líquido trabalhado no domingo for superior a **360 minutos** ($6\text{h}00\text{min}$):
    $$\text{totalMinutosTrabalhados} > 360$$
  - *(Nota: Trabalhos em domingo de até $6\text{h}00\text{min}$ são considerados operacionais e não geram ocorrência).*
- **f) Evidência Gerada:**
  - `valorConstatado`: Tempo de trabalho no domingo (ex: `"07:30"`).
  - `valorPermitido`: `"06:00"`.
  - `descricao`: `"Trabalho em domingo de 07:30, superior ao limite operacional de 06:00. Excedente: 01:30. Fundamento legal contextual: CLT Art. 67."`
  - `gravidade`: `ALTO` ($6\text{h}$ a $8\text{h}$); `CRITICO` ($>8\text{h}$).

---

### 3.5 Regra 5: Descanso Interjornada Insuficiente (`INTERJORNADA_INSUFICIENTE`)

- **a) Arquivo:** `/server/engine.ts`
- **b) Função:** `auditarInterjornada(visoes: VisaoDiaria[], func: Funcionario)`
- **c) Dependências Internas:** `criarTimestampDataHora()`, `formatarMinutosParaHHMM()`, `VisaoDiaria`, `Ocorrencia`
- **d) Ordem de Execução na Cadeia:** **Execução Periódica #1** (Processada no nível do funcionário após a montagem de todas as visões diárias do período).
- **e) Condição Matemática e Lógica Exata de Disparo:**
  - Filtra todos os dias do período que possuem presença física e marcações válidas ($\ge 2$ batidas) e ordena cronologicamente por data.
  - Para cada par de dias trabalhados consecutivos ($D_{i}$ e $D_{i+1}$):
    - Extrai a **última saída** do dia anterior $D_{i}$ e a **primeira entrada** do dia seguinte $D_{i+1}$.
    - Converte ambos os horários para timestamps UTC exatos em milissegundos.
    - Calcula o descanso efetivo em minutos:
      $$\text{descansoMinutos} = \frac{\text{TimestampEntrada}_{i+1} - \text{TimestampSaida}_{i}}{60.000}$$
    - Dispara a ocorrência se o descanso for estritamente inferior a **660 minutos** ($11\text{h}00\text{min}$):
      $$\text{descansoMinutos} < 660$$
- **f) Evidência Gerada:**
  - `valorConstatado`: Tempo de descanso realizado em HH:MM (ex: `"09:30"`).
  - `valorPermitido`: `"11:00"`.
  - `descricao`: `"Descanso interjornada insuficiente entre 10/08/2026 (22:00) e 11/08/2026 (07:30). Descanso realizado: 09:30h (Mínimo legal: 11:00h - Art. 66 CLT). Saldo devido como HE: 01:30h."`
  - `gravidade`: `ALTO`.

---

### 3.6 Regra 6: Trabalho sem Folga por 7 ou Mais Dias Consecutivos (`SEM_FOLGA_7_DIAS`)

- **a) Arquivo:** `/server/engine.ts`
- **b) Função:** `auditarTrabalho7Dias(visoes: VisaoDiaria[], func: Funcionario)`
- **c) Dependências Internas:** `calcularDiferencaDias()`, `validarEGerarOcorrencia()`, `formatDateBR()`, `baseOcorrencia()`, `VisaoDiaria`
- **d) Ordem de Execução na Cadeia:** **Execução Periódica #2** (Processada no nível do colaborador sobre o array de visões diárias).
- **e) Condição Matemática e Lógica Exata de Disparo:**
  - Ordena as visões diárias do colaborador estritamente por data (`YYYY-MM-DD`).
  - **Validação de Batida Física Efetiva:** Considera dia trabalhado **Apenas** se `possuiMarcacao === true` e houver batida física no relógio. Dias com abono, folga cadastrada, feriado ou ausência de batida **zeram** a contagem do bloco.
  - **Validação de Continuidade Temporal:** Verifica se a diferença entre datas consecutivas é de exatamente $1$ dia civil ($\Delta t = 1$).
  - Dispara a infração consolidada quando a sequência de dias ininterruptos com batida física atinge ou supera **7 dias consecutivos**:
    $$\text{tamanhoDoBlocoTrabalhado} \ge 7$$
- **f) Evidência Gerada:**
  - `valorConstatado`: Quantidade de dias contínuos trabalhados (ex: `"7 dias"` ou `"9 dias"`).
  - `valorPermitido`: `"Até 6 dias consecutivos"`.
  - `descricao`: `"Trabalho contínuo por 7 dias consecutivos sem Descanso Semanal Remunerado (CLT Art. 67). Período: 01/08/2026 a 07/08/2026."`
  - `gravidade`: `ALTO` (se $7$ dias); `CRITICO` (se $\ge 8$ dias).

---

### 3.7 Regra 7: Trabalho em Dois Domingos Seguidos (`DOMINGOS_SEGUIDOS`)

- **a) Arquivo:** `/server/engine.ts`
- **b) Função:** `auditarDoisDomingosSeguidos(visoes: VisaoDiaria[], func: Funcionario)`
- **c) Dependências Internas:** `dateToDayNumber()`, `addDays()`, `baseOcorrencia()`, `formatDateBR()`, `VisaoDiaria`
- **d) Ordem de Execução na Cadeia:** **Execução Periódica #3** (Processada sobre o conjunto de visões diárias do colaborador).
- **e) Condição Matemática e Lógica Exata de Disparo:**
  - Filtra todos os domingos do período em que `domingo === true` e `possuiMarcacao === true`.
  - Para cada domingo trabalhado $D_1$, calcula a data do domingo seguinte $D_2 = D_1 + 7 \text{ dias}$.
  - Dispara a infração no segundo domingo $D_2$ se ele também possuir `possuiMarcacao === true`.
- **f) Evidência Gerada:**
  - `valorConstatado`: `"2 domingos consecutivos"`.
  - `valorPermitido`: `"1 domingo"`.
  - `descricao`: `"Foram identificados registros de ponto em dois domingos consecutivos: 02/08/2026 e 09/08/2026. Para esta regra, uma única marcação já comprova a existência de registro no domingo. Fundamento legal contextual: CLT Art. 67."`
  - `gravidade`: `ALTO`.

---

## 4. CONSOLIDAÇÃO DE JORNADAS E IDENTIFICAÇÃO DE EVENTOS TRABALHISTAS

O sistema trata e diferencia eventos de presença e ausência com base na estrutura de dados do relógio e da API do Dimep Kairos.

### 4.1 Identificação de Presença e Dias Trabalhados
- **Batida Física Registrada (`possuiMarcacao`):** Determinado pela presença de pelo menos uma marcação de tipo `ENTRADA` ou `SAIDA` com horário válido. Utilizado para contagem de presença e avaliação de folgas semanais e domingos.
- **Batida Válida para Jornada (`possuiMarcacaoValidaParaJornada`):** Filtra e remove registros onde `desprezado === true` ou cuja origem pertença a eventos administrativos. Utilizado exclusivamente para cálculo de horas trabalhadas e intervalos.

### 4.2 Tratamento de Folgas, DSR, Férias, Afastamentos e Abonos
- **Situação Cadastral na API (`server/kairos.ts`):** A função `obterSituacaoDoFuncionario` lê os atributos do colaborador no Dimep Kairos e classifica sua situação em:
  - `ATIVO`: Colaborador em atividade normal.
  - `FERIAS`: Identificado pelas flags `Ferias === true`, `Situacao === "5"` ou `PessoaStatus === "105"`.
  - `AFASTADO`: Identificado pelas flags `Afastado === true`, `Situacao === "4"` ou `PessoaStatus === "106*"`.
  - `DESLIGADO`: Identificado pelas flags `Demitido === true`, `Situacao === "2"` ou `DataDemissao` preenchida.
  - `EXCLUIDO`: Identificado por `Excluido === true` ou `Situacao === "3"`.
- **Filtro de Origem Administrativa (`origemAdministrativa` em `server/engine.ts`):**
  - O motor inspeciona os campos `origem` e `descricao` da marcação. Se contiverem termos como `"FOLGA"`, `"DSR"`, `"FERIADO"`, `"FERIAS"`, `"AFAST"`, `"ABONO"`, `"FALTA"`, `"DIA LIVRE"`, a batida é desconsiderada como trabalho físico real, garantindo que eventos administrativos não gerem falsos positivos de trabalho.

### 4.3 Reconstrução de Primeira Entrada, Última Saída e Intervalos
- **Primeira Entrada (`primeiraEntrada`):** Horário `HH:MM` do primeiro período de trabalho reconstruído que inicia na data do calendário.
- **Última Saída (`ultimaSaida`):** Horário `HH:MM` do último período de trabalho reconstruído que encerra na data do calendário.
- **Intervalo Intrajornada (`intervaloIntrajornadaMinutos`):** Calculado como a diferença em minutos entre a saída de um período $P_i$ e a entrada do período seguinte $P_{i+1}$ dentro do mesmo dia.
- **Descanso Interjornada (`interjornadaHoras`):** Calculado como a diferença em horas entre a última saída da jornada anterior e a primeira entrada da jornada atual.

---

## 5. DIAGNÓSTICO DE FRAGILIDADES E OPORTUNIDADES ARQUITETURAIS (SEM ALTERAÇÃO DE CÓDIGO)

Com base na análise minuciosa do ecossistema, identificam-se 6 fragilidades e pontos de atenção arquiteturais:

### Fragilidade 1: Persistência Síncrona em Arquivo JSON Único (`data/db.json`)
- **Mecânica:** A classe `Database` em `server/db.ts` executa a gravação do banco chamando `fs.writeFileSync` de forma atômica e síncrona a cada atualização de dados.
- **Impacto:** Conforme a base histórica de batidas e ocorrências cresce ($> 100.000$ registros), cada chamada ao `save()` bloqueia a Event Loop do Node.js durante a serialização de grandes objetos JSON, gerando picos de latência e alto consumo de memória RAM.
- **Recomendação de Evolução:** Migração da camada de persistência para um banco relacional indexado embarcado (SQLite via `better-sqlite3` ou Drizzle ORM).

### Fragilidade 2: Processamento de Filtros BI em Memória no Servidor (`getFilteredRecords`)
- **Mecânica:** Os endpoints `/api/dashboard/kpis`, `/api/dashboard/charts`, `/api/funcionarios` e `/api/ocorrencias` em `server.ts` executam varreduras do tipo $O(N)$ em arrays em memória RAM para aplicar filtros de departamento, centro de custo, cargo, período e grau de risco.
- **Impacto:** Sob uso simultâneo de múltiplos usuários, a CPU do servidor Node.js é sobrecarregada ao refazer filtros e iterações em laços repetidos para cada requisição HTTP.
- **Recomendação de Evolução:** Delegar a filtragem e agregação para consultas SQL nativas com índices no banco de dados.

### Fragilidade 3: Paginação HTTP Sequencial na Ingestão do Kairos (`fetchEmployees`)
- **Mecânica:** O método `fetchEmployees` em `server/kairos.ts` executa um laço `while` que aguarda a resposta de cada página de colaboradores em série antes de solicitar a próxima página.
- **Impacto:** Em empresas com milhares de colaboradores distribuídos em muitas páginas, o tempo de ingestão da lista de pessoas pode se estender por vários minutos.
- **Recomendação de Evolução:** Implementar requisições paginadas concorrentes com limite de concorrência (pool de conexões HTTP).

### Fragilidade 4: Sincronização Síncrona Retida na Rota HTTP (`/api/sync`)
- **Mecânica:** A rota `/api/sync` executa todo o fluxo de download na API do Kairos, limpeza de vínculos, execução do motor de auditoria e salvamento em disco dentro do ciclo de vida de uma única requisição HTTP POST.
- **Impacto:** Se o volume de dados do cliente exigir mais de 30 a 60 segundos para processamento, proxies de nuvem (Cloud Run, Nginx) ou o próprio navegador encerrarão a conexão por *timeout* de rede.
- **Recomendação de Evolução:** Transformar a sincronização em uma tarefa assíncrona em segundo plano (Background Worker/Job) com endpoint de acompanhamento de progresso (`polling`).

### Fragilidade 5: Isolamento Multiempresa por Reset de Banco (`clearAllData`)
- **Mecânica:** Ao selecionar uma nova empresa ativa na API (`/api/empresas-rest/selecionar`), o sistema chama `dbInstance.clearAllData()`, apagando os dados em memória da empresa anterior para carregar os dados da nova empresa.
- **Impacto:** Impede o uso verdadeiramente *multi-tenant* simultâneo por usuários de empresas diferentes no mesmo servidor, pois a empresa ativa é global na memória da instância.
- **Recomendação de Evolução:** Adicionar a coluna `empresaId` indexada em todas as tabelas e eliminar o acoplamento de limpeza de banco na troca de empresa.

### Fragilidade 6: Inversão Potencial em Emparelhamento de Marcações Ímpares
- **Mecânica:** Quando ocorrem batidas ímpares isoladas no meio do dia (ex: esquecimento de registrar a saída para o almoço), o algoritmo de emparelhamento sequencial simples pode parear temporariamente a volta do almoço com a saída do final do expediente.
- **Impacto:** Embora a regra `MARCACAO_IMPAR` identifique e sinalize a batida sem par corretamente, a interpretação das horas dos blocos restantes do dia pode apresentar distorções pontuais naquele dia específico.
- **Recomendação de Evolução:** Adotar heurísticas avançadas de proximidade de horários contratados para descarte/ajuste de batidas órfãs.

---

## 6. CONCLUSÃO

O sistema **Audit Kairos** apresenta uma arquitetura robusta, determinística e centralizada no motor `/server/engine.ts`. A purificação de marcações, o tratamento de viradas de turno e a consolidação de vínculos históricos asseguram diagnósticos precisos das 7 regras de conformidade trabalhista da CLT. As fragilidades identificadas representam oportunidades claras para a evolução futura de desempenho e escalabilidade da plataforma.
