/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MAX_COMPANIES = 30;

export interface EmpresaRestConfig {
  id: string;
  cnpj: string;
  key: string;
  razaoSocial?: string;
  ativa: boolean;
  companyId?: number;
  companyCode?: number;
}

export interface DimepConfig {
  host: string;
  hostDimep?: string;
  identifier: string;
  key: string;
  periodoPadrao: string; // 'last_30_days' | 'current_month' | 'last_month' | 'custom'
  dataInicioCustom?: string;
  dataFimCustom?: string;
  agendamentoSinc: string; // 'daily_00_00' | 'daily_12_00' | 'every_6h' | 'manual'
  isDemoCleared?: boolean;
  appMode?: 'REAL' | 'DEMONSTRAÇÃO';
  isCleanSetup?: boolean;
  setupCompleted?: boolean;
  isDemoActive?: boolean;
  masterInactivityTimeoutExempt?: boolean;
  companyId?: number;
  companyCode?: number;
  nomeEmpresaConectada?: string;
  dataUltimaConexaoValida?: string;
  dataUltimaSincronizacao?: string;
  sessionTimeoutMinutes?: number; // Ex: 15, 30, 60, 120 (default: 30)
  heartbeatIntervalMinutes?: number; // Ex: 1, 5, 10, 15 (default: 5)
  blockNewConnections?: boolean;
  empresasRest?: EmpresaRestConfig[];
}

export interface UserSession {
  sessionId: string;
  token: string;
  userId: string;
  userEmail: string;
  nomeCompleto: string;
  empresa: string;
  perfilAcesso: string;
  loginTime: string; // ISO String
  lastActivityTime: string; // ISO String
  lastActivityMs: number; // Timestamp em ms
  ip: string;
  userAgent: string;
  status: 'ATIVA' | 'EXPIRADA' | 'ENCERRADA';
}

export interface User {
  id: string;
  nomeCompleto: string;
  email: string;
  passwordHash: string;
  key: string; // REST API Key
  identifier: string; // CPF/CNPJ
  empresa: string;
  dataCadastro: string;
  dataUltimaAlteracao: string;
  dataUltimoAcesso: string | null;
  status: 'ATIVO' | 'BLOQUEADO' | 'INATIVO';
  perfilAcesso: string; // 'Master', 'Administrador', 'Usuário Comum' ou personalizado
  criadorEmail?: string;
  perguntasSeguranca?: { pergunta: string; respostaHash: string }[];
  tentativasLogin?: number;
  bloqueadoAte?: string | null;
  precisaTrocarSenha?: boolean;
  forcarTrocaSenha?: boolean;
  salt?: string;
  precisaConfigurarPerguntas?: boolean;
  sincronizarAoEntrar?: boolean;
}

export interface Profile {
  id: string;
  nome: string;
  descricao: string;
  permissoes: string[]; // Ex: ['dashboard_executivo_visualizar', 'dashboard_executivo_exportar', ...]
  dataCriacao?: string;
  dataUltimaAlteracao?: string;
  criadorEmail?: string;
  status?: 'ATIVO' | 'INATIVO';
}

export interface ActivityLog {
  id: string;
  usuario: string; // email ou 'Sistema'
  dataHora: string; // ISO string
  ip: string;
  operacao: string;
  modulo: string;
  detalhes: string;
}

export interface UsageStats {
  totalAcessos: number;
  modulosAcessados: Record<string, number>;
  horariosUtilizacao: Record<string, number>; // e.g. {"08": 12, "09": 15}
  relatoriosGerados: number;
  exportacoesRealizadas: number;
}

export interface Empresa {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  pis: string;
  cargo: string;
  departamento: string;
  centroCusto: string;
  gestor: string;
  empresaId: string;
  grauRisco: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  scoreRisco: number; // 0 - 100
  status?: 'ATIVO' | 'DESLIGADO';
  situacao?: 'ATIVO' | 'INATIVO' | 'EXCLUIDO' | 'DESLIGADO' | 'AFASTADO' | 'FERIAS';
  matricula?: string;
  cracha?: string;
  sexo?: 'MASCULINO' | 'FEMININO' | 'M' | 'F' | string;
}

export interface Marcacao {
  id: string;
  funcionarioId: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  tipo: 'ENTRADA' | 'SAIDA' | 'NEUTRO';
  origem: string; // 'Relógio' | 'Manual' | 'Mobile'
  descricao?: string;
  desprezado?: boolean;
  desprezada?: boolean;
  status?: string;
}

export type FaixaDuracaoDiaria = 'SEM_MARCACAO' | 'MENOS_DE_4H' | 'DE_4_A_6H' | 'MAIS_DE_6H';

export interface VisaoDiaria {
  funcionarioId: string;
  funcionarioNome: string;
  funcionarioMatricula?: string;
  empresaId: string;
  data: string; // YYYY-MM-DD
  diaDaSemana: 'DOMINGO' | 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA' | 'SABADO';
  domingo: boolean;
  quantidadeMarcacoes: number;
  marcacoesDoDia: Marcacao[];
  possuiMarcacao: boolean; // isDiaComMarcacao (isMarcacaoExistente)
  possuiMarcacaoValidaParaJornada: boolean; // isMarcacaoValidaParaJornada
  primeiraEntrada: string | null;
  ultimaSaida: string | null;
  horasEfetivamenteTrabalhadas: number; // em horas decimais
  horasEfetivamenteTrabalhadasFormat: string; // HH:MM
  totalMinutosTrabalhados: number;
  faixaDuracao: FaixaDuracaoDiaria;
  intervaloIntrajornadaMinutos: number;
  saidaAnterior: string | null;
  dataSaidaAnterior: string | null;
  entradaAtual: string | null;
  interjornadaHoras: number | null; // em horas decimais
}

export interface JornadaCalculada {
  id: string;
  funcionarioId: string;
  data: string; // YYYY-MM-DD
  primeiraEntrada: string | null; // HH:MM
  ultimaSaida: string | null; // HH:MM
  marcações: string[]; // ['08:00', '12:00', '13:00', '18:00']
  horasTrabalhadas: number; // em horas decimais
  horasNoturnas: number; // em horas decimais
  horasTrabalhadasFormat: string; // "08:00"
  intervaloRealizado: number; // em minutos
  descansoInterjornada: number | null; // em horas decimais (descanso com relação à saída do dia anterior)
  tipoDia: 'UTIL' | 'DOMINGO' | 'SABADO' | 'FERIADO';
}

export type GravidadeOcorrencia = 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';

export type TipoOcorrencia =
  | 'JORNADA_EXCESSIVA' // > 10 horas trabalhadas
  | 'SEM_FOLGA_7_DIAS' // > 6 dias seguidos sem DSR
  | 'DOMINGO_EXCESSIVO' // > 6 horas no domingo
  | 'INTERVALO_INSUFICIENTE' // < 1 hora de intervalo
  | 'INTERJORNADA_INSUFICIENTE' // < 11 horas de descanso entre jornadas
  | 'MARCACAO_IMPAR' // marcação ímpar (possível esquecimento)
  | 'AUSENCIA' // ausência injustificada
  | 'ATRASO_GRAVE' // atraso superior a 15 minutos
  | 'FALTA_RECORRENTE' // mais de 2 faltas no mês
  | 'DOMINGOS_SEGUIDOS'; // trabalho em dois domingos consecutivos

export interface Ocorrencia {
  id: string;
  funcionarioId: string;
  funcionarioNome?: string;
  funcionarioMatricula?: string;
  funcionarioDepartamento?: string;
  funcionarioSexo?: string;
  data: string; // YYYY-MM-DD
  tipo: TipoOcorrencia;
  descricao: string;
  gravidade: GravidadeOcorrencia;
  valorConstatado: string; // ex: "11h30" ou "45 min" ou "8 dias"
  valorPermitido: string; // ex: "10h00" ou "60 min" ou "11h00"
  primeiraMarcacao?: string | null;
  ultimaMarcacao?: string | null;
  marcacoesUtilizadas?: string[];
  periodosTrabalhadosDesc?: string[];
  totalMinutosTrabalhados?: number;
  limiteMinutos?: number;
  excedenteMinutos?: number;
}

export interface SyncLog {
  id: string;
  dataHora: string;
  status: 'SUCESSO' | 'FALHA' | 'EM_ANDAMENTO';
  detalhes: string;
  registrosColetados: number;
}

export interface BIFilters {
  empresaId: string;
  departamento: string;
  centroCusto: string;
  cargo: string;
  gestor: string;
  grauRisco: string;
  dataInicio: string;
  dataFim: string;
  buscaFuncionario: string;
  tipoOcorrencia: string;
  sexo?: string;
  status?: string;
}

export interface DashboardKPIs {
  totalFuncionarios: number;
  totalPessoas?: number;
  totalPessoasAtivas?: number;
  totalPessoasInativas?: number;
  totalPessoasExcluidas?: number;
  totalPessoasAfastadas?: number;
  totalPessoasFerias?: number;
  totalOcorrencias: number;
  funcionariosEmRisco: number;
  ocorrenciasCriticas: number;
  empresasMonitoradas: number;
  scoreGeralConformidade: number; // 0 - 100
  taxaJornadasExcessivas: number; // %
  taxaDescansoInadequado: number; // %
  taxaIntervaloInsuficiente: number; // %
  taxaTrabalhoDomingo: number; // %
  taxaDoisDomingos?: number; // %
  taxaFaltasAtrasos?: number; // %
}
