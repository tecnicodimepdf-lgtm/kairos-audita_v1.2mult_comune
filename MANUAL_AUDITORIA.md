# Manual do Módulo de Auditoria de Jornadas e Relatórios PDF (CLT)

**Auditoria Trabalhista — Sistema de Compliance Trabalhista**  
**Versão:** v002  
**Data:** 2026-07-28  

---

## 1. Visão Geral

O Módulo de Auditoria de Jornadas e a central de Relatórios PDF do **Auditoria Trabalhista** foram projetados para garantir o alinhamento rigoroso das escalas e apontamentos de ponto com as exigências da **Consolidação das Leis do Trabalho (CLT)**, súmulas do TST e portarias do Ministério do Trabalho e Emprego (MTE).

---

## 2. Estrutura Padrão dos Relatórios PDF

Todos os relatórios PDF gerados pela plataforma seguem a estrutura corporativa padronizada:

### 2.1 Cabeçalho Institucional
* **Razão Social / Nome da Empresa Conectada**: Exibido no topo do documento.
* **CNPJ**: Identificação fiscal da empresa auditada.
* **Data e Hora de Emissão**: Carimbo de data/hora oficial no padrão `DD/MM/YYYY às HH:MM:SS`.
* **Usuário Emissor**: Nome e e-mail do operador responsável pela emissão.
* **Período Analisado**: Intervalo de datas selecionado nos filtros globais.
* **Tipo de Auditoria**: `Auditoria Trabalhista CLT (Auditoria Trabalhista)`.
* **Tipo de Relatório**: Título oficial do relatório selecionado.

### 2.2 Resumo Executivo (KPIs)
* Total de colaboradores auditados
* Total de ocorrências de irregularidade identificadas
* Quantidade de funcionários afetados
* Percentual de conformidade (%)
* Percentual de não conformidade (%)
* Quantidade de departamentos impactados

### 2.3 Tabela Detalhada das Ocorrências
Colunas padronizadas contendo:
* **Data**: Data do evento (`DD/MM/YYYY`).
* **Matrícula**: Código de matrícula do colaborador no sistema.
* **Funcionário**: Nome completo do colaborador.
* **Departamento**: Setor de lotação.
* **Gravidade**: Classificação do risco (`CRITICO`, `ALTO`, `MEDIO`, `BAIXO`).
* **Constatado**: Valor Apurado (formatado rigorosamente no padrão `HH:MM` para tempos/horas).
* **Permitido**: Limite Legal Permitido pela CLT/Escala.
* **Descrição da Irregularidade**: Detalhamento técnico do desvio.

---

## 3. Catálogo de Relatórios PDF Disponíveis

| ID do Relatório | Título do Relatório | Base Legal / Regra de Negócio |
| :--- | :--- | :--- |
| `interjornada` | Relatório PDF – Interjornada Curta | Art. 66 da CLT & Súmula 110 do TST (Mínimo de 11h de descanso entre jornadas) |
| `intervalos` | Relatório PDF – Intervalo Intrajornada Insuficiente | Art. 71 da CLT (Mínimo de 1h de refeição em jornadas > 6h) |
| `trabalho_7_dias` | Relatório PDF – Trabalho Sem Folga por 7 Dias Consecutivos | Art. 67 da CLT & Art. 7º, XV da CF (Vedado trabalho > 6 dias consecutivos s/ DSR) |
| `domingos` | Relatório PDF – Domingos Seguidos Trabalhados | Art. 386 da CLT & Portaria MTP 671 (Rodízio obrigatório em domingos) |
| `jornada` | Relatório PDF – Excesso de Jornada Diária | Art. 59 da CLT (Jornada diária superior a 10 horas) |
| `horas_extras` | Relatório PDF – Horas Extras Excessivas | Art. 59, § 1º da CLT (Horas extras além do limite legal de 2h/dia) |
| `dsr` | Relatório PDF – Descanso Semanal Remunerado (DSR) | Art. 67 da CLT (Supressão ou irregularidade no descanso semanal) |
| `marcacoes_inconsistentes` | Relatório PDF – Marcações Inconsistentes | Portaria MTP 671 (Batidas ímpares / registros com falha) |
| `ausencia_marcacao` | Relatório PDF – Ausência de Marcação | Falta total de marcação de ponto em dia com expediente previsto |
| `jornadas_excepcionais` | Relatório PDF – Jornadas Excepcionais | Apontamentos atípicos ou horários estendidos não previstos |
| `banco_horas` | Relatório PDF – Banco de Horas | Art. 59, § 2º da CLT (Incoerências de saldo e prazos de compensação) |
| `consolidado_funcionario` | Relatório PDF – Auditoria Consolidada por Funcionário | Dossiê individual completo de conformidade |
| `compilado_deptos` | Relatório PDF – Auditoria Consolidada por Departamento | Compilado e agrupamento por setor operacional |
| `resumo` | Relatório PDF – Auditoria Executiva Consolidada | Visão gerencial sumarizada para Diretoria e RH |

---

## 4. Regras Especiais e Validações

### 4.1 Validação do Trabalho em Domingos (`domingos`)
A verificação de **Dois Domingos Seguidos Trabalhados** (`DOMINGOS_SEGUIDOS`) utiliza o algoritmo em 5 etapas para cada domingo analisado, eliminando falsos positivos ao exigir comprovação objetiva de trabalho efetivo (marcação física válida de ponto):

#### Investigação da Causa Raiz do Falso Positivo Anterior
Anteriormente, o sistema avaliava registros de folga ou feriado de forma isolada sem cruzar com a presença de marcações físicas ativas (`isApontamentoValido`). Dessa forma, domingos marcados administrativamente como descanso sem qualquer batida de ponto eram erroneamente somados na sequência de trabalho em certos cenários de escala.

#### Nova Estrutura de Validação Obrigatória em 5 Etapas
1. **Etapa 1 — Confirmação de Domingo**: Confirmar se a data analisada corresponde a um domingo (`isSunday`). Se não for domingo, interrompe a análise (`return false`).
2. **Etapa 2 — Consolidação Completa de Dados**: Carregar e consolidar todas as informações disponíveis para a data (marcações de ponto, eventos de escala, folgas, dias livres, justificativas, afastamentos, feriados).
3. **Etapa 3 — Verificação de Marcação de Ponto**: Verificar a existência de ao menos uma marcação de ponto original e válida (`ENTRADA` ou `SAIDA` com `isApontamentoValido`).
4. **Etapa 4 — Eventos Administrativos**: Consultar a presença de ocorrências de Folga, Folga de Escala, Descanso Semanal, Dia Livre, DSR, Feriado, Justificativa, Atestado, Abono, Afastamento ou Férias.
5. **Etapa 5 — Priorização e Matriz de Decisão**:
   - **Cenário A**: Evento administrativo presente + SEM marcação de ponto válida -> **DESCANSO** (sequência interrompida, não compõe o evento).
   - **Cenário B**: Evento administrativo presente + COM marcação de ponto válida -> **TRABALHADO** (a batida física de ponto prevalece sobre o registro administrativo; a ocorrência administrativa é registrada em log de auditoria).
   - **Cenário C**: SEM evento administrativo + COM marcação de ponto válida -> **TRABALHADO**.
   - **Cenário D**: SEM marcação de ponto + SEM evento administrativo -> **DESCANSO**.

#### Regra de Decisão do Evento `DOMINGOS_SEGUIDOS`
Para fins exclusivos deste evento, a determinação de um domingo como trabalhado é objetiva e baseada exclusivamente nas marcações de ponto válidas do colaborador:
1. **Cenário 1 — Existe pelo menos uma marcação válida**: Se houver pelo menos um apontamento de ponto cujo status não seja 'Desprezada' (`isApontamentoValido`), o domingo é classificado como **Domingo Trabalhado**.
2. **Cenário 2 — Existem apenas marcações desprezadas**: Se todas as marcações do domingo estiverem classificadas como 'Desprezada', o domingo é considerado **Domingo Não Trabalhado**.
3. **Cenário 3 — Ausência de marcações de ponto**: Se não houver qualquer marcação de ponto para a data, o domingo é obrigatoriamente considerado **Domingo Não Trabalhado**.
4. **Independência de Eventos Administrativos**: Lançamentos administrativos de folga, DSR, descanso semanal, licença, férias, faltas ou feriados são ignorados para a classificação deste evento.

#### Regra de Geração da Infração
O evento `DOMINGOS_SEGUIDOS` é gerado exclusivamente quando dois domingos consecutivos do calendário ($D_1$ e $D_2 = D_1 + 7 \text{ dias}$) forem **ambos** classificados como **Domingo Trabalhado** (presença de marcação válida em ambos). Se qualquer um dos domingos for classificado como **Domingo Não Trabalhado**, o evento não é gerado. A ocorrência de folgas, férias ou outros eventos em dias intermediários durante a semana é totalmente irrelevante.

#### Suíte Permanente de Testes Automatizados e Adequação à LGPD
O algoritmo é validado pela suíte de testes em `/scripts/test-runner.ts` (`npx tsx scripts/test-runner.ts`), cobrindo todos os cenários operacionais (19/19 PASSED) com conformidade total com a Lei Geral de Proteção de Dados (LGPD) através do uso exclusivo de dados de teste fictícios e anonimizados.

#### Isonomia
A auditoria da CLT aplica-se de forma isonômica a todos os colaboradores.

### 4.2 Validação do Trabalho sem Folga por 7 Dias (`trabalho_7_dias`)
A verificação de **Trabalho sem Folga por 7 Dias Consecutivos** (`SEM_FOLGA_7_DIAS`) atende estritamente ao Art. 67 da CLT e Art. 7º, XV da CF:

#### Regra Obrigatória de Decisão
- **Exclusividade de Trabalho Efetivo**: Apenas dias contendo pelo menos um apontamento original válido (`isApontamentoValido`) compõem a sequência.
- **Eliminação de Critérios Indiretos**: A ausência do evento 'Folga', ausência de escala ou ausência de justificativa **jamais** caracteriza um dia trabalhado.
- **Tratamento de Apontamentos Desprezados**:
  - *Exemplo 1 e 3 (Dia contendo apenas apontamentos desprezados)*: O dia é considerado sem trabalho válido e interrompe imediatamente a contagem da sequência.
  - *Exemplo 2 (Dia contendo apontamentos válidos e um ajuste desprezado)*: A presença de pelo menos um apontamento válido mantém o dia como trabalhado e integrado à sequência.
- **Interrupção de Sequência**: Qualquer dia sem trabalho válido zera a contagem e exige reinício a partir da próxima jornada efetiva.

### 4.3 Formatação Obrigatória de Tempos (`HH:MM`)
Todos os apontamentos de hora e duração nos relatórios são formatados rigorosamente no padrão de duas horas e dois minutos (ex: `08:00`, `11:30`, `00:45`), eliminando inconsistências em decimais ou notações mistas.

### 4.3 Parecer Executivo Automático
Todos os relatórios PDF possuem a seção **Parecer Executivo**, contendo análise sintética gerada automaticamente para suporte às tomadas de decisão do departamento jurídico e de recursos humanos.

---

## 5. Auditoria e Logs de Emissão

Toda geração de relatório PDF dispara um registro automático no log de auditoria operacional do sistema (`/api/audit/log-export`), gravando:
1. **Usuário Emissor**: Nome e e-mail.
2. **Tipo do Relatório**: Nome técnico do relatório.
3. **Período**: Filtro de datas aplicado.
4. **Registros Exportados**: Quantidade de ocorrências listadas.
5. **Data e Hora da Geração**: Timestamp do servidor.

---

## 6. Procedimento de Rollback

Caso seja necessário reverter a versão dos relatórios ou do motor de exportação em PDF:
1. Acesse o histórico de alterações no repositório.
2. Reverta as alterações no arquivo `/server/engine.ts` e `/src/utils/pdfGenerator.ts`.
3. Os dados da base de auditoria permanecem intocados em `data/db.json`.
