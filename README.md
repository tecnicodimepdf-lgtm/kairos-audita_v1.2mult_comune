<<<<<<< HEAD
# kairos-autita-red
Projeto em que conecto kairos via API pararealização de auditorias de jornadas de ponto
=======
# Auditoria Trabalhista - Plataforma de Auditoria Trabalhista e Inteligência Operacional

**Auditoria Trabalhista** é uma plataforma corporativa web de alta performance desenvolvida para a auditoria de jornadas de trabalho, monitoramento operacional e mapeamento automatizado de riscos trabalhistas (CLT), com integração à API do **Dimep Kairos**.

O sistema coleta marcações brutas através da API REST do Kairos, reconstrói integralmente as folhas de ponto de forma incremental, aplica um robusto motor de auditoria de conformidade com a legislação brasileira e disponibiliza dashboards analíticos cruzados no estilo Business Intelligence (BI).

---

## 🌟 Recursos Principais

1. **Dashboard Executivo & BI**: KPIs de conformidade jurídica, score geral de risco, tendências de desvios por datas, gráficos interativos e inteligência artificial para categorização de riscos de colaboradores.
2. **Dashboard de Compliance RH (CLT)**: Auditorias focadas nas normas vigentes (Art. 59, 66 e 71 da CLT): jornadas > 10h, descanso de almoço inadequado, DSR violado (mais de 6 dias trabalhados sem folga) e interjornada inferior a 11h.
3. **BI Analítico Cruzado**: Filtros cruzados aplicados automaticamente ao clicar em qualquer elemento gráfico. A alteração de um filtro de departamento atualiza os KPIs e a distribuição de risco instantaneamente.
4. **Relatórios Fiscais e PDFs Corporativos (CLT)**: Emissão profissional de relatórios em PDF com cabeçalho institucional, CNPJ, resumo executivo de KPIs, parecer executivo automático, paginação e logs de auditoria para todos os eventos (Interjornada, Intrajornada, Domingos, 7 Dias, Excesso de Jornada, Banco de Horas, Consolidado por Funcionário/Departamento).
5. **Configurações e Sincronizador**: Painel para gerenciar conexões seguras com Dimep Kairos, agendamento de coletas incrementais automáticas, histórico detalhado de execuções e logs estruturados em tempo real com auto-scroll inteligente e controle de pausa. Agora com **Controle de Sincronização ao Entrar** configurável por perfil.
6. **Resiliência e Estabilidade**: Proteção global com `ErrorBoundary` e validação rigorosa de renderização para evitar falhas de interface ("White Screen"), com auto-healing de estado.
7. **Padronização Visual "Verde Institucional"**: Interface corporativa modernizada com paleta de cores verde institucional, sidebar de alto contraste e formulários padronizados para máxima produtividade.

---

## 🏗️ Estrutura de Documentação do Projeto

Para garantir manutenibilidade e governança de software, a plataforma conta com uma suíte de documentos técnicos:

* **[INSTALACAO.md](./INSTALACAO.md)**: Manual detalhado para instalação e execução local ou em containers Docker.
* **[MANUAL_AUDITORIA.md](./MANUAL_AUDITORIA.md)**: Manual completo dos relatórios PDF do módulo de auditoria de jornadas (CLT).
* **[MANUAL_ADMINISTRADOR.md](./MANUAL_ADMINISTRADOR.md)**: Guia do administrador para gestão de perfis, usuários e auditoria de exportações.
* **[DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md)**: Especificação da engine de PDF, testes de regressão e endpoints.
* **[MANUAL_SEGURANCA.md](./MANUAL_SEGURANCA.md)**: Diretrizes de hashing com salt, proteção de credenciais, respostas de segurança e matriz RBAC v2.5.
* **[Documentacao/Diagnostico_Permissoes.md](./Documentacao/Diagnostico_Permissoes.md)**: Diagnóstico completo de autorização, análise de vulnerabilidades e arquitetura de permissões.
* **[Documentacao/Matriz_Permissoes.md](./Documentacao/Matriz_Permissoes.md)**: Inventário completo de 58 permissões granulares por módulo, tela, ação e relatório.
* **[MANUAL_BACKUP_RECUPERACAO.md](./MANUAL_BACKUP_RECUPERACAO.md)**: Procedimentos de backup relacional, gravação atômica em disco e rotinas de restauração.
* **[ARQUITETURA.md](./ARQUITETURA.md)**: Padrões de design de software (Clean Architecture, SOLID, Repository e Service Layer).
* **[BANCO_DE_DADOS.md](./BANCO_DE_DADOS.md)**: Modelagem relacional e integridade dos esquemas históricos.
* **[API_INTERNA.md](./API_INTERNA.md)**: Documentação dos endpoints REST do servidor Express da plataforma.
* **[MANUAL_USUARIO.md](./MANUAL_USUARIO.md)**: Guia operacional do usuário final e controle de desvios.
* **[ROADMAP.md](./ROADMAP.md)**: Próximos passos planejados de evolução do produto.
* **[CHANGELOG.md](./CHANGELOG.md)**: Histórico de lançamentos e versões.
* **[projeto.md](./projeto.md)**: Registro contínuo de status, funcionalidades entregues e marcos técnicos.

---

## 🛡️ Controle de Acesso e Segurança (Usuário Master)

O **Auditoria Trabalhista** possui uma arquitetura de segurança integrada com controle de tentativas de força bruta e criação automática de credenciais:
* **Usuário Master Automático**: Criado automaticamente na primeira inicialização caso a base de usuários esteja vazia, com os dados:
  * **E-mail**: `tecnicodimepdf@gmail.com`
  * **Nome**: Renato Santos
  * **Senha Inicial**: `Suporte@dimep`
* **Troca de Senha Obrigatória**: No primeiro login do usuário Master, o sistema impede a navegação e exige a alteração obrigatória da senha inicial e o cadastro de **3 Perguntas de Segurança** distintas.
* **Segurança Criptográfica**: Senhas e respostas de segurança são criptografadas com hash seguro **SHA-256** unidirecional e nunca são expostas em logs, arquivos de backup ou transferências.
* **Prevenção de Ataques**: Bloqueio temporário de 15 minutos para contas após **5 tentativas consecutivas** de login malsucedidas.

---

## 💻 Pilha Tecnológica Adotada

### Backend (Processamento e APIs)
* **TypeScript & Node.js**: Motor principal compilado para ESM/CJS de alta performance.
* **Express**: Servidor HTTP REST e entrega estável de ativos estáticos.
* **Calculation Engine**: Motor analítico proprietário para cálculos fiscais e detecção de fraudes.
* **File-Based Database**: Banco relacional relacional estruturado, indexado e persistido localmente para uso corporativo instantâneo.

### Frontend (Interface do Usuário)
* **React 19 & TypeScript**: Componentização modular e tipagem estrita para segurança em tempo de compilação.
* **Tailwind CSS & Vite**: Compilação veloz e layout ultra-moderno baseado nos conceitos de design da Monday.com e Metabase.
* **Recharts & Lucide React**: Biblioteca de vetores interativos e gráficos reativos para BI.

---

*Desenvolvido em conformidade com as diretrizes de governança trabalhista e proteção de dados no Brasil.*
<<<<<<< HEAD
>>>>>>> fd1daab (Versão corrigida e homologada 100 pode cento do projeto)
=======
# auditoria-kairos-red
>>>>>>> 006021d (first commit)
