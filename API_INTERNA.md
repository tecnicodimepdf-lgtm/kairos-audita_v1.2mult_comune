# Documentação da API Interna (REST) - Auditoria Trabalhista

O servidor Express da plataforma Auditoria Trabalhista expõe uma API RESTful estruturada para alimentar os dashboards de BI, listar funcionários críticos, gerenciar chaves de conexão e monitorar logs de auditoria.

Este documento detalha os principais endpoints, parâmetros suportados e respostas JSON.

---

## 🔑 Autenticação e Segurança
Os dados são expostos localmente ou através de proxies reversos autenticados. As chaves de conexão com a API do Dimep Kairos são armazenadas sob criptografia no servidor, impedindo o vazamento de segredos para o navegador do usuário.

---

## 📊 Endpoints de Dashboard e BI Analítico

### 1. Obter KPIs Consolidados (Executive Stats)
Retorna os indicadores unificados de risco trabalhista e taxas de violação CLT, aplicando filtros cruzados dinâmicos.

* **URL**: `/api/dashboard/kpis`
* **Método**: `GET`
* **Parâmetros de Query (Opcionais)**:
  * `empresaId`: ID da filial.
  * `departamento`: Nome do departamento.
  * `centroCusto`: Nome do centro de custo.
  * `gestor`: Nome do supervisor.
  * `dataInicio`: Data limite inferior (`YYYY-MM-DD`).
  * `dataFim`: Data limite superior (`YYYY-MM-DD`).
* **Resposta de Sucesso (200 OK)**:
```json
{
  "totalFuncionarios": 45,
  "totalOcorrencias": 128,
  "funcionariosEmRisco": 12,
  "ocorrenciasCriticas": 34,
  "empresasMonitoradas": 3,
  "scoreGeralConformidade": 84.5,
  "taxaJornadasExcessivas": 18.2,
  "taxaDescansoInadequado": 12.4,
  "taxaIntervaloInsuficiente": 8.1,
  "taxaTrabalhoDomingo": 4.5,
  "taxaFaltasAtrasos": 2.3
}
```

### 2. Obter Dados de Gráficos e Distribuições
Retorna séries temporais e estatísticas agrupadas para renderização de gráficos do Recharts.

* **URL**: `/api/dashboard/charts`
* **Método**: `GET`
* **Parâmetros de Query**: *Mesmos filtros suportados por `/api/dashboard/kpis`.*
* **Resposta de Sucesso (200 OK)**:
```json
{
  "evolucaoTemporal": [
    { "data": "2026-06-01", "ocorrencias": 12 },
    { "data": "2026-06-02", "ocorrencias": 15 }
  ],
  "ocorrenciasPorDepto": [
    { "name": "Operações", "value": 45 },
    { "name": "Logística", "value": 30 }
  ],
  "ocorrenciasPorCC": [
    { "name": "CC-01 Filial RJ", "value": 55 },
    { "name": "CC-02 Filial SP", "value": 35 }
  ],
  "distribuicaoGravidade": [
    { "name": "CRITICO", "value": 15 },
    { "name": "ALTO", "value": 25 },
    { "name": "MEDIO", "value": 45 },
    { "name": "BAIXO", "value": 43 }
  ],
  "ocorrenciasPorTipo": [
    { "name": "JORNADA_EXCESSIVA", "value": 48 },
    { "name": "INTERJORNADA_INSUFICIENTE", "value": 32 }
  ],
  "rankingGestores": [
    { "name": "Gestor Marcos Silva", "value": 35 },
    { "name": "Gestor Ana Paula", "value": 24 }
  ]
}
```

---

## 📋 Endpoints de Ocorrências e Funcionários

### 3. Listar Ocorrências Auditadas (Paginação e Filtros)
Retorna a listagem analítica das irregularidades identificadas pelo motor de conformidade.

* **URL**: `/api/ocorrencias`
* **Método**: `GET`
* **Parâmetros de Query (Opcionais)**:
  * `page`: Número da página (padrão: `1`).
  * `limit`: Quantidade de itens por página (padrão: `15`).
  * `tipo`: Código da violação (ex: `JORNADA_EXCESSIVA`).
  * *Mais filtros cruzados de BI listados acima.*
* **Resposta de Sucesso (200 OK)**:
```json
{
  "data": [
    {
      "id": "oc_1",
      "funcionarioId": "func_1",
      "data": "2026-06-15",
      "tipo": "JORNADA_EXCESSIVA",
      "descricao": "Jornada diária trabalhada de 11h45 ultrapassou o limite legal de 10h diárias conforme estipula o Artigo 59 da CLT.",
      "gravidade": "ALTO",
      "valorConstatado": "11h45",
      "valorPermitido": "10h00"
    }
  ],
  "page": 1,
  "totalPages": 8,
  "total": 120
}
```

### 4. Listar Funcionários Cadastrados
* **URL**: `/api/funcionarios`
* **Método**: `GET`
* **Parâmetros de Query**: *Mesmos parâmetros de paginação e filtros de busca.*
* **Resposta (200 OK)**: Lista resumida contendo o score de risco individual, CPF, PIS e dados do contrato de trabalho.

---

## ⚙️ Endpoints de Conectividade e Sincronização

### 5. Consultar Configuração Atual
* **URL**: `/api/config`
* **Método**: `GET`
* **Resposta (200 OK)**: Retorna chaves mascaradas e as definições salvas de agendamento de coleta automática.

### 6. Gravar Configuração
* **URL**: `/api/config`
* **Método**: `POST`
* **Payload JSON**:
```json
{
  "host": "https://www.dimepkairos.com.br",
  "identifier": "12.345.678/0001-99",
  "key": "MINHA_REST_KEY_CONFIDENCIAL",
  "periodoPadrao": "last_30_days",
  "agendamentoSinc": "daily_00_00"
}
```

### 7. Testar Conexão com API Dimep
* **URL**: `/api/config/test`
* **Método**: `POST`
* **Payload JSON**: *Credenciais a serem testadas antes de salvar.*
* **Resposta (200 OK)**: `{ "success": true, "message": "Autenticação realizada com sucesso. Empresa autenticada: Dimep Brasil." }`

### 8. Disparar Sincronização Manual (Coleta incremental + Motor CLT)
* **URL**: `/api/sync`
* **Método**: `POST`
* **Resposta (200 OK)**: `{ "success": true, "message": "Coleta incremental finalizada com sucesso. 14 novos registros de ponto importados." }`
