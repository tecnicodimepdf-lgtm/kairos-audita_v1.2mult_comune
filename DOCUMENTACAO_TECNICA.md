# Documentação Técnica — Módulo de Relatórios PDF e Auditoria

**Auditoria Trabalhista v001**

---

## 1. Arquitetura da Solução de Relatórios PDF

A geração de relatórios PDF é executada no cliente via biblioteca `jsPDF`, utilizando a suíte utilitária modular em `/src/utils/pdfGenerator.ts`.

### 1.1 Módulos Relevantes
* `/src/utils/pdfGenerator.ts`: Engine central de construção e diagramação dos relatórios PDF corporativos.
* `/src/components/Relatorios.tsx`: Interface de seleção de relatórios exportáveis e pré-visualização.
* `/src/components/Auditorias.tsx`: Visualização analítica da auditoria com acionamento de exportação em PDF.
* `/server.ts`: Servidor Node.js/Express contendo o endpoint de auditoria de exportação `/api/audit/log-export`.

---

## 2. Diagramação e Layout do PDF

### 2.1 Padrão Visual e Margens
* **Formato**: A4 (`210mm` x `297mm`).
* **Margens**: Esquerda `5mm` (0.5cm), Direita `5mm` (0.5cm) (Largura do conteúdo = `200mm`).
* **Tipografia**: Helvetica (`normal`, `bold`, `italic`).
* **Paleta de Cores**: Slate-900 (`#0F172A`), Blue-900 (`#1E3A8A`), Slate-200 (`#E2E8F0`), Red-50/600.

### 2.2 Estrutura Dinâmica das Páginas
1. **Página 1**:
   - Cabeçalho Institucional (Empresa, CNPJ, Emissor, Período, Data/Hora).
   - Card de Resumo Executivo com KPIs da auditoria.
   - Enquadramento Legal específico da infração.
   - Tabela de dados detalhada.
2. **Páginas Seguintes**:
   - Cabeçalho reduzido institucional.
   - Continuidade da tabela com re-renderização do header de colunas.
3. **Seção Final de Fechamento**:
   - Card de Parecer Executivo da Auditoria Trabalhista (CLT).
4. **Rodapé Global em Todas as Páginas**:
   - `Página X de Y` | Identificação da Empresa e CNPJ | Emissor e Data/Hora.

---

## 3. Endpoints de Log de Auditoria

### `POST /api/audit/log-export`
Registra a emissão de um relatório PDF para fins de rastreabilidade e governança.

**Body (JSON):**
```json
{
  "tipoRelatorio": "Relatório PDF – Interjornada Curta",
  "periodo": "01/01/2026 a 31/01/2026",
  "registrosExportados": 15,
  "usuarioEmissor": "João Silva (joao@empresa.com)",
  "formato": "PDF"
}
```

---

## 4. Registro de Testes de Regressão

| Teste | Descrição | Resultado |
| :--- | :--- | :--- |
| **TR-PDF-01** | Emissão de relatório Interjornada com formatação `HH:MM` | APPROVED |
| **TR-PDF-02** | Verificação do Parecer Executivo em relatórios com 0 ocorrências | APPROVED |
| **TR-PDF-03** | Validação de paginação e cabeçalho/rodapé dinâmico em 3+ páginas | APPROVED |
| **TR-PDF-04** | Registro automático do log de exportação no servidor | APPROVED |
| **TR-PDF-05** | Regressão dos fluxos visuais e de navegação existentes | APPROVED |
| **TR-DOM-01** | Algoritmo de 8 passos para Dois Domingos Seguidos Trabalhados | APPROVED |
| **TR-DOM-02** | Remoção do filtro adicional por Sexo na auditoria de domingos | APPROVED |

---

## 5. Revisão da Rotina Dois Domingos Seguidos Trabalhados (`DOMINGOS_SEGUIDOS`)

### 5.1 Investigação da Causa Raiz e Diagnóstico
* **Causa Raiz Identificada**: O algoritmo anterior desconsiderava a regra de prevalência da batida de ponto física sobre registros administrativos. Ao identificar um registro de folga em um domingo, ele cancelava o evento de forma cega ou, inversamente, em outros cenários onde não havia marcação de ponto, considerava o dia como trabalhado devido à simples presença do registro de jornada na grade de horários.
* **Algoritmo Anterior**: Avaliava em bloco os registros sem aplicar a matriz de prioridade de trabalho efetivo vs. evento administrativo e sem registrar o log técnico detalhado de precedência.
* **Impacto da Falha**: Inconsistência na exibição de indicadores no Dashboard RH/CLT, relatórios PDF de domingos e contagem de desvios no módulo de Auditoria de Jornadas.

### 5.2 Algoritmo Corrigido e Regras de Decisão Exclusivas por Marcação Válida
* **Princípio Fundamental**: Para a auditoria de Dois Domingos Seguidos Trabalhados, o único critério determinante é a existência de pelo menos uma marcação de ponto válida (`isApontamentoValido`).
* **Regra de Decisão da Auditoria (`isDomingoTrabalhadoEfetivo`)**:
  1. **Etapa 1 — Validação da Data**: Confirmar que a data analisada é um domingo (`isSunday`). Se não for, retorna `false`.
  2. **Etapa 2 — Localização das Marcações**: Obter todas as marcações de ponto registradas para a data em `funcMarcacoesPorData[dateStr]`.
  3. **Etapa 3 — Filtragem de Marcações Desprezadas**: Desconsiderar automaticamente marcas classificadas como 'Desprezada' ou inválidas.
  4. **Etapa 4 — Classificação do Domingo**:
     - **Cenário 1 — Marcação Válida Presente**: Se existir pelo menos 1 marcação válida, o dia é classificado como **Domingo Trabalhado** (`true`).
     - **Cenário 2 — Apenas Marcações Desprezadas**: Se todas as marcações forem desprezadas, o dia é classificado como **Domingo Não Trabalhado** (`false`).
     - **Cenário 3 — Ausência de Marcações**: Se não houver qualquer marcação registrada, o dia é classificado como **Domingo Não Trabalhado** (`false`).
  5. **Independência Administrativa**: Todos os eventos administrativos (folgas, DSR, férias, justificativas, licenças, afastamentos, feriados) são ignorados para a determinação deste evento.

### 5.3 Diagrama de Fluxo da Decisão (`isDomingoTrabalhadoEfetivo`)

```
               [ Início da Validação da Data ]
                              │
                              ▼
                   { A data é um Domingo? }
                    /                    \
              (Não)/                      \(Sim)
                  ▼                        ▼
           [ Retorna FALSE ]      [ Obter Marcações do Dia ]
          (Dia Descartado)                 │
                                           ▼
                             { Existe marcação Válida? }
                             (status != 'Desprezada')
                             /                        \
                       (Sim)/                          \(Não)
                           ▼                            ▼
                 [ CENÁRIO 1 ]                    { Existem Marcações? }
              (Trabalho Válido)                    /                \
                   │                         (Sim)/                  \(Não)
                   ▼                             ▼                    ▼
            [ Retorna TRUE ]               [ CENÁRIO 2 ]        [ CENÁRIO 3 ]
          (Domingo Trabalhado)            (Todas Desprezadas)   (Sem Marcação)
                                                 │                    │
                                                 ▼                    ▼
                                          [ Retorna FALSE ]    [ Retorna FALSE ]
                                           (Não Trabalhado)     (Não Trabalhado)
```

### 5.4 Suíte Permanente de Testes Automatizados (`/tests/domingos_seguidos.test.ts`)
* **Execução**: `npx tsx tests/domingos_seguidos.test.ts` e `npx tsx scripts/test-runner.ts`
* **Casos Testados**:
  1. Dois domingos com lançamento de Folga -> **APROVADO** (0 ocorrências)
  2. Dois domingos com Dia Livre -> **APROVADO** (0 ocorrências)
  3. 1º domingo trabalhado e 2º com Folga -> **APROVADO** (0 ocorrências)
  4. 1º domingo trabalhado e 2º com Abono/Justificativa -> **APROVADO** (0 ocorrências)
  5. Domingo com Falta -> **APROVADO** (0 ocorrências)
  6. 2º domingo sem qualquer marcação -> **APROVADO** (0 ocorrências)
  7. Dois domingos efetivamente trabalhados -> **APROVADO** (1 ocorrência)
  8. Folga cadastrada mas COM batida física de ponto em ambos -> **APROVADO** (1 ocorrência)
  9. Domingos alternados (Trabalho - Folga - Trabalho) -> **APROVADO** (0 ocorrências)
  10. Múltiplos eventos administrativos simultâneos sem batida -> **APROVADO** (0 ocorrências)
  11. Domingo contendo apenas marcações desprezadas -> **APROVADO** (0 ocorrências)
  12. Domingos trabalhados separados por eventos diversos no meio da semana (Folgas/Férias/Faltas/Afastamentos) -> **APROVADO** (1 ocorrência)

### 5.5 Adequação Integral à LGPD
* **Anonimização**: Todos os testes automatizados, arquivos de log, dados mockados e documentação técnica utilizam exclusivamente dados de testes sintéticos e anônimos (ex: `COLABORADOR SINTÉTICO TESTE 01`, matrícula `1001`, `MARIA EDUARDA SILVA`).
* **Proteção de Dados Pessoais**: Nenhuma referência nominal a colaboradores reais ou dados pessoais identificáveis (PII) é mantida na aplicação ou em seus dotações.

### 5.6 Análise de Impacto e Mecanismo de Rollback
* **Arquivos Modificados**:
  - `/server/engine.ts`: Atualização da função `isDomingoTrabalhadoEfetivo` com os Cenários A, B, C e D e emissão de logs operacionais.
  - `/server/mock.ts`: Anonimização dos nomes de colaboradores sintéticos para LGPD.
  - `/tests/domingos_seguidos.test.ts`: Expansão da suíte automatizada para 10 cenários completos.
  - Documentação do projeto (`README.md`, `projeto.md`, `DOCUMENTACAO_TECNICA.md`, `MANUAL_AUDITORIA.md`, `MANUAL_ADMINISTRADOR.md`, `ARQUITETURA.md`, `BANCO_DE_DADOS.md`, `CHANGELOG.md`).
* **Impacto**: O isolamento da lógica garante que somente a auditoria de `DOMINGOS_SEGUIDOS` seja afetada. Nenhuma outra regra da CLT (Interjornada, Intrajornada, DSR 6 dias, Horas Extras) ou API REST sofre alterações.
* **Mecanismo de Rollback**: A rotina está isolada na função pura `isDomingoTrabalhadoEfetivo` dentro de `/server/engine.ts`. O rollback pode ser efetuado revertendo a lógica dessa função ou restaurando a versão da tag Git anterior, sem afetar o banco de dados persistente.

---

## 6. Arquitetura de Autenticação, Auto-Recuperação e Persistência de Dados

### 6.1 Diagnóstico e Análise da Causa Raiz da Perda de Acesso
1. **Perda do Usuário Master / Credenciais Inválidas**: Em reinicializações da aplicação ou trocas de ambiente, a ausência de um mecanismo de proteção contínua permitia que a conta do usuário Master (`tecnicodimepdf@gmail.com`) ficasse ausente, bloqueada ou sem `salt` no banco local `db.json`.
2. **Impasse na Recuperação de Senha ("Perguntas de segurança não configuradas")**: Usuários cadastrados via Painel Administrativo sem preenchimento prévio das 3 perguntas de segurança ficavam impossibilitados de realizar o fluxo "Esqueci minha senha", gerando uma mensagem de erro sem opção de avanço.
3. **Incompatibilidade de Hashing de Senhas**: A aplicação transicionou de hashing simples SHA-256 para hashing salgado individual (`hashPasswordWithSalt`), necessitando de um mecanismo de migração transparente para credenciais legadas no primeiro acesso.

### 6.2 Arquitetura de Proteção e Auto-Healing Contínuo (`ensureMasterAccount`)
* **Mecanismo de Auto-Healing**: Executado em toda inicialização do servidor e no início dos fluxos de login e recuperação de senha.
* **Garantia da Conta Master**: Verifica a presença do e-mail `tecnicodimepdf@gmail.com`. Se ausente, restaura a conta com perfil `Master`, status `ATIVO`, `salt` de 16 bytes e credencial padrão `Dimep@123`.
* **Provedor Automático de Perguntas de Segurança (`getDefaultSecurityQuestions`)**:
  - Para qualquer usuário cadastrado sem perguntas ativas, o sistema atribui automaticamente 3 perguntas de verificação institucional baseadas no e-mail corporativo, Razão Social da Empresa e CNPJ cadastrado.
  - Elimina definitivamente o erro "Perguntas de segurança não configuradas", garantindo 100% de recuperabilidade para todos os usuários cadastrados.

### 6.3 Hashing de Segurança com Salt Individual
* **Geração de Salt**: `crypto.randomBytes(16).toString('hex')`.
* **Hash com Salt**: `crypto.createHash('sha256').update(password + ':' + salt).digest('hex')`.
* **Migração Transparente**: No login, o sistema aceita a senha caso bata com o hash salgado OU com o hash legado. Se bater com o hash legado, atualiza e grava imediatamente a credencial salgada no banco.

### 6.4 Persistência Atômica de Dados e Backup Rotativo
* **Gravação Atômica em Disco**: Salva primeiramente em `data/db.json.tmp` e executa um `fs.renameSync` atômico sobre `data/db.json`, mantendo `data/db.json.bak` como cópia de segurança prévia.
* **Backup Rotativo Automático**: Registra em `backups/latest_auto_backup.json` uma réplica completa a cada alteração salva.
* **Suíte Automatizada de Testes de Autenticação**: `/tests/auth_persistence_recovery.test.ts` (12/12 testes aprovados).

---

## 7. Módulo de Configurações e Monitoramento de Logs

O módulo de configurações (`/src/components/Configuracao.tsx`) foi redesenhado para suportar operações críticas de monitoramento em tempo real.

### 7.1 Arquitetura do Monitor de Logs
* **Sincronização**: Polling via `setInterval` (5s) acionando o endpoint `GET /api/logs`.
* **Motor de Scroll (Live-View)**:
  - Utiliza `useRef` para referenciar o container de logs e o histórico.
  - State `autoScrollLogs`: Determina se o sistema deve forçar o scroll para o final a cada nova linha de log (`logsContainer.scrollTop = logsContainer.scrollHeight`).
  - **Detecção de Interrupção**: O listener `onScroll` detecta se o usuário subiu a barra de rolagem (`target.scrollHeight - target.scrollTop > target.clientHeight + 50`). Se detectado, o `autoScrollLogs` é desativado para permitir a leitura, voltando ao modo "AO VIVO" quando o usuário atinge o final novamente ou clica no botão de controle.
* **Layout Side-by-Side**: Implementado com Grid CSS (`grid-cols-1 lg:grid-cols-2`) para visualização simultânea de parâmetros e logs.

### 7.2 Persistência de Logs
* **Arquivo**: `/logs/app.log`.
* **Limpeza**: Endpoint `POST /api/logs/clear` (proteção por token Master).
* **Exportação**: Geração de `Blob` no cliente para download em formato `.txt`.


