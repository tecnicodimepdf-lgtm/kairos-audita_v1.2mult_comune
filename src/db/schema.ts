/**
 * Definições do Esquema de Banco de Dados Relacional (SQLite / PostgreSQL)
 * Suporta integração com Drizzle ORM ou drivers SQL nativos.
 */

export interface RelationalConfigTable {
  id: string;
  hostDimep: string;
  key: string;
  identifier: string;
  periodoPadrao: string;
  agendamentoSinc: string;
  appMode: 'REAL' | 'DEMONSTRAÇÃO';
  isCleanSetup: boolean;
  setupCompleted: boolean;
  isDemoActive: boolean;
  masterInactivityTimeoutExempt: boolean;
  companyId: number;
  companyCode: number;
  nomeEmpresaConectada: string;
  sessionTimeoutMinutes: number;
  heartbeatIntervalMinutes: number;
  updatedAt: string;
}

export interface RelationalUserTable {
  id: string;
  nomeCompleto: string;
  email: string;
  passwordHash: string;
  salt: string;
  perfilAcesso: string;
  status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO';
  precisaTrocarSenha: boolean;
  tentativasLogin: number;
  bloqueadoAte: string | null;
  dataCadastro: string;
  dataUltimaAlteracao: string;
  dataUltimoAcesso: string | null;
  empresa: string;
  identifier: string;
  key: string;
  perguntasSegurancaJson: string; // JSON string das perguntas de segurança
}

export interface RelationalEmpresaTable {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
}

export interface RelationalProfileTable {
  id: string;
  nome: string;
  descricao: string;
  isMaster?: boolean;
  permissoesJson: string;
}

export interface RelationalActivityLogTable {
  id: string;
  timestamp: string;
  usuario: string;
  ip: string;
  acao: string;
  categoria: string;
  detalhes: string;
}

export interface RelationalActiveSessionTable {
  token: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  empresa: string;
  perfilAcesso: string;
  loginTime: string;
  lastActivityTime: string;
  lastActivityMs: number;
  ip: string;
  userAgent: string;
}

/**
 * Interface Unificada do Adaptador de Banco de Dados Relacional
 */
export interface RelationalDatabaseAdapter {
  initialize(): Promise<void>;
  isReady(): boolean;
  syncFromJsonDatabase(jsonData: any): Promise<void>;
  exportToJsonDatabase(): Promise<any>;
}
