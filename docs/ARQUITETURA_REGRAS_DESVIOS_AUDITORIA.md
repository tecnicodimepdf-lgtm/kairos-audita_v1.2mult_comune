# ARQUITETURA DE DADOS, PROCESSAMENTO, DEDUZIBILIDADE E AUDITORIA DE DESVIOS TRABALHISTAS (CLT / MTE)

**Sistema:** Audit Kairos — Módulo de Inteligência e Auditoria Contínua Trabalhista  
**Integração:** API REST Dimep Kairos (`/RestServiceApi/People/SearchPeople` e `/RestServiceApi/Appointment/GetAppointmentsV2`)  
**Versão do Documento:** 1.0.0 (Definitivo / Homologado)  
**Data de Emissão:** 13 de Agosto de 2026  
**Escopo do Documento:** Especificação técnica oficial e permanente da arquitetura de dados, pipeline de ingestão, regras de normalização, deduplicação de vínculos, construção da Visão Diária e cálculo determinístico das 7 ocorrências de desvios trabalhistas.

---

## 1. OBJETIVO DA DOCUMENTAÇÃO E ESCOPO DA AUDITORIA

Este documento estabelece a referência técnica oficial e permanente do sistema **Audit Kairos**, detalhando minuciosamente a esteira de dados percorrida desde a coleta de registros brutos de ponto na API REST do Dimep Kairos até a apresentação e exportação final dos eventos de desvio trabalhista.

### 1.1 Esteira End-to-End de Processamento de Dados

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             1. API DIMEP KAIROS                                  │
│   Endpoints: SearchPeople (Pessoas) e GetAppointmentsV2 (Batidas de Ponto)       │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             2. INGESTÃO & COLETA                                 │
│   server/kairos.ts → syncRealDimepKairos() & fetchAppointments()                 │
│   Período fixo contínuo de 32 dias (HOJE - 32) com tolerância a falhas de rede     │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   3. PURIFICAÇÃO E CONSOLIDAÇÃO DE VÍNCULOS                      │
│   src/utils/funcionarios.ts → resolverEConsolidarVinculos()                      │
│   Agrupamento CPF/PIS/Nome, seleção do vínculo ATIVO e remapeamento histórico    │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     4. CONSTRUÇÃO DA VISÃO DIÁRIA CONSOLIDADA                    │
│   server/engine.ts → gerarVisaoDiaria()                                         │
│   Emparelhamento sequencial, cálculo de horas trabalhadas e interjornada         │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        5. MOTOR DE REGRAS AUDITORIA CLT                          │
│   server/engine.ts → processarAuditoria()                                        │
│   Avaliação determinística das 7 regras diárias e temporais de infração          │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   6. CÁLCULO DE SCORE DE RISCO E PERSISTÊNCIA                     │
│   server/engine.ts → calcularScoresFuncionarios()                                │
│   Atribuição de gravidade, score (0-100) e salvamento no banco dbInstance        │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       7. CAMADA DE APRESENTAÇÃO E EXPORTAÇÃO                     │
│   REST API (/api/ocorrencias, /api/dashboard/kpis) & Relatórios PDF/CSV           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Distinção entre Fundamento Legal e Critérios Operacionais

O motor de auditoria faz a distinção formal entre a **norma legal** (Consolidação das Leis do Trabalho - CLT e Portarias do Ministério do Trabalho e Emprego - MTE) e os **critérios operacionais de tolerância e cálculo**:

1. **Fundamento Legal (Norma CLT/MTE):** Define o direito do trabalhador e a proibição legal (ex: limite de 10h diárias conforme Art. 59; intervalo mínimo de 11h entre jornadas conforme Art. 66; descanso semanal remunerado conforme Art. 67).
2. **Critério Operacional (Regra Determinística):** Define as condições matemáticas estritas de disparo de infração. Para evitar falsos positivos por imprecisão de segundos, o motor trabalha com **minutos inteiros consolidados**, garantindo que apenas ultrapassagens reais gerem ocorrências registradas.

---

## 2. FONTE ÚNICA DA VERDADE E ESTRUTURA DO MOTOR DETERMINÍSTICO

Para assegurar 100% de consistência, auditabilidade e reprodutibilidade nos cálculos, o sistema adota o arquivo **`/server/engine.ts`** como a **Fonte Única da Verdade** das regras de auditoria trabalhista. 

A antiga dependência de subprocessos Python e bibliotecas como `pandas` foi totalmente descontinuada. O módulo `/server/pythonBridge.ts` atua como um wrapper direto e síncrono para o motor em `/server/engine.ts`, eliminando divergências de ambiente ou arredondamento.

### 2.1 Modelos e Interfaces Principais (`/src/types.ts`)

#### A. `VisaoDiaria`
Estrutura diária unificada que consolida todos os atributos de presença e jornada de um colaborador em determinada data:

```typescript
export interface VisaoDiaria {
  funcionarioId: string;
  funcionarioNome: string;
  funcionarioMatricula: string;
  empresaId: string;
  data: string; // Formato YYYY-MM-DD
  diaDaSemana: 'DOMINGO' | 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA' | 'SABADO';
  domingo: boolean;
  quantidadeMarcacoes: number;
  marcacoesDoDia: Marcacao[];
  possuiMarcacao: boolean; // Indica se há qualquer batida física registrada
  possuiMarcacaoValidaParaJornada: boolean; // Indica se há batidas válidas (não-desprezadas)
  primeiraEntrada: string | null; // HH:MM da primeira batida válida
  ultimaSaida: string | null; // HH:MM da última batida válida
  horasEfetivamenteTrabalhadas: number; // Horas decimais
  horasEfetivamenteTrabalhadasFormat: string; // Formato HH:MM
  totalMinutosTrabalhados: number; // Minutos inteiros acumulados
  faixaDuracao: FaixaDuracaoDiaria;
  intervaloIntrajornadaMinutos: number; // Maior intervalo do dia em minutos
  saidaAnterior: string | null; // Hora de saída da jornada anterior
  dataSaidaAnterior: string | null; // Data da jornada anterior
  entradaAtual: string | null; // Hora de entrada do dia atual
  interjornadaHoras: number | null; // Horas decimais de descanso interjornada
}
```

#### B. `FaixaDuracaoDiaria`
Enum para categorização operacional da duração trabalhada no dia:

```typescript
export type FaixaDuracaoDiaria = 'SEM_MARCACAO' | 'MENOS_DE_4H' | 'DE_4_A_6H' | 'MAIS_DE_6H';
```

#### C. `JornadaCalculada`
Estrutura para visualização na interface e relatórios detalhados:

```typescript
export interface JornadaCalculada {
  id: string;
  funcionarioId: string;
  data: string;
  primeiraEntrada: string | null;
  ultimaSaida: string | null;
  marcações: string[];
  horasTrabalhadas: number;
  horasNoturnas: number;
  horasTrabalhadasFormat: string;
  intervaloRealizado: number;
  descansoInterjornada: number | null;
  tipoDia: 'UTIL' | 'DOMINGO' | 'SABADO' | 'FERIADO';
}
```

#### D. `Ocorrencia`
Estrutura do registro formal do desvio trabalhista detectado:

```typescript
export interface Ocorrencia {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  funcionarioMatricula: string;
  funcionarioDepartamento: string;
  funcionarioSexo: 'MASCULINO' | 'FEMININO';
  data: string;
  tipo: TipoOcorrencia;
  descricao: string;
  gravidade: GravidadeOcorrencia;
  valorConstatado: string;
  valorPermitido: string;
  // Campos detalhados para auditoria
  primeiraMarcacao?: string | null;
  ultimaMarcacao?: string | null;
  marcacoesUtilizadas?: string[];
  periodosTrabalhadosDesc?: string[];
  totalMinutosTrabalhados?: number;
  limiteMinutos?: number;
  excedenteMinutos?: number;
}
```

### 2.2 Inventário Completo das Funções do Motor (`/server/engine.ts`)

| Nome da Função | Assinatura Resumida | Propósito Técnico |
| :--- | :--- | :--- |
| `timeToMinutes` | `(timeStr: string): number` | Converte string `"HH:MM"` ou `"HH:MM:SS"` em minutos a partir da meia-noite. |
| `minutesToTimeStr` | `(totalMinutes: number): string` | Converte minutos em formato `"HH:MM"`. |
| `diffHours` | `(start: string, end: string): number` | Calcula a diferença em horas entre duas marcações, suportando virada de dia. |
| `isSunday` | `(dateStr: string): boolean` | Verifica se a data (YYYY-MM-DD) é um domingo. |
| `isSaturday` | `(dateStr: string): boolean` | Verifica se a data é um sábado. |
| `isHoliday` | `(dateStr: string): boolean` | Consulta a tabela de feriados nacionais fixos brasileiros. |
| `calcularHorasNoturnas` | `(inicio: string, fim: string): number` | Calcula o tempo trabalhado entre 22:00 e 05:00 aplicando a hora fictícia reduzida (52m30s / fator 1.142857x). |
| `isMarcacaoValida` | `(m: Marcacao): boolean` | Verifica se a marcação é uma batida real (ENTRADA/SAIDA) e não possui status "Desprezada". |
| `isMarcacaoExistente` | `(m: Marcacao): boolean` | Verifica se existe registro físico no relógio (mesmo isolado ou desprezado) para contagem de presença. |
| `isMarcacaoValidaParaJornada` | `(m: Marcacao): boolean` | Alias para `isMarcacaoValida`. |
| `isDiaComMarcacao` | `(dayPuncs: Marcacao[]): boolean` | Retorna `true` se houver ao menos uma marcação existente no dia. |
| `normalizarMarcacoes` | `(marcacoes: Marcacao[]): Marcacao[]` | Filtra batidas válidas e elimina duplicatas no mesmo minuto. |
| `calcularJornadaEfetiva` | `(marcacoes: Marcacao[]): JornadaEfetiva` | Emparelha marcações ordenadas, calcula duração total de trabalho e intervalos intrajornada. |
| `isDiaTrabalhado` | `(dayPuncs: Marcacao[]): boolean` | Função central para determinar se o colaborador prestou trabalho efetivo no dia. |
| `gerarVisaoDiaria` | `(func, datas, funcMarcacoesPorData): VisaoDiaria[]` | Constrói a camada unificada de dados diários para todas as datas do período. |
| `auditarMarcacaoImpar` | `(visao): Ocorrencia \| null` | Audita se a quantidade de batidas do dia é ímpar. |
| `auditarInterjornada` | `(visao): Ocorrencia \| null` | Audita se o descanso entre a jornada anterior e a atual foi inferior a 11 horas (CLT Art. 66). |
| `auditarDomingoExcessivo` | `(visao): Ocorrencia \| null` | Audita se o trabalho em domingo ultrapassou o limite operacional de 6 horas (CLT Art. 67). |
| `auditarIntervaloIntrajornada`| `(visao): Ocorrencia \| null` | Audita se o intervalo para repouso e alimentação foi descumprido (CLT Art. 71). |
| `auditarJornadaExcessiva` | `(visao): Ocorrencia \| null` | Audita se a jornada total de trabalho ultrapassou 10 horas diárias (CLT Art. 59). |
| `auditarTrabalho7Dias` | `(visoes, func): Ocorrencia[]` | Audita trabalho por 7 ou mais dias consecutivos sem descanso semanal (CLT Arts. 67/68). |
| `auditarDoisDomingosSeguidos` | `(visoes, func): Ocorrencia[]` | Audita trabalho em dois domingos consecutivos sem descanso dominical (CLT Art. 67). |
| `processarAuditoria` | `(funcs, marcacoes): AuditResult` | Orquestrador principal que executa toda a pipeline e gera jornadas e ocorrências. |
| `calcularScoresFuncionarios` | `(funcs, ocs): Funcionario[]` | Recalcula a pontuação de risco (0 a 100) e classifica a gravidade global do colaborador. |

---

## 3. INGESTÃO DE DADOS DA API DIMEP KAIROS (`/server/kairos.ts`)

A aquisição de dados do sistema de ponto é realizada diretamente por chamadas à API REST oficial do Dimep Kairos.

### 3.1 Endpoints Utilizados

1. **`/RestServiceApi/People/SearchPeople` (Coleta de Pessoas/Colaboradores):**
   - Requisição enviada via método `POST` com o corpo `{ Pagina: X }`.
   - Cabeçalhos de autenticação: `identifier` (CNPJ/CPF limpo) e `Key` (Rest API Key).
   - Suporta paginação automática contínua. Possui mecanismo de proteção contra *loops* infinitos (interrompe quando a página não traz novos IDs).

2. **`/RestServiceApi/Appointment/GetAppointmentsV2` (Coleta de Batidas de Ponto):**
   - Requisição enviada via método `POST` com o corpo:
     ```json
     {
       "IdsPessoa": [0],
       "DataInicio": "dd-MM-yyyy",
       "DataFim": "dd-MM-yyyy",
       "CalculoNaoAtualizado": "true",
       "ResponseType": "AS400V1"
     }
     ```
   - O parâmetro `IdsPessoa: [0]` solicita os registros de **todos** os colaboradores cadastrados na empresa vinculada.

### 3.2 Janela Temporal de Sincronização e Tolerância a Falhas

- **Período de Sincronização:** Sincroniza um período móvel contínuo de **32 dias** (`dataInicio` = HOJE - 32 dias e `dataFim` = HOJE).
- **Mecanismo de Retentativa (Retry Exponential):** A função `callKairosApi` realiza até 3 retentativas automáticas com *backoff* exponencial para erros transientes de rede (códigos HTTP 502, 503, 504, 429) ou falhas de soquete (`EPIPE`, `ECONNRESET`, `ETIMEDOUT`).

### 3.3 Mapeamento do Status e Situação do Colaborador (`obterSituacaoDoFuncionario`)

O status do colaborador retornado pela API do Kairos é normalizado pela função `obterSituacaoDoFuncionario(emp)` conforme as regras abaixo:

```typescript
export function obterSituacaoDoFuncionario(emp: KairosEmployeeRaw): {
  status: 'ATIVO' | 'DESLIGADO';
  situacao: 'ATIVO' | 'INATIVO' | 'EXCLUIDO' | 'DESLIGADO' | 'AFASTADO' | 'FERIAS';
}
```

- **Verificação das Flags Oficiais:**
  - `Excluido === true` ou `Situacao === "3"` → Status `DESLIGADO`, Situação `EXCLUIDO`.
  - `Demitido === true` ou `Situacao === "2"` ou `DataDemissao` válida → Status `DESLIGADO`, Situação `DESLIGADO`.
  - `Bloqueado === true` ou `Suspenso === true` → Status `DESLIGADO`, Situação `INATIVO`.
  - `Ferias === true` ou `Situacao === "5"` ou `PessoaStatus === "105"` → Status `ATIVO`, Situação `FERIAS`.
  - `Afastado === true` ou `Situacao === "4"` ou `PessoaStatus === "106*"` → Status `ATIVO`, Situação `AFASTADO`.
  - `Ativo === true` ou `Situacao === "1"` → Status `ATIVO`, Situação `ATIVO`.

---

## 4. TRATAMENTO, PURIFICAÇÃO E CONSOLIDAÇÃO DE DADOS

### 4.1 Purificação e Normalização de Marcações (`normalizarMarcacoes`)

Para garantir a higienização dos dados do relógio de ponto:

1. **Filtro `isMarcacaoValida`:**
   - Exclui qualquer registro cujo tipo seja diferente de `'ENTRADA'` e `'SAIDA'`.
   - Exclui batidas cuja origem ou descrição sinalize eventos administrativos (`'FOLGA'`, `'DSR'`, `'FERIAS'`, `'AFASTAMENTO'`, `'ABONO'`).
   - Exclui batidas marcadas explicitamente como `'Desprezada'` (`desprezado === true` ou status contendo `"DESPREZAD"`).
2. **Eliminação de Duplicatas:**
   - Se duas ou mais batidas ocorrerem dentro do mesmo minuto para o mesmo colaborador na mesma posição da sequência, apenas a primeira é mantida.

### 4.2 Deduplicação e Consolidação de Múltiplos Vínculos (`resolverEConsolidarVinculos`)

Em sistemas de RH como o Kairos, um mesmo colaborador pode ter múltiplos cadastros (vínculos históricos encerrados e um vínculo atual ativo). A função `resolverEConsolidarVinculos` localizada em `/src/utils/funcionarios.ts` executa a consolidação:

1. **Chave de Agrupamento:** Agrupa cadastros por **CPF** (se informado), por **PIS**, ou por **Nome Normalizado + Empresa**.
2. **Identificação do Vínculo Principal:** Seleciona como vínculo ativo o cadastro que possui `status === 'ATIVO'` e `situacao !== 'DESLIGADO'`.
3. **Mapeamento de Histórico (`mapaHistoricoParaAtivo`):** Cria um mapa chave-valor onde todos os IDs de cadastros antigos/desligados daquela mesma pessoa são apontados para o ID do vínculo **ATIVO**. Todas as batidas e jornadas dos IDs antigos são consolidadas e atribuídas ao cadastro ativo único, garantindo visão unificada no relatório e dashboard.

---

## 5. CONSTRUÇÃO DA CAMADA DIÁRIA CONSOLIDADA (`gerarVisaoDiaria`)

A função `gerarVisaoDiaria` em `/server/engine.ts` constrói, dia a dia e colaborador a colaborador, o objeto `VisaoDiaria`.

### 5.1 Algoritmo de Emparelhamento Sequencial Estrito (`calcularJornadaEfetiva`)

O cálculo da jornada efetiva de cada dia segue um emparelhamento estrito e ordenado das batidas purificadas:

- **Par 1:** Batida 1 (Entrada 1) ─── Batida 2 (Saída 1) → Período Trabalhado 1.
- **Intervalo 1:** Batida 2 (Saída 1) ─── Batida 3 (Entrada 2) → Intervalo Intrajornada 1.
- **Par 2:** Batida 3 (Entrada 2) ─── Batida 4 (Saída 2) → Período Trabalhado 2.

**Cálculo da Duração:**
$$\text{Minutos Trabalhados} = \sum (\text{Saída}_i - \text{Entrada}_i)$$

Se $\text{Saída}_i < \text{Entrada}_i$, o sistema identifica automaticamente uma **escala noturna** (virada de dia) e adiciona $1440$ minutos ($24\text{h}$) à marcação de saída para a correta subtração.

### 5.2 Encadeamento Interjornada entre Dias

A função mantém o rastreamento da `ultimaSaidaConhecida` e `dataUltimaSaidaConhecida`. Ao processar o dia seguinte com `primeiraEntrada`, calcula o descanso interjornada exato:

$$\text{Descanso Interjornada (horas)} = \frac{\text{Data/Hora Entrada Atual} - \text{Data/Hora Saída Anterior}}{3.600.000 \text{ ms}}$$

---

## 6. REGRAS DETALHADAS DOS 7 DESVIOS TRABALHISTAS

Esta seção detalha as 7 regras de auditoria executadas pelo motor central.

---

### 6.1 MARCAÇÃO ÍMPAR (`MARCACAO_IMPAR`)

- **a) Nome e Código:** Marcação Ímpar (`MARCACAO_IMPAR`).
- **b) Fundamento Legal:** Portaria MTE 671/2021 e CLT Art. 74 (Obrigatoriedade da fidelidade dos registros de entrada e saída).
- **c) Condição Exata de Disparo:**
  $$\text{Quantidade de Batidas Válidas no Dia} \pmod 2 \neq 0$$
- **d) Função Responsável:** `auditarMarcacaoImpar(visao: VisaoDiaria)` em `/server/engine.ts`.
- **e) Estrutura de Entrada:** Objeto `VisaoDiaria` com `marcacoesDoDia`.
- **f) Lógica de Cálculo:**
  1. Extrai batidas válidas do dia.
  2. Verifica se `timesArr.length % 2 !== 0`.
  3. Se verdadeiro, gera a ocorrência.
- **g) Evidência Gerada:**
  - `valorConstatado`: Ex: `"3 batidas"`.
  - `valorPermitido`: `"Pares"`.
  - `descricao`: `"Quantidade ímpar de marcações registradas (3 batidas): [08:00, 12:00, 18:00]. Possível esquecimento."`
- **h) Nível de Gravidade:** `MEDIO`.

---

### 6.2 JORNADA EXCESSIVA (`JORNADA_EXCESSIVA`)

- **a) Nome e Código:** Jornada Excessiva (`JORNADA_EXCESSIVA`).
- **b) Fundamento Legal:** CLT Art. 59 (A jornada normal de trabalho poderá ser acrescida de horas suplementares, em número não excedente de 2 horas diárias, totalizando o limite máximo legal de 10 horas).
- **c) Condição Exata de Disparo:**
  $$\text{totalMinutosTrabalhados} > 600 \quad (10\text{h } 00\text{min})$$
  *(Nota: Se $\text{totalMinutosTrabalhados} \le 600$, **não** há infração. $10\text{h}00\text{min}$ exatas é legal).*
- **d) Função Responsável:** `auditarJornadaExcessiva(visao: VisaoDiaria)` em `/server/engine.ts`.
- **e) Estrutura de Entrada:** Objeto `VisaoDiaria` contendo `totalMinutosTrabalhados` e `marcacoesDoDia`.
- **f) Lógica de Cálculo:**
  1. $\text{totalMinutosTrabalhados} = \sum (\text{Saída}_i - \text{Entrada}_i)$.
  2. Compara `totalMinutosTrabalhados > 600`.
  3. Se maior, calcula excedente: $\text{excessoMinutos} = \text{totalMinutosTrabalhados} - 600$.
- **g) Evidência Gerada:**
  - `valorConstatado`: Ex: `"10:01"` ou `"11:00"`.
  - `valorPermitido`: `"10:00"`.
  - `descricao`: `"Jornada excessiva registrada de 10:01. Excedeu o limite legal de 10h em 00:01. Fundamento legal: CLT Art. 59."`
- **h) Nível de Gravidade:**
  - `MEDIO`: Se $600 < \text{totalMinutosTrabalhados} \le 720$ ($10\text{h}$ a $12\text{h}$).
  - `ALTO`: Se $720 < \text{totalMinutosTrabalhados} \le 840$ ($12\text{h}$ a $14\text{h}$).
  - `CRITICO`: Se $\text{totalMinutosTrabalhados} > 840$ ($> 14\text{h}$).

---

### 6.3 INTERVALO INTRAJORNADA INSUFICIENTE (`INTERVALO_INSUFICIENTE`)

- **a) Nome e Código:** Intervalo Intrajornada Insuficiente (`INTERVALO_INSUFICIENTE`).
- **b) Fundamento Legal:** CLT Art. 71 (Para jornadas superiores a 6 horas, é obrigatória a concessão de um intervalo para repouso ou alimentação de, no mínimo, 1 hora. Para jornadas entre 4 e 6 horas, o intervalo mínimo é de 15 minutos).
- **c) Condição Exata de Disparo:**
  - **Caso 1 (Jornada > 6h / 360 min):**
    - Se não houver intervalo (apenas 2 batidas) OU $\text{intervaloRealizadoMinutos} < 60$.
  - **Caso 2 (Jornada de 4h a 6h / 240 a 360 min):**
    - Se não houver intervalo OU $\text{intervaloRealizadoMinutos} < 15$.
- **d) Função Responsável:** `auditarIntervaloIntrajornada(visao: VisaoDiaria)` em `/server/engine.ts`.
- **e) Estrutura de Entrada:** Objeto `VisaoDiaria`.
- **f) Lógica de Cálculo:**
  1. Identifica o maior intervalo entre períodos trabalhados no dia.
  2. Compara a duração efetiva do trabalho com os limiares de $360$ min e $240$ min.
  3. Avalia se o intervalo atinge $60$ min (para $>6\text{h}$) ou $15$ min (para $4\text{h}$ a $6\text{h}$).
- **g) Evidência Gerada:**
  - `valorConstatado`: Ex: `"0 min"` ou `"35 min"`.
  - `valorPermitido`: `"60 min"` (ou `"15 min"`).
  - `descricao`: `"Intervalo para repouso ou alimentação de apenas 35 minutos. CLT exige no mínimo 60 minutos para jornadas acima de 6h (CLT Art. 71)."`
- **h) Nível de Gravidade:**
  - Sem intervalo em jornada $> 6\text{h}$: `CRITICO`.
  - Intervalo $< 30\text{ min}$ em jornada $> 6\text{h}$: `CRITICO`.
  - Intervalo entre $30\text{ min}$ e $59\text{ min}$ em jornada $> 6\text{h}$: `ALTO`.
  - Sem intervalo em jornada de $4\text{h}$ a $6\text{h}$: `MEDIO`.
  - Intervalo $< 15\text{ min}$ em jornada de $4\text{h}$ a $6\text{h}$: `ALTO`.

---

### 6.4 TRABALHO EXCESSIVO EM DOMINGO (`DOMINGO_EXCESSIVO`)

- **a) Nome e Código:** Trabalho Excessivo em Domingo (`DOMINGO_EXCESSIVO`).
- **b) Fundamento Legal:** CLT Art. 67 (O descanso semanal remunerado deverá coincidir com o domingo, no todo ou em parte. Trabalhos operacionais autorizados em domingos devem observar jornada reduzida).
- **c) Condição Exata de Disparo:**
  $$\text{domingo} === \text{true} \quad \text{E} \quad \text{totalMinutosTrabalhados} > 360 \quad (6\text{h } 00\text{min})$$
  *(Nota: Exatamente $360$ min ou menos no domingo é permitido e não gera infração).*
- **d) Função Responsável:** `auditarDomingoExcessivo(visao: VisaoDiaria)` em `/server/engine.ts`.
- **e) Estrutura de Entrada:** Objeto `VisaoDiaria`.
- **f) Lógica de Cálculo:**
  1. Verifica se `diaDaSemana === 'DOMINGO'`.
  2. Se verdadeiro, verifica se `totalMinutosTrabalhados > 360`.
- **g) Evidência Gerada:**
  - `valorConstatado`: Ex: `"07:30"`.
  - `valorPermitido`: `"06:00"`.
  - `descricao`: `"Trabalho excessivo no domingo registrado de 07:30. Excedeu o limite prudencial operacional de 6h. Fundamento legal: CLT Art. 67."`
- **h) Nível de Gravidade:**
  - `ALTO`: Se $360 < \text{totalMinutosTrabalhados} \le 480$ ($6\text{h}$ a $8\text{h}$).
  - `CRITICO`: Se $\text{totalMinutosTrabalhados} > 480$ ($> 8\text{h}$).

---

### 6.5 INTERJORNADA INSUFICIENTE (`INTERJORNADA_INSUFICIENTE`)

- **a) Nome e Código:** Interjornada Insuficiente (`INTERJORNADA_INSUFICIENTE`).
- **b) Fundamento Legal:** CLT Art. 66 (Entre 2 jornadas de trabalho haverá um período mínimo de 11 horas consecutivas para descanso).
- **c) Condição Exata de Disparo:**
  $$\text{interjornadaHoras} < 11.0 \quad (660\text{ minutos})$$
  *(Nota: Se $\text{interjornadaHoras} \ge 11.0$, o descanso é legal).*
- **d) Função Responsável:** `auditarInterjornada(visao: VisaoDiaria)` em `/server/engine.ts`.
- **e) Estrutura de Entrada:** Objeto `VisaoDiaria` contendo `saidaAnterior`, `dataSaidaAnterior`, `entradaAtual` e `interjornadaHoras`.
- **f) Lógica de Cálculo:**
  1. $\text{DataHoraSaidaAnt} = \text{dataSaidaAnterior} + \text{saidaAnterior}$.
  2. $\text{DataHoraEntradaAtual} = \text{data} + \text{entradaAtual}$.
  3. $\text{interjornadaHoras} = (\text{DataHoraEntradaAtual} - \text{DataHoraSaidaAnt}) / 3.600.000$.
  4. Avalia se $\text{interjornadaHoras} < 11.0$.
- **g) Evidência Gerada:**
  - `valorConstatado`: Ex: `"09:30"`.
  - `valorPermitido`: `"11:00"`.
  - `descricao`: `"Descanso interjornada inferior a 11h. Detalhamento: Data da jornada anterior: 10/08/2026, Horário de saída anterior: 22:00, Data da jornada atual: 11/08/2026, Horário de entrada atual: 07:30, Quantidade de descanso apurada: 09:30. Fundamento legal: CLT Art. 66."`
- **h) Nível de Gravidade:**
  - `ALTO`: Se $9.0 \le \text{interjornadaHoras} < 11.0$ ($9\text{h}$ a $10\text{h}59\text{m}$).
  - `CRITICO`: Se $\text{interjornadaHoras} < 9.0$ ($< 9\text{h}$).

---

### 6.6 TRABALHO SEM FOLGA 7 DIAS (`SEM_FOLGA_7_DIAS`)

- **a) Nome e Código:** Trabalho sem Folga 7 Dias (`SEM_FOLGA_7_DIAS`).
- **b) Fundamento Legal:** CLT Arts. 67 e 68 e Constituição Federal Art. 7º, XV (O descanso semanal remunerado é direito constitucional obrigatoriamente concedido a cada período máximo de 6 dias de trabalho consecutivos).
- **c) Condição Exata de Disparo:**
  $$\text{Sequência de Dias Consecutivos com } \texttt{possuiMarcacao} === \text{true} \ge 7$$
- **d) Função Responsável:** `auditarTrabalho7Dias(visoes: VisaoDiaria[], func: Funcionario)` em `/server/engine.ts`.
- **e) Estrutura de Entrada:** Array de `VisaoDiaria` ordenado cronologicamente do colaborador.
- **f) Lógica de Cálculo:**
  1. Percorre os dias do colaborador verificando `v.possuiMarcacao`.
  2. Incrementa o contador `diasSeguidos`.
  3. Ao atingir $7$ ou mais dias ininterruptos com presença/registro de ponto, gera a ocorrência consolidada da sequência.
- **g) Evidência Gerada:**
  - `valorConstatado`: Ex: `"7 dias"` ou `"9 dias"`.
  - `valorPermitido`: `"6 dias"`.
  - `descricao`: `"Trabalho s/ Folga 7 Dias: prestou trabalho efetivo por 7 dias consecutivos sem descanso semanal. Fundamento legal: CLT Arts. 67 e 68."`
- **h) Nível de Gravidade:**
  - `ALTO`: Se $\text{diasSeguidos} === 7$.
  - `CRITICO`: Se $\text{diasSeguidos} \ge 8$.

---

### 6.7 TRABALHO EM DOIS DOMINGOS SEGUIDOS (`DOMINGOS_SEGUIDOS`)

- **a) Nome e Código:** Trabalho em Dois Domingos Seguidos (`DOMINGOS_SEGUIDOS`).
- **b) Fundamento Legal:** CLT Art. 67 e Portaria MTE 671/2021 (Regulamentação do descanso semanal remunerado coincidente com o domingo, vedando a prestação de serviços por dois domingos consecutivos sem folga dominical).
- **c) Condição Exata de Disparo:**
  $$\text{Domingo}_N \text{ com } \texttt{possuiMarcacao} === \text{true} \quad \text{E} \quad \text{Domingo}_{N+7} \text{ com } \texttt{possuiMarcacao} === \text{true}$$
- **d) Função Responsável:** `auditarDoisDomingosSeguidos(visoes: VisaoDiaria[], func: Funcionario)` em `/server/engine.ts`.
- **e) Estrutura de Entrada:** Array de `VisaoDiaria` do colaborador.
- **f) Lógica de Cálculo:**
  1. Filtra todos os domingos em que `domingo === true` e `possuiMarcacao === true`.
  2. Para cada domingo trabalhado $D1$, calcula $D2 = D1 + 7\text{ dias}$.
  3. Se no domingo $D2$ também houver `possuiMarcacao === true`, registra o desvio no segundo domingo.
- **g) Evidência Gerada:**
  - `valorConstatado`: `"2 domingos"`.
  - `valorPermitido`: `"1 domingo"`.
  - `descricao`: `"Trabalho em Domingos Seguidos: o colaborador trabalhou em dois domingos consecutivos (02/08/2026 e 09/08/2026) sem o descanso dominical. Fundamento legal: CLT Art. 67."`
- **h) Nível de Gravidade:** `ALTO`.

---

## 7. SISTEMA DE PONTUAÇÃO DE RISCO E CLASSIFICAÇÃO DO COLABORADOR

Após a geração de todas as ocorrências do período, o sistema executa a função `calcularScoresFuncionarios` para ponderar a gravidade global de cada colaborador.

### 7.1 Pesos por Gravidade da Infrações

| Gravidade | Pontuação por Ocorrência |
| :--- | :--- |
| `CRITICO` | 25 pontos |
| `ALTO` | 10 pontos |
| `MEDIO` | 4 pontos |
| `BAIXO` | 1 ponto |

### 7.2 Fórmula e Teto do Score de Risco

$$\text{Score de Risco} = \min \left( \sum_{i=1}^{N} \text{Peso}(\text{Ocorrência}_i), 100 \right)$$

O score é limitado ao valor máximo de **100**.

### 7.3 Faixas de Classificação de Grau de Risco

- **`BAIXO`:** Score de 0 a 9 pontos.
- **`MEDIO`:** Score de 10 a 24 pontos.
- **`ALTO`:** Score de 25 a 49 pontos.
- **`CRITICO`:** Score de 50 a 100 pontos.

---

## 8. MATRIZ DE RASTREABILIDADE E SUÍTE DE TESTES

A matriz a seguir relaciona a regra de auditoria com seu artigo legal correspondente, a função do código e os arquivos de testes unitários automatizados no diretório `/tests`:

| Código da Regra | Nome da Regra | Artigo Legal (CLT/MTE) | Função do Código (`/server/engine.ts`) | Suíte de Testes Automatizados |
| :--- | :--- | :--- | :--- | :--- |
| `MARCACAO_IMPAR` | Marcação Ímpar | Portaria MTE 671/2021 | `auditarMarcacaoImpar()` | `/tests/jornada_excessiva_nova.test.ts` |
| `JORNADA_EXCESSIVA` | Jornada Excessiva (>10h) | CLT Art. 59 | `auditarJornadaExcessiva()` | `/tests/jornada_excessiva_nova.test.ts` |
| `INTERVALO_INSUFICIENTE` | Intervalo Intrajornada Insuficiente | CLT Art. 71 | `auditarIntervaloIntrajornada()` | `/tests/intervalo.test.ts` |
| `DOMINGO_EXCESSIVO` | Trabalho Excessivo em Domingo (>6h) | CLT Art. 67 | `auditarDomingoExcessivo()` | `/tests/domingos_seguidos.test.ts` |
| `INTERJORNADA_INSUFICIENTE` | Interjornada Insuficiente (<11h) | CLT Art. 66 | `auditarInterjornada()` | `/tests/interjornada.test.ts` |
| `SEM_FOLGA_7_DIAS` | Trabalho sem Folga 7 Dias | CLT Arts. 67 e 68 | `auditarTrabalho7Dias()` | `/tests/domingos_seguidos.test.ts` |
| `DOMINGOS_SEGUIDOS` | Dois Domingos Seguidos | CLT Art. 67 | `auditarDoisDomingosSeguidos()` | `/tests/domingos_seguidos.test.ts` |

---

## 9. CONCLUSÃO E HOMOLOGAÇÃO TÉCNICA

A arquitetura descrita neste documento garante total determinismo, rastreabilidade e integridade no tratamento de dados trabalhistas. Com a unificação em `/server/engine.ts`, a consolidação inteligente de vínculos em `/src/utils/funcionarios.ts` e a janela de sincronização contínua de 32 dias na API Dimep Kairos em `/server/kairos.ts`, o sistema **Audit Kairos** fornece diagnósticos auditáveis e em total conformidade com a legislação trabalhista brasileira.
