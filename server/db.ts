/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  DimepConfig,
  Empresa,
  EmpresaRestConfig,
  Funcionario,
  Marcacao,
  JornadaCalculada,
  Ocorrencia,
  SyncLog,
  User,
  Profile,
  ActivityLog,
  UsageStats,
  UserSession
} from '../src/types';

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function isBcryptHash(hash: string): boolean {
  return typeof hash === 'string' && (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$'));
}

export function hashPasswordSHA256(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function hashPasswordWithSaltSHA256(password: string, salt: string): string {
  return crypto.createHash('sha256').update(password + ':' + salt).digest('hex');
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function hashPasswordWithSalt(password: string, salt: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyAndMigratePassword(password: string, user: User, saveUsersFn?: (users: User[]) => void): boolean {
  if (!user || !user.passwordHash) return false;

  if (isBcryptHash(user.passwordHash)) {
    return bcrypt.compareSync(password, user.passwordHash);
  }

  // Verificar se confere com os padrões legados de hash SHA-256
  const saltedInput = hashPasswordWithSaltSHA256(password, user.salt || '');
  const legacyInput = hashPasswordSHA256(password);

  if (user.passwordHash === saltedInput || user.passwordHash === legacyInput) {
    // Migração transparente de hash legado para bcrypt
    user.passwordHash = bcrypt.hashSync(password, 10);
    if (saveUsersFn) {
      saveUsersFn(dbInstance.getUsers());
    } else {
      dbInstance.save();
    }
    return true;
  }

  return false;
}

export function hashAnswer(answer: string): string {
  return crypto.createHash('sha256').update((answer || '').toLowerCase().trim()).digest('hex');
}

export function cleanIdentifier(identifier: string): string {
  if (!identifier) return '';
  return identifier.replace(/[^a-zA-Z0-9]/g, '');
}

export type SafeUserDTO = Omit<User, 'passwordHash' | 'salt' | 'perguntasSeguranca'>;

export function toSafeUserDTO(user: User | null | undefined): SafeUserDTO | null {
  if (!user) return null;
  const { passwordHash, salt, perguntasSeguranca, ...safeUser } = user;
  return safeUser;
}

export function getDefaultSecurityQuestions(userEmail: string, empresa?: string, identifier?: string): { pergunta: string; respostaHash: string }[] {
  const normEmail = (userEmail || '').toLowerCase().trim();
  const normEmpresa = (empresa || 'Empresa Não Informada').toLowerCase().trim();
  const normId = cleanIdentifier(identifier || '00000000000');

  return [
    {
      pergunta: 'Qual o e-mail oficial de cadastro corporativo do usuário?',
      respostaHash: hashAnswer(normEmail)
    },
    {
      pergunta: 'Qual a Razão Social ou Nome da Empresa vinculada?',
      respostaHash: hashAnswer(normEmpresa)
    },
    {
      pergunta: 'Qual o CNPJ/CPF cadastrado sem pontuação?',
      respostaHash: hashAnswer(normId)
    }
  ];
}

interface DatabaseSchema {
  config: DimepConfig;
  empresas: Empresa[];
  funcionarios: Funcionario[];
  marcacoes: Marcacao[];
  jornadas: JornadaCalculada[];
  ocorrencias: Ocorrencia[];
  syncLogs: SyncLog[];
  users: User[];
  profiles: Profile[];
  activityLogs: ActivityLog[];
  usageStats: UsageStats;
  activeSessions?: UserSession[];
}

const DEFAULT_CONFIG: DimepConfig = {
  host: 'https://www.dimepkairos.com.br',
  identifier: '',
  key: '',
  periodoPadrao: 'last_30_days',
  agendamentoSinc: 'manual',
  appMode: 'REAL',
  isCleanSetup: true,
  setupCompleted: false,
  isDemoActive: false,
  masterInactivityTimeoutExempt: true,
  companyId: 0,
  companyCode: 0,
  nomeEmpresaConectada: '',
  sessionTimeoutMinutes: 30,
  heartbeatIntervalMinutes: 5
};

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

export interface SecurityConfig {
  EmergencyAccess: boolean;
  LastEmergencyActivation: string | null;
  LastActivatedByIP?: string;
  Reason?: string;
  EmergencyLog: Array<{
    dataHora: string;
    acao: string;
    ip?: string;
    detalhes: string;
  }>;
}

const SECURITY_FILE = path.join(DB_DIR, 'security.json');

export class Database {
  private data: DatabaseSchema;
  private lastMtime: number = 0;

  constructor() {
    this.data = {
      config: { ...DEFAULT_CONFIG },
      empresas: [],
      funcionarios: [],
      marcacoes: [],
      jornadas: [],
      ocorrencias: [],
      syncLogs: [],
      users: [],
      profiles: [],
      activityLogs: [],
      usageStats: {
        totalAcessos: 0,
        modulosAcessados: {},
        horariosUtilizacao: {},
        relatoriosGerados: 0,
        exportacoesRealizadas: 0
      },
      activeSessions: []
    };
    this.init();
  }

  public checkReload(): void {
    try {
      if (fs.existsSync(DB_FILE)) {
        const stat = fs.statSync(DB_FILE);
        if (stat.mtimeMs > this.lastMtime) {
          const currentSessions = [...(this.data.activeSessions || [])];
          this.init();
          if (currentSessions.length > 0) {
            currentSessions.forEach(cs => {
              const found = this.data.activeSessions.find(s => s.token === cs.token);
              if (found) {
                if (cs.lastActivityMs > (found.lastActivityMs || 0)) {
                  found.lastActivityMs = cs.lastActivityMs;
                  found.lastActivityTime = cs.lastActivityTime;
                }
              } else if (cs.status === 'ATIVA') {
                this.data.activeSessions.push(cs);
              }
            });
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  public init() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const stat = fs.statSync(DB_FILE);
        this.lastMtime = stat.mtimeMs;
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        this.data = {
          config: parsed.config || { ...DEFAULT_CONFIG },
          empresas: parsed.empresas || [],
          funcionarios: parsed.funcionarios || [],
          marcacoes: parsed.marcacoes || [],
          jornadas: parsed.jornadas || [],
          ocorrencias: parsed.ocorrencias || [],
          syncLogs: parsed.syncLogs || [],
          users: parsed.users || [],
          profiles: parsed.profiles || [],
          activityLogs: parsed.activityLogs || [],
          usageStats: parsed.usageStats || {
            totalAcessos: 0,
            modulosAcessados: {},
            horariosUtilizacao: {},
            relatoriosGerados: 0,
            exportacoesRealizadas: 0
          },
          activeSessions: parsed.activeSessions || []
        };
        
        if (!this.data.config.appMode) {
          this.data.config.appMode = 'REAL';
        }

        // Backup automático de inicialização removido para evitar instabilidade no startup
      } else {
        this.save();
      }

      // Semeia Perfis Padrão se vazios ou incompletos
      this.ensureDefaultProfiles();

      // Garante integridade e auto-recuperação contínua da conta Master e perguntas de segurança
      this.ensureMasterAccount();

      // Auditoria de sessões para eliminar órfãs (Requisito 5)
      this.auditSessions();

      // Limpeza de quaisquer dados antigos de demonstração/exemplo nas configurações
      this.cleanseDemoConfig();

      // Suporte Multiempresa: Garante integridade do array de empresas REST
      this.ensureMultiEmpresaConfig();

    } catch (error) {
      console.error('Erro ao inicializar o banco de dados:', error);
    }
  }

  public ensureMultiEmpresaConfig(): void {
    try {
      if (!this.data.config) return;

      if (!Array.isArray(this.data.config.empresasRest)) {
        this.data.config.empresasRest = [];
      }

      let changed = false;

      // Se o array de empresas estiver vazio, mas houver dados de empresa existentes
      if (this.data.config.empresasRest.length === 0) {
        if (this.data.config.identifier || this.data.config.key) {
          this.data.config.empresasRest.push({
            id: 'emp_rest_1',
            cnpj: this.data.config.identifier || '',
            key: this.data.config.key || '',
            razaoSocial: this.data.config.nomeEmpresaConectada || 'Empresa Principal',
            ativa: true,
            companyId: this.data.config.companyId,
            companyCode: this.data.config.companyCode
          });
          changed = true;
        }
      }

      // Se existirem empresas na lista, garante que exatamente UMA empresa está marcada como ativa
      if (this.data.config.empresasRest.length > 0) {
        const ativas = this.data.config.empresasRest.filter(e => e.ativa);
        if (ativas.length === 0) {
          this.data.config.empresasRest[0].ativa = true;
          changed = true;
        } else if (ativas.length > 1) {
          this.data.config.empresasRest.forEach((e, index) => {
            if (index > 0 && e.ativa) {
              e.ativa = false;
              changed = true;
            }
          });
        }

        // Sincroniza os atributos legados do config com a empresa ativa
        const activeEmp = this.data.config.empresasRest.find(e => e.ativa);
        if (activeEmp) {
          if (this.data.config.identifier !== activeEmp.cnpj) {
            this.data.config.identifier = activeEmp.cnpj;
            changed = true;
          }
          if (this.data.config.key !== activeEmp.key) {
            this.data.config.key = activeEmp.key;
            changed = true;
          }
          if (activeEmp.razaoSocial && this.data.config.nomeEmpresaConectada !== activeEmp.razaoSocial) {
            this.data.config.nomeEmpresaConectada = activeEmp.razaoSocial;
            changed = true;
          }
          if (activeEmp.companyId !== undefined) {
            this.data.config.companyId = activeEmp.companyId;
          }
          if (activeEmp.companyCode !== undefined) {
            this.data.config.companyCode = activeEmp.companyCode;
          }
        }
      }

      if (changed) {
        this.save();
      }
    } catch (err) {
      console.error('Erro ao garantir configuração multiempresa:', err);
    }
  }

  /**
   * Sincronização centralizada e unificada dos dados de integração REST da API Kairos.
   * Garante a Fonte Única Persistente de Dados (CNPJ / Rest API Key / Empresa)
   * compartilhada entre os módulos: Cadastro de Usuário, Gestão Multiempresa e Parâmetros REST.
   */
  public syncCentralIntegrationData(params: {
    cnpj?: string;
    key?: string;
    razaoSocial?: string;
    empresaId?: string;
    setAsActive?: boolean;
  }): { activeCompany: EmpresaRestConfig | null; config: DimepConfig } {
    this.checkReload();

    if (!this.data.config) {
      this.data.config = {
        host: 'https://www.dimepkairos.com.br',
        identifier: '',
        key: '',
        nomeEmpresaConectada: '',
        periodoPadrao: '30_DIAS',
        agendamentoSinc: 'DIARIO',
        appMode: 'REAL',
        empresasRest: []
      };
    }

    if (!Array.isArray(this.data.config.empresasRest)) {
      this.data.config.empresasRest = [];
    }

    const { cnpj, key, razaoSocial, empresaId, setAsActive } = params;
    const cleanCnpjInput = cnpj ? cleanIdentifier(cnpj) : '';

    let matchedEmp: EmpresaRestConfig | undefined = undefined;

    // 1. Tenta localizar a empresa por ID ou por CNPJ na lista central
    if (empresaId) {
      matchedEmp = this.data.config.empresasRest.find(e => e.id === empresaId);
    }
    if (!matchedEmp && cleanCnpjInput) {
      matchedEmp = this.data.config.empresasRest.find(e => cleanIdentifier(e.cnpj) === cleanCnpjInput);
    }

    // 2. Se a empresa já existe na lista central, atualiza seus dados
    if (matchedEmp) {
      if (cnpj && cnpj.trim() !== '') {
        matchedEmp.cnpj = cnpj.trim();
      }
      if (key !== undefined && key.trim() !== '') {
        matchedEmp.key = key.trim();
      }
      if (razaoSocial !== undefined && razaoSocial.trim() !== '') {
        matchedEmp.razaoSocial = razaoSocial.trim();
      }
      if (setAsActive) {
        this.data.config.empresasRest.forEach(e => {
          e.ativa = (e.id === matchedEmp!.id);
        });
      }
    } else if (cleanCnpjInput || (key && key.trim() !== '')) {
      // 3. Se a empresa não existe na lista central, cria um novo registro central
      const isFirst = this.data.config.empresasRest.length === 0;
      const shouldBeActive = setAsActive || isFirst;

      const newEmp: EmpresaRestConfig = {
        id: empresaId || `emp_rest_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        cnpj: cnpj ? cnpj.trim() : (this.data.config.identifier || ''),
        key: key ? key.trim() : (this.data.config.key || ''),
        razaoSocial: razaoSocial ? razaoSocial.trim() : (this.data.config.nomeEmpresaConectada || `Empresa ${cleanCnpjInput}`),
        ativa: shouldBeActive
      };

      if (shouldBeActive) {
        this.data.config.empresasRest.forEach(e => {
          e.ativa = false;
        });
      }

      this.data.config.empresasRest.push(newEmp);
      matchedEmp = newEmp;
    }

    // 4. Garante a integridade do estado ativo
    this.ensureMultiEmpresaConfig();

    // 5. Atualiza os ponteiros globais de empresa ativa no sysConfig
    const activeEmp = this.data.config.empresasRest.find(e => e.ativa) || this.data.config.empresasRest[0] || null;
    if (activeEmp) {
      this.data.config.identifier = activeEmp.cnpj;
      this.data.config.key = activeEmp.key;
      this.data.config.nomeEmpresaConectada = activeEmp.razaoSocial;
      if (activeEmp.companyId !== undefined) this.data.config.companyId = activeEmp.companyId;
      if (activeEmp.companyCode !== undefined) this.data.config.companyCode = activeEmp.companyCode;
    }

    // 6. Sincroniza todos os registros da tabela de Usuários com a fonte central
    if (Array.isArray(this.data.users)) {
      this.data.users.forEach(u => {
        if (u.perfilAcesso === 'Master' || u.perfilAcesso === 'Administrador') {
          if (activeEmp) {
            u.identifier = activeEmp.cnpj;
            u.key = activeEmp.key;
            u.empresa = activeEmp.razaoSocial;
          }
        } else if (u.identifier) {
          const uCleanId = cleanIdentifier(u.identifier);
          const userCompany = this.data.config.empresasRest.find(e => cleanIdentifier(e.cnpj) === uCleanId);
          if (userCompany) {
            u.key = userCompany.key;
            u.empresa = userCompany.razaoSocial;
            u.identifier = userCompany.cnpj;
          }
        }
      });
    }

    // 7. Salva no banco de dados de forma atômica
    this.save();

    return {
      activeCompany: activeEmp,
      config: this.data.config
    };
  }

  public ensureDefaultProfiles(): void {
    try {
      const defaults: Profile[] = [
        {
          id: 'prof_master',
          nome: 'Master',
          descricao: 'Acesso total e irrestrito ao sistema.',
          permissoes: ['admin_acesso_total'],
          dataCriacao: new Date().toISOString(),
          dataUltimaAlteracao: new Date().toISOString(),
          criadorEmail: 'Sistema',
          status: 'ATIVO'
        },
        {
          id: 'prof_admin',
          nome: 'Administrador',
          descricao: 'Acesso administrativo e operacional amplo.',
          permissoes: [
            'admin_acesso_total',
            'login_acesso', 'login_recuperacao', 'login_alteracao_senha',
            'dashboard_executivo_visualizar', 'dashboard_executivo_filtros', 'dashboard_executivo_expandir_graficos', 'dashboard_executivo_exportar', 'dashboard_executivo_atalhos',
            'dashboard_rh_visualizar', 'dashboard_rh_filtros', 'dashboard_rh_relatorios', 'dashboard_rh_navegar',
            'dashboard_gerencial_visualizar', 'dashboard_gerencial_filtros', 'dashboard_gerencial_exportar',
            'auditoria_visualizar', 'auditoria_filtrar', 'auditoria_executar', 'auditoria_exportar_csv', 'auditoria_gerar_pdf', 'auditoria_imprimir', 'auditoria_agrupar_departamento', 'auditoria_detalhes',
            'funcionarios_visualizar', 'funcionarios_consultar', 'funcionarios_ativos', 'funcionarios_desligados', 'funcionarios_exportar', 'funcionarios_historico', 'funcionarios_pesquisa', 'funcionarios_gerar_relatorios',
            'configuracao_visualizar', 'configuracao_empresa', 'configuracao_sincronizar', 'configuracao_rest_api', 'configuracao_logs', 'configuracao_atualizar', 'configuracao_editar', 'configuracao_multiempresa',
            'relatorios_visualizar', 'relatorios_auditoria_pessoa', 'relatorios_auditoria_departamento', 'relatorios_auditoria_geral', 'relatorios_resumo_executivo', 'relatorios_ocorrencias', 'relatorios_gerar_pdf', 'relatorios_gerar_csv', 'relatorios_exportar_dados',
            'painel_master_acesso', 'painel_master_usuarios', 'painel_master_perfis', 'painel_master_permissoes', 'painel_master_backup', 'painel_master_logs', 'painel_master_stats', 'painel_master_configuracoes', 'painel_master_administracao', 'painel_master_auditoria', 'painel_master_empresa', 'painel_master_seguranca',
            'usuarios_criar', 'usuarios_editar', 'usuarios_excluir', 'usuarios_bloquear', 'usuarios_ativar', 'usuarios_reset_senha', 'usuarios_alterar_perfil',
            'perfis_criar', 'perfis_editar', 'perfis_excluir', 'perfis_clonar',
            'logs_visualizar', 'logs_exportar'
          ],
          dataCriacao: new Date().toISOString(),
          dataUltimaAlteracao: new Date().toISOString(),
          criadorEmail: 'Sistema',
          status: 'ATIVO'
        },
        {
          id: 'prof_supervisor',
          nome: 'Supervisor',
          descricao: 'Gestão de auditorias, relatórios e colaboradores.',
          permissoes: [
            'login_acesso', 'login_recuperacao', 'login_alteracao_senha',
            'dashboard_executivo_visualizar', 'dashboard_executivo_filtros', 'dashboard_executivo_expandir_graficos', 'dashboard_executivo_exportar', 'dashboard_executivo_atalhos',
            'dashboard_rh_visualizar', 'dashboard_rh_filtros', 'dashboard_rh_relatorios', 'dashboard_rh_navegar',
            'dashboard_gerencial_visualizar', 'dashboard_gerencial_filtros', 'dashboard_gerencial_exportar',
            'auditoria_visualizar', 'auditoria_filtrar', 'auditoria_executar', 'auditoria_exportar_csv', 'auditoria_gerar_pdf', 'auditoria_imprimir', 'auditoria_agrupar_departamento', 'auditoria_detalhes',
            'funcionarios_visualizar', 'funcionarios_consultar', 'funcionarios_ativos', 'funcionarios_desligados', 'funcionarios_exportar', 'funcionarios_historico', 'funcionarios_pesquisa', 'funcionarios_gerar_relatorios',
            'relatorios_visualizar', 'relatorios_auditoria_pessoa', 'relatorios_auditoria_departamento', 'relatorios_auditoria_geral', 'relatorios_resumo_executivo', 'relatorios_ocorrencias', 'relatorios_gerar_pdf', 'relatorios_gerar_csv', 'relatorios_exportar_dados',
            'configuracao_visualizar', 'configuracao_empresa', 'configuracao_sincronizar', 'configuracao_logs'
          ],
          dataCriacao: new Date().toISOString(),
          dataUltimaAlteracao: new Date().toISOString(),
          criadorEmail: 'Sistema',
          status: 'ATIVO'
        },
        {
          id: 'prof_consulta',
          nome: 'Consulta',
          descricao: 'Acesso exclusivamente de leitura e consulta.',
          permissoes: [
            'login_acesso', 'login_recuperacao', 'login_alteracao_senha',
            'dashboard_executivo_visualizar', 'dashboard_executivo_filtros', 'dashboard_executivo_expandir_graficos', 'dashboard_executivo_atalhos',
            'dashboard_rh_visualizar', 'dashboard_rh_filtros', 'dashboard_rh_navegar',
            'dashboard_gerencial_visualizar', 'dashboard_gerencial_filtros',
            'auditoria_visualizar', 'auditoria_filtrar', 'auditoria_imprimir', 'auditoria_agrupar_departamento', 'auditoria_detalhes',
            'funcionarios_visualizar', 'funcionarios_consultar', 'funcionarios_ativos', 'funcionarios_pesquisa', 'funcionarios_historico',
            'relatorios_visualizar', 'relatorios_auditoria_pessoa', 'relatorios_auditoria_departamento', 'relatorios_auditoria_geral', 'relatorios_resumo_executivo', 'relatorios_ocorrencias',
            'configuracao_visualizar', 'configuracao_empresa'
          ],
          dataCriacao: new Date().toISOString(),
          dataUltimaAlteracao: new Date().toISOString(),
          criadorEmail: 'Sistema',
          status: 'ATIVO'
        },
        {
          id: 'prof_operacional',
          nome: 'Operacional',
          descricao: 'Operações de sincronização e monitoramento.',
          permissoes: [
            'login_acesso', 'login_recuperacao', 'login_alteracao_senha',
            'dashboard_executivo_visualizar', 'dashboard_executivo_atalhos',
            'funcionarios_visualizar', 'funcionarios_consultar', 'funcionarios_ativos', 'funcionarios_pesquisa',
            'configuracao_visualizar', 'configuracao_empresa', 'configuracao_sincronizar', 'configuracao_logs',
            'auditoria_visualizar', 'auditoria_executar'
          ],
          dataCriacao: new Date().toISOString(),
          dataUltimaAlteracao: new Date().toISOString(),
          criadorEmail: 'Sistema',
          status: 'ATIVO'
        }
      ];

      let changed = false;
      for (const def of defaults) {
        const exists = this.data.profiles.some(p => p.id === def.id || p.nome.toLowerCase() === def.nome.toLowerCase());
        if (!exists) {
          this.data.profiles.push(def);
          changed = true;
        }
      }

      if (changed) {
        this.save();
      }
    } catch (err) {
      console.error('Erro ao garantir perfis padrão:', err);
    }
  }

  public ensureMasterAccount(): void {
    try {
      let master = this.data.users.find(u => u.perfilAcesso === 'Master' || u.email.toLowerCase() === 'tecnicodimepdf@gmail.com');
      let changed = false;

      if (!master) {
        const salt = generateSalt();
        const initialPassword = 'senha';
        const passwordHash = hashPasswordWithSalt(initialPassword, salt);

        master = {
          id: 'user_master_auto',
          nomeCompleto: 'Renato Santos',
          email: 'tecnicodimepdf@gmail.com',
          salt: salt,
          passwordHash: passwordHash,
          key: '',
          identifier: '',
          empresa: '',
          dataCadastro: new Date().toISOString(),
          dataUltimaAlteracao: new Date().toISOString(),
          dataUltimoAcesso: null,
          status: 'ATIVO',
          perfilAcesso: 'Master',
          criadorEmail: 'Sistema',
          precisaTrocarSenha: true,
          tentativasLogin: 0,
          bloqueadoAte: null,
          perguntasSeguranca: getDefaultSecurityQuestions('tecnicodimepdf@gmail.com', '', '')
        };
        this.data.users.unshift(master);
        changed = true;
        console.log(`[SETUP INICIAL] Conta Master criada com a senha inicial padrão: "${initialPassword}".`);
        console.log('Altere a senha após o primeiro acesso.');
        
        this.addActivityLog({
          usuario: 'Sistema',
          dataHora: new Date().toISOString(),
          ip: '127.0.0.1',
          operacao: 'Criação de Usuário',
          modulo: 'admin',
          detalhes: 'Usuário Master Renato Santos (tecnicodimepdf@gmail.com) restaurado automaticamente pelo mecanismo de proteção contínua do banco.'
        });
      } else {
        // Assegurar que a conta Master permaneça ATIVA, desbloqueada e com permissões íntegras (sem alterar a senha)
        if (master.status !== 'ATIVO') {
          master.status = 'ATIVO';
          changed = true;
        }
        if (master.perfilAcesso !== 'Master') {
          master.perfilAcesso = 'Master';
          changed = true;
        }
        if (master.bloqueadoAte) {
          master.bloqueadoAte = null;
          changed = true;
        }
        if (master.tentativasLogin && master.tentativasLogin > 0) {
          master.tentativasLogin = 0;
          changed = true;
        }
        if (!master.salt) {
          master.salt = generateSalt();
          changed = true;
        }
        if (!master.perguntasSeguranca || master.perguntasSeguranca.length < 3) {
          master.perguntasSeguranca = getDefaultSecurityQuestions(master.email, master.empresa || '', master.identifier || '');
          changed = true;
        }
      }

      // Garantir que nenhum usuário na base fique sem salt ou sem perguntas de segurança
      this.data.users.forEach(u => {
        if (!u.salt) {
          u.salt = generateSalt();
          changed = true;
        }
        if (!u.perguntasSeguranca || u.perguntasSeguranca.length < 3) {
          u.perguntasSeguranca = getDefaultSecurityQuestions(u.email, u.empresa || '', u.identifier || '');
          changed = true;
        }
      });

      if (changed) {
        this.save();
      }
    } catch (err) {
      console.error('Erro ao assegurar integridade do usuário Master:', err);
    }
  }

  /**
   * Elimina definitivamente dados de demonstração das configurações do sistema
   * e garante que o cadastro do usuário seja a fonte única da integração REST.
   */
  public cleanseDemoConfig(): void {
    const DEMO_KEYS = ['c7867c41-9650-4b0c-a0cf-a76f8c95a3d3', 'demo-rest-key', 'key_demo'];
    const DEMO_CNPJS = ['37.120.466/0001-30', '37120466000130', '00.000.000/0001-00', '12.345.678/0001-99'];
    const DEMO_COMPANIES = ['Dimep Auditorias S.A.', 'Dimep Auditorias S.A. (Demo)', 'Dimep Sistemas', 'Audit Kairos Matriz S.A.'];

    let changed = false;

    if (this.data.config) {
      if (DEMO_KEYS.includes(this.data.config.key)) {
        this.data.config.key = '';
        changed = true;
      }
      if (DEMO_CNPJS.includes(this.data.config.identifier)) {
        this.data.config.identifier = '';
        changed = true;
      }
      if (DEMO_COMPANIES.includes(this.data.config.nomeEmpresaConectada || '')) {
        this.data.config.nomeEmpresaConectada = '';
        changed = true;
      }
    }

    // Limpa também resquícios em usuários caso existam dados demo
    this.data.users.forEach(u => {
      if (DEMO_KEYS.includes(u.key)) {
        u.key = '';
        changed = true;
      }
      if (DEMO_CNPJS.includes(u.identifier)) {
        u.identifier = '';
        changed = true;
      }
      if (DEMO_COMPANIES.includes(u.empresa)) {
        u.empresa = '';
        changed = true;
      }
    });

    if (changed) {
      this.save();
    }
  }

  public getSecurityConfig(): SecurityConfig {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (fs.existsSync(SECURITY_FILE)) {
        const content = fs.readFileSync(SECURITY_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        return {
          EmergencyAccess: !!parsed.EmergencyAccess,
          LastEmergencyActivation: parsed.LastEmergencyActivation || null,
          LastActivatedByIP: parsed.LastActivatedByIP || '127.0.0.1',
          Reason: parsed.Reason || 'Ativação manual em arquivo de configuração',
          EmergencyLog: Array.isArray(parsed.EmergencyLog) ? parsed.EmergencyLog : []
        };
      }
    } catch (e) {
      console.error('Erro ao ler security.json:', e);
    }
    const defaultConfig: SecurityConfig = {
      EmergencyAccess: false,
      LastEmergencyActivation: null,
      EmergencyLog: []
    };
    this.saveSecurityConfig(defaultConfig);
    return defaultConfig;
  }

  public saveSecurityConfig(cfg: SecurityConfig): void {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(SECURITY_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    } catch (e) {
      console.error('Erro ao salvar security.json:', e);
    }
  }

  public setEmergencyMode(enabled: boolean, reason?: string, ip?: string): SecurityConfig {
    const cfg = this.getSecurityConfig();
    cfg.EmergencyAccess = enabled;
    if (enabled) {
      cfg.LastEmergencyActivation = new Date().toISOString();
      cfg.LastActivatedByIP = ip || '127.0.0.1';
      cfg.Reason = reason || 'Ativação via arquivo de configuração security.json';
      cfg.EmergencyLog.unshift({
        dataHora: new Date().toISOString(),
        acao: 'Ativação do Modo de Emergência (Break Glass)',
        ip: ip || '127.0.0.1',
        detalhes: `Motivo: ${cfg.Reason}`
      });
      this.addActivityLog({
        usuario: 'Sistema (Emergência)',
        dataHora: new Date().toISOString(),
        ip: ip || '127.0.0.1',
        operacao: 'Ativação Break Glass',
        modulo: 'seguranca',
        detalhes: `Modo de Emergência ativado. Motivo: ${cfg.Reason}. IP: ${ip || '127.0.0.1'}`
      });
    } else {
      cfg.EmergencyLog.unshift({
        dataHora: new Date().toISOString(),
        acao: 'Desativação do Modo de Emergência',
        ip: ip || '127.0.0.1',
        detalhes: 'Restauração do modo operacional normal.'
      });
      this.addActivityLog({
        usuario: 'Sistema (Emergência)',
        dataHora: new Date().toISOString(),
        ip: ip || '127.0.0.1',
        operacao: 'Desativação Break Glass',
        modulo: 'seguranca',
        detalhes: `Modo de Emergência desativado com sucesso. Restabelecida operação normal.`
      });
    }
    this.saveSecurityConfig(cfg);
    return cfg;
  }

  public executeEmergencyAction(action: string, payload: any, ip?: string): { success: boolean; message: string; tempPassword?: string } {
    let message = '';
    let tempPassword: string | undefined = undefined;

    if (action === 'create_master' || action === 'repair_master') {
      const salt = generateSalt();
      const randomPassword = crypto.randomBytes(18).toString('base64url');
      const hasCustomPass = payload?.password && typeof payload.password === 'string' && payload.password.trim() !== '';
      const newPass = hasCustomPass ? payload.password.trim() : randomPassword;

      if (!hasCustomPass) {
        tempPassword = randomPassword;
      }

      const masterEmail = (payload?.email || 'tecnicodimepdf@gmail.com').toLowerCase().trim();
      const masterName = payload?.nomeCompleto || 'Renato Santos';
      const empresaName = payload?.empresa || '';
      const identifier = cleanIdentifier(payload?.identifier || '');

      let masterUser = this.data.users.find(u => u.email.toLowerCase() === masterEmail);
      if (!masterUser) {
        masterUser = {
          id: 'user_master_emergency_' + Date.now(),
          nomeCompleto: masterName,
          email: masterEmail,
          salt: salt,
          passwordHash: hashPasswordWithSalt(newPass, salt),
          key: '',
          identifier: identifier,
          empresa: empresaName,
          dataCadastro: new Date().toISOString(),
          dataUltimaAlteracao: new Date().toISOString(),
          dataUltimoAcesso: null,
          status: 'ATIVO',
          perfilAcesso: 'Master',
          criadorEmail: 'Modo de Emergência (Break Glass)',
          precisaTrocarSenha: true,
          tentativasLogin: 0,
          bloqueadoAte: null,
          perguntasSeguranca: getDefaultSecurityQuestions(masterEmail, empresaName, identifier)
        };
        this.data.users.unshift(masterUser);
      } else {
        masterUser.nomeCompleto = masterName;
        masterUser.status = 'ATIVO';
        masterUser.perfilAcesso = 'Master';
        masterUser.salt = salt;
        masterUser.passwordHash = hashPasswordWithSalt(newPass, salt);
        masterUser.tentativasLogin = 0;
        masterUser.bloqueadoAte = null;
        masterUser.precisaTrocarSenha = true;
        masterUser.perguntasSeguranca = getDefaultSecurityQuestions(masterEmail, empresaName, identifier);
      }
      this.saveUsers(this.data.users);
      if (tempPassword) {
        message = `Usuário Master (${masterEmail}) recriado/redefinido com sucesso via Modo de Emergência! Senha temporária: ${tempPassword}`;
      } else {
        message = `Usuário Master (${masterEmail}) recriado/redefinido com sucesso via Modo de Emergência!`;
      }
    } else if (action === 'unlock_users') {
      let count = 0;
      this.data.users.forEach(u => {
        if (u.status === 'BLOQUEADO' || u.bloqueadoAte || (u.tentativasLogin && u.tentativasLogin > 0)) {
          u.status = 'ATIVO';
          u.bloqueadoAte = null;
          u.tentativasLogin = 0;
          count++;
        }
      });
      this.saveUsers(this.data.users);
      message = `Desbloqueio efetuado para ${count} usuário(s) no sistema.`;
    } else if (action === 'repair_permissions') {
      this.ensureDefaultProfiles();
      const masterProfile = this.data.profiles.find(p => p.nome === 'Master');
      if (masterProfile) {
        masterProfile.permissoes = ['*'];
      }
      this.saveProfiles(this.data.profiles);
      this.data.users.forEach(u => {
        if (u.email.toLowerCase() === 'tecnicodimepdf@gmail.com') {
          u.perfilAcesso = 'Master';
          u.status = 'ATIVO';
        }
      });
      this.saveUsers(this.data.users);
      message = 'Matriz de permissões e perfil Master restaurados com sucesso.';
    } else {
      message = 'Ação de emergência executada com sucesso.';
    }

    // Registrar ação no log e desativar EmergencyAccess automaticamente
    const cfg = this.getSecurityConfig();
    cfg.EmergencyLog.unshift({
      dataHora: new Date().toISOString(),
      acao: `Ação Concluída: ${action}`,
      ip: ip || '127.0.0.1',
      detalhes: message
    });
    cfg.EmergencyAccess = false; // Restauração automática do modo operacional normal
    this.saveSecurityConfig(cfg);

    this.addActivityLog({
      usuario: 'Sistema (Emergência)',
      dataHora: new Date().toISOString(),
      ip: ip || '127.0.0.1',
      operacao: 'Ação de Emergência Concluída',
      modulo: 'seguranca',
      detalhes: `${message} O Modo de Emergência foi desativado automaticamente.`
    });

    return { success: true, message, ...(tempPassword ? { tempPassword } : {}) };
  }

  public save() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      const tempFile = `${DB_FILE}.tmp`;
      const bakFile = `${DB_FILE}.bak`;
      const jsonStr = JSON.stringify(this.data, null, 2);

      // Escrita atômica para evitar corrupção em reinicializações incompletas
      fs.writeFileSync(tempFile, jsonStr, 'utf-8');
      if (fs.existsSync(DB_FILE)) {
        fs.copyFileSync(DB_FILE, bakFile);
      }
      fs.renameSync(tempFile, DB_FILE);
      if (fs.existsSync(DB_FILE)) {
        this.lastMtime = fs.statSync(DB_FILE).mtimeMs;
      }
    } catch (error) {
      console.error('Erro ao salvar o banco de dados:', error);
    }
  }

  // Config methods
  public getConfig(): DimepConfig {
    this.checkReload();
    this.ensureMultiEmpresaConfig();
    return this.data.config;
  }

  public saveConfig(config: DimepConfig): void {
    this.data.config = { ...config };
    this.ensureMultiEmpresaConfig();

    if (config.identifier || config.key) {
      this.syncCentralIntegrationData({
        cnpj: config.identifier,
        key: config.key,
        razaoSocial: config.nomeEmpresaConectada,
        setAsActive: true
      });
    } else {
      this.save();
    }
  }

  // Empresa methods
  public getEmpresas(): Empresa[] {
    this.checkReload();
    return this.data.empresas;
  }

  public saveEmpresas(empresas: Empresa[]): void {
    this.data.empresas = empresas;
    this.save();
  }

  // Funcionario methods
  public getFuncionarios(): Funcionario[] {
    this.checkReload();
    return this.data.funcionarios;
  }

  public saveFuncionarios(funcionarios: Funcionario[]): void {
    this.data.funcionarios = funcionarios;
    this.save();
  }

  // Marcacoes methods
  public getMarcacoes(): Marcacao[] {
    this.checkReload();
    return this.data.marcacoes;
  }

  public saveMarcacoes(marcacoes: Marcacao[]): void {
    this.data.marcacoes = marcacoes;
    this.save();
  }

  // Jornadas methods
  public getJornadas(): JornadaCalculada[] {
    this.checkReload();
    return this.data.jornadas;
  }

  public saveJornadas(jornadas: JornadaCalculada[]): void {
    this.data.jornadas = jornadas;
    this.save();
  }

  // Ocorrencias methods
  public getOcorrencias(): Ocorrencia[] {
    this.checkReload();
    return this.data.ocorrencias;
  }

  public saveOcorrencias(ocorrencias: Ocorrencia[]): void {
    this.data.ocorrencias = ocorrencias;
    this.save();
  }

  // SyncLog methods
  public getSyncLogs(): SyncLog[] {
    this.checkReload();
    return this.data.syncLogs;
  }

  public addSyncLog(log: Omit<SyncLog, 'id'>): SyncLog {
    const newLog: SyncLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    this.data.syncLogs.unshift(newLog); // Insere no início (mais recentes primeiro)
    // Limita o histórico a 100 logs
    if (this.data.syncLogs.length > 100) {
      this.data.syncLogs = this.data.syncLogs.slice(0, 100);
    }
    this.save();
    return newLog;
  }

  // User methods
  public getUsers(): User[] {
    this.checkReload();
    return this.data.users;
  }

  public saveUsers(users: User[]): void {
    // Garantia de Segurança: O usuário Master (tecnicodimepdf@gmail.com) nunca pode ser removido, desativado ou rebaixado
    const masterEmail = 'tecnicodimepdf@gmail.com';
    let masterInNewList = users.find(u => u.email.toLowerCase() === masterEmail || u.perfilAcesso === 'Master');
    
    if (!masterInNewList) {
      const existingMaster = this.data.users.find(u => u.email.toLowerCase() === masterEmail);
      if (existingMaster) {
        masterInNewList = existingMaster;
        users.unshift(masterInNewList);
      }
    }
    
    if (masterInNewList) {
      masterInNewList.status = 'ATIVO';
      masterInNewList.perfilAcesso = 'Master';
      masterInNewList.bloqueadoAte = null;
      masterInNewList.tentativasLogin = 0;
    }

    this.data.users = users;

    // Sincroniza usuários com a fonte central de dados de empresas REST
    const sysConfig = this.data.config;
    if (sysConfig && Array.isArray(sysConfig.empresasRest) && sysConfig.empresasRest.length > 0) {
      const activeEmp = sysConfig.empresasRest.find(e => e.ativa) || sysConfig.empresasRest[0];
      this.data.users.forEach(u => {
        if (u.perfilAcesso === 'Master' || u.perfilAcesso === 'Administrador') {
          if (activeEmp) {
            u.identifier = activeEmp.cnpj;
            u.key = activeEmp.key;
            u.empresa = activeEmp.razaoSocial;
          }
        } else if (u.identifier) {
          const uClean = cleanIdentifier(u.identifier);
          const emp = sysConfig.empresasRest.find(e => cleanIdentifier(e.cnpj) === uClean);
          if (emp) {
            u.key = emp.key;
            u.empresa = emp.razaoSocial;
            u.identifier = emp.cnpj;
          }
        }
      });
    }

    this.save();
  }

  public loadDemoEnvironment(): { success: boolean; message: string } {
    try {
      const demoDir = path.join(process.cwd(), 'data', 'demo');
      const demoFile = path.join(demoDir, 'demo-db.json');

      if (!fs.existsSync(demoDir)) {
        fs.mkdirSync(demoDir, { recursive: true });
      }

      if (!fs.existsSync(demoFile)) {
        const mockEmpresas: Empresa[] = [
          { id: 'emp_demo_1', cnpj: '12.345.678/0001-99', razaoSocial: 'Dimep Auditoria Matriz S.A.', nomeFantasia: 'Auditoria Matriz (Demo)' },
          { id: 'emp_demo_2', cnpj: '12.345.678/0002-88', razaoSocial: 'Dimep CD Extrema Logística Ltda', nomeFantasia: 'CD Extrema (Demo)' }
        ];
        fs.writeFileSync(demoFile, JSON.stringify({
          empresas: mockEmpresas,
          funcionarios: [],
          marcacoes: [],
          jornadas: [],
          ocorrencias: []
        }, null, 2), 'utf-8');
      }

      const demoContent = JSON.parse(fs.readFileSync(demoFile, 'utf-8'));
      this.data.empresas = demoContent.empresas || [];
      this.data.funcionarios = demoContent.funcionarios || [];
      this.data.marcacoes = demoContent.marcacoes || [];
      this.data.jornadas = demoContent.jornadas || [];
      this.data.ocorrencias = demoContent.ocorrencias || [];
      this.data.config.appMode = 'DEMONSTRAÇÃO';
      this.data.config.isDemoActive = true;
      this.save();
      return { success: true, message: 'Ambiente de Demonstração carregado com sucesso a partir de /data/demo/demo-db.json.' };
    } catch (err: any) {
      return { success: false, message: `Erro ao carregar banco de demonstração: ${err.message || err}` };
    }
  }

  public unloadDemoEnvironment(): { success: boolean; message: string } {
    this.data.empresas = [];
    this.data.funcionarios = [];
    this.data.marcacoes = [];
    this.data.jornadas = [];
    this.data.ocorrencias = [];
    this.data.syncLogs = [];
    this.data.config.appMode = 'REAL';
    this.data.config.isDemoActive = false;
    this.data.activeSessions = [];
    this.save();
    return { success: true, message: 'Retornado ao Ambiente Operacional limpo. Dados de demonstração e sessões anteriores foram removidos.' };
  }

  // Profile methods
  public getProfiles(): Profile[] {
    return this.data.profiles;
  }

  public saveProfiles(profiles: Profile[]): void {
    this.data.profiles = profiles;
    this.save();
  }

  public saveProfile(profile: Profile): Profile {
    const idx = this.data.profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      this.data.profiles[idx] = { ...profile, dataUltimaAlteracao: new Date().toISOString() };
    } else {
      this.data.profiles.push({
        ...profile,
        dataCriacao: profile.dataCriacao || new Date().toISOString(),
        dataUltimaAlteracao: new Date().toISOString()
      });
    }
    this.save();
    return profile;
  }

  public deleteProfile(profileId: string): boolean {
    const idx = this.data.profiles.findIndex(p => p.id === profileId);
    if (idx < 0) return false;
    this.data.profiles.splice(idx, 1);
    this.save();
    return true;
  }

  // ActivityLog methods
  public getActivityLogs(): ActivityLog[] {
    return this.data.activityLogs;
  }

  public addActivityLog(log: Omit<ActivityLog, 'id'>): ActivityLog {
    const newLog: ActivityLog = {
      ...log,
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    this.data.activityLogs.unshift(newLog);
    if (this.data.activityLogs.length > 1000) {
      this.data.activityLogs = this.data.activityLogs.slice(0, 1000);
    }
    this.save();
    return newLog;
  }

  // UsageStats methods
  public getUsageStats(): UsageStats {
    return this.data.usageStats;
  }

  public saveUsageStats(stats: UsageStats): void {
    this.data.usageStats = stats;
    this.save();
  }

  // Active Sessions Methods
  public getActiveSessions(): UserSession[] {
    if (!this.data.activeSessions) {
      this.data.activeSessions = [];
    }
    return this.data.activeSessions;
  }

  public saveActiveSessions(sessions: UserSession[]): void {
    this.data.activeSessions = sessions;
    this.save();
  }

  public addActiveSession(session: UserSession): void {
    if (!this.data.activeSessions) {
      this.data.activeSessions = [];
    }
    // Consolidação: Evitar múltiplas sessões ATIVAS para o mesmo usuário se desejado
    // Aqui permitimos múltiplas sessões (dispositivos diferentes), mas removemos duplicatas exatas de token
    this.data.activeSessions = this.data.activeSessions.filter(s => s.token !== session.token);
    this.data.activeSessions.push(session);
    this.save();
  }

  public removeActiveSession(token: string): void {
    if (!this.data.activeSessions) return;
    this.data.activeSessions = this.data.activeSessions.filter(s => s.token !== token);
    this.save();
  }

  public touchActiveSession(token: string): void {
    if (!this.data.activeSessions) return;
    const sess = this.data.activeSessions.find(s => s.token === token);
    if (sess) {
      sess.lastActivityMs = Date.now();
      sess.lastActivityTime = new Date().toISOString();
      // Removido this.save() para evitar overhead de disco a cada request
    }
  }

  public cleanExpiredSessions(timeoutMinutes: number = 30): void {
    if (!this.data.activeSessions) return;
    const now = Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const initialCount = this.data.activeSessions.length;
    
    this.data.activeSessions = this.data.activeSessions.filter(s => {
      // O usuário Master possui isenção permanente de expiração por inatividade
      if (s.perfilAcesso === 'Master' || s.userEmail?.toLowerCase() === 'tecnicodimepdf@gmail.com') {
        return s.status === 'ATIVA';
      }
      const lastAct = s.lastActivityMs || now;
      const isExpired = (now - lastAct) > timeoutMs;
      return !isExpired && s.status === 'ATIVA';
    });

    if (this.data.activeSessions.length !== initialCount) {
      this.save();
    }
  }

  // Eliminar sessões inconsistentes ou órfãs (Requisito 5)
  public auditSessions(): void {
    if (!this.data.activeSessions) return;
    const initialCount = this.data.activeSessions.length;
    const validUserIds = new Set(this.data.users.map(u => u.id));
    const validUserEmails = new Set(this.data.users.map(u => u.email.toLowerCase()));

    this.data.activeSessions = this.data.activeSessions.filter(s => {
      const userExists = validUserIds.has(s.userId) || validUserEmails.has(s.userEmail.toLowerCase());
      return userExists && s.status === 'ATIVA' && s.token && s.userId;
    });

    if (this.data.activeSessions.length !== initialCount) {
      this.save();
    }
  }

  public clearAllData(): void {
    this.data.empresas = [];
    this.data.funcionarios = [];
    this.data.marcacoes = [];
    this.data.jornadas = [];
    this.data.ocorrencias = [];
    this.save();
  }

  public clearLogs(category: 'auditoria' | 'tecnico' | 'sistema' | 'all' = 'all'): void {
    if (category === 'auditoria' || category === 'all') {
      this.data.activityLogs = [];
    }
    if (category === 'tecnico' || category === 'all') {
      this.data.syncLogs = [];
    }
    if (category === 'all') {
      this.data.usageStats = {
        totalAcessos: 0,
        modulosAcessados: {},
        horariosUtilizacao: {},
        relatoriosGerados: 0,
        exportacoesRealizadas: 0
      };
    }
    this.save();
  }

  public resetToCleanSetup(): void {
    this.data.config.isCleanSetup = true;
    this.data.config.setupCompleted = false;
    this.data.empresas = [];
    this.data.funcionarios = [];
    this.data.marcacoes = [];
    this.data.jornadas = [];
    this.data.ocorrencias = [];
    this.data.syncLogs = [];
    this.data.activeSessions = [];
    this.data.users = [];
    this.ensureDefaultProfiles();
    this.ensureMasterAccount();
    this.save();
  }

  public getRawData(): DatabaseSchema {
    return this.data;
  }

  public restoreRawData(newData: Partial<DatabaseSchema>): boolean {
    try {
      // Backup de segurança automático pré-restauração
      try {
        const fs = require('fs');
        const path = require('path');
        const backupDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        const preRestoreFilename = `auto_backup_pre_restore_${Date.now()}.json`;
        fs.writeFileSync(path.join(backupDir, preRestoreFilename), JSON.stringify(this.data, null, 2), 'utf-8');
        console.log(`[BACKUP] Backup de segurança pré-restauração salvo em: backups/${preRestoreFilename}`);
      } catch (backupErr) {
        console.warn('Aviso ao criar backup de segurança pré-restauração:', backupErr);
      }

      if (newData.config) this.data.config = { ...newData.config };
      if (newData.empresas) this.data.empresas = newData.empresas;
      if (newData.funcionarios) this.data.funcionarios = newData.funcionarios;
      if (newData.marcacoes) this.data.marcacoes = newData.marcacoes;
      if (newData.jornadas) this.data.jornadas = newData.jornadas;
      if (newData.ocorrencias) this.data.ocorrencias = newData.ocorrencias;
      if (newData.syncLogs) this.data.syncLogs = newData.syncLogs;
      if (newData.users) this.data.users = newData.users;
      if (newData.profiles) this.data.profiles = newData.profiles;
      if (newData.activityLogs) this.data.activityLogs = newData.activityLogs;
      if (newData.usageStats) this.data.usageStats = newData.usageStats;
      if (newData.activeSessions) this.data.activeSessions = newData.activeSessions;
      this.save();
      return true;
    } catch (e) {
      console.error('Erro ao restaurar banco de dados:', e);
      return false;
    }
  }
}

export const dbInstance = new Database();
