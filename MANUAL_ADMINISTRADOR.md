# Manual do Administrador — Auditoria Trabalhista

**Plataforma de Auditoria de Jornadas e Compliance Trabalhista (Auditoria Trabalhista)**  
**Versão:** v001  

---

## 1. Gestão do Painel Master

O **Painel Master** permite ao administrador gerenciar:
1. **Perfis de Acesso Granulares (RBAC v2.5)**: Criação, edição, clonagem (`perfis_clonar`) e inativação de perfis com atribuição granulada de até 58 permissões individuais divididas em 10 categorias operacionais.
2. **Usuários da Plataforma**: Cadastro, bloqueio, ativação, alteração de perfil e redefinição de senhas com hashing SHA-256 + Salt.
3. **Logs de Operação, Segurança e Auditoria**: Registro completo e imutável de alterações de perfil, atribuição de permissões, logins, exportações e acessos.
4. **Parâmetros de Conexão Kairos API**: Configuração de chaves API REST e CNPJ de integração.

---

## 2. Permissões Associadas a Relatórios PDF

Para que um usuário possa emitir relatórios PDF, seu perfil de acesso deve possuir as seguintes permissões ativas:
* `relatorios_visualizar`: Acesso à aba de Relatórios Exportáveis.
* `relatorios_gerar_pdf`: Autorização para emissão e download de relatórios em formato PDF.
* `auditoria_exportar`: Autorização para exportação na tela de Auditoria de Jornadas.

---

## 3. Logs de Auditoria de Exportação

Todas as ações de geração de PDF são registradas no arquivo de logs de operações (`op_logs.txt` / `logs.json`) e visíveis no menu **Logs de Operação**:
* **Tipo**: `Exportação de Relatório PDF`
* **Módulo**: `Relatórios` / `Auditoria`
* **Campos Armazenados**: Usuário emissor, tipo de relatório, período, total de registros exportados, data/hora.

---

## 5. Governança LGPD e Rastreabilidade da Auditoria de Domingos

1. **Adequação Integral à LGPD**:
   - A plataforma opera em total conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
   - Suítes de testes, documentação e logs padrão utilizam estritamente dados sintéticos e anônimos.
2. **Rastreabilidade Técnica da Auditoria (`DOMINGOS_SEGUIDOS`)**:
   - Quando o motor identifica marcações de ponto físicas sobrepostas a eventos administrativos (Cenário B), o sistema gera um log de auditoria com nível `INFO` registrando:
     - Data analisada;
     - Lançamento administrativo presente (Folga/DSR/Feriado);
     - Presença de batida física de ponto que prevaleceu sobre a informação administrativa.
   - O administrador pode consultar esses logs na aba de **Logs de Operação** para verificação de inconformidades operacionais de escala.

---

## 6. Procedimentos de Recuperação de Senha e Auto-Recuperação de Acesso Master

1. **Auto-Recuperação da Conta Master (`Auto-Healing`)**:
   - A conta Master do sistema (`tecnicodimepdf@gmail.com`) possui proteção automática contínua. Caso o acesso seja bloqueado por tentativas incorretas ou dados corrompidos, a reinicialização do servidor restabelecerá o status `ATIVO`, o perfil `Master` e as 3 perguntas de segurança padrão.
2. **Atribuição Automática de Perguntas de Segurança para Novos Usuários**:
   - Usuários cadastrados no Painel Administrativo sem preenchimento prévio das perguntas de segurança recebem automaticamente perguntas de verificação corporativa baseadas no e-mail, empresa e CNPJ no primeiro uso da funcionalidade "Esqueci minha senha".
3. **Bloqueios Temporários por Tentativas Incorretas**:
   - Excesso de 5 tentativas de login com senha incorreta gera bloqueio temporário de 15 minutos.
   - Excesso de 3 tentativas com respostas incorretas na recuperação gera bloqueio de 15 minutos.
   - Os bloqueios são registrados em tempo real na aba de **Logs de Operação e Segurança**.

