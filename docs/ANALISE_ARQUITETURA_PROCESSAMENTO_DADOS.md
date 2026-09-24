# DIAGNÓSTICO E ANÁLISE DE ARQUITETURA DE PROCESSAMENTO DE DADOS

**Aplicações e Sistemas:** Sistema de Auditoria Trabalhista e Compliance CLT (Integração Dimep Kairos REST)  
**Data da Varredura:** 11 de Agosto de 2026  
**Status do Projeto:** Varredura Técnica Completa & Diagnóstico Arquitetural Executado (Somente Leitura)  

---

## 1. RESUMO EXECUTIVO E ESCOPO DA VARREDURA

Realizou-se uma varredura técnica completa em todo o ecossistema da aplicação para mapear a **arquitetura de processamento de dados**, identificar gargalos de desempenho e avaliar o potencial de utilização de **Python** e bibliotecas de Data Science (**Pandas, NumPy, Polars, PyArrow, DuckDB**) para otimização de volumes e auditoria trabalhista.

### Principais Conclusões do Diagnóstico:
1. **Linguagem & Runtime:** A aplicação é 100% desenvolvida em **TypeScript/JavaScript (Node.js + Express)** no backend e **React 18 + Vite** no frontend.
2. **Presença de Python:** O Python **não faz parte do runtime de backend**. Existe exclusivamente um script utilitário (`scripts/update_docs.py`) utilizado para automação de manutenção de documentação Markdown.
3. **Bibliotecas de Data Science:** Nenhuma biblioteca de Data Science (Pandas, Polars, DuckDB, PyArrow, NumPy) está instalada ou em uso.
4. **Mecanismo de Persistência:** A base de dados principal é um banco leve baseado em arquivo JSON único (`data/db.json`), controlado pela classe `Database` em `server/db.ts` e mantido em memória RAM durante a execução.
5. **Motor Trabalhista (CLT/MTE):** Todas as regras de auditoria (Jornada > 10h, Descanso Interjornada < 11h, Intervalo Intrajornada < 1h, Trabalho s/ Folga por 7 dias, Dois Domingos Seguidos Trabalhados, Pontuações de Risco) são processadas em **TypeScript puramente em memória** no arquivo `server/engine.ts`.
6. **Integração Dimep Kairos:** A comunicação ocorre via chamadas REST HTTP POST síncronas (`server/kairos.ts`), paginando funcionários (`SearchPeople`) e buscando batidas de ponto em lote (`GetAppointmentsV2`).

---

## 2. ARQUITETURA DE PROCESSAMENTO DE DADOS ATUAL

```
 +-----------------------------------------------------------------------------------+
 |                                 FONTE DE DADOS                                    |
 |                         API REST Dimep Kairos (Externa)                           |
 +-----------------------------------------------------------------------------------+
                                           |
                                           | (HTTP POST JSON / REST)
                                           v
 +-----------------------------------------------------------------------------------+
 |                         CAMADA DE INGESTÃO E CONEXÃO                              |
 |   server/kairos.ts (fetchEmployees, fetchAppointments, cleanIdentifier)           |
 +-----------------------------------------------------------------------------------+
                                           |
                                           | (Objetos JSON Brutos)
                                           v
 +-----------------------------------------------------------------------------------+
 |                        MOTOR DE AUDITORIA & REGRAS CLT                            |
 |   server/engine.ts (processarAuditoria, isDiaTrabalhado, calcularScores)         |
 +-----------------------------------------------------------------------------------+
                                           |
                                           | (Entidades Processadas)
                                           v
 +-----------------------------------------------------------------------------------+
 |                           PERSISTÊNCIA EM DISCO / RAM                             |
 |   server/db.ts (Database Class -> RAM Cache + Sync Flush para data/db.json)      |
 +-----------------------------------------------------------------------------------+
                                           |
                                           | (Filtros BI Server-Side / getFilteredRecords)
                                           v
 +-----------------------------------------------------------------------------------+
 |                       CAMADA DE APRESENTAÇÃO E BI (CLIENTE)                       |
 |   React 18 + Vite (DashboardExecutivo, DashboardRH, Auditorias, Relatorios)       |
 +-----------------------------------------------------------------------------------+
```

### Detalhamento dos Componentes de Processamento:

| Componente | Linguagem/Tecnologia | Arquivo | Responsabilidade Principal |
| :--- | :--- | :--- | :--- |
| **Ingestão REST** | TypeScript / Fetch API | `server/kairos.ts` | Conexão com API Dimep Kairos, autenticação via headers (`identifier`, `Key`), paginação de pessoas e coleta de batidas. |
| **Motor Trabalhista** | TypeScript | `server/engine.ts` | Reconstrução de jornadas diárias, cálculo de horas noturnas com redução fictícia, verificação de 7 dias s/ folga e 2 domingos seguidos. |
| **Armazenamento** | TypeScript / JSON Native | `server/db.ts` | Carregamento inicial de `data/db.json` para a memória RAM, operações CRUD síncronas e gravação atômica em disco. |
| **Servidor API** | Express / Node.js | `server.ts` | Autenticação de sessões, verificação de permissões por perfil, consolidação de múltiplos vínculos e motor de filtros para BI (`getFilteredRecords`). |
| **Interface Visual** | React 18 / Tailwind | `src/components/*` | Renderização de gráficos Recharts, cartões KPI, tabelas paginadas e filtros dinâmicos de BI. |

---

## 3. AVALIAÇÃO DETALHADA SOBRE O USO E POTENCIAL DE PYTHON / DATA SCIENCE

### 3.1 Diagnóstico do Estado Atual de Python
- **Identificação no Código:** O único arquivo Python localizado no projeto foi `/scripts/update_docs.py`.
- **Finalidade:** Trata-se de uma ferramenta de linha de comando interna para auxiliar o desenvolvimento na atualização dos arquivos de documentação Markdown em `/docs`.
- **Uso em Produção:** **Nenhum**. O script não é importado, chamado pelo `server.ts` nem empacotado para o runtime da aplicação.

### 3.2 Análise de Oportunidade e Ganho Real com Bibliotecas de Data Science

Foi realizada uma análise comparativa sobre a viabilidade e o ganho real de implementar ferramentas de processamento massivo de dados (**Python**, **Pandas**, **Polars**, **DuckDB**, **PyArrow** e **NumPy**):

| Tecnologia | Caso de Uso Potencial | Viabilidade no Contexto Atual | Ganho Real Estimado | Conclusão e Recomendação |
| :--- | :--- | :--- | :--- | :--- |
| **Python Standard** | Subprocesso executando rotinas de auditoria trabalhista. | **Baixa**. Requer instalação do ambiente Python no container Cloud Run, aumentando o tamanho da imagem em ~300MB. | **Inexistente / Negativo** para o volume atual. Adiciona latência de IPC (Inter-Process Communication). | **Não Recomendado** para o core. O V8 do Node.js é extremamente veloz para coleções em memória. |
| **Pandas / NumPy** | Vetorização de séries temporais de marcações de ponto. | **Média**. Exige integração via REST/gRPC interno ou processo filho. | **Baixo a Médio**. Eficiente, porém consome muita memória RAM para dataframes em texto. | **Não Recomendado**. A complexidade de manter duas linguagens supera os benefícios em volumes < 1M registros. |
| **Polars / PyArrow** | Processamento ultra-rápido multithreaded em memória de grande volume de batidas. | **Média/Alta**. Pode ser usado via Python ou via bindings nativos de Rust/Node.js. | **Alto** apenas para volumes **> 1.000.000 de marcações histórico**. | **Avaliável para o futuro** em cenários de Big Data. |
| **DuckDB** | Banco OLAP analítico embarcado executando consultas SQL vetorizadas diretamente sobre Parquet/JSON. | **Alta**. Possui bindings nativos em C++/Node.js (`duckdb` npm package), dispensando runtime Python. | **MUITO ALTO** para BI, agregações complexas e dashboards analíticos. | **RECOMENDADO** como alternativa de evolução sem necessidade de adicionar Python. |

### 3.3 Matriz de Decisão: Manter TypeScript Node.js vs. Migrar para Python

```
                       VOLUMETRIA DE MARCAÇÕES DE PONTO
 0 ------- 100.000 marcações ------- 1.000.000 marcações ------- > 10.000.000 marcações
 |                                   |                            |
 +---> MANTER TYPESCRIPT (ATUAL) ----+---> ADOTAR DUCKDB NATIVO --+---> PYTHON / POLARS SERVICE
       - Latência < 30ms                   (Bindings Node.js)           (Container dedicado)
       - Zero overhead IPC                 - SQL OLAP rápido            - Parquet em Cloud Storage
       - Deploy simplificado               - Zero Python extra
```

**Diagnóstico Conclusivo:**  
Para a volumetria típica atendida pelo sistema (de dezenas a centenas de empresas com até 5.000 colaboradores e ~300.000 marcações/mês), a adição de Python traria **mais complexidade operacional e maior tempo de inicialização do container** do que benefícios de performance, pois a limitação de velocidade atual decorre da **I/O de rede da API REST do Dimep Kairos** e da persistência em arquivo JSON único, e não da capacidade de cálculo do motor em TypeScript.

---

## 4. ANÁLISE DE GARGALOS, REDUNDÂNCIAS E LIMITAÇÕES DE ESCALA

During the scanning process, five critical architectural bottleneck areas were mapped:

### Gargalo 1: Persistência em Arquivo JSON Único (`data/db.json`)
- **Impacto:** A classe `Database` lê e grava todo o arquivo `db.json` de forma síncrona/bloqueante (`fs.writeFileSync`).
- **Risco de Escala:** Conforme a base cresce (ex: > 500.000 marcações), cada salvamento no banco trava a Event Loop do Node.js durante a serialização do JSON, gerando lentidão e alto consumo de memória RAM.

### Gargalo 2: Filtros de BI em Memória no Express (`getFilteredRecords`)
- **Impacto:** Todas as requisições para `/api/dashboard/kpis`, `/api/dashboard/charts`, `/api/funcionarios` e `/api/ocorrencias` executam varreduras do tipo $O(N)$ em arrays em memória para aplicar filtros de departamento, centro de custo, cargo, período e grau de risco.
- **Risco de Escala:** Em cenários com requisições concorrentes de múltiplos usuários, a CPU do servidor é sobrecarregada com laços de repetição duplicados no JavaScript.

### Gargalo 3: Paginação Sequencial HTTP na API Kairos (`fetchEmployees`)
- **Impacto:** O método `fetchEmployees` utiliza um laço `while` que aguarda síncronamente cada página de funcionários ser retornada antes de solicitar a próxima (`await callKairosApi`).
- **Risco de Escala:** Em empresas com milhares de colaboradores, a sincronização pode demorar vários minutos se houver muitas páginas.

### Gargalo 4: Execução Síncrona da Sincronização na Rota HTTP (`/api/sync`)
- **Impacto:** A rota `/api/sync` executa todo o processo de download, limpeza, auditoria e salvamento dentro da mesma requisição HTTP.
- **Risco de Escala:** Se o processo ultrapassar 30-60 segundos, a conexão HTTP do navegador ou do proxy da nuvem (Cloud Run/Nginx) sofrerá um *timeout* de rede.

### Gargalo 5: Isolamento Multiempresa Baseado em Limpeza de Banco (`clearAllData`)
- **Impacto:** Ao alternar a empresa ativa na lista de integração REST (`/api/empresas-rest/selecionar`), o sistema executa `dbInstance.clearAllData()`, apagando os dados anteriores da memória para carregar os da nova empresa.
- **Risco de Escala:** Impede o uso verdadeiramente multi-tenant simultâneo por usuários de empresas diferentes, pois a empresa ativa é global na instância do servidor.

---

## 5. DIAGNÓSTICO DO FLUXO DE DATAS E TRATAMENTO DE PERÍODO

### 5.1 Status dos Erros de Tela ("period is not defined")
- **Diagnóstico:** Todos os componentes do frontend (`DashboardExecutivo.tsx`, `DashboardRH.tsx`, `DashboardGerencial.tsx`, `Funcionarios.tsx`, `Auditorias.tsx`) foram inspecionados. As referências incorretas à variável não declarada `period` foram **completamente corrigidas e tratadas** com a padronização do estado `periodoPadrao` e das propriedades `dataInicio`/`dataFim`.

### 5.2 Formatação e Padronização de Datas no Servidor
- **Formatos em Uso:**
  1. **API Dimep Kairos:** Requer datas no formato `DD-MM-YYYY` (ex: `31-08-2026`) nos métodos de requisição.
  2. **Banco Interno e Motores:** Utiliza formato ISO `YYYY-MM-DD` (ex: `2026-08-31`) para ordenação léxica direta e consultas eficientes.
  3. **Cálculos de Timezone e Proteção de Fusos:** O motor de auditoria em `server/engine.ts` força o sufixo `T12:00:00` (ex: `2026-08-31T12:00:00`) ao instanciar objetos `Date`. Isso elimina desvios de timezone de meia-noite (UTC vs BRT -3h) durante a verificação de dias da semana e feriados.

---

## 6. RECOMENDAÇÕES E PLANO DE EVOLUÇÃO ARQUITETURAL

Com base na varredura técnica realizada, apresenta-se o plano de ação sugerido para as próximas etapas (sujeito à autorização prévia):

```
+-----------------------------------------------------------------------------------+
| FASE 1: OTIMIZAÇÃO DA PERSISTÊNCIA (Curto Prazo)                                 |
| - Substituir `data/db.json` por SQLite indexado (via `better-sqlite3` ou Drizzle).|
| - Transferir os filtros de `getFilteredRecords` para cláusulas SQL `WHERE`.       |
+-----------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
| FASE 2: ASSINCRONISMO NA INTEGRACÃO KAIROS (Médio Prazo)                         |
| - Transformar a rota `/api/sync` em um Job de Fundo com Polling de Progresso.    |
| - Implementar chamadas paralelas paginadas na busca de funcionários.              |
+-----------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
| FASE 3: MULTI-TENANCY MULTIEMPRESA REAL (Médio Prazo)                             |
| - Adicionar `empresaId` indexado em todas as tabelas.                            |
| - Eliminar o acoplamento de `clearAllData()` na troca de empresa ativa.           |
+-----------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
| FASE 4: BI ANALÍTICO DE ALTA PERFORMANCE (Longo Prazo / Se > 1M registros)        |
| - Integrar **DuckDB Node.js** para consultas analíticas instantâneas em memória.  |
| - Avaliar microserviço Python/Polars somente se houver módulo de ML/Data Mining. |
+-----------------------------------------------------------------------------------+
```

---
*Relatório emitido pela ferramenta de diagnóstico de arquitetura em 11 de Agosto de 2026.*
