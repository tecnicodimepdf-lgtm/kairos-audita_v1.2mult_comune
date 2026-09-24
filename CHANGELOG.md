## [4.1.3] - 2026-08-05
### Fixed
- **Eliminação Definitiva de Page Reloads (Client-Side):** Removidas as chamadas de salvamento contínuo em disco (`this.save()`) na rotina de atualização de sessão (`touchActiveSession`), eliminando os gargalos de File System I/O que disparavam o watcher do Vite.
- **Desativação Completa de Backup Automático no Startup:** Removidas as funções intrusivas de backup automático (`createAutoBackup`, `createStartupBackup`) e políticas de retenção contínuas que congelavam a inicialização do Node.
- **Estabilização de Renderização React:** Ajustados os dependentes dos Hooks `useEffect` no `App.tsx` (modificado `[user]` para `[!!user]`) e em múltiplos componentes (`DashboardExecutivo`, `DashboardGerencial`, `DashboardRH`, `Funcionarios`, `Relatorios`) acoplando restrições condicionais baseadas na tag `isSyncing`.
- **Sincronização Automática:** Restringiu-se de modo estrito a sincronização automática na inicialização *apenas* se a propriedade `sincronizarAoEntrar` do usuário ativo estiver marcada como verdadeira, prevenindo chamadas REST incondicionais na abertura.
- **Otimização do Painel Administrativo:** Desacopladas chamadas sequenciais incondicionais da API no componente `AdminPanel.tsx`. Agora o carregamento (`fetch`) é exclusivo para a sub-aba que o usuário visualizar no momento.


# CHANGELOG - Painel de Inteligência Operacional Dimep Kairos

All notable changes to this project will be documented in this file.

## [4.1.0] - 2026-08-05

### Added & Improved
- **Backup Automático na Inicialização:** Implementação de política de backup administrativo automático a cada boot do servidor, com retenção rotativa dos últimos 10 backups.
- **Gerenciamento Centralizado de Logs (Painel Master):** Nova infraestrutura de logs categorizados (Auditoria, Técnico, Sistema, Métricas) com visualização em tempo real e ferramentas de limpeza por categoria.
- **Refatoração do Módulo de Sessões Ativas:** Sincronização em tempo real entre memória e persistência, auditoria automática de sessões órfãs e eliminação de duplicatas para garantir o estado real da aplicação.
- **Consolidação de Persistência e Integridade:** Auditoria contínua de usuários e perfis para garantir resiliência contra falhas de sistema e reinicializações incompletas.

## [4.0.0] - 2026-08-05

### Added & Standardized
- **Padronização Visual "Verde Institucional":**
  - **Sidebar:** Implementação de fundo em verde escuro (`emerald-900`), fontes e ícones em branco puro, contraste acentuado e destaque visual no item selecionado.
  - **Formulários:** Padronização dos cabeçalhos de formulários e logs com fundo verde escuro e títulos em branco, garantindo legibilidade e modernidade.
  - **Identidade Visual:** Predominância de branco no corpo da aplicação com detalhes em verde institucional, proporcionando um aspecto profissional e limpo.
- **Controle de Sincronização Automática:**
  - **Desativação do Sync Automático Incondicional:** A sincronização automática ao entrar foi desativada por padrão para preservar performance e controle do usuário.
  - **Preferência do Usuário:** Adicionada a configuração "Sincronizar ao entrar" no perfil do usuário, permitindo o controle individual da automação.
  - **Gatilho Explícito:** O usuário agora deve acionar a sincronização manualmente ou via preferência salva, respeitando o fluxo de trabalho sob demanda.
- **Consolidação de Persistência:**
  - **Fonte Única da Verdade:** Garantia de persistência obrigatória de todos os dados administrativos (Usuários, Perfis, Permissões, Configurações REST) em `db.json`.
  - **Segurança Master:** Atualização da senha padrão da conta Master para `Suporte@dimep` conforme auditoria de segurança.
  - **Sincronização de Preferências:** Persistência garantida das novas preferências de sincronização no modelo de dados do usuário.

## [3.5.3] - 2026-08-05

### Corrigido
- **Correção da Lógica de Auditoria (7 Dias / Domingos Seguidos)**: Eliminada a falha que considerava eventos administrativos (Folga, DSR, Férias, Abonos) como dias trabalhados, gerando falsos positivos.
- **Identificação de Marcadores Kairos**: Expandida a lista de marcadores de "Não Trabalho" na integração com a API do Dimep Kairos (DSR, FE, AF, AB, FJ, etc.).
- **Segurança do Motor de Auditoria**: Implementada camada de proteção "Redobrada" em `isMarcacaoValida`, validando simultaneamente o Tipo e a Origem da marcação para garantir a integridade dos eventos gerados.

## [3.5.2] - 2026-08-05

### Fixed
- **Resolução de Erro Crítico de Renderização React:**
  - Corrigido o erro "Objects are not valid as a React child" em `/src/components/Relatorios.tsx`. A causa era uma expressão de string contendo chaves `{"{ Pagina: 1 }"}` que estava sendo interpretada incorretamente ou gerando inconsistências de hidratação. Convertido para string literal simples `{'{ Pagina: 1 }'}`.
  - Verificação global de todos os componentes funcionais para garantir que objetos (como eventos de mouse/teclado ou mensagens de erro não-string) não sejam renderizados diretamente no DOM.

### Changed
- **Reorganização do Módulo de Configurações (`Configuracao.tsx`):**
  - **Layout Side-by-Side:** Reestruturação visual para exibir "Parâmetros de Integração" e "Logs de Utilização e Erros" lado a lado em telas grandes (layout de duas colunas), otimizando o uso do espaço horizontal.
  - **Histórico de Coletas Centralizado:** Posicionamento do "Histórico Recente de Coletas" em destaque logo abaixo dos parâmetros principais.
  - **Aprimoramento do Monitor de Logs:**
    - Implementação de **Auto-Scroll Inteligente**: Rolagem vertical automática para o último registro em tempo real.
    - **Controle de Interrupção Manual:** Possibilidade de pausar a rolagem automática para análise de registros específicos sem perder as atualizações em background.
    - **Polling de Atualização Automática:** Sincronização de logs e status da API a cada 5 segundos.
  - **Gestão de Ambiente:** Movimentação dos controles de "Modo de Demonstração" e "Limpeza de Base" para uma seção dedicada na base do módulo, prevenindo acionamentos acidentais.

## [3.5.1] - 2026-07-28

### Fixed & Standardized
- **Refinamento Definitivo da Auditoria "Dois Domingos Seguidos Trabalhados" (`DOMINGOS_SEGUIDOS`):**
  - **Adoção do Critério Exclusivo por Marcação de Ponto Válida:** Atualização da função `isDomingoTrabalhadoEfetivo` em `/server/engine.ts` para basear a classificação de domingo trabalhado exclusivamente na presença de marcações físicas de ponto válidas (`isApontamentoValido`).
  - **Desconsideração Total de Eventos Administrativos:** Eventos de folga, DSR, feriados, licenças, abonos, faltas e justificativas são desconsiderados para este evento específico, eliminando a dependência de classificações de escala ou do status de jornada.
  - **Tratamento de Marcações Desprezadas:** Domingos com marcações classificadas como 'Desprezada' ou sem marcações são rigorosamente considerados **Domingo Não Trabalhado**.
  - **Independência dos Dias Intermediários:** Confirmado que a ocorrência de folgas, férias ou afastamentos no meio da semana (Segunda a Sábado) não afeta a identificação da infração em domingos consecutivos.
  - **Validação com Suíte Ampliada de Testes:** Atualização de `/tests/domingos_seguidos.test.ts` e `/scripts/test-runner.ts` com 12 cenários operacionais e 24/24 testes integrados com 100% de êxito.

## [3.5.0] - 2026-07-28

### Added & Fixed
- **Correção da Auditoria "Trabalho sem Folga por 7 Dias" (`SEM_FOLGA_7_DIAS`):**
  - **Eliminação Total do Critério Indireto de Ausência de Folga:** A presença/ausência do evento 'Folga', escalas, justificativas ou ocorrências administrativas deixou de ser utilizada para inferir dias trabalhados.
  - **Critério Exclusivo de Trabalho Efetivo:** Um dia integra a sequência se, e somente se, possuir pelo menos um apontamento original e válido de trabalho (`isApontamentoValido`).
  - **Tratamento Rigoroso de Apontamentos Desprezados:**
    - *Apenas apontamentos desprezados:* O dia é considerado sem trabalho válido e interrompe imediatamente a sequência (Exemplos 1 e 3).
    - *Apontamentos válidos acompanhados de ajustes desprezados:* O dia permanece válido para a sequência de trabalho efetivo (Exemplo 2).
  - **Intersupervisão de Sequências:** Qualquer dia sem apontamento válido interrompe a contagem e reseta a sequência.
- **Correção e Eliminação de Falsos Positivos na Auditoria "Dois Domingos Seguidos Trabalhados":**
  - **Investigação da Causa Raiz:** Constatou-se que a rotina anterior avaliava precipitadamente dias de folga/DSR/feriado sem validar a presença de marcações físicas de ponto válidas (`isApontamentoValido`), gerando falsos positivos onde folgas oficiais eram classificadas como trabalho.
  - **Novo Algoritmo em 5 Etapas Rigorosas:**
    1. Confirmar que a data analisada é um domingo (`isSunday`).
    2. Consolidação de todas as marcações e eventos cadastrados para a data.
    3. Verificação da existência de marcação física de ponto válida (ENTRADA / SAIDA).
    4. Verificação da presença de eventos administrativos (Folga, DSR, Feriado, Justificativa, Dia Livre, Afastamento).
    5. Priorização por regra de decisão (Cenários A, B, C, D):
       - *Cenário A:* Evento administrativo existente e SEM marcação de ponto válida -> **DESCANSO** (sequência interrompida).
       - *Cenário B:* Evento administrativo existente e COM marcação de ponto válida -> **TRABALHADO** (prevalece a batida de ponto física; evento administrativo registrado em log).
       - *Cenário C:* Sem evento administrativo e COM marcação de ponto válida -> **TRABALHADO**.
       - *Cenário D:* Sem marcação de ponto e sem evento administrativo -> **DESCANSO**.
  - **Detecção Estrita do Evento:** O evento `DOMINGOS_SEGUIDOS` passa a ser gerado exclusivamente quando dois domingos consecutivos atenderem simultaneamente aos critérios de trabalho efetivo após a execução das 5 etapas.
  - **Rastreabilidade e Logs Técnicos Detalhados:** Registro em log contendo data analisada, quantidade de marcações válidas, presença de folga/justificativa/feriado, decisão tomada e justificativa legal.
  - **Conformidade LGPD:** Remoção e anonimização de todos os nomes/dados sensíveis de colaboradores reais nas massas de teste e documentação, substituídos por dados sintéticos.
  - **Homologação:** 100% de aprovação na bateria de testes integrados (21/21 PASSED) em `/scripts/test-runner.ts`.

## [3.4.0] - 2026-07-27

### Added & Homologated
- **Gestão Completa e Persistência de Usuários:** Homologação do ciclo de vida de usuários (criação, edição, exclusão, bloqueio, desbloqueio, troca de perfil, redefinição de senha e auto-healing da conta Master).
- **Conexão e Sincronização REST API Kairos:** Retenção permanente de parâmetros REST (Host, API Key, CNPJ, Empresa) sem retornos indevidos a "Não cadastrado" e sincronização em segundo plano desacoplada da UI.
- **Single Source of Truth & Isolamento de Sessão:** Acesso centralizado via repositório de dados com isolamento por token de sessão e expiração automática configurável.
- **Emissão do Boletim Técnico BT-006:** Publicação do boletim `/Documentacao/Boletins/Boletim_Tecnico_006_2026-07-27_08-48.md` e atualização da matriz documental.

## [3.3.0] - 2026-07-27

### Added & Homologated
- **Estabilização Definitiva e Auditoria Integrada:** Auditoria completa e verificação final de ausência de perda de dados, retenção permanente de API Key, CNPJ, Empresa Conectada e parâmetros REST.
- **Single Source of Truth & Isolamento de Sessões:** Garantia de fonte única da verdade para dados de configuração em `/server/db.ts` e `/server.ts` com isolamento estrito por token de sessão (`x-session-token`).
- **Resiliência React & Bateria de Testes:** Proteção global contra falhas na árvore DOM com `ErrorBoundary` e 100% de aprovação (15/15 PASSED) na bateria de testes integrados `/scripts/test-runner.ts`.
- **Boletim Técnico BT-005:** Emissão do boletim técnico `/Documentacao/Boletins/Boletim_Tecnico_005_2026-07-27_08-36.md` e atualização do índice documental.

## [3.2.0] - 2026-07-27

### Added & Homologated
- **Homologação Técnica e Validação de Invariantes:** Auditoria completa e verificação final de ausência de perda de dados, retenção permanente de API Key, CNPJ e empresa conectada.
- **Single Source of Truth Consolidado:** Confirmação da gravação síncrona e unificada das credenciais REST em `/server.ts` e `/server/db.ts`.
- **Sessões e Resiliência da Interface:** Validação da captura de exceções via `ErrorBoundary` e isolamento estrito de sessões multiusuário com 100% dos testes aprovados (15/15 PASSED).
- **Emissão do Boletim Técnico BT-004:** Geração do boletim `/Documentacao/Boletins/Boletim_Tecnico_004_2026-07-27_08-18.md` e atualização da matriz documental.

## [3.1.0] - 2026-07-27

### Added & Fixed
- **Reestruturação Arquitetural e Single Source of Truth:** Unificação da fonte única da verdade para parâmetros de conexão REST (API Key, CNPJ Identificador, Nome da Empresa) sincronizados atomicamente entre as configurações globais e o cadastro dos usuários ativos.
- **Proteção Visual de Interface (`ErrorBoundary`):** Adição de captura global de exceções de renderização React em `/src/components/ErrorBoundary.tsx`, eliminando riscos de tela branca no encerramento de sessão ou trocas bruscas de estado.
- **Gerenciamento Profissional de Inatividade:** Configuração do timeout de inatividade para usuários padrão (padrão: 30 minutos) com manutenção de isenção total para a conta Master (`masterInactivityTimeoutExempt: true`) e suporte a eventos de toque, scroll, teclado e mouse.
- **Homologação e Bateria de Testes Integrada:** Execução e 100% de aprovação (15/15 PASSED) na suite de testes automatizados `/scripts/test-runner.ts`.
- **Boletim Técnico BT-003:** Emissão do boletim técnico `/Documentacao/Boletins/Boletim_Tecnico_003_2026-07-27_08-00.md` e atualização do índice `/Documentacao/Indice_Boletins.md`.

## [3.0.0] - 2026-07-26

### Added
- **Bateria de Testes Automatizada Integrada:** Criação do script `/scripts/test-runner.ts` que executa e valida as 14 categorias de testes obrigatórias (Unitários, Persistência, Isolamento, Motor CLT, Permissões, Demo vs. Operacional).
- **Prontidão de Infraestrutura para Banco Relacional:** Criação do módulo de esquemas e interfaces do adaptador de banco relacional em `/src/db/schema.ts` (suporte a SQLite / PostgreSQL).
- **Assistente de Primeiro Acesso Expandido (First Access Wizard):**
  - Passo 1: Troca da senha temporária inicial (`senha`) e cadastro de 3 perguntas/respostas de segurança com HMAC-SHA256.
  - Passo 2: Cadastro da empresa principal e chave CNPJ.
  - Passo 3: Configuração das credenciais e host da REST API Dimep Kairos.
- **Boletim Técnico BT-002:** Emissão do boletim técnico `/Documentacao/Boletins/BT-002.md` com os resultados completos da auditoria técnica e homologação do sistema.

### Verified & Validated
- **Usuário Master Permanente:** Proteção de nível de infraestrutura no `Database.saveUsers` e `ensureMasterAccount`. O usuário `tecnicodimepdf@gmail.com` é auto-regenerado, ativo e imutável.
- **Isenção do Usuário Master do Timeout de Inatividade:** O Master permanece conectado sem interrupções por inatividade (`masterInactivityTimeoutExempt: true`).
- **Gerenciamento de Ambiente de Demonstração vs. Operacional:**
  - Carga explícita do ambiente de demonstração via `POST /api/database/load-demo`.
  - Desativação e limpeza completa via `POST /api/database/unload-demo`.
- **Motor de Auditoria CLT:** Validação dos algoritmos de identificação de jornadas superiores a 10h, marcações ímpares, ausência de intervalo, domingos consecutivos e incoerências de ponto.

## [1.0.0] - 2026-07-26
- Versão inicial com persistência em banco local de arquivos e controle de sessões.
