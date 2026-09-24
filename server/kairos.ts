/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Database } from './db';
import { DimepConfig, Empresa, Funcionario, Marcacao } from '../src/types';
import { processarAuditoria, calcularScoresFuncionarios } from './engine';
import { runPythonAudit } from './pythonBridge';
import { writeOpLog } from './logger';

// Remove caracteres especiais de CNPJ, CPF, NIF, etc.
export function cleanIdentifier(identifier: string): string {
  if (!identifier) return '';
  return identifier.replace(/[^a-zA-Z0-9]/g, '');
}

// Valida URLs de integração externa impedindo SSRF e restringindo domínios a uma allowlist autorizada
export function validateExternalUrl(targetUrl: string): void {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new Error(`URL de integração externa inválida: ${targetUrl}`);
  }

  // 1. Exigir protocolo HTTP ou HTTPS
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Protocolo de URL não permitido: ${parsedUrl.protocol}`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // 2. Bloquear IPs locais, loopback e endereços privados (Proteção contra SSRF)
  const isLocalOrPrivate = 
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.startsWith('169.254.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

  if (isLocalOrPrivate) {
    throw new Error(`Acesso a endereços locais/privados (SSRF) é estritamente proibido: ${hostname}`);
  }

  // 3. Allowlist de domínios permitidos
  const customAllowlist = process.env.ALLOWED_KAIROS_HOSTS
    ? process.env.ALLOWED_KAIROS_HOSTS.split(',').map(h => h.trim().toLowerCase())
    : [];

  const isDefaultAllowed = 
    hostname.endsWith('.dimep.com.br') ||
    hostname === 'dimep.com.br' ||
    hostname.endsWith('.dimepkairos.com.br') ||
    hostname === 'dimepkairos.com.br' ||
    hostname.endsWith('.kairosweb.com.br') ||
    hostname === 'kairosweb.com.br';

  const isCustomAllowed = customAllowlist.some(allowed => hostname === allowed || hostname.endsWith('.' + allowed));

  if (!isDefaultAllowed && !isCustomAllowed) {
    throw new Error(`Domínio de integração não autorizado na allowlist: ${hostname}`);
  }
}

// Garante que o host tenha o protocolo https://
export function formatHost(host: string): string {
  let formatted = host.trim();
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = 'https://' + formatted;
  }
  // Remove barra final se houver
  if (formatted.endsWith('/')) {
    formatted = formatted.slice(0, -1);
  }
  return formatted;
}

// Formata data como dd-MM-aaaa conforme exigido pelo Dimep Kairos
function formatDimepDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Formata data interna para YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().substring(0, 10);
}

// Formata hora interna para HH:MM:SS
function formatTime(hrs: number, mins: number, secs = 0): string {
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export interface KairosEmployeeRaw {
  Id?: number;
  id?: number;
  Matricula?: number;
  matricula?: number;
  Cracha?: number;
  cracha?: number;
  Nome?: string;
  nome?: string;
  Cpf?: string;
  cpf?: string;
  CPF?: string;
  CodigoPis?: string;
  pis?: string;
  Cargo?: { Descricao?: string; codigo?: number } | string;
  cargo?: { descricao?: string } | string;
  Estrutura?: { Descricao?: string; CentroCusto?: string } | string;
  estrutura?: { descricao?: string; centroCusto?: string } | string;
  Gestor?: string;
  gestor?: string;
  CompanyName?: string;
  CompanyNameReal?: string;
  PeopleCompanyName?: string;

  // Campos de Situação e Status do Kairos
  Ativo?: boolean | string | number;
  ativo?: boolean | string | number;
  Demitido?: boolean | string | number;
  demitido?: boolean | string | number;
  Excluido?: boolean | string | number;
  excluido?: boolean | string | number;
  Afastado?: boolean | string | number;
  afastado?: boolean | string | number;
  Ferias?: boolean | string | number;
  ferias?: boolean | string | number;
  EmFerias?: boolean | string | number;
  emFerias?: boolean | string | number;
  Inativo?: boolean | string | number;
  inativo?: boolean | string | number;
  Bloqueado?: boolean | string | number;
  bloqueado?: boolean | string | number;
  Suspenso?: boolean | string | number;
  suspenso?: boolean | string | number;
  Status?: string | number;
  statusField?: string | number;
  Situacao?: string | number;
  situacao?: string | number;
  DataDemissao?: string;
  dataDemissao?: string;
  PessoaStatus?: string | number;
}

export interface KairosAppointmentRaw {
  Matricula?: number;
  Ano?: number;
  Mes?: number;
  Dia?: number;
  Hora?: number;
  Minuto?: number;
  TipoMarcacao?: string;
  PIS?: string;
  PessoaID?: number;
  CPF?: string;
}

/**
 * Realiza chamadas para a API REST do Dimep Kairos
 */
async function callKairosApi(
  endpoint: string,
  config: { host: string; identifier: string; key: string },
  body: any,
  maxRetries = 3
): Promise<any> {
  const host = formatHost(config.host);
  const cleanId = cleanIdentifier(config.identifier);
  const url = `${host}${endpoint}`;

  validateExternalUrl(url);

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      if (attempt > 1) {
        console.log(`[Kairos API] Tentativa ${attempt}/${maxRetries + 1} para POST ${url}`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      } else {
        console.log(`[Kairos API] Chamando POST ${url} com identifier=${cleanId}`);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'identifier': cleanId,
          'Key': config.key,
          'Connection': 'close'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isTransientStatus = [502, 503, 504, 429].includes(response.status);
        if (isTransientStatus && attempt <= maxRetries) {
          console.warn(`[Kairos API] Erro transiente HTTP ${response.status}. Tentando novamente...`);
          continue;
        }
        throw new Error(`Erro na API Dimep Kairos (HTTP ${response.status}): ${errorText || response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      const isNetworkError = err?.name === 'TypeError' || 
                             errMsg.includes('fetch failed') || 
                             errMsg.includes('EPIPE') || 
                             errMsg.includes('ECONNRESET') || 
                             errMsg.includes('ETIMEDOUT') || 
                             errMsg.includes('socket hang up') || 
                             err?.code === 'EPIPE' || 
                             err?.code === 'ECONNRESET';

      if (isNetworkError && attempt <= maxRetries) {
        console.warn(`[Kairos API] Falha temporária de rede na tentativa ${attempt}/${maxRetries + 1}: ${errMsg}. Tentando novamente...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error(`Erro de comunicação com a API Dimep Kairos após ${maxRetries + 1} tentativas.`);
}

/**
 * Testa a conexão e retorna os dados da empresa se houver sucesso
 */
export async function testConnection(
  host: string,
  identifier: string,
  key: string
): Promise<{ success: boolean; message: string; companyName?: string }> {
  try {
    const cleanId = cleanIdentifier(identifier);
    writeOpLog('INICIO', 'Teste de Conexão', `Iniciando teste de conexão ao host ${host} com CNPJ/Identificador ${identifier}`, 'Esta operação valida as credenciais de autenticação (Rest API Key e Identificador) realizando uma chamada de teste.');

    // Buscamos funcionários na página 1 como teste de validação e para extrair o nome da empresa
    const body = { Pagina: 1 };
    let result: any;
    try {
      result = await callKairosApi('/RestServiceApi/People/SearchPeople', { host, identifier, key }, body);
    } catch (apiErr: any) {
      writeOpLog('FALHA', 'Teste de Conexão', `Falha de rede ou credenciais inválidas: ${apiErr.message}`, 'Verificar se a chave da API do Kairos está correta ou se o CNPJ/CPF está cadastrado na base correspondente.');
      throw apiErr;
    }
    
    let count = 0;
    let sampleCompanyName = `Dimep Cliente Real - CNPJ/CPF: ${identifier}`;
    let rawList: any[] = [];
    
    if (Array.isArray(result)) {
      rawList = result;
    } else if (result && Array.isArray(result.Obj)) {
      rawList = result.Obj;
    }
    
    count = rawList.length;
    if (rawList.length > 0) {
      const first = rawList[0];
      sampleCompanyName = first.CompanyName || first.PeopleCompanyName || first.CompanyNameReal || first.nome || sampleCompanyName;
    } else {
      // Se não há funcionários, tenta buscar dados da empresa pelo GetCompany como fallback
      try {
        const compResult = await callKairosApi('/RestServiceApi/Company/GetCompany', { host, identifier, key }, {
          Id: 0,
          Code: 0,
          ResponseType: 'AS400V1'
        });
        if (compResult) {
          const extName = compResult.RazaoSocial || compResult.NomeFantasia || compResult.Nome || 
                          (compResult.Obj && (compResult.Obj.RazaoSocial || compResult.Obj.NomeFantasia || compResult.Obj.Nome));
          if (extName) {
            sampleCompanyName = extName;
          }
        }
      } catch (e) {
        // ignora
      }
    }

    writeOpLog('SUCESSO', 'Teste de Conexão', `Conexão autenticada para a empresa "${sampleCompanyName}". Total de funcionários na página 1: ${count}`, 'Autenticação validada com sucesso! Mesmo com zero funcionários ativos, a API respondeu normalmente de forma autorizada.');

    return {
      success: true,
      message: `Conexão efetuada com sucesso! Empresa autenticada: ${sampleCompanyName}. Foram encontrados ${count} funcionários ativos na base de dados.`,
      companyName: sampleCompanyName
    };
  } catch (err: any) {
    console.error('[Kairos API] Erro ao testar conexão:', err);
    writeOpLog('FALHA', 'Teste de Conexão', `Erro ao testar conexão: ${err.message || err}`, 'Verificar se o host está acessível, se o token de API não expirou, ou se as regras de firewall do servidor do cliente barram a chamada.');
    return {
      success: false,
      message: err.message || 'Erro inesperado ao conectar com a API do Dimep Kairos.'
    };
  }
}

/**
 * Classificação confiável e baseada estritamente nos dados oficiais retornados pela API do Kairos.
 * Documentação da Lógica de Status:
 * O status de um colaborador na API do Kairos é verificado através dos campos de controle:
 * - Ativo / ativo: Indica se a pessoa está ativa no sistema.
 * - Demitido / demitido: Indica que houve o desligamento da pessoa.
 * - Excluido / excluido: Indica que o colaborador foi deletado.
 * - Afastado / afastado: Indica se o colaborador está temporariamente afastado por motivos de saúde ou licença.
 * - Ferias / ferias / EmFerias / emFerias: Indica se o colaborador está em período de férias.
 * - Situacao / situacao: Indica numericamente (1 = Ativo, 2 = Inativo, 3 = Excluido, 4 = Afastado, 5 = Ferias) ou textualmente o estado atual.
 */
export function obterSituacaoDoFuncionario(emp: KairosEmployeeRaw): {
  status: 'ATIVO' | 'DESLIGADO';
  situacao: 'ATIVO' | 'INATIVO' | 'EXCLUIDO' | 'DESLIGADO' | 'AFASTADO' | 'FERIAS';
} {
  const extrairBooleano = (val: any): boolean => {
    if (val === undefined || val === null) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    const str = String(val).toLowerCase().trim();
    return str === 'true' || str === '1' || str === 's' || str === 'sim' || str === 'y' || str === 'yes';
  };

  // Se as flags Ativo/ativo não estiverem presentes de forma alguma (caso real do Dimep Kairos API)
  if (emp.Ativo === undefined && emp.ativo === undefined) {
    const demDate = emp.DataDemissao || emp.dataDemissao || '';
    const temDemissaoReal = demDate && !demDate.startsWith('01/01/1753') && !demDate.startsWith('1753-01-01');
    if (temDemissaoReal) {
      return { status: 'DESLIGADO', situacao: 'DESLIGADO' };
    } else {
      // Se tiver situação ou flags adicionais de férias ou afastamento
      let situacaoTexto = '';
      if (emp.Situacao !== undefined && emp.Situacao !== null) {
        situacaoTexto = String(emp.Situacao).toUpperCase().trim();
      } else if (emp.situacao !== undefined && emp.situacao !== null) {
        situacaoTexto = String(emp.situacao).toUpperCase().trim();
      }
      
      const pStatus = String(emp.PessoaStatus || '').trim();
      
      if (pStatus === '105' || situacaoTexto.includes('FERIA') || situacaoTexto === '5') {
        return { status: 'ATIVO', situacao: 'FERIAS' };
      }
      if (pStatus.startsWith('106') || situacaoTexto.includes('AFAST') || situacaoTexto === '4') {
        return { status: 'ATIVO', situacao: 'AFASTADO' };
      }
      return { status: 'ATIVO', situacao: 'ATIVO' };
    }
  }

  // Extração de flags oficiais do Kairos
  const isAtivo = extrairBooleano(emp.Ativo !== undefined ? emp.Ativo : emp.ativo);
  const isDemitido = extrairBooleano(emp.Demitido !== undefined ? emp.Demitido : emp.demitido);
  const isExcluido = extrairBooleano(emp.Excluido !== undefined ? emp.Excluido : emp.excluido);
  const isAfastado = extrairBooleano(emp.Afastado !== undefined ? emp.Afastado : emp.afastado);
  const isFerias = extrairBooleano(
    emp.Ferias !== undefined ? emp.Ferias : 
    (emp.ferias !== undefined ? emp.ferias : 
    (emp.EmFerias !== undefined ? emp.EmFerias : emp.emFerias))
  );

  const isInativo = extrairBooleano(emp.Inativo !== undefined ? emp.Inativo : emp.inativo);
  const isBloqueado = extrairBooleano(emp.Bloqueado !== undefined ? emp.Bloqueado : emp.bloqueado);
  const isSuspenso = extrairBooleano(emp.Suspenso !== undefined ? emp.Suspenso : emp.suspenso);

  // Verifica o campo textual ou numérico de situação
  let situacaoTexto = '';
  if (emp.Situacao !== undefined && emp.Situacao !== null) {
    situacaoTexto = String(emp.Situacao).toUpperCase().trim();
  } else if (emp.situacao !== undefined && emp.situacao !== null) {
    situacaoTexto = String(emp.situacao).toUpperCase().trim();
  }

  // Se houver algum flag de exclusão ou situação de excluído
  if (isExcluido || situacaoTexto.includes('EXCLU') || situacaoTexto === '3') {
    return { status: 'DESLIGADO', situacao: 'EXCLUIDO' };
  }

  // Se houver algum flag de demissão, desligado ou inativo
  if (isDemitido || situacaoTexto.includes('DEMIT') || situacaoTexto.includes('DESLIG') || situacaoTexto === '2' || situacaoTexto.includes('INATIVO') || isInativo) {
    return { status: 'DESLIGADO', situacao: 'DESLIGADO' };
  }

  // Se houver flag de bloqueio ou suspensão
  if (isBloqueado || isSuspenso || situacaoTexto.includes('BLOQUE') || situacaoTexto.includes('SUSPEN')) {
    return { status: 'DESLIGADO', situacao: 'INATIVO' };
  }

  // Se o flag isAtivo for falso de forma inequívoca
  if (emp.Ativo !== undefined || emp.ativo !== undefined) {
    if (!isAtivo) {
      if (isAfastado || situacaoTexto.includes('AFAST') || situacaoTexto === '4') {
        return { status: 'DESLIGADO', situacao: 'AFASTADO' }; // Afastado permanente/inativo
      }
      return { status: 'DESLIGADO', situacao: 'INATIVO' };
    }
  }

  // Se a situação textual ou flags indicarem férias/afastamento enquanto ativo
  if (isFerias || situacaoTexto.includes('FERIA') || situacaoTexto === '5') {
    return { status: 'ATIVO', situacao: 'FERIAS' };
  }

  if (isAfastado || situacaoTexto.includes('AFAST') || situacaoTexto === '4') {
    return { status: 'ATIVO', situacao: 'AFASTADO' }; // Afastamento ativo/temporário
  }

  if (isAtivo || situacaoTexto.includes('ATIV') || situacaoTexto === '1') {
    return { status: 'ATIVO', situacao: 'ATIVO' };
  }

  // Fallback caso seja inativo sem flag de demissão
  return { status: 'DESLIGADO', situacao: 'INATIVO' };
}

/**
 * Busca funcionários reais via API do Dimep Kairos com paginação dinâmica automática
 */
export async function fetchEmployees(
  host: string,
  identifier: string,
  key: string
): Promise<KairosEmployeeRaw[]> {
  let allEmployees: KairosEmployeeRaw[] = [];
  let page = 1;
  let hasMore = true;
  const vistos = new Set<string>();

  console.log(`[Kairos API] Iniciando carregamento completo de funcionários via SearchPeople...`);

  while (hasMore) {
    try {
      const body = { Pagina: page };
      const result = await callKairosApi('/RestServiceApi/People/SearchPeople', { host, identifier, key }, body);
      
      let pageEmployees: KairosEmployeeRaw[] = [];
      if (Array.isArray(result)) {
        pageEmployees = result;
      } else if (result && Array.isArray(result.Obj)) {
        pageEmployees = result.Obj;
      }

      if (pageEmployees.length === 0) {
        console.log(`[Kairos API] Página ${page} retornou vazia. Encerrando paginação.`);
        hasMore = false;
        break;
      }

      // Evita loop infinito caso a API ignore o parâmetro "Pagina" e retorne repetidamente o mesmo conjunto
      let hasNewId = false;
      for (const emp of pageEmployees) {
        const idVal = emp.Id !== undefined ? emp.Id : emp.id;
        const keyVal = idVal !== undefined ? String(idVal) : `${emp.Nome || emp.nome}_${emp.CPF || emp.cpf || emp.Cpf || ''}`;
        if (!vistos.has(keyVal)) {
          vistos.add(keyVal);
          hasNewId = true;
        }
      }

      if (!hasNewId) {
        console.log(`[Kairos API] Nenhum colaborador novo na página ${page}. Proteção de loop infinito ativada. Encerrando paginação.`);
        hasMore = false;
        break;
      }

      allEmployees = allEmployees.concat(pageEmployees);
      console.log(`[Kairos API] Página ${page} importada: +${pageEmployees.length} registros. Total acumulado: ${allEmployees.length}`);
      
      page++;
    } catch (err: any) {
      console.error(`[Kairos API] Erro de comunicação na página ${page}:`, err);
      if (allEmployees.length > 0) {
        console.warn(`[Kairos API] Conexão interrompida na página ${page}, mas foram obtidos ${allEmployees.length} colaboradores das páginas anteriores. Concluindo importação com colaboradores já carregados.`);
        writeOpLog('INFO', 'Sincronização', `Importação de colaboradores finalizada na página ${page} devido a oscilação de rede: ${err.message || err}. Mantidos ${allEmployees.length} colaboradores importados.`, 'Foram salvas as páginas anteriores com sucesso.');
        hasMore = false;
        break;
      }
      throw err;
    }
  }

  console.log(`[Kairos API] Carregamento concluído! Total de funcionários obtidos: ${allEmployees.length}`);
  return allEmployees;
}

/**
 * Busca marcações de ponto do período especificado
 */
export async function fetchAppointments(
  host: string,
  identifier: string,
  key: string,
  startDate: Date,
  endDate: Date
): Promise<KairosAppointmentRaw[]> {
  try {
    // Busca marcações usando GetAppointmentsV2
    const body = {
      IdsPessoa: [0], // 0 traz todos os funcionários
      DataInicio: formatDimepDate(startDate),
      DataFim: formatDimepDate(endDate),
      CalculoNaoAtualizado: "true",
      ResponseType: "AS400V1"
    };

    const result = await callKairosApi('/RestServiceApi/Appointment/GetAppointmentsV2', { host, identifier, key }, body);
    
    if (Array.isArray(result)) {
      return result;
    } else if (result && Array.isArray(result.Obj)) {
      return result.Obj;
    }
    return [];
  } catch (err) {
    console.error('[Kairos API] Erro ao buscar batidas de ponto:', err);
    throw err;
  }
}

/**
 * Realiza sincronização de fato com a conta Kairos conectada
 */
export async function syncRealDimepKairos(
  db: Database,
  config: DimepConfig
): Promise<{ success: boolean; message: string; count: number }> {
  const host = config.host;
  const identifier = config.identifier;
  const key = config.key;

  if (!host || !identifier || !key) {
    writeOpLog('FALHA', 'Sincronização', 'Configuração incompleta do Dimep Kairos (Host, Identificador ou Chave em branco).', 'Campos de configuração do cliente estão vazios no painel.');
    throw new Error('Configuração incompleta do Dimep Kairos (Host, Identificador ou Chave em branco).');
  }

  writeOpLog('INICIO', 'Sincronização', `Iniciando sincronização real dos dados com CNPJ/CPF ${identifier}`, 'A sincronização irá limpar a base demo, carregar os colaboradores ativos e importar as marcações dos últimos 30 dias.');

  // 1. Limpa dados de demonstração anteriores
  db.clearAllData();

  // 2. Busca Funcionários
  let rawEmployees: KairosEmployeeRaw[] = [];
  try {
    rawEmployees = await fetchEmployees(host, identifier, key);
  } catch (empErr: any) {
    writeOpLog('FALHA', 'Sincronização', `Erro ao buscar funcionários na API: ${empErr.message || empErr}`, 'Falha de comunicação ou autenticação ao invocar o método People_SearchPeople.');
    throw empErr;
  }

  // Define um nome padrão de empresa
  let razaoSocial = `Dimep Cliente Real - CNPJ/CPF: ${identifier}`;
  let nomeFantasia = 'Dimep Cliente Real';
  
  if (rawEmployees.length === 0) {
    writeOpLog('INFO', 'Sincronização', 'Aviso: Nenhum funcionário ativo foi retornado pela API do Dimep Kairos.', 'A base de dados da empresa conectada está vazia ou todos os colaboradores estão inativos no momento. A sincronização continuará para registrar a empresa autenticada.');
    
    // Tenta obter o nome da empresa como fallback
    try {
      const compResult = await callKairosApi('/RestServiceApi/Company/GetCompany', { host, identifier, key }, {
        Id: 0,
        Code: 0,
        ResponseType: 'AS400V1'
      });
      if (compResult) {
        const extName = compResult.RazaoSocial || compResult.NomeFantasia || compResult.Nome || 
                        (compResult.Obj && (compResult.Obj.RazaoSocial || compResult.Obj.NomeFantasia || compResult.Obj.Nome));
        if (extName) {
          razaoSocial = extName.trim();
          nomeFantasia = extName.trim();
        }
      }
    } catch (e) {
      // ignore
    }
  } else {
    // Extrai o nome da empresa diretamente do primeiro funcionário retornado pela API
    const sampleEmp = rawEmployees[0];
    if (sampleEmp) {
      const extractedName = sampleEmp.CompanyName || sampleEmp.PeopleCompanyName || sampleEmp.CompanyNameReal || '';
      if (extractedName && extractedName.trim() !== '') {
        razaoSocial = extractedName.trim();
        nomeFantasia = extractedName.trim();
      }
    }
  }

  // Cria e salva empresa conectada
  const empresaId = 'emp_real_1';
  const empresas: Empresa[] = [
    {
      id: empresaId,
      cnpj: cleanIdentifier(identifier),
      razaoSocial,
      nomeFantasia
    }
  ];
  db.saveEmpresas(empresas);

  // Mapeia para o formato de Funcionário do nosso banco
  const defaultDepto = 'Operacional';
  const defaultCC = 'Centro de Custo Geral';
  const defaultGestor = 'Gestor Geral';
  const defaultCargo = 'Colaborador';

  const funcionarios: Funcionario[] = rawEmployees.map((emp, idx) => {
    const id = emp.Id ? String(emp.Id) : `func_real_${idx + 1}`;
    
    // Resolve cargo
    let cargo = defaultCargo;
    if (emp.Cargo) {
      cargo = typeof emp.Cargo === 'object' ? emp.Cargo.Descricao || defaultCargo : emp.Cargo;
    } else if (emp.cargo) {
      cargo = typeof emp.cargo === 'object' ? emp.cargo.descricao || defaultCargo : emp.cargo;
    }

    // Resolve departamento e centro de custo
    let departamento = defaultDepto;
    let centroCusto = defaultCC;
    if (emp.Estrutura) {
      if (typeof emp.Estrutura === 'object') {
        departamento = emp.Estrutura.Descricao || defaultDepto;
        centroCusto = emp.Estrutura.CentroCusto || defaultCC;
      } else {
        departamento = emp.Estrutura;
      }
    } else if (emp.estrutura) {
      if (typeof emp.estrutura === 'object') {
        departamento = emp.estrutura.descricao || defaultDepto;
        centroCusto = emp.estrutura.centroCusto || defaultCC;
      } else {
        departamento = emp.estrutura;
      }
    }

    // Resolve gestor
    const gestor = emp.Gestor || emp.gestor || defaultGestor;

    // Resolve matricula e crachá
    const mat = emp.Matricula || emp.matricula || emp.Cracha || emp.cracha || (idx + 1001);
    const cracha = emp.Cracha || emp.cracha ? String(emp.Cracha || emp.cracha) : '';

    // Classificação confiável da situação da pessoa baseada nas regras de status oficiais do Kairos
    const { status, situacao } = obterSituacaoDoFuncionario(emp);

    return {
      id,
      nome: emp.Nome || emp.nome || `Funcionário ${id}`,
      cpf: emp.CPF || emp.Cpf || emp.cpf || '',
      pis: emp.CodigoPis || emp.pis || '',
      cargo,
      departamento,
      centroCusto,
      gestor,
      empresaId,
      grauRisco: 'BAIXO',
      scoreRisco: 100,
      status,
      situacao,
      cracha,
      matricula: String(mat)
    };
  });

  db.saveFuncionarios(funcionarios);

  // 3. Define intervalo de sincronização de batidas (período contínuo de 32 dias)
  const dataFim = new Date();
  const dataInicio = new Date();
  dataInicio.setDate(dataFim.getDate() - 32);
  const quantidadeDiasProcessados = 32;

  const dataInicialFmt = formatDate(dataInicio);
  const dataFinalFmt = formatDate(dataFim);

  console.log(`[Kairos Sync] PERÍODO: ${quantidadeDiasProcessados} dias | DATA INICIAL: ${dataInicialFmt} | DATA FINAL: ${dataFinalFmt}`);

  // Busca Batidas de Ponto para todas as pessoas da empresa ([0])
  const rawAppointments = await fetchAppointments(host, identifier, key, dataInicio, dataFim);

  // Mapeia batidas para nosso formato Marcacao
  const marcacoes: Marcacao[] = [];
  
  // Agrupa as batidas por funcionário e data para poder atribuir ENTRADA/SAIDA alternadas caso a API não especifique
  const batidasPorFuncData: Record<string, KairosAppointmentRaw[]> = {};

  rawAppointments.forEach((app) => {
    // Encontra o funcionário correspondente de forma estrita para evitar mesclagem de contratos (lojas diferentes)
    let matchingFunc = funcionarios.find((f) => app.PessoaID && String(app.PessoaID) === f.id);
    
    if (!matchingFunc) {
      matchingFunc = funcionarios.find((f) => app.Matricula && String(app.Matricula) === f.id.replace('func_real_', ''));
    }
    
    if (!matchingFunc) {
      // Como último recurso, busca por PIS ou CPF. 
      // Se houver mais de um (ex: pessoa foi transferida e tem 2 matrículas), prioriza a ATIVA para não jogar tudo na desligada.
      const matches = funcionarios.filter((f) => 
        (app.PIS && String(app.PIS) === f.pis) ||
        (app.CPF && cleanIdentifier(app.CPF) === cleanIdentifier(f.cpf))
      );
      if (matches.length > 0) {
        matchingFunc = matches.find((m) => m.status === 'ATIVO') || matches[0];
      }
    }

    if (matchingFunc) {
      const dateStr = app.Ano && app.Mes && app.Dia
        ? `${app.Ano}-${String(app.Mes).padStart(2, '0')}-${String(app.Dia).padStart(2, '0')}`
        : null;

      if (dateStr) {
        const key = `${matchingFunc.id}_${dateStr}`;
        if (!batidasPorFuncData[key]) {
          batidasPorFuncData[key] = [];
        }
        batidasPorFuncData[key].push(app);
      }
    }
  });

  let marcacaoIdCounter = 1;

  // Processa as batidas de cada dia por funcionário ordenadamente
  Object.keys(batidasPorFuncData).forEach((key) => {
    const parts = key.split('_');
    const funcionarioId = parts[0];
    const data = parts[1];
    const items = batidasPorFuncData[key];

    // Ordena as batidas cronologicamente por hora e minuto
    items.sort((a, b) => {
      const aMin = (a.Hora || 0) * 60 + (a.Minuto || 0);
      const bMin = (b.Hora || 0) * 60 + (b.Minuto || 0);
      return aMin - bMin;
    });

    items.forEach((item, idx) => {
      const horaStr = formatTime(item.Hora || 0, item.Minuto || 0);
      
      // Se a API provê TipoMarcacao ("E" ou "S" ou "F/FOLGA"), nós usamos, senão alternamos Entrada/Saída
      let tipo: 'ENTRADA' | 'SAIDA' | 'NEUTRO' = idx % 2 === 0 ? 'ENTRADA' : 'SAIDA';
      let origem = 'Relógio';
      
      if (item.TipoMarcacao) {
        const t = item.TipoMarcacao.toUpperCase().trim();
        // Lista expandida de marcadores de dias não trabalhados (Eventos Administrativos/Abonos)
        const isNonWorking = t.includes('FOLGA') || t === 'F' || t === 'FOL' || 
                            t === 'DSR' || t === 'D' || t.includes('DESC') || 
                            t.includes('FERIA') || t === 'FE' || 
                            t.includes('AFAS') || t === 'AF' || 
                            t.includes('ABON') || t === 'AB' || 
                            t.includes('FALTA') || t === 'FJ' || t === 'FI';

        if (isNonWorking) {
          tipo = 'NEUTRO';
          origem = 'Evento Administrativo';
          if (t.includes('FOLGA') || t === 'F') origem = 'Folga';
          else if (t === 'DSR' || t === 'D' || t.includes('DESC')) origem = 'DSR';
          else if (t.includes('FERIA') || t === 'FE') origem = 'Férias';
          else if (t.includes('AFAS') || t === 'AF') origem = 'Afastamento';
          else if (t.includes('ABON') || t === 'AB') origem = 'Abono';
        } else if (t.includes('E') || t.includes('ENTRADA')) {
          tipo = 'ENTRADA';
        } else if (t.includes('S') || t.includes('SAIDA')) {
          tipo = 'SAIDA';
        }
      }

      marcacoes.push({
        id: `m_real_${marcacaoIdCounter++}`,
        funcionarioId,
        data,
        hora: horaStr,
        tipo,
        origem
      });
    });
  });

  db.saveMarcacoes(marcacoes);

  // 4. Roda o motor analítico em Python para auditoria trabalhista / CLT
  const auditResult = await runPythonAudit(funcionarios, marcacoes);
  db.saveJornadas(auditResult.jornadas);
  db.saveOcorrencias(auditResult.ocorrencias);
  db.saveFuncionarios(auditResult.funcionariosAtualizados);

  db.addSyncLog({
    dataHora: new Date().toISOString(),
    status: 'SUCESSO',
    detalhes: `Sincronização real efetuada com sucesso via API Dimep Kairos. Conectado ao CNPJ/CPF ${identifier}. Período: 32 dias (De ${dataInicialFmt} a ${dataFinalFmt}). Total de pessoas: ${funcionarios.length}. Total de marcações: ${marcacoes.length}.`,
    registrosColetados: marcacoes.length
  });

  writeOpLog('SUCESSO', 'Sincronização', `Sincronização concluída com sucesso para o CNPJ/CPF ${identifier}. PERÍODO: 32 dias (${dataInicialFmt} a ${dataFinalFmt}). TOTAL DE PESSOAS: ${funcionarios.length}. TOTAL DE MARCAÇÕES: ${marcacoes.length}.`, 'Todos os colaboradores e marcações de ponto coletados foram analisados e processados pelo motor de auditoria trabalhista CLT/MTE.');

  return {
    success: true,
    message: `Sincronização bem sucedida! ${funcionarios.length} colaboradores e ${marcacoes.length} batidas de ponto importados e analisados pelo motor CLT.`,
    count: marcacoes.length
  };
}
