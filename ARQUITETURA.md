# Arquitetura de Software e Padrões de Design - Auditoria Trabalhista

A plataforma Auditoria Trabalhista foi concebida com foco em **escalabilidade, isolamento de regras fiscais de negócio e facilidade de manutenção**, seguindo rigorosamente os padrões modernos de engenharia de software da comunidade sênior.

Este documento explica os pilares arquiteturais adotados na plataforma.

---

## 🏗️ Clean Architecture (Arquitetura Limpa)

A estrutura do projeto separa de maneira clara as responsabilidades técnicas, garantindo que o núcleo (coração jurídico e fiscal da empresa) não dependa de frameworks visuais ou detalhes de entrega de dados.

### Organização de Camadas:
1. **Camada de Domínio / Tipos (`/src/types.ts`)**: Define as entidades corporativas fundamentais (Empresas, Funcionários, Ocorrências, Marcações) livres de dependências externas.
2. **Motor de Cálculo / Regras de Negócio (`/server/engine.ts`)**: Isola os algoritmos de cálculo da CLT brasileira. Essa camada recebe dados brutos estruturados de marcação e cospe jornadas e violações, não sabendo de onde os dados vieram (se da API do Kairos, de um banco PostgreSQL ou de um mock seeder).
3. **Persistência / Repositório (`/server/db.ts`)**: Responsável por serializar e gerenciar as transações de leitura e escrita do banco de dados, permitindo mudar o driver de armazenamento (ex: de arquivo local para PostgreSQL em nuvem) sem alterar uma única linha do frontend ou do motor de cálculo.
4. **Camada de Framework / Controle (`/server.ts` & `/src/App.tsx`)**: O servidor Express expõe as APIs RESTful, enquanto o React renderiza os componentes visuais de BI.

---

## 💎 Aplicação dos Princípios SOLID

### 1. Single Responsibility Principle (Princípio de Responsabilidade Única)
* **`engine.ts`**: Tem como ÚNICA responsabilidade analisar listas de marcações e calcular se houve conformidade trabalhista com as regras fiscais.
* **`db.ts`**: Dedicado exclusivamente à gestão de estado persistente na base de dados.
* **`server.ts`**: Atua unicamente como roteador HTTP e mapeador de endpoints REST.

### 2. Open/Closed Principle (Princípio Aberto/Fechado)
O motor de auditoria em `engine.ts` está desenhado para permitir a expansão de novas auditorias CLT (ex: cálculo de insalubridade, horas extras aos sábados) simplesmente estendendo as constantes e funções do processador, sem necessidade de reescrever as rotinas de agrupamento de datas.

### 3. Liskov Substitution Principle (Princípio de Substituição de Liskov)
Os tipos definidos em `types.ts` são estritos e suas extensões (como `JornadaCalculada` ou `Ocorrencia`) respeitam os contratos originais, evitando asserções arriscadas de runtime.

### 4. Interface Segregation Principle (Princípio de Segregação de Interfaces)
As interfaces de BI em `/src/types.ts` são divididas em blocos enxutos e modulares. Interfaces como `DimepConfig` ou `BIFilters` agrupam apenas dados semanticamente relacionados.

### 5. Dependency Inversion Principle (Princípio de Inversão de Dependência)
O Express e o React dependem de contratos abstratos estruturados em `types.ts`, e não de implementações voláteis de rede.

---

## 🧱 Repository e Service Layer Pattern

A plataforma aplica o **Repository Pattern** através do singleton `dbInstance` em `/server/db.ts`. 

```typescript
// Exemplo de baixo acoplamento utilizando o Repository Pattern
export class Database {
  public getOcorrencias(): Ocorrencia[] { ... }
  public saveOcorrencias(ocorrencias: Ocorrencia[]): void { ... }
}
```

O isolamento oferecido por esses padrões garante que:
* **Testes unitários** possam ser escritos mockando a classe Database em menos de 10 linhas de código.
* **Mudanças na REST API do Dimep** (como novos parâmetros agregados no GetAppointmentsV2) sejam absorvidas sem furos de design de software na interface do usuário.

---

## 🛡️ Arquitetura de Segurança, Controle de Acesso e Autenticação

A Auditoria Trabalhista implementa uma infraestrutura rígida de segurança e controle de acesso projetada para ambientes multitenant e sistemas corporativos de auditoria:

### 1. Criação Automática do Usuário Master e Fluxo de Primeiro Acesso
Na primeira execução da plataforma em um novo ambiente (se o banco de dados `db.json` não possuir usuários), o sistema cria automaticamente o usuário com perfil **Master**:
* **Nome**: Renato Santos
* **E-mail**: `tecnicodimepdf@gmail.com`
* **Senha Inicial**: `Dimep@123`
* **Status**: Ativo

**Troca de Senha Obrigatória (Mecanismo "First Access Reset")**:
Ao efetuar o login pela primeira vez com a senha inicial, o frontend intercepta a sessão e impede o acesso aos módulos da aplicação, renderizando a tela de **Troca de Senha Obrigatória e Setup de Segurança**:
* O usuário Master deve fornecer a senha atual, uma nova senha forte (com comprimento >= 6 caracteres) e confirmá-la.
* O usuário deve selecionar e responder a **3 Perguntas de Segurança** distintas (hashes das respostas em minúsculas e sem espaços).
* O backend atualiza as credenciais utilizando o algoritmo de hash unidirecional **SHA-256** com salting e limpa a flag de primeiro acesso.
* Toda a operação é registrada com registro de IP do cliente, data, hora e operação de alteração obrigatória de senha no log de auditoria do banco de dados, assegurando a rastreabilidade absoluta de implantação.

### 2. Lockout Temporário e Proteção Contra Força Bruta
Para neutralizar ataques cibernéticos de dicionário ou força bruta no login:
* Cada tentativa inválida incrementa o contador `tentativasLogin` do usuário.
* Ao atingir **5 tentativas consecutivas**, a conta é bloqueada temporariamente (`status: 'BLOQUEADO'`) até que o horário `bloqueadoAte` expire (definido como 15 minutos adicionais no backend).
* Tentativas de login dentro desse período são sumariamente bloqueadas com retorno amigável e indicador de tempo restante para liberação da conta.

### 3. Recuperação de Senha por Respostas Criptografadas
O fluxo de recuperação de senha ("Esqueci minha senha") realiza um desafio-resposta estruturado de 3 etapas totalmente no backend:
* **Etapa 1**: Validação de e-mail e carregamento das 3 perguntas cadastradas.
* **Etapa 2**: Resposta simultânea dos 3 desafios de segurança. O backend compara as respostas aplicando hashing criptográfico irreversível (utilizando algoritmo idêntico ao das senhas).
* **Etapa 3**: Redefinição direta no banco persistente após homologação unânime de acerto no backend.

### 4. Controle de Acesso Baseado em Papéis (RBAC) e Enforcement do Perfil Master
A Auditoria Trabalhista emprega um modelo RBAC estrito com três níveis de permissão: `Master`, `Administrador` e `Comum`.
O perfil **Master** é a autoridade máxima do sistema e o único com poder físico para:
* Criar, editar, ativar/inativar ou deletar outros usuários.
* Exportar backups do ambiente ou importar/restaurar o arquivo persistente (`db.json`).
* Administradores comuns e perfis com restrição de CNPJ (Comum) têm visibilidade em modo de leitura dessas abas, sendo bloqueados fisicamente no backend com validações seguras e logs de auditoria detalhados.

### 5. Auditoria de Segurança Integrada (SIEM) e Log de Atividades
Todas as atividades sensíveis do sistema (como tentativas falhas, bloqueios temporários, redefinições de senha bem-sucedidas, ações administrativas e transações de backup) geram logs estruturados no banco de auditoria, alimentando as **Métricas de Segurança** visualizáveis pelo Master no painel administrativo.

---

---

## 🛡️ Resiliência da Interface e Renderização React

A Auditoria Trabalhista adota padrões de renderização defensiva para garantir a estabilidade contínua da interface do usuário em ambientes corporativos críticos:

### 1. Captura Global de Exceções (ErrorBoundary)
A árvore de componentes React é encapsulada por um `ErrorBoundary` de alta granularidade em `/src/components/ErrorBoundary.tsx`. Esse mecanismo captura falhas fatais de renderização em subcomponentes isolados (como gráficos que recebem dados malformados), apresentando uma interface de fallback amigável e permitindo o "Auto-Healing" do estado sem a necessidade de recarregar a página inteira (F5).

### 2. Validação Estrita de Children e Prevenção de Hydration Errors
Para evitar o erro crítico "Objects are not valid as a React child", a arquitetura impõe:
* **Sanitização de Outputs**: Todas as mensagens de erro dinâmicas capturadas de APIs ou do sistema operacional são convertidas explicitamente para strings (`String(err)`) antes da renderização em tags `<p>` ou `<span>`.
* **Proteção contra Event Leakage**: Handlers de eventos (`onClick`, `onChange`) são implementados preferencialmente como arrow functions para evitar a passagem acidental de objetos de eventos sintéticos do React para funções de estado ou renderizadores de texto.

## ⚖️ Conformidade com a LGPD e Privacidade por Design

A plataforma Auditoria Trabalhista foi desenvolvida em alinhamento estrito com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD):
1. **Anonimização de Massa de Dados**: A suíte de testes de regressão automatizada (`/tests/domingos_seguidos.test.ts`), geradores de mock e documentações utilizam dados estritamente sintéticos, genéricos ou mascarados (`COLABORADOR SINTÉTICO TESTE 01`, matrícula `1001`).
2. **Minimização de Dados e Read-Only Access**: As integrações com APIs externas operam em modo somente leitura (Read-Only), garantindo a integridade dos sistemas legados.
3. **Isolamento e Inviolabilidade**: O processamento analítico do motor de auditoria (`server/engine.ts`) executa em memória e gera saídas sanitizadas, impedindo a exposição indevida de dados pessoais.
