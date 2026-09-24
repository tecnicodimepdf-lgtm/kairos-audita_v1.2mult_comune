# INVENTÁRIO COMPLETO DE PROCESSAMENTO E FLUXO DE DADOS

**Sistema:** Plataforma de Auditoria Trabalhista e Conformidade CLT  
**Data do Mapeamento:** 11 de Agosto de 2026  
**Finalidade:** Inventário Exaustivo de Funções, Algoritmos, Estruturas de Dados e Processamento na Aplicação  

---

## 1. MAPPING GERAL DO CICLO DE VIDA DOS DADOS

```
 [Dimep Kairos REST API]
          |
          v (1. Ingestão & Formatação HTTP POST)
 [server/kairos.ts] --> callKairosApi() / fetchEmployees() / fetchAppointments()
          |
          v (2. Normalização & Sanitização)
 cleanIdentifier() / obterSituacaoDoFuncionario()
          |
          v (3. Persistência de Transição)
 [server/db.ts] --> saveEmpresas() / saveFuncionarios() / saveMarcacoes()
          |
          v (4. Reconstrução de Jornadas & Regras CLT)
 [server/engine.ts] --> processarAuditoria() / resolverEConsolidarVinculos()
          |              ├──> isMarcacaoValida()
          |              ├──> isDiaTrabalhado()
          |              ├──> calcularHorasNoturnas()
          |              ├──> Regra: Jornada > 10h (Art. 59)
          |              ├──> Regra: Intervalo Intrajornada < 1h / < 15m (Art. 71)
          |              ├──> Regra: Interjornada < 11h (Art. 66)
          |              ├──> Regra: 7 Dias Seguidos s/ Folga (Streak)
          |              └──> Regra: 2 Domingos Seguidos Trabalhados
          |
          v (5. Cálculo de Risco e Classificação)
 calcularScoresFuncionarios() --> scoreRisco (0-100) / grauRisco (BAIXO, MEDIO, ALTO, CRITICO)
          |
          v (6. Persistência Definitiva em Disco)
 [data/db.json] (via dbInstance.save())
          |
          v (7. Filtros Cross-BI Server-Side)
 [server.ts] --> getFilteredRecords() / /api/dashboard/kpis / /api/dashboard/charts
          |
          v (8. Consumo e Renderização Visual Client-Side)
 [src/components/*] (DashboardExecutivo, DashboardRH, Auditorias, Relatorios)
```

---

## 2. INVENTÁRIO DETALHADO POR ARQUIVO E MÓDULO

### 2.1 Módulo `server/kairos.ts` — Ingestão e Conexão REST Dimep Kairos

| Função / Entidade | Tipo de Entrada | Tipo de Saída | Descrição do Algoritmo e Regras | Status de Otimização |
| :--- | :--- | :--- | :--- | :--- |
| `cleanIdentifier()` | `identifier: string` | `string` | Remove caracteres não alfanuméricos de CNPJs, CPFs e NIFs via Regex `/[^a-zA-Z0-9]/g`. | **Otimizado** (O(1)). |
| `formatHost()` | `host: string` | `string` | Garante presença do protocolo `https://` e remove barras finais. | **Otimizado** (O(1)). |
| `formatDimepDate()` | `date: Date` | `string` | Formata data para `DD-MM-YYYY` exigido pela API Dimep Kairos. | **Otimizado** (O(1)). |
| `callKairosApi()` | `endpoint, config, body, maxRetries=3` | `Promise<any>` | Realiza chamadas `fetch` HTTP POST com cabeçalhos `identifier`, `Key` e `Connection: close`. Inclui retry exponencial automático para erros 502, 503, 504, 429 e quedas de conexão de rede (EPIPE, ECONNRESET, socket hang up). | **Otimizado** com retry resiliência. Ponto de atenção: Execução síncrona/bloqueante. |
| `testConnection()` | `host, identifier, key` | `Promise<{ success, message, companyName }>` | Dispara chamada de validação ao endpoint `/RestServiceApi/People/SearchPeople` (Página 1). Extrai o nome da empresa ou executa fallback em `GetCompany`. | **Otimizado**. |
| `obterSituacaoDoFuncionario()` | `emp: KairosEmployeeRaw` | `{ status, situacao }` | Avalia hierarquia de status do Kairos (`Ativo`, `Demitido`, `Excluido`, `Afastado`, `Ferias`, `Situacao`, `PessoaStatus`, `DataDemissao`). Converte em categorias normalizadas: `ATIVO` / `DESLIGADO` e `ATIVO`/`INATIVO`/`EXCLUIDO`/`DESLIGADO`/`AFASTADO`/`FERIAS`. | **Otimizado**. Regras de transição fiéis ao sistema Dimep. |
| `fetchEmployees()` | `host, identifier, key` | `Promise<KairosEmployeeRaw[]>` | Executa paginação iterativa `while(hasMore)` no endpoint `/RestServiceApi/People/SearchPeople`. Possui mecanismo de proteção contra loop infinito através do rastreamento de IDs vistos (`Set<string>`). | **Funcional**. Ponto de melhoria: Paginação sequencial em série. |
| `fetchAppointments()` | `host, identifier, key, startDate, endDate` | `Promise<KairosAppointmentRaw[]>` | Dispara requisição ao `/RestServiceApi/Appointment/GetAppointmentsV2` com `IdsPessoa: [0]` para trazer todas as batidas do período de uma só vez. | **Otimizado** para volume moderado. |
| `syncRealDimepKairos()` | `db: Database, config: DimepConfig` | `Promise<{ success, message, count }>` | Função orquestradora principal. Executa: 1. `clearAllData()`; 2. `fetchEmployees()`; 3. Cadastro da Empresa; 4. `fetchAppointments()`; 5. Agrupamento e alternância de batidas (Entrada/Saída); 6. `processarAuditoria()`; 7. `calcularScoresFuncionarios()`; 8. Salvamento em `db.json`. | **Funcional**. Gargalo de escala se houver > 50.000 batidas por causa do salvamento atômico em disco. |

---

### 2.2 Módulo `server/engine.ts` — Motor Trabalhista e Regras de Auditoria CLT

| Função / Entidade | Tipo de Entrada | Tipo de Saída | Descrição do Algoritmo e Regras | Status de Otimização |
| :--- | :--- | :--- | :--- | :--- |
| `timeToMinutes()` | `timeStr: "HH:MM"` | `number` | Converte string de hora para minutos totais acumulados desde a meia-noite. | **Otimizado** ($O(1)$). |
| `minutesToTimeStr()` | `totalMinutes: number` | `string` | Converte minutos em formato formatado `"HH:MM"`. | **Otimizado** ($O(1)$). |
| `diffHours()` | `start, end: string` | `number` | Calcula a diferença em horas decimais entre duas marcações no mesmo dia ou com virada de dia (adiciona +1440 minutos se `end < start`). | **Otimizado** ($O(1)$). |
| `isSunday()` / `isSaturday()` | `dateStr: "YYYY-MM-DD"` | `boolean` | Determina o dia da semana utilizando `new Date(dateStr + 'T12:00:00')` para evitar desvios de fuso horário. | **Otimizado**. |
| `isHoliday()` | `dateStr: "YYYY-MM-DD"` | `boolean` | Verifica se a data coincide com feriados nacionais recorrentes brasileiros. | **Otimizado**. |
| `calcularHorasNoturnas()` | `inicio, fim: string` | `number` | Avalia minuto a minuto se a jornada está entre 22:00 e 05:00. Aplica a hora noturna reduzida da CLT (fator $60 / 52.5 = 1.142857\times$). | **Otimizado** (Laço limitado a no máximo 1.440 iterações por turno). |
| `isMarcacaoValida()` | `m: Marcacao` | `boolean` | **Regra Fundamental de Auditoria:** Retorna `true` somente para batidas originais de `ENTRADA` ou `SAIDA` cujo status não seja `Desprezada` e origem não seja evento administrativo (Folga, DSR, Férias, Abono). | **Otimizado** ($O(1)$). |
| `isDiaTrabalhado()` | `dayPuncs: Marcacao[]` | `boolean` | Retorna `true` se e somente se existir pelo menos uma marcação válida (`isMarcacaoValida`) no dia informado. | **Otimizado** ($O(N)$ local do dia). |
| `processarAuditoria()` | `funcionarios[], marcacoes[]` | `{ jornadas[], ocorrencias[] }` | **Motor Central de Auditoria:**<br>1. Consolida vínculos históricos via `resolverEConsolidarVinculos()`;<br>2. Agrupa marcações por funcionário e data;<br>3. Identifica marcações ímpares (esquecimento);<br>4. Calcula horas trabalhadas, noturnas e intervalos intrajornada;<br>5. Audita limite de 10h diárias (CLT Art. 59);<br>6. Audita intervalo intrajornada (CLT Art. 71);<br>7. Audita descanso interjornada < 11h (CLT Art. 66);<br>8. **Audita 7 Dias Seguidos s/ Folga** em janela móvel diária com log detalhado de justificativas;<br>9. **Audita Dois Domingos Seguidos Trabalhados**. | **Otimizado em memória** ($O(F \times D)$). Extremamente veloz para volumes até 500k batidas. |
| `calcularScoresFuncionarios()` | `funcionarios[], ocorrencias[]` | `Funcionario[]` | Soma penalidades por gravidade das ocorrências (CRÍTICO: 25pt, ALTO: 10pt, MÉDIO: 4pt, BAIXO: 1pt). Limita o `scoreRisco` entre 0 e 100 e define a categoria (`BAIXO`, `MEDIO`, `ALTO`, `CRITICO`). | **Otimizado** ($O(F + O)$). |

---

### 2.3 Módulo `server/db.ts` — Gerenciamento e Persistência do Banco de Dados

| Método / Classe | Tipo de Operação | Descrição Mecânica | Status de Otimização |
| :--- | :--- | :--- | :--- |
| `Database.constructor()` | Leitura de Arquivo | Tenta carregar `data/db.json`. Se não existir ou estiver corrompido, inicializa estrutura em branco com suporte multiempresa. | **Otimizado** no boot. |
| `Database.save()` | Escrita em Disco | Serializa o objeto `DatabaseSchema` em formato JSON e grava sincronamente no arquivo `data/db.json` via `fs.writeFileSync`. | **Gargalo Potencial** para bases grandes. Recomenda-se evolução para SQLite. |
| `ensureMultiEmpresaConfig()` | Normalização | Sincroniza a lista `empresasRest` com a configuração legada e com a lista de empresas ativas. | **Otimizado**. |
| `getFuncionarios()`, `getMarcacoes()`, `getJornadas()`, `getOcorrencias()` | Leitura em Memória | Retorna os arrays mantidos na memória RAM. | **Ultrarrápido** ($O(1)$). |
| `saveFuncionarios()`, `saveMarcacoes()`, `saveJornadas()`, `saveOcorrencias()` | Atualização | Atualiza a referência dos arrays na RAM e aciona `save()`. | **Gargalo de escrita atômica** se chamado repetidamente. |
| `clearAllData()` | Reset | Limpa todas as coleções de funcionários, marcações, jornadas e ocorrências (preservando configurações e usuários) para isolamento entre empresas. | **Otimizado**. |

---

### 2.4 Módulo `server.ts` — Agregações BI e Rotas da API REST

| Rota / Função | Método HTTP | Finalidade e Processamento de Dados |
| :--- | :--- | :--- |
| `getFilteredRecords()` | Helper Interno | Executa filtragem cruzada em memória baseando-se nas permissões do usuário e nos parâmetros da URL (`empresaId`, `departamento`, `centroCusto`, `cargo`, `gestor`, `grauRisco`, `dataInicio`, `dataFim`, `buscaFuncionario`, `status`). |
| `/api/config` | `GET` / `POST` | Obtém e salva parâmetros globais de conexão com a API REST do Kairos. |
| `/api/empresas-rest/selecionar` | `POST` | Alterna a empresa ativa da integração REST e isola os dados locais acionando `clearAllData()`. |
| `/api/empresas-rest` | `POST` / `DELETE` | Gerencia o cadastro de empresas no modelo multiempresa. |
| `/api/config/test` | `POST` | Testa a comunicação e credenciais com o servidor do Dimep Kairos. |
| `/api/sync` | `POST` | Dispara o ciclo completo de sincronização e auditoria em tempo real. |
| `/api/filtros/valores` | `GET` | Retorna valores únicos e ordenados para preenchimento dos filtros do frontend. |
| `/api/funcionarios` | `GET` | Retorna a lista de funcionários filtrada e paginada (`page`, `limit`). |
| `/api/ocorrencias` | `GET` | Retorna as ocorrências trabalhistas enriquecidas com nome, matrícula e departamento do colaborador. |
| `/api/dashboard/kpis` | `GET` | Calcula indicadores consolidadores (Score Geral de Conformidade, Taxas de Infrações, total de pessoas ativas/inativas/afastadas/férias). |
| `/api/dashboard/charts` | `GET` | Realiza agregações por data, departamento, centro de custo, gravidade, tipo de infração e rankings de gestores e funcionários. |

---

### 2.5 Script Utilitário `scripts/update_docs.py` — Automação de Documentação

| Arquivo | Linguagem | Finalidade | Escopo de Execução |
| :--- | :--- | :--- | :--- |
| `scripts/update_docs.py` | Python 3 | Script utilitário para auxílio na formatação, verificação e atualização de arquivos de documentação Markdown. | **Utilitário de Desenvolvimento**. Não roda no servidor backend nem em produção. |

---

## 3. RESUMO DAS ESTRUTURAS DE DADOS PRINCIPAIS

```typescript
// Entidade Funcionário (Normalizada com Múltiplos Vínculos Consolidados)
interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  pis: string;
  cargo: string;
  departamento: string;
  centroCusto: string;
  gestor: string;
  empresaId: string;
  grauRisco: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  scoreRisco: number;
  status: 'ATIVO' | 'DESLIGADO';
  situacao: 'ATIVO' | 'INATIVO' | 'EXCLUIDO' | 'DESLIGADO' | 'AFASTADO' | 'FERIAS';
  cracha?: string;
  matricula: string;
}

// Entidade Marcação de Ponto
interface Marcacao {
  id: string;
  funcionarioId: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  tipo: 'ENTRADA' | 'SAIDA' | 'NEUTRO';
  origem: string; // "Relógio", "Folga", "DSR", "Férias", "Abono", etc.
  desprezada?: boolean;
}

// Entidade Ocorrência (Infração Trabalhista)
interface Ocorrencia {
  id: string;
  funcionarioId: string;
  funcionarioNome?: string;
  funcionarioMatricula?: string;
  funcionarioDepartamento?: string;
  funcionarioSexo?: string;
  data: string;
  tipo: 'MARCACAO_IMPAR' | 'JORNADA_EXCESSIVA' | 'INTERVALO_INSUFICIENTE' | 
        'INTERJORNADA_INSUFICIENTE' | 'DOMINGO_EXCESSIVO' | 'SEM_FOLGA_7_DIAS' | 
        'DOMINGOS_SEGUIDOS' | 'AUSENCIA' | 'ATRASO_GRAVE';
  descricao: string;
  gravidade: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  valorConstatado?: string;
  valorPermitido?: string;
}
```

---
*Inventário técnico finalizado e validado em 11 de Agosto de 2026.*
