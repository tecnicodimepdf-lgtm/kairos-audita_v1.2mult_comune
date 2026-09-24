# Registro Geral do Projeto (Dossiê) - Auditoria Trabalhista

Este documento fornece um sumário executivo da plataforma Auditoria Trabalhista para auditoria de jornadas e gerenciamento de passivo trabalhista brasileiro.

---

## 🏛️ Origem do Nome Auditoria Trabalhista
**Auditoria Trabalhista** (ou Horas) são figuras associadas à mitologia grega, relacionadas à ordem natural, regularidade, ciclos e organização do tempo. Filhas de Zeus e Têmis (a deusa da justiça e da ordem), as Auditoria Trabalhista eram responsáveis por manter a harmonia, o equilíbrio das estações e o cumprimento das leis e normas.
No contexto da plataforma, o nome **Auditoria Trabalhista** representa a disciplina, conformidade, regularidade e monitoramento contínuo das jornadas de trabalho, alinhando a gestão do tempo ao cumprimento estrito das regras trabalhistas e da justiça corporativa.

---

## 📝 Visão Geral do Produto
O **Auditoria Trabalhista** visa preencher a lacuna entre os dados brutos de relógio de ponto e a tomada de decisão jurídica de conselho, transformando marcações de batidas obtidas via a REST API do Dimep Kairos em inteligência operacional, permitindo mitigar passivos de fiscalizações e reclamações de empregados.

---

## 🏆 Checklist de Entregas e Conformidades

### 1. Camada de Apresentação (Frontend React + Vite)
* [x] **Painel Executivo Principal**: Estatísticas macro, volumetria temporal e gráficos de gravidade e tipos de desvios.
* [x] **Painel de Compliance RH**: Foco exclusivo nas violações do Artigo 59, 66 e 71 da CLT, listagem de funcionários mais críticos e alertas detalhados.
* [x] **Sistema de Notificações de Inconsistência**: Banner inteligente de alerta flutuante exibido de forma proativa pós-sincronização, fornecendo volumetria real e atalhos rápidos de auditoria para mitigação ágil de passivos.
* [x] **BI Analítico Cruzado**: Capacidade de filtrar dados cruzados em todo o ecossistema clicando nos elementos visuais ou badges.
* [x] **Relatórios Prontos para Impressão e PDFs Corporativos (CLT)**: Motor dedicado (`pdfGenerator.ts`) para geração de relatórios PDF com cabeçalho corporativo, CNPJ, resumo executivo de KPIs, parecer executivo automático, formatação `HH:MM`, paginação dinâmica e suporte a 14+ tipos de auditoria (Interjornada, Intrajornada, Domingos, 7 Dias, Excesso de Jornada, Banco de Horas, Consolidado por Colaborador/Departamento).
* [x] **Logs de Auditoria de Exportação em Servidor**: Endpoint `/api/audit/log-export` que registra em log de auditoria operacional cada relatório PDF emitido, com informações de usuário, tipo de relatório, período e volume de registros.
* [x] **Documentação Técnica e de Rollback**: Criação do `MANUAL_AUDITORIA.md`, `MANUAL_ADMINISTRADOR.md`, `DOCUMENTACAO_TECNICA.md` com procedimentos de rollback e registro de testes de regressão.
* [x] **Painel de Configurações**: Gerenciamento de credenciais da Dimep, teste de credenciais em tempo real, visualizador de logs comentados e históricos de coletas.
* [x] **Indicador de Banco Ativo**: Exibição da empresa e CNPJ reais ou simulados ativos.
* [x] **Limpeza de Base de Exemplo**: Recurso para apagar todos os registros de demonstração e manter a base limpa para produção.
* [x] **Backup e Restauração de Credenciais**: Exportação e importação de arquivos de configuração em formato JSON.
* [x] **Alertas de Proteção de Dados**: Avisos consolidados do modo Read-Only, assegurando integridade total da nuvem Dimep Kairos.

### 2. Camada de Aplicação e Serviços (Node/Express Backend)
* [x] **Motor de Auditoria CLT**: Regras matemáticas estritas que reconstróem as batidas diárias computando limites de horas extras e descansos.
* [x] **Revisão da Detecção de Dois Domingos Seguidos Trabalhados (`DOMINGOS_SEGUIDOS`)**: Algoritmo revisado (`isDomingoTrabalhadoEfetivo`). A classificação de domingo trabalhado baseia-se exclusivamente na existência de pelo menos uma marcação física de ponto válida (`isApontamentoValido`), desconsiderando eventos administrativos (folgas, DSR, férias, feriados, licenças, abonos e faltas). Suíte de testes automatizados e anônimos (LGPD) em `/tests/domingos_seguidos.test.ts` (12/12 testes aprovados) e bateria integrada em `/scripts/test-runner.ts` (24/24 PASSED).
* [x] **Repository Pattern**: Abstração limpa das tabelas e persistência de dados históricos.
* [x] **Dimep Integration**: Conexão estável e certificada com endpoints reais de API do Dimep Kairos, dispensando configurações secundárias de ID de empresa e suportando fallback dinâmico para Razão Social.
* [x] **Logs de Utilização e Erros**: Arquivo de diagnóstico comentado `logs_utilizacao_kairos.txt` integrado à interface para auxílio e análise ágil de IS.
* [x] **Credenciais de Fábrica Ativas**: Provisionamento das credenciais reais de produção do cliente por padrão no repositório de dados.
* [x] **Seeder Corporativo**: Gerador automático de dados consistentes para auditorias realistas.
* [x] **Usuário Master de Fábrica (Automático & Auto-Healing)**: Criação automática e manutenção contínua do primeiro usuário Master (`tecnicodimepdf@gmail.com`, Renato Santos, senha `Suporte@dimep`, empresa `RED COM DE CALÇADOS LTDA`, CNPJ `10722889000174`, API Key `2a8789c6-4306-4ab2-a68c-dacea9b9e457`).
* [x] **Segurança com Salt e Provedor Automático de Perguntas**: Criptografia de senhas com salt individual de 16 bytes, hashing de respostas de segurança e inicialização automática de perguntas corporativas para prevenir impasses na recuperação.
* [x] **Troca de Senha Obrigatória no Primeiro Acesso**: Intercepção e barreira no login exigindo a alteração de senha inicial e definição de 3 perguntas de segurança criptografadas.
* [x] **Controle de Tentativas e Bloqueio**: Proteção contra ataques de força bruta, bloqueando a conta temporariamente por 15 minutos após 5 erros seguidos de senha.
* [x] **Registro de Auditoria IP**: Rastreamento e log do IP de acesso, data e hora para criação do usuário Master, primeiro acesso, troca de senhas, logins e logouts.

### 3. Módulo de Perfis, Permissões Granulares (RBAC v2.5.0) e Controle Master
* [x] **Diagnóstico de Permissões e Inventário Completo**: Elaborado diagnóstico em `/Documentacao/Diagnostico_Permissoes.md` e mapeamento integral em `/Documentacao/Matriz_Permissoes.md` com 58 permissões individuais divididas em 10 categorias operacionais.
* [x] **Centralização e Duplo Nível de Validação (Front & Back)**:
  - **Front-end**: Ocultação dinâmica de abas, menus e botões; barreira `hasTabPermission` para acessos diretos com renderização de cartão de "Acesso Restrito".
  - **Back-end**: Interceptação middleware `hasPermission` em todos os endpoints REST do servidor `server.ts` validando token ativo, status `ATIVO` e permissão específica ou `admin_acesso_total` / `*`.
* **Clonagem e Edição de Perfis**: Funcionalidade `perfis_clonar` para clonagem rápida de perfis e matriz interativa de 58 seleções de permissões por categoria.
* [x] **Inviolabilidade do Perfil Master**: Proteção contínua do perfil Master (`prof_master`), impedindo alteração ou exclusão por usuários comuns.
* [x] **Suíte de Testes RBAC**: Testes automatizados em `/tests/rbac_permissions.test.ts` validando a matriz de 58 permissões, clonagem de perfil, bloqueio de conta e proteção Master (8/8 assertions aprovadas).

---

## 📂 Visão Geral da Estrutura de Arquivos

```
├── /server.ts               # Servidor unificado Express + Rotas REST + Middleware Vite
├── /server/
│   ├── db.ts                # Repositório de banco persistente serializado em JSON
│   ├── engine.ts            # Motor matemático de cálculo trabalhista da CLT
│   └── mock.ts              # Gerador de marcações e dados de teste reais
├── /src/
│   ├── App.tsx              # Componente master React e gerenciador de estado do BI
│   ├── types.ts             # Dossiê de tipos e modelos de domínio
│   ├── index.css            # Folha global de estilos Tailwind CSS e tipografias
│   └── components/
│       ├── Sidebar.tsx            # Navegação do sistema
│       ├── FiltrosGerais.tsx      # Barra de BI e buscas no topo do painel
│       ├── DashboardExecutivo.tsx # KPIs e gráficos macro
│       ├── DashboardRH.tsx        # Detalhamento de Artigos da CLT
│       ├── DashboardGerencial.tsx # BI analítico cruzado de centros de custo e gestores
│       ├── Auditorias.tsx         # Tabela de registros auditados completa
│       ├── Relatorios.tsx         # Relatórios formatados com exportador CSV/PDF
│       ├── Configuracao.tsx       # Controle de chaves Dimep e coletas
│       ├── FirstAccessReset.tsx   # Troca obrigatória de senha inicial e setup de segurança
```
---

*A plataforma encontra-se compilada, testada e pronta para implantação.*
