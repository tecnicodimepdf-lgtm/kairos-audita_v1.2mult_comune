/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { dbInstance, hashPassword, hashPasswordWithSalt, generateSalt, getDefaultSecurityQuestions, hashAnswer, verifyAndMigratePassword, hashPasswordSHA256, toSafeUserDTO } from './server/db';
import { processarAuditoria, calcularScoresFuncionarios, resolverEConsolidarVinculos } from './server/engine';
import { runPythonAudit } from './server/pythonBridge';
import { testConnection, syncRealDimepKairos, cleanIdentifier } from './server/kairos';
import { DimepConfig, SyncLog, User, Profile, ActivityLog, UsageStats, UserSession, Empresa, MAX_COMPANIES } from './src/types';
import { writeOpLog, readOpLogs, clearOpLogs } from './server/logger';

const activeSessionsMap = new Map<string, UserSession>();

// Sincroniza as sessões persistentes com o mapa em memória na inicialização
const persistedSessions = dbInstance.getActiveSessions();
persistedSessions.forEach(sess => {
  activeSessionsMap.set(sess.token, sess);
});

// Registrar log de inicialização do sistema
logActivity(null, 'Inicialização', 'sistema', `O servidor Dimep Cloud foi iniciado. ${persistedSessions.length} sessões recuperadas da base persistente.`);

export const ALL_PERMISSIONS_IDS = [
  'admin_acesso_total',
  'login_acesso', 'login_recuperacao', 'login_alteracao_senha',
  'dashboard_executivo_visualizar', 'dashboard_executivo_filtros', 'dashboard_executivo_expandir_graficos', 'dashboard_executivo_exportar', 'dashboard_executivo_atalhos',
  'dashboard_rh_visualizar', 'dashboard_rh_filtros', 'dashboard_rh_relatorios', 'dashboard_rh_navegar',
  'dashboard_gerencial_visualizar', 'dashboard_gerencial_filtros', 'dashboard_gerencial_exportar',
  'auditoria_visualizar', 'auditoria_filtrar', 'auditoria_executar', 'auditoria_exportar_csv', 'auditoria_gerar_pdf', 'auditoria_imprimir', 'auditoria_agrupar_departamento', 'auditoria_detalhes',
  'funcionarios_visualizar', 'funcionarios_consultar', 'funcionarios_ativos', 'funcionarios_desligados', 'funcionarios_exportar', 'funcionarios_historico', 'funcionarios_pesquisa', 'funcionarios_gerar_relatorios',
  'configuracao_visualizar', 'configuracao_empresa', 'configuracao_sincronizar', 'configuracao_rest_api', 'configuracao_logs', 'configuracao_atualizar', 'configuracao_editar', 'configuracao_multiempresa',
  'relatorios_visualizar', 'relatorios_auditoria_pessoa', 'relatorios_auditoria_departamento', 'relatorios_auditoria_geral', 'relatorios_resumo_executivo', 'relatorios_ocorrencias', 'relatorios_gerar_pdf', 'relatorios_gerar_csv', 'relatorios_exportar_dados',
  'painel_master_acesso', 'painel_master_usuarios', 'painel_master_perfis', 'painel_master_permissoes', 'painel_master_backup', 'painel_master_restauracao', 'painel_master_logs', 'painel_master_stats', 'painel_master_configuracoes', 'painel_master_administracao', 'painel_master_auditoria', 'painel_master_banco_dados', 'painel_master_empresa', 'painel_master_seguranca', 'painel_master_break_glass',
  'usuarios_criar', 'usuarios_editar', 'usuarios_excluir', 'usuarios_bloquear', 'usuarios_ativar', 'usuarios_reset_senha', 'usuarios_alterar_perfil',
  'perfis_criar', 'perfis_editar', 'perfis_excluir', 'perfis_clonar',
  'logs_visualizar', 'logs_exportar'
];

function getSessionData(req: express.Request): { user: User; session: UserSession } | null {
  const token = (req.headers['x-session-token'] as string) || (req.query.token as string);
  if (!token) return null;

  let session = activeSessionsMap.get(token);
  if (!session) {
    const savedSessions = dbInstance.getActiveSessions();
    const found = savedSessions.find(s => s.token === token && s.status === 'ATIVA');
    if (found) {
      session = found;
      activeSessionsMap.set(token, session);
    }
  }

  if (!session) return null;

  const users = dbInstance.getUsers();
  const user = users.find(u => u.id === session.userId || u.email.toLowerCase() === session.userEmail.toLowerCase());
  if (!user || user.status === 'BLOQUEADO' || user.status === 'INATIVO') {
    activeSessionsMap.delete(token);
    dbInstance.removeActiveSession(token);
    return null;
  }

  const config = dbInstance.getConfig();
  const timeoutMinutes = config.sessionTimeoutMinutes || 30;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const now = Date.now();

  if (!session.lastActivityMs || isNaN(session.lastActivityMs)) {
    session.lastActivityMs = now;
  }

  // Requisito 7: O usuário Master constitui exceção permanente de inatividade
  if (user.perfilAcesso !== 'Master' && user.email.toLowerCase() !== 'tecnicodimepdf@gmail.com') {
    if (now - session.lastActivityMs > timeoutMs) {
      activeSessionsMap.delete(token);
      dbInstance.removeActiveSession(token);
      logActivity(req, 'Inatividade', 'seguranca', `Sessão expirada por inatividade (${timeoutMinutes} min): ${session.userEmail}`);
      return null;
    }
  }

  session.lastActivityMs = now;
  session.lastActivityTime = new Date().toISOString();
  session.empresa = user.empresa;
  session.perfilAcesso = user.perfilAcesso;
  
  dbInstance.touchActiveSession(token);

  return { user, session };
}

function getSessionUser(req: express.Request): User | null {
  const data = getSessionData(req);
  return data ? data.user : null;
}

function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  if (user.status === 'BLOQUEADO' || user.status === 'INATIVO') return false;
  if (user.perfilAcesso === 'Master') return true; // Master possui acesso total irrestrito

  const profiles = dbInstance.getProfiles();
  const profile = profiles.find(p => p.id === user.perfilAcesso || p.nome.toLowerCase() === user.perfilAcesso.toLowerCase().trim());
  if (!profile || profile.status === 'INATIVO') return false;

  if (profile.permissoes.includes('admin_acesso_total') || profile.permissoes.includes('*')) {
    return true;
  }

  return profile.permissoes.includes(permission);
}

function getUserPermissions(user: User | null): string[] {
  if (!user || user.status === 'BLOQUEADO' || user.status === 'INATIVO') return [];
  if (user.perfilAcesso === 'Master') {
    return ALL_PERMISSIONS_IDS;
  }
  const profiles = dbInstance.getProfiles();
  const profile = profiles.find(p => p.id === user.perfilAcesso || p.nome.toLowerCase() === user.perfilAcesso.toLowerCase().trim());
  if (!profile || profile.status === 'INATIVO') return [];
  if (profile.permissoes.includes('admin_acesso_total') || profile.permissoes.includes('*')) {
    return ALL_PERMISSIONS_IDS;
  }
  return profile.permissoes || [];
}

function isDemoValue(val?: string): boolean {
  if (!val) return true;
  const lower = val.trim().toLowerCase();
  const DEMO_STRINGS = [
    '37.120.466/0001-30', '37120466000130', '00.000.000/0001-00', '12.345.678/0001-99',
    'c7867c41-9650-4b0c-a0cf-a76f8c95a3d3', 'demo-rest-key', 'key_demo',
    'dimep auditorias s.a.', 'dimep auditorias s.a. (demo)', 'dimep sistemas', 'audit kairos matriz s.a.'
  ];
  return DEMO_STRINGS.includes(lower);
}

function getUserConfig(req: express.Request): DimepConfig {
  const sysConfig = dbInstance.getConfig();
  const sessionUser = getSessionUser(req);

  // Garante a integridade da lista multiempresa
  dbInstance.ensureMultiEmpresaConfig();

  // Recupera a empresa ativa da Gestão Multiempresa
  const activeEmp = Array.isArray(sysConfig.empresasRest) && sysConfig.empresasRest.length > 0
    ? (sysConfig.empresasRest.find(e => e.ativa) || sysConfig.empresasRest[0])
    : null;

  if (activeEmp) {
    if (activeEmp.cnpj) sysConfig.identifier = activeEmp.cnpj;
    if (activeEmp.key) sysConfig.key = activeEmp.key;
    if (activeEmp.razaoSocial) sysConfig.nomeEmpresaConectada = activeEmp.razaoSocial;
    if (activeEmp.companyId !== undefined) sysConfig.companyId = activeEmp.companyId;
    if (activeEmp.companyCode !== undefined) sysConfig.companyCode = activeEmp.companyCode;
  }

  // Se o usuário logado for de perfil restrito (não-Master e não-Admin) com vínculo específico de empresa
  if (sessionUser && sessionUser.perfilAcesso !== 'Master' && sessionUser.perfilAcesso !== 'Administrador' && sessionUser.identifier) {
    const uCleanId = cleanIdentifier(sessionUser.identifier);
    const userEmp = sysConfig.empresasRest?.find(e => cleanIdentifier(e.cnpj) === uCleanId);
    if (userEmp) {
      return {
        ...sysConfig,
        identifier: userEmp.cnpj,
        key: isDemoValue(userEmp.key) ? '' : (userEmp.key || ''),
        nomeEmpresaConectada: userEmp.razaoSocial || sysConfig.nomeEmpresaConectada,
        companyId: userEmp.companyId ?? sysConfig.companyId,
        companyCode: userEmp.companyCode ?? sysConfig.companyCode
      };
    }
  }

  const sysKey = isDemoValue(sysConfig.key) ? '' : (sysConfig.key || '');
  const sysId = isDemoValue(sysConfig.identifier) ? '' : (sysConfig.identifier || '');
  const sysEmp = isDemoValue(sysConfig.nomeEmpresaConectada) ? '' : (sysConfig.nomeEmpresaConectada || '');

  return {
    ...sysConfig,
    key: sysKey,
    identifier: sysId,
    nomeEmpresaConectada: sysEmp
  };
}

function logActivity(req: express.Request | null, operation: string, modulo: string, detalhes: string) {
  const user = req ? getSessionUser(req) : null;
  const email = user ? user.email : 'Sistema';
  const ip = req ? (req.ip || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1';
  
  dbInstance.addActivityLog({
    usuario: email,
    dataHora: new Date().toISOString(),
    ip,
    operacao: operation,
    modulo,
    detalhes
  });

  // Track in usage stats
  const stats = dbInstance.getUsageStats();
  stats.totalAcessos = (stats.totalAcessos || 0) + (operation === 'Login' ? 1 : 0);
  
  if (modulo && modulo !== 'none') {
    stats.modulosAcessados = stats.modulosAcessados || {};
    stats.modulosAcessados[modulo] = (stats.modulosAcessados[modulo] || 0) + 1;
  }
  
  const hour = new Date().getHours().toString().padStart(2, '0');
  stats.horariosUtilizacao = stats.horariosUtilizacao || {};
  stats.horariosUtilizacao[hour] = (stats.horariosUtilizacao[hour] || 0) + 1;
  
  if (operation.includes('Exportar') || operation.includes('Download') || operation.includes('Backup')) {
    stats.exportacoesRealizadas = (stats.exportacoesRealizadas || 0) + 1;
  }
  if (operation.includes('Relatório') || operation.includes('Gerar')) {
    stats.relatoriosGerados = (stats.relatoriosGerados || 0) + 1;
  }
  
  dbInstance.saveUsageStats(stats);
  writeOpLog(
    operation.includes('Falha') || operation.includes('Erro') ? 'FALHA' : 'SUCESSO',
    operation,
    detalhes,
    `Usuário: ${email} | IP: ${ip}`
  );
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Rate Limiter Global para APIs (/api)
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas requisições enviadas. Por favor, aguarde alguns minutos.' }
});

// Rate Limiter Estrito para Autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas tentativas de autenticação. Por favor, aguarde 15 minutos.' }
});

app.use('/api/', globalApiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/recover', authLimiter);
app.use('/api/auth/first-access-reset', authLimiter);

// Inicialização e revalidação do banco de dados na inicialização
const funcionariosIniciais = dbInstance.getFuncionarios();
const configAtual = dbInstance.getConfig();

if (!configAtual.appMode) {
  configAtual.appMode = 'REAL';
  dbInstance.saveConfig(configAtual);
}

if (funcionariosIniciais.length > 0) {
  // Re-executa o motor analítico em Python para revalidar todas as ocorrências existentes
  const marcacoesAtuais = dbInstance.getMarcacoes();
  runPythonAudit(funcionariosIniciais, marcacoesAtuais).then(auditResult => {
    dbInstance.saveJornadas(auditResult.jornadas);
    dbInstance.saveOcorrencias(auditResult.ocorrencias);
    dbInstance.saveFuncionarios(auditResult.funcionariosAtualizados);
  });
} else {
  console.log('[STARTUP] Banco de dados inicializado em branco (Modo REAL ativo). Apenas a estrutura do banco foi criada.');
}

// ----------------------------------------------------
// UTILS DE BI E FILTROS CRUZADOS (SERVER-SIDE)
// ----------------------------------------------------
function getFilteredRecords(query: any, req?: express.Request) {
  let funcs = dbInstance.getFuncionarios();
  let jorns = dbInstance.getJornadas();
  let ocs = dbInstance.getOcorrencias();

  const user = req ? getSessionUser(req) : null;
  if (user && user.perfilAcesso !== 'Master' && user.identifier) {
    const userCnpj = cleanIdentifier(user.identifier);
    const empresas = dbInstance.getEmpresas();
    const allowedEmpIds = empresas
      .filter((e) => cleanIdentifier(e.cnpj) === userCnpj)
      .map((e) => e.id);

    funcs = funcs.filter(
      (f) => allowedEmpIds.includes(f.empresaId) || cleanIdentifier(f.empresaId) === userCnpj
    );
    
    const allowedFuncIds = new Set(funcs.map((f) => f.id));
    jorns = jorns.filter((j) => allowedFuncIds.has(j.funcionarioId));
    ocs = ocs.filter((o) => allowedFuncIds.has(o.funcionarioId));
  }

  // Consolidação e deduplicação de múltiplos vínculos por pessoa
  const consolidacao = resolverEConsolidarVinculos(funcs);

  const empresaId = query.empresaId || '';
  const departamento = query.departamento || '';
  const centroCusto = query.centroCusto || '';
  const cargo = query.cargo || '';
  const gestor = query.gestor || '';
  const grauRisco = query.grauRisco || '';
  const dataInicio = query.dataInicio || '';
  const dataFim = query.dataFim || '';
  const buscaFuncionario = query.buscaFuncionario || '';
  const tipoOcorrencia = query.tipoOcorrencia || query.tipo || '';
  const statusFilter = (query.status || '').toUpperCase().trim();

  // Seleciona o conjunto de funcionários com base no filtro de status
  if (statusFilter === 'DESLIGADO') {
    funcs = consolidacao.desligados;
  } else if (statusFilter === 'TODOS') {
    funcs = consolidacao.todos;
  } else if (statusFilter === 'ATIVO') {
    funcs = consolidacao.ativos;
  } else {
    // Se nenhum filtro explícito de status for passado, considera exclusivamente os cadastros ATIVOS
    funcs = consolidacao.ativos;
  }

  // Remapeia jornadas e ocorrências de IDs históricos para o ID ativo do mesmo colaborador
  jorns = jorns.map((j) => {
    const activeId = consolidacao.mapaHistoricoParaAtivo[j.funcionarioId];
    return activeId && activeId !== j.funcionarioId ? { ...j, funcionarioId: activeId } : j;
  });

  ocs = ocs.map((o) => {
    const activeId = consolidacao.mapaHistoricoParaAtivo[o.funcionarioId];
    return activeId && activeId !== o.funcionarioId ? { ...o, funcionarioId: activeId } : o;
  });

  // Auxiliar para remoção de acentos e padronização de busca
  const removeAccents = (str: string): string => {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  };

  // 1. Filtra Funcionários pelo perfil
  if (empresaId) {
    funcs = funcs.filter((f) => f.empresaId === empresaId);
  }
  if (departamento) {
    funcs = funcs.filter((f) => f.departamento.toLowerCase() === departamento.toLowerCase());
  }
  if (centroCusto) {
    funcs = funcs.filter((f) => f.centroCusto.toLowerCase() === centroCusto.toLowerCase());
  }
  if (cargo) {
    funcs = funcs.filter((f) => f.cargo.toLowerCase() === cargo.toLowerCase());
  }
  if (gestor) {
    funcs = funcs.filter((f) => f.gestor.toLowerCase() === gestor.toLowerCase());
  }
  if (grauRisco) {
    funcs = funcs.filter((f) => f.grauRisco === grauRisco);
  }

  // Busca avançada multi-termo insensível a caixa e acentos (CPF e PIS limpos de formatação)
  if (buscaFuncionario) {
    const cleanSearch = removeAccents(buscaFuncionario);
    const searchTerms = cleanSearch.split(' ').filter(Boolean);

    if (searchTerms.length > 0) {
      funcs = funcs.filter((f) => {
        const cleanNome = removeAccents(f.nome);
        const cleanMatricula = removeAccents(f.matricula || '');
        const cleanCPF = (f.cpf || '').replace(/\D/g, '');
        const cleanPIS = (f.pis || '').replace(/\D/g, '');
        const cleanCracha = removeAccents(f.cracha || '');
        const cleanID = removeAccents(f.id || '');
        const cleanDepto = removeAccents(f.departamento || '');
        const cleanCC = removeAccents(f.centroCusto || '');
        const cleanCargo = removeAccents(f.cargo || '');
        const cleanGestor = removeAccents(f.gestor || '');

        return searchTerms.every(term => 
          cleanNome.includes(term) ||
          cleanMatricula.includes(term) ||
          cleanCPF.includes(term) ||
          cleanPIS.includes(term) ||
          cleanCracha.includes(term) ||
          cleanID.includes(term) ||
          cleanDepto.includes(term) ||
          cleanCC.includes(term) ||
          cleanCargo.includes(term) ||
          cleanGestor.includes(term)
        );
      });
    }
  }

  const activeFuncIds = new Set(funcs.map((f) => f.id));

  // 2. Filtra Jornadas e Ocorrências baseando-se nos funcionários filtrados e períodos de data
  jorns = jorns.filter((j) => activeFuncIds.has(j.funcionarioId));
  ocs = ocs.filter((o) => activeFuncIds.has(o.funcionarioId));

  if (tipoOcorrencia) {
    ocs = ocs.filter((o) => o.tipo === tipoOcorrencia);
  }

  const sexo = query.sexo as string;
  if (sexo && sexo !== 'Todos' && sexo !== 'TODOS') {
    const normSexo = sexo.toUpperCase();
    funcs = funcs.filter(f => {
      const fSexo = ((f as any).sexo || '').toUpperCase();
      if (normSexo === 'MASCULINO' || normSexo === 'M') {
        return fSexo === 'MASCULINO' || fSexo === 'M';
      }
      if (normSexo === 'FEMININO' || normSexo === 'F') {
        return fSexo === 'FEMININO' || fSexo === 'F';
      }
      return fSexo.includes(normSexo);
    });
  }

  const valorPermitido = query.valorPermitido as string;
  if (valorPermitido) {
    ocs = ocs.filter(o => o.valorPermitido === valorPermitido);
  }

  if (dataInicio) {
    jorns = jorns.filter((j) => j.data >= dataInicio);
    ocs = ocs.filter((o) => o.data >= dataInicio);
  }
  if (dataFim) {
    jorns = jorns.filter((j) => j.data <= dataFim);
    ocs = ocs.filter((o) => o.data <= dataFim);
  }

  return { funcs, jorns, ocs };
}

// ----------------------------------------------------
// ROTAS DE API REST
// ----------------------------------------------------

// 1. Configurações Dimep Kairos
app.get('/api/config', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'configuracao_visualizar') && !hasPermission(user, 'configuracao_editar'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para visualizar as configurações.' });
  }
  res.json(getUserConfig(req));
});

app.post('/api/config', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'configuracao_editar') && !hasPermission(user, 'configuracao_multiempresa'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para alterar as configurações.' });
  }
  const novaConfig = req.body as DimepConfig;
  
  // 1. Sincroniza e persiste via Fonte Central Persistente
  const { config: updatedConfig } = dbInstance.syncCentralIntegrationData({
    cnpj: novaConfig.identifier,
    key: novaConfig.key,
    razaoSocial: novaConfig.nomeEmpresaConectada,
    setAsActive: true
  });

  // 2. Atualiza demais campos de configuração não-credenciais
  if (novaConfig.host) updatedConfig.host = novaConfig.host;
  if (novaConfig.hostDimep) updatedConfig.hostDimep = novaConfig.hostDimep;
  if (novaConfig.periodoPadrao) updatedConfig.periodoPadrao = novaConfig.periodoPadrao;
  if (novaConfig.agendamentoSinc) updatedConfig.agendamentoSinc = novaConfig.agendamentoSinc;
  if (novaConfig.appMode) updatedConfig.appMode = novaConfig.appMode;
  if (novaConfig.companyId !== undefined) updatedConfig.companyId = novaConfig.companyId;
  if (novaConfig.companyCode !== undefined) updatedConfig.companyCode = novaConfig.companyCode;
  if (novaConfig.sessionTimeoutMinutes !== undefined) updatedConfig.sessionTimeoutMinutes = Number(novaConfig.sessionTimeoutMinutes);
  if (novaConfig.heartbeatIntervalMinutes !== undefined) updatedConfig.heartbeatIntervalMinutes = Number(novaConfig.heartbeatIntervalMinutes);

  dbInstance.saveConfig(updatedConfig);

  const sessionToken = req.headers['x-session-token'] as string;
  if (sessionToken && activeSessionsMap.has(sessionToken)) {
    const sess = activeSessionsMap.get(sessionToken)!;
    if (novaConfig.nomeEmpresaConectada) sess.empresa = novaConfig.nomeEmpresaConectada;
    dbInstance.touchActiveSession(sessionToken);
  }

  logActivity(req, 'Configurações', 'configuracao', `Configurações da integração REST salvas com sucesso: CNPJ ${novaConfig.identifier || updatedConfig.identifier}`);
  writeOpLog('SUCESSO', 'Salvar Configurações', `Configurações de conexão REST salvas com sucesso no sistema. CNPJ/Identificador: ${novaConfig.identifier || updatedConfig.identifier}`, `Salvo por ${user.email}.`);
  
  res.json({ success: true, message: 'Parâmetros de Integração REST e Empresa salvos com sucesso com persistência permanente!', config: getUserConfig(req) });
});

// Multiempresa: Alternar empresa ativa da integração REST
app.post('/api/empresas-rest/selecionar', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'configuracao_multiempresa') && !hasPermission(user, 'configuracao_editar'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui a permissão "Gerenciar Empresas da Integração REST (Multiempresa)".' });
  }

  const { empresaId } = req.body;
  if (!empresaId) {
    return res.status(400).json({ success: false, message: 'ID da empresa não informado.' });
  }

  const sysConfig = dbInstance.getConfig();
  if (!Array.isArray(sysConfig.empresasRest) || sysConfig.empresasRest.length === 0) {
    return res.status(400).json({ success: false, message: 'Nenhuma empresa cadastrada na lista de integração REST.' });
  }

  const target = sysConfig.empresasRest.find(e => e.id === empresaId);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Empresa não encontrada na lista de integração.' });
  }

  // Alterna ativação na lista de empresas via Fonte Central
  dbInstance.syncCentralIntegrationData({
    empresaId,
    setAsActive: true
  });

  // Isolamento Estrito: Limpa dados locais anteriores ao alterar o contexto da empresa ativa
  dbInstance.clearAllData();

  logActivity(req, 'Multiempresa', 'configuracao', `Empresa ativa alterada para "${target.razaoSocial || target.cnpj}" (CNPJ: ${target.cnpj}).`);
  writeOpLog('SUCESSO', 'Alteração de Empresa Ativa', `Empresa ativa da integração REST alterada para ${target.razaoSocial || target.cnpj} (CNPJ ${target.cnpj}). Dados anteriores isolados.`, `Operação realizada por ${user.email}.`);

  res.json({
    success: true,
    message: `Empresa ativa alterada com sucesso para ${target.razaoSocial || target.cnpj}!`,
    config: getUserConfig(req)
  });
});

// Multiempresa: Adicionar ou Editar empresa na lista REST (até MAX_COMPANIES)
app.post('/api/empresas-rest', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'configuracao_multiempresa') && !hasPermission(user, 'configuracao_editar'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui a permissão "Gerenciar Empresas da Integração REST (Multiempresa)".' });
  }

  const { id, cnpj, key, razaoSocial, ativa } = req.body;
  if (!cnpj || !key) {
    return res.status(400).json({ success: false, message: 'CNPJ/Identificador e REST API Key são obrigatórios.' });
  }

  const cleanCnpj = cleanIdentifier(cnpj);

  const sysConfig = dbInstance.getConfig();
  if (!Array.isArray(sysConfig.empresasRest)) {
    sysConfig.empresasRest = [];
  }

  // Verifica duplicidade de CNPJ
  const duplicateCnpj = sysConfig.empresasRest.find(e => e.id !== id && cleanIdentifier(e.cnpj) === cleanCnpj);
  if (duplicateCnpj) {
    return res.status(400).json({ success: false, message: `Já existe uma empresa cadastrada com este CNPJ (${cnpj}).` });
  }

  if (!id && sysConfig.empresasRest.length >= MAX_COMPANIES) {
    return res.status(400).json({ success: false, message: `Limite máximo de ${MAX_COMPANIES} empresas cadastradas atingido.` });
  }

  const isNew = !id || !sysConfig.empresasRest.some(e => e.id === id);

  dbInstance.syncCentralIntegrationData({
    empresaId: id,
    cnpj,
    key,
    razaoSocial,
    setAsActive: Boolean(ativa)
  });

  logActivity(req, 'Multiempresa', 'configuracao', `${isNew ? 'Adicionada' : 'Atualizada'} empresa "${razaoSocial || cnpj}" na integração REST.`);
  writeOpLog('SUCESSO', 'Gestão Multiempresa', `Empresa ${razaoSocial || cnpj} (CNPJ: ${cnpj}) ${isNew ? 'adicionada' : 'atualizada'} com sucesso.`, `Realizado por ${user.email}.`);

  res.json({
    success: true,
    message: `Empresa ${isNew ? 'cadastrada' : 'atualizada'} com sucesso!`,
    config: getUserConfig(req)
  });
});

// Multiempresa: Excluir empresa da lista REST
app.delete('/api/empresas-rest/:id', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'configuracao_multiempresa') && !hasPermission(user, 'configuracao_editar'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui a permissão "Gerenciar Empresas da Integração REST (Multiempresa)".' });
  }

  const { id } = req.params;
  const sysConfig = dbInstance.getConfig();

  if (!Array.isArray(sysConfig.empresasRest) || sysConfig.empresasRest.length === 0) {
    return res.status(400).json({ success: false, message: 'Nenhuma empresa cadastrada para exclusão.' });
  }

  const index = sysConfig.empresasRest.findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
  }

  const isAtiva = sysConfig.empresasRest[index].ativa;
  sysConfig.empresasRest.splice(index, 1);

  if (isAtiva && sysConfig.empresasRest.length > 0) {
    sysConfig.empresasRest[0].ativa = true;
  }

  dbInstance.syncCentralIntegrationData({});

  logActivity(req, 'Multiempresa', 'configuracao', `Empresa ID ${id} removida da lista da integração REST.`);
  writeOpLog('SUCESSO', 'Exclusão de Empresa REST', `Empresa ID ${id} foi removida da configuração multiempresa.`, `Excluída por ${user.email}.`);

  res.json({
    success: true,
    message: 'Empresa removida com sucesso!',
    config: getUserConfig(req)
  });
});

// Testar Conexão com Dimep Kairos
app.post('/api/config/test', async (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'configuracao_editar')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para testar conexões de rede.' });
  }
  const { host, identifier, key } = req.body;
  if (!host || !identifier || !key) {
    writeOpLog('FALHA', 'Teste de Conexão', 'Parâmetros insuficientes enviados no corpo da requisição.', 'A requisição exige Host, Identificador e Rest API Key.');
    return res.status(400).json({
      success: false,
      message: 'Dados incompletos para testar conexão. Host, Identificador e Rest API Key são obrigatórios.'
    });
  }

  try {
    const result = await testConnection(host, identifier, key);
    if (result.success) {
      const user = getSessionUser(req);
      if (user) {
        const users = dbInstance.getUsers();
        const u = users.find(x => x.id === user.id);
        if (u) {
          u.empresa = result.companyName || u.empresa;
          dbInstance.saveUsers(users);
          const tok = req.headers['x-session-token'] as string;
          if (tok && activeSessionsMap.has(tok)) {
            const sess = activeSessionsMap.get(tok)!;
            sess.empresa = u.empresa;
            dbInstance.touchActiveSession(tok);
          }
        }
      }
      
      const sysConfig = dbInstance.getConfig();
      sysConfig.nomeEmpresaConectada = result.companyName || sysConfig.nomeEmpresaConectada;
      sysConfig.dataUltimaConexaoValida = new Date().toISOString();
      dbInstance.saveConfig(sysConfig);

      logActivity(req, 'Teste de Conexão', 'configuracao', `Conexão bem sucedida com CNPJ ${identifier}. Empresa: ${result.companyName}`);

      res.json({
        success: true,
        message: result.message
      });
    } else {
      logActivity(req, 'Falha no Teste de Conexão', 'configuracao', `Erro de conexão com CNPJ ${identifier}: ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (err: any) {
    logActivity(req, 'Falha no Teste de Conexão', 'configuracao', `Erro interno de conexão com CNPJ ${identifier}: ${err.message || err}`);
    res.status(500).json({
      success: false,
      message: `Falha ao tentar conectar à API do Dimep Kairos: ${err.message || err}`
    });
  }
});

// Sincronizar Agora (coleta e motor de cálculo)
app.post('/api/sync', async (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'auditoria_executar')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para executar sincronizações/auditorias.' });
  }
  const config = getUserConfig(req);

  dbInstance.addSyncLog({
    dataHora: new Date().toISOString(),
    status: 'EM_ANDAMENTO',
    detalhes: 'Iniciando coleta incremental e motor de cálculo trabalhista...',
    registrosColetados: 0
  });

  try {
    if (config.appMode === 'DEMONSTRAÇÃO') {
      // Em modo demonstração, apenas re-executa a auditoria em Python sobre a base de exemplo
      const funcs = dbInstance.getFuncionarios();
      const marcs = dbInstance.getMarcacoes();
      const auditResult = await runPythonAudit(funcs, marcs);
      dbInstance.saveJornadas(auditResult.jornadas);
      dbInstance.saveOcorrencias(auditResult.ocorrencias);
      dbInstance.saveFuncionarios(auditResult.funcionariosAtualizados);

      const logs = dbInstance.getSyncLogs();
      if (logs.length > 0) {
        logs[0].status = 'SUCESSO';
        logs[0].detalhes = 'Auditoria da base de exemplo executada com sucesso em Modo Demonstração.';
        logs[0].registrosColetados = marcs.length;
        dbInstance.save();
      }

      logActivity(req, 'Sincronização', 'configuracao', 'Auditoria executada em Modo Demonstração.');

      return res.json({
        success: true,
        message: 'Auditoria trabalhista executada com sucesso sobre a base de exemplo (Modo Demonstração).',
        logs: dbInstance.getSyncLogs().slice(0, 5)
      });
    }

    // Modo REAL: comunicação exclusiva com a API oficial do Dimep Kairos
    const isRealConfigured = config.key && config.key.trim() !== '' && config.key !== 'demo-rest-key' && config.key !== 'key_demo';

    if (!isRealConfigured) {
      dbInstance.addSyncLog({
        dataHora: new Date().toISOString(),
        status: 'FALHA',
        detalhes: 'Credenciais de API não configuradas. É necessário informar API Key e CNPJ válidos no cadastro.',
        registrosColetados: 0
      });
      return res.status(400).json({
        success: false,
        message: 'Modo REAL ativo: Credenciais de API (API Key e CNPJ) não foram configuradas. Por favor, acesse a guia de Configurações para salvar suas credenciais oficiais.',
        logs: dbInstance.getSyncLogs().slice(0, 5)
      });
    }

    const syncResult = await syncRealDimepKairos(dbInstance, config);
    
    const logs = dbInstance.getSyncLogs();
    if (logs.length > 0) {
      logs[0].status = 'SUCESSO';
      logs[0].detalhes = syncResult.message;
      logs[0].registrosColetados = syncResult.count;
      dbInstance.save();
    }

    const sysConfig = dbInstance.getConfig();
    sysConfig.dataUltimaSincronizacao = new Date().toISOString();
    dbInstance.saveConfig(sysConfig);

    logActivity(req, 'Sincronização', 'configuracao', `Sincronização bem-sucedida com CNPJ ${config.identifier}. ${syncResult.count} registros coletados.`);

    res.json({
      success: true,
      message: syncResult.message,
      logs: dbInstance.getSyncLogs().slice(0, 5)
    });
  } catch (err: any) {
    console.error('[Sync] Erro na sincronização:', err);
    dbInstance.addSyncLog({
      dataHora: new Date().toISOString(),
      status: 'FALHA',
      detalhes: `Erro na API Kairos: ${err.message || err}`,
      registrosColetados: 0
    });
    logActivity(req, 'Falha na Sincronização', 'configuracao', `Erro na sincronização: ${err.message || err}`);
    res.status(500).json({ 
      success: false, 
      message: `Erro ao conectar com a API Dimep Kairos: ${err.message || err}` 
    });
  }
});

// 2. Valores únicos para filtros de BI (Dinamiza o select do frontend com dados reais)
app.get('/api/filtros/valores', (req, res) => {
  let funcs = dbInstance.getFuncionarios();
  const empresas = dbInstance.getEmpresas();

  const empresaId = req.query.empresaId as string;
  if (empresaId) {
    funcs = funcs.filter((f) => f.empresaId === empresaId);
  }

  const departamentos = Array.from(new Set(funcs.map((f) => f.departamento))).filter(Boolean).sort();
  const centrosCusto = Array.from(new Set(funcs.map((f) => f.centroCusto))).filter(Boolean).sort();
  const cargos = Array.from(new Set(funcs.map((f) => f.cargo))).filter(Boolean).sort();
  const gestores = Array.from(new Set(funcs.map((f) => f.gestor))).filter(Boolean).sort();

  res.json({
    empresas,
    departamentos,
    centrosCusto,
    cargos,
    gestores
  });
});

// 3. Empresas monitoradas
app.get('/api/empresas', (req, res) => {
  const user = getSessionUser(req);
  let empresas = dbInstance.getEmpresas();
  if (user && user.perfilAcesso !== 'Master' && user.identifier) {
    const cleanId = cleanIdentifier(user.identifier);
    empresas = empresas.filter(e => cleanIdentifier(e.cnpj) === cleanId);
  }
  res.json(empresas);
});

// 4. Funcionários com paginação e filtros de BI
app.get('/api/funcionarios', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'funcionarios_visualizar') && !hasPermission(user, 'funcionarios_consultar'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para visualizar funcionários.' });
  }
  const { funcs } = getFilteredRecords(req.query, req);

  const limitQuery = req.query.limit as string;
  if (limitQuery === 'all' || limitQuery === '-1') {
    return res.json({
      data: funcs,
      total: funcs.length,
      page: 1,
      limit: funcs.length,
      totalPages: 1
    });
  }

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(limitQuery, 10) || 15;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  const results = funcs.slice(startIndex, endIndex);

  res.json({
    data: results,
    total: funcs.length,
    page,
    limit,
    totalPages: Math.ceil(funcs.length / limit)
  });
});

// 5. Ocorrências com paginação e filtros de BI
app.get('/api/ocorrencias', (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'auditoria_visualizar')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para visualizar as ocorrências.' });
  }
  const { ocs } = getFilteredRecords(req.query, req);
  const funcs = dbInstance.getFuncionarios();
  const funcMap = new Map(funcs.map((f) => [f.id, f]));

  // Map occurrences to include Name, Matricula and Departamento
  const mappedOcs = ocs.map((o) => {
    const f = funcMap.get(o.funcionarioId);
    return {
      ...o,
      funcionarioNome: f ? f.nome : o.funcionarioId.replace('func_', 'Funcionário '),
      funcionarioMatricula: f ? (f.matricula || f.id.replace(/\D/g, '') || f.id) : '',
      funcionarioDepartamento: f ? f.departamento : 'Não Informado',
      funcionarioSexo: f ? ((f as any).sexo || 'MASCULINO') : (o.funcionarioSexo || 'MASCULINO')
    };
  });

  const limitQuery = req.query.limit as string;
  if (limitQuery === 'all' || limitQuery === '-1') {
    return res.json({
      data: mappedOcs,
      total: mappedOcs.length,
      page: 1,
      limit: mappedOcs.length,
      totalPages: 1
    });
  }

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(limitQuery, 10) || 15;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  const results = mappedOcs.slice(startIndex, endIndex);

  res.json({
    data: results,
    total: mappedOcs.length,
    page,
    limit,
    totalPages: Math.ceil(mappedOcs.length / limit)
  });
});

// 6. Histórico de sincronizações
app.get('/api/sync/history', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'auditoria_visualizar') && !hasPermission(user, 'configuracao_visualizar'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado.' });
  }
  res.json(dbInstance.getSyncLogs());
});

// 6.5.1 Importar Base de Exemplo
app.post('/api/database/import-sample', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'admin_acesso_total') && !hasPermission(user, 'configuracao_editar'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para importar dados de exemplo.' });
  }

  const samplePath = path.join(process.cwd(), 'sample-data', 'exemplo.json');
  const fallbackPath = path.join(process.cwd(), 'assets', 'sample-db.json');
  
  let targetPath = fs.existsSync(samplePath) ? samplePath : (fs.existsSync(fallbackPath) ? fallbackPath : '');
  
  if (!targetPath) {
    return res.status(404).json({
      success: false,
      message: 'Arquivo de base de exemplo (/sample-data/exemplo.json) não foi localizado no servidor.'
    });
  }

  try {
    const fileContent = fs.readFileSync(targetPath, 'utf-8');
    const sampleData = JSON.parse(fileContent);

    dbInstance.saveEmpresas(sampleData.empresas || []);
    dbInstance.saveFuncionarios(sampleData.funcionarios || []);
    dbInstance.saveMarcacoes(sampleData.marcacoes || []);
    dbInstance.saveJornadas(sampleData.jornadas || []);
    dbInstance.saveOcorrencias(sampleData.ocorrencias || []);

    const currentConfig = dbInstance.getConfig();
    dbInstance.saveConfig({
      ...currentConfig,
      appMode: 'DEMONSTRAÇÃO',
      isDemoCleared: false
    });

    dbInstance.addSyncLog({
      dataHora: new Date().toISOString(),
      status: 'SUCESSO',
      detalhes: `Base de exemplo importada com sucesso a partir de ${path.basename(targetPath)}. Modo Demonstração ativado.`,
      registrosColetados: (sampleData.marcacoes || []).length
    });

    logActivity(req, 'Importação de Base de Exemplo', 'configuracao', 'Base de exemplo importada manualmente com sucesso. Modo Demonstração ativo.');
    writeOpLog('SUCESSO', 'Importação Base de Exemplo', 'Usuário acionou a importação manual da base de exemplo.', 'Dados de demonstração carregados com sucesso. Modo da aplicação alterado para DEMONSTRAÇÃO.');

    res.json({
      success: true,
      message: 'Base de exemplo importada com sucesso! A aplicação está em Modo Demonstração.',
      appMode: 'DEMONSTRAÇÃO'
    });
  } catch (err: any) {
    console.error('Erro ao importar base de exemplo:', err);
    res.status(500).json({
      success: false,
      message: `Falha ao importar o arquivo de exemplo: ${err.message || err}`
    });
  }
});

// 6.5.2 Remover Base de Exemplo / Limpar Banco
const removeSampleHandler = (req: express.Request, res: express.Response) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'admin_acesso_total') && !hasPermission(user, 'configuracao_editar'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui a permissão requerida para esta ação.' });
  }

  dbInstance.clearAllData();
  const currentConfig = dbInstance.getConfig();
  dbInstance.saveConfig({
    ...currentConfig,
    appMode: 'REAL',
    isDemoCleared: true
  });
  
  dbInstance.addSyncLog({
    dataHora: new Date().toISOString(),
    status: 'SUCESSO',
    detalhes: 'Base de exemplo/dados locais removidos com sucesso. Aplicação em Modo REAL aguardando sincronização oficial.',
    registrosColetados: 0
  });

  logActivity(req, 'Remoção de Base de Exemplo', 'configuracao', 'Base de exemplo removida com sucesso. Aplicação alterada para Modo REAL.');
  writeOpLog('SUCESSO', 'Remoção de Base de Exemplo', 'Mecanismo de remoção da base de exemplo acionado pelo usuário.', 'Todos os dados simulados foram excluídos de db.json. Aplicação definida exclusivamente para Modo REAL.');
  
  res.json({
    success: true,
    message: 'Base de exemplo removida com sucesso! A aplicação retornou ao Modo REAL.',
    appMode: 'REAL'
  });
};

app.post('/api/database/remove-sample', removeSampleHandler);
app.post('/api/database/clear', removeSampleHandler);

// 6.6 Endpoints de logs comentados
app.get('/api/logs', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'logs_visualizar') && !hasPermission(user, 'admin_acesso_total'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para visualizar logs.' });
  }
  const content = readOpLogs();
  res.json({ logs: content });
});

app.post('/api/logs/clear', (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'admin_acesso_total')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para limpar os logs.' });
  }
  clearOpLogs();
  dbInstance.clearLogs();
  writeOpLog('INFO', 'Limpeza de Logs', 'O arquivo de logs de utilização e histórico de auditoria foram limpos pelo painel.', 'Logs anteriores de acessos e operações foram reiniciados.');
  res.json({ success: true, message: 'Logs de operações limpos com sucesso!' });
});

// Endpoint para registro de auditoria de exportações e geração de relatórios PDF
app.post('/api/audit/log-export', (req, res) => {
  const user = getSessionUser(req);
  const { tipoRelatorio, periodo, registrosExportados, formato } = req.body;
  const usuarioEmissor = user ? `${user.nomeCompleto} (${user.email})` : (req.body.usuarioEmissor || 'Usuário Não Autenticado');
  
  logActivity(
    req,
    `Exportação de Relatório (${formato || 'PDF'})`,
    'Relatórios',
    `Relatório '${tipoRelatorio}' gerado por ${usuarioEmissor}. Período: ${periodo || 'Geral'}. Registros exportados: ${registrosExportados}. Data/Hora: ${new Date().toLocaleString('pt-BR')}`
  );

  writeOpLog(
    'INFO',
    'Exportação de Relatório PDF',
    `Emissão do relatório '${tipoRelatorio}' em formato ${formato || 'PDF'}`,
    `Usuário emissor: ${usuarioEmissor} | Período: ${periodo || 'Geral'} | Qtd Registros: ${registrosExportados} | Data/Hora: ${new Date().toLocaleString('pt-BR')}`
  );

  res.json({ success: true, message: 'Log de auditoria registrado com sucesso.' });
});

// 7. KPIs de conformidade baseados nos filtros ativos
app.get('/api/dashboard/kpis', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'dashboard_executivo_visualizar') && !hasPermission(user, 'dashboard_rh_visualizar'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para visualizar o dashboard.' });
  }
  const { funcs, ocs, jorns } = getFilteredRecords(req.query, req);

  const allBaseFuncs = dbInstance.getFuncionarios();
  const baseConsolidacao = resolverEConsolidarVinculos(allBaseFuncs);

  const totalPessoas = baseConsolidacao.todos.length;
  const totalPessoasAtivas = baseConsolidacao.ativos.length;
  const totalPessoasInativas = baseConsolidacao.desligados.length;

  const totalPessoasExcluidas = funcs.filter((f) => f.situacao === 'EXCLUIDO').length;
  const totalPessoasAfastadas = funcs.filter((f) => f.situacao === 'AFASTADO').length;
  const totalPessoasFerias = funcs.filter((f) => f.situacao === 'FERIAS').length;

  // Determinar o grupo correto de análise
  const statusFilter = req.query.status || '';
  const targetFuncs = statusFilter ? funcs : funcs.filter((f) => f.status === 'ATIVO');
  const targetFuncIds = new Set(targetFuncs.map((f) => f.id));
  
  // Filtrar ocorrências para abranger estritamente as pessoas em análise
  const targetOcs = ocs.filter((o) => targetFuncIds.has(o.funcionarioId));

  const totalFuncionarios = targetFuncs.length || 1;
  const totalOcorrencias = targetOcs.length;

  // Funcionários que possuem pelo menos 1 ocorrência de risco ALTO ou CRITICO
  const funcOcsCriticas = new Set(
    targetOcs
      .filter((o) => o.gravidade === 'CRITICO' || o.gravidade === 'ALTO')
      .map((o) => o.funcionarioId)
  );
  const funcionariosEmRisco = funcOcsCriticas.size;

  const ocorrenciasCriticas = targetOcs.filter((o) => o.gravidade === 'CRITICO').length;

  const empresasMonitoradas = Array.from(new Set(targetFuncs.map((f) => f.empresaId))).length;

  // Score de conformidade (inverso do índice de ocorrência ponderado por funcionário)
  // Penalidades: CRITICO = 5 pts, ALTO = 2 pts, MEDIO = 1 pt, BAIXO = 0.2 pts
  let totalPenalidades = 0;
  targetOcs.forEach((o) => {
    if (o.gravidade === 'CRITICO') totalPenalidades += 5;
    else if (o.gravidade === 'ALTO') totalPenalidades += 2;
    else if (o.gravidade === 'MEDIO') totalPenalidades += 1;
    else totalPenalidades += 0.2;
  });

  const divisor = totalFuncionarios || 1;
  const scoreCalculado = 100 - (totalPenalidades / divisor) * 8;
  const scoreGeralConformidade = Math.round(Math.max(12, Math.min(100, scoreCalculado)));

  // Taxas específicas (porcentagem de funcionários afetados por cada infração)
  const funcsJornadaExcedida = new Set(targetOcs.filter((o) => o.tipo === 'JORNADA_EXCESSIVA').map((o) => o.funcionarioId)).size;
  const funcsDescansoInadequado = new Set(targetOcs.filter((o) => o.tipo === 'INTERJORNADA_INSUFICIENTE').map((o) => o.funcionarioId)).size;
  const funcsIntervaloInsuficiente = new Set(targetOcs.filter((o) => o.tipo === 'INTERVALO_INSUFICIENTE').map((o) => o.funcionarioId)).size;
  const funcsTrabalhoDomingo = new Set(targetOcs.filter((o) => o.tipo === 'DOMINGO_EXCESSIVO').map((o) => o.funcionarioId)).size;
  const funcsDoisDomingos = new Set(targetOcs.filter((o) => o.tipo === 'DOMINGOS_SEGUIDOS').map((o) => o.funcionarioId)).size;
  const funcsFaltasAtrasos = new Set(targetOcs.filter((o) => o.tipo === 'AUSENCIA' || o.tipo === 'ATRASO_GRAVE' || o.tipo === 'FALTA_RECORRENTE').map((o) => o.funcionarioId)).size;

  const taxaJornadasExcessivas = totalFuncionarios ? Math.round((funcsJornadaExcedida / totalFuncionarios) * 100) : 0;
  const taxaDescansoInadequado = totalFuncionarios ? Math.round((funcsDescansoInadequado / totalFuncionarios) * 100) : 0;
  const taxaIntervaloInsuficiente = totalFuncionarios ? Math.round((funcsIntervaloInsuficiente / totalFuncionarios) * 100) : 0;
  const taxaTrabalhoDomingo = totalFuncionarios ? Math.round((funcsTrabalhoDomingo / totalFuncionarios) * 100) : 0;
  const taxaDoisDomingos = totalFuncionarios ? Math.round((funcsDoisDomingos / totalFuncionarios) * 100) : 0;
  const taxaFaltasAtrasos = totalFuncionarios ? Math.round((funcsFaltasAtrasos / totalFuncionarios) * 100) : 0;

  res.json({
    totalFuncionarios,
    totalPessoas,
    totalPessoasAtivas,
    totalPessoasInativas,
    totalPessoasExcluidas,
    totalPessoasAfastadas,
    totalPessoasFerias,
    totalOcorrencias,
    funcionariosEmRisco,
    ocorrenciasCriticas,
    empresasMonitoradas,
    scoreGeralConformidade,
    taxaJornadasExcessivas,
    taxaDescansoInadequado,
    taxaIntervaloInsuficiente,
    taxaTrabalhoDomingo,
    taxaDoisDomingos,
    taxaFaltasAtrasos
  });
});

// 8. Agregações para gráficos de BI cruzados
app.get('/api/dashboard/charts', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'dashboard_executivo_visualizar') && !hasPermission(user, 'dashboard_rh_visualizar'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para visualizar os gráficos do dashboard.' });
  }
  const { funcs, ocs } = getFilteredRecords(req.query, req);

  // Mapeamento de funcionários para buscar propriedades de departamento/gestor etc.
  const funcMap = new Map(funcs.map((f) => [f.id, f]));

  // A. Ocorrências por data (Evolução temporal)
  const ocsPorData: Record<string, number> = {};
  ocs.forEach((o) => {
    ocsPorData[o.data] = (ocsPorData[o.data] || 0) + 1;
  });
  const evolucaoTemporal = Object.keys(ocsPorData)
    .sort()
    .map((data) => ({
      data,
      ocorrencias: ocsPorData[data]
    }));

  // B. Ocorrências por departamento
  const ocsPorDepto: Record<string, number> = {};
  ocs.forEach((o) => {
    const f = funcMap.get(o.funcionarioId);
    if (f) {
      const depto = f.departamento;
      ocsPorDepto[depto] = (ocsPorDepto[depto] || 0) + 1;
    }
  });
  const ocorrenciasPorDepto = Object.keys(ocsPorDepto).map((depto) => ({
    name: depto,
    value: ocsPorDepto[depto]
  })).sort((a, b) => b.value - a.value);

  // C. Ocorrências por centro de custo
  const ocsPorCC: Record<string, number> = {};
  ocs.forEach((o) => {
    const f = funcMap.get(o.funcionarioId);
    if (f) {
      const cc = f.centroCusto;
      ocsPorCC[cc] = (ocsPorCC[cc] || 0) + 1;
    }
  });
  const ocorrenciasPorCC = Object.keys(ocsPorCC).map((cc) => ({
    name: cc,
    value: ocsPorCC[cc]
  })).sort((a, b) => b.value - a.value);

  // D. Distribuição de gravidade
  const ocsPorGravidade: Record<string, number> = {
    BAIXO: 0,
    MEDIO: 0,
    ALTO: 0,
    CRITICO: 0
  };
  ocs.forEach((o) => {
    if (o.gravidade in ocsPorGravidade) {
      ocsPorGravidade[o.gravidade]++;
    }
  });
  const distribuicaoGravidade = Object.keys(ocsPorGravidade).map((grav) => ({
    name: grav,
    value: ocsPorGravidade[grav]
  }));

  // E. Ranking de funcionários (Top 8 por score de risco / infrações)
  const rankingFuncionarios = funcs
    .map((f) => {
      const funcOcs = ocs.filter((o) => o.funcionarioId === f.id);
      return {
        id: f.id,
        nome: f.nome,
        departamento: f.departamento,
        centroCusto: f.centroCusto,
        scoreRisco: f.scoreRisco,
        grauRisco: f.grauRisco,
        totalOcorrencias: funcOcs.length
      };
    })
    .sort((a, b) => b.scoreRisco - a.scoreRisco)
    .slice(0, 8);

  // F. Ranking de gestores (Ocorrências de sua equipe)
  const ocsPorGestor: Record<string, number> = {};
  ocs.forEach((o) => {
    const f = funcMap.get(o.funcionarioId);
    if (f) {
      ocsPorGestor[f.gestor] = (ocsPorGestor[f.gestor] || 0) + 1;
    }
  });
  const rankingGestores = Object.keys(ocsPorGestor)
    .map((gestor) => ({
      name: gestor,
      value: ocsPorGestor[gestor]
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // G. Ocorrências por tipo
  const ocsPorTipo: Record<string, number> = {};
  ocs.forEach((o) => {
    ocsPorTipo[o.tipo] = (ocsPorTipo[o.tipo] || 0) + 1;
  });
  const ocorrenciasPorTipo = Object.keys(ocsPorTipo).map((tipo) => ({
    name: tipo,
    value: ocsPorTipo[tipo]
  })).sort((a, b) => b.value - a.value);

  res.json({
    evolucaoTemporal,
    ocorrenciasPorDepto,
    ocorrenciasPorCC,
    distribuicaoGravidade,
    rankingFuncionarios,
    rankingGestores,
    ocorrenciasPorTipo
  });
});

// ----------------------------------------------------
// ENDPOINTS DE AUTENTICAÇÃO E SEGURANÇA
// ----------------------------------------------------

function checkEmergencyAuth(req: express.Request): { authorized: boolean; authType?: string; userEmail?: string } {
  const user = getSessionUser(req);
  if (user && user.perfilAcesso === 'Master') {
    return { authorized: true, authType: 'Sessão Master', userEmail: user.email };
  }

  const headerSecret = req.headers['x-emergency-secret'];
  const envSecret = process.env.EMERGENCY_ACCESS_SECRET;

  if (envSecret && typeof headerSecret === 'string' && headerSecret.length > 0) {
    const a = Buffer.from(headerSecret);
    const b = Buffer.from(envSecret);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { authorized: true, authType: 'Header Secret (x-emergency-secret)', userEmail: 'Segredo de Emergência' };
    }
  }

  return { authorized: false };
}

// Obter status do Modo de Recuperação de Emergência (Break Glass)
app.get('/api/auth/emergency-status', (req, res) => {
  const cfg = dbInstance.getSecurityConfig();
  res.json({
    emergencyMode: cfg.EmergencyAccess,
    config: cfg
  });
});

// Ativar/Desativar Modo de Emergência (Break Glass)
app.post('/api/auth/toggle-emergency', (req, res) => {
  const auth = checkEmergencyAuth(req);
  if (!auth.authorized) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Requer sessão Master ou segredo de emergência válido.' });
  }

  const { enabled, reason } = req.body;
  const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const enrichedReason = `${reason || 'Sem motivo informado'} (Autenticado por: ${auth.authType} - ${auth.userEmail})`;
  const cfg = dbInstance.setEmergencyMode(!!enabled, enrichedReason, ip);
  res.json({ success: true, emergencyMode: cfg.EmergencyAccess, config: cfg });
});

// Executar Ação de Recuperação de Emergência (Break Glass)
app.post('/api/auth/emergency-action', (req, res) => {
  const auth = checkEmergencyAuth(req);
  if (!auth.authorized) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Requer sessão Master ou segredo de emergência válido.' });
  }

  const { action, payload } = req.body;
  const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const result = dbInstance.executeEmergencyAction(action, payload, ip);
  logActivity(req, 'Ação de Emergência Executada', 'seguranca', `Ação '${action}' executada via Break Glass por ${auth.userEmail} (${auth.authType}). IP: ${ip}`);
  res.json(result);
});

// Verificar se o sistema precisa de configuração inicial (Assistente)
app.get('/api/auth/needs-setup', (req, res) => {
  const users = dbInstance.getUsers();
  const hasMaster = users.some(u => u.perfilAcesso === 'Master');
  res.json({ needsSetup: !hasMaster });
});

// Configuração administrativa inicial do usuário Master
app.post('/api/auth/setup-admin', (req, res) => {
  const { nomeCompleto, email, password, perguntasSeguranca } = req.body;
  if (!nomeCompleto || !email || !password) {
    return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
  }

  // Validação de formato de e-mail
  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ success: false, message: 'Formato de e-mail inválido.' });
  }

  // Validação de força de senha (mínimo 6 caracteres)
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'A senha do administrador precisa ter no mínimo 6 caracteres por razões de segurança.' });
  }

  // Validação das perguntas de segurança
  if (!perguntasSeguranca || !Array.isArray(perguntasSeguranca) || perguntasSeguranca.length !== 3) {
    return res.status(400).json({ success: false, message: 'É obrigatório selecionar e responder exatamente 3 perguntas de segurança.' });
  }

  const distinctQuestions = new Set(perguntasSeguranca.map(p => p.pergunta));
  if (distinctQuestions.size !== 3) {
    return res.status(400).json({ success: false, message: 'As perguntas de segurança devem ser distintas.' });
  }

  for (const q of perguntasSeguranca) {
    if (!q.pergunta || !q.resposta || q.resposta.trim() === '') {
      return res.status(400).json({ success: false, message: 'Todas as 3 perguntas de segurança devem possuir uma resposta válida.' });
    }
  }
  
  const users = dbInstance.getUsers();
  const hasMaster = users.some(u => u.perfilAcesso === 'Master');
  if (hasMaster) {
    return res.status(400).json({ success: false, message: 'Usuário Master já configurado no sistema.' });
  }

  const salt = generateSalt();

  // Hashing das respostas das perguntas de segurança
  const hashedQuestions = perguntasSeguranca.map((item: any) => ({
    pergunta: item.pergunta,
    respostaHash: hashAnswer(item.resposta)
  }));

  const newAdmin: User = {
    id: 'user_admin_' + Date.now(),
    nomeCompleto,
    email: email.toLowerCase().trim(),
    salt: salt,
    passwordHash: hashPasswordWithSalt(password, salt),
    key: '',
    identifier: cleanIdentifier(req.body?.identifier || '00000000000'),
    empresa: req.body?.empresa || 'Empresa Não Informada',
    dataCadastro: new Date().toISOString(),
    dataUltimaAlteracao: new Date().toISOString(),
    dataUltimoAcesso: null,
    status: 'ATIVO',
    perfilAcesso: 'Master',
    criadorEmail: 'Setup Assistente',
    perguntasSeguranca: hashedQuestions
  };

  users.push(newAdmin);
  dbInstance.saveUsers(users);

  // Registro em log de auditoria com IP, Versão e Data/Hora
  const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  let appVersion = '1.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
    appVersion = pkg.version || '1.0.0';
  } catch (err) {}
  
  logActivity(req, 'Criação de Usuário', 'admin', `Primeiro usuário Master criado via assistente: ${email}. IP: ${ip}, Versão: ${appVersion}, Horário: ${new Date().toLocaleTimeString()}`);
  res.json({ success: true, message: 'Usuário Master configurado com sucesso!' });
});

// Carregar Ambiente de Demonstração (Demanda explícita do usuário)
app.post('/api/database/load-demo', (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Autenticação necessária.' });
  }

  const result = dbInstance.loadDemoEnvironment();
  logActivity(req, 'Carga de Demonstração', 'configuracao', `Ambiente de Demonstração ativado pelo usuário (${user.email}).`);
  res.json(result);
});

// Retornar ao Ambiente Operacional (Limpeza integral de dados de demonstração)
app.post('/api/database/unload-demo', (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Autenticação necessária.' });
  }

  const result = dbInstance.unloadDemoEnvironment();
  logActivity(req, 'Desativação de Demonstração', 'configuracao', `Retornado ao Ambiente Operacional. Dados de demonstração descarregados por (${user.email}).`);
  res.json(result);
});

// Realizar Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.' });
  }

  const secCfg = dbInstance.getSecurityConfig();
  if (secCfg.EmergencyAccess) {
    return res.status(503).json({
      success: false,
      emergencyMode: true,
      message: 'A aplicação está em Modo de Recuperação de Emergência (Break Glass). O login normal está temporariamente suspenso.'
    });
  }

  // Assegura auto-healing da conta Master e perguntas de segurança pré-login
  dbInstance.ensureMasterAccount();

  const users = dbInstance.getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

  if (!user) {
    logActivity(req, 'Falha de Autenticação', 'seguranca', `Tentativa de login malsucedida para e-mail inexistente: ${email}`);
    return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
  }

  // Verificação de bloqueio temporário por múltiplas tentativas
  if (user.bloqueadoAte && new Date(user.bloqueadoAte) > new Date()) {
    logActivity(req, 'Falha de Autenticação', 'seguranca', `Tentativa de login em conta bloqueada temporariamente: ${email}`);
    const tempoRestante = Math.ceil((new Date(user.bloqueadoAte).getTime() - Date.now()) / 1000 / 60);
    return res.status(403).json({ success: false, message: `Conta bloqueada temporariamente. Tente novamente em ${tempoRestante} minutos.` });
  }

  if (user.status === 'BLOQUEADO') {
    logActivity(req, 'Falha de Autenticação', 'seguranca', `Tentativa de login em conta bloqueada permanentemente: ${email}`);
    return res.status(403).json({ success: false, message: 'Usuário bloqueado administrativamente. Entre em contato com o suporte.' });
  }

  if (user.status === 'INATIVO') {
    logActivity(req, 'Falha de Autenticação', 'seguranca', `Tentativa de login em conta inativa: ${email}`);
    return res.status(403).json({ success: false, message: 'Usuário inativo.' });
  }

  const sysConfigBlock = dbInstance.getConfig();
  if (sysConfigBlock.blockNewConnections && user.perfilAcesso !== 'Master' && user.email.toLowerCase() !== 'tecnicodimepdf@gmail.com') {
    logActivity(req, 'Falha de Autenticação', 'seguranca', `Tentativa de login rejeitada para ${email}: Novas conexões bloqueadas pelo Administrador Master.`);
    return res.status(403).json({ success: false, message: 'O acesso está temporariamente suspenso para novas conexões pelo Administrador Master.' });
  }

  if (!user.salt) {
    user.salt = generateSalt();
  }

  const isValidPassword = verifyAndMigratePassword(password, user);

  if (!isValidPassword) {
    user.tentativasLogin = (user.tentativasLogin || 0) + 1;
    if (user.tentativasLogin >= 5) {
      user.bloqueadoAte = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // Bloqueio de 15 minutos
      user.tentativasLogin = 0; // reset
      dbInstance.saveUsers(users);
      logActivity(req, 'Bloqueio de Usuário', 'seguranca', `Usuário ${email} bloqueado temporariamente (15 min) por excesso de tentativas de login.`);
      return res.status(403).json({ success: false, message: 'Conta bloqueada temporariamente por excesso de tentativas de login (15 minutos).' });
    }
    dbInstance.saveUsers(users);
    logActivity(req, 'Falha de Autenticação', 'seguranca', `Senha incorreta para o usuário: ${email}. Tentativas: ${user.tentativasLogin}/5`);
    return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
  }

  if (!user.perguntasSeguranca || user.perguntasSeguranca.length < 3) {
    user.perguntasSeguranca = getDefaultSecurityQuestions(user.email, user.empresa, user.identifier);
  }

  // Política de Troca de Senha:
  // Só exige troca de senha se for explicitamente marcada pelo Administrador/Master (forcarTrocaSenha === true)
  // ou se o usuário estiver com precisaTrocarSenha === true pendente.
  // Usuários com senhas criadas ou redefinidas pelo Master NÃO são forçados a trocar a cada dia/primeiro acesso.
  if (user.forcarTrocaSenha) {
    user.precisaTrocarSenha = true;
  } else if (user.precisaTrocarSenha === undefined) {
    user.precisaTrocarSenha = false;
  }

  // Login bem sucedido: resetar tentativas e limpar bloqueio temporário
  user.tentativasLogin = 0;
  user.bloqueadoAte = null;
  user.dataUltimoAcesso = new Date().toISOString();
  dbInstance.saveUsers(users);

  // Gerar token de sessão aleatório e objeto de sessão estruturado
  const token = 'sess_' + crypto.randomBytes(16).toString('hex');
  const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) || 'Desconhecido';

  const sessionObj: UserSession = {
    sessionId: 'sid_' + crypto.randomBytes(8).toString('hex'),
    token,
    userId: user.id,
    userEmail: user.email,
    nomeCompleto: user.nomeCompleto,
    empresa: user.empresa || '',
    perfilAcesso: user.perfilAcesso,
    loginTime: new Date().toISOString(),
    lastActivityTime: new Date().toISOString(),
    lastActivityMs: Date.now(),
    ip,
    userAgent,
    status: 'ATIVA'
  };

  activeSessionsMap.set(token, sessionObj);
  dbInstance.addActiveSession(sessionObj);

  logActivity(req, 'Login', 'seguranca', `Usuário logado com sucesso: ${email}`);

  const sysConfig = dbInstance.getConfig();

  res.json({
    success: true,
    token,
    isCleanSetup: sysConfig.isCleanSetup,
    setupCompleted: sysConfig.setupCompleted,
    isDemoActive: sysConfig.isDemoActive,
    user: {
      id: user.id,
      nomeCompleto: user.nomeCompleto,
      email: user.email,
      key: user.key,
      identifier: user.identifier,
      empresa: user.empresa,
      perfilAcesso: user.perfilAcesso,
      status: user.status,
      precisaTrocarSenha: user.precisaTrocarSenha,
      permissoes: getUserPermissions(user)
    }
  });
});

// Heartbeat e Validação de Sessão em Tempo Real
app.post('/api/auth/heartbeat', (req, res) => {
  const data = getSessionData(req);
  if (!data) {
    return res.status(401).json({
      success: false,
      valid: false,
      message: 'Sessão expirada por inatividade ou encerrada.'
    });
  }

  const { user, session } = data;
  const config = dbInstance.getConfig();

  res.json({
    success: true,
    valid: true,
    sessionTimeoutMinutes: config.sessionTimeoutMinutes || 30,
    heartbeatIntervalMinutes: config.heartbeatIntervalMinutes || 5,
    lastActivityTime: session.lastActivityTime,
    user: {
      id: user.id,
      nomeCompleto: user.nomeCompleto,
      email: user.email,
      key: user.key,
      identifier: user.identifier,
      empresa: user.empresa,
      perfilAcesso: user.perfilAcesso,
      status: user.status,
      precisaTrocarSenha: user.precisaTrocarSenha,
      permissoes: getUserPermissions(user)
    }
  });
});

// Verificar Sessão Ativa
app.get('/api/auth/session', (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Sessão inválida ou expirada.' });
  }
  res.json({
    success: true,
    user: {
      id: user.id,
      nomeCompleto: user.nomeCompleto,
      email: user.email,
      key: user.key,
      identifier: user.identifier,
      empresa: user.empresa,
      perfilAcesso: user.perfilAcesso,
      status: user.status,
      precisaTrocarSenha: user.precisaTrocarSenha,
      permissoes: getUserPermissions(user)
    }
  });
});

// Realizar Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-session-token'] as string;
  if (token) {
    const session = activeSessionsMap.get(token);
    const userEmail = session ? session.userEmail : 'Sessão Ativa';
    logActivity(req, 'Logout', 'seguranca', `Usuário efetuou logout: ${userEmail}`);
    activeSessionsMap.delete(token);
    dbInstance.removeActiveSession(token);
  }
  res.json({ success: true });
});

// Listar Sessões Ativas (Admin / Master)
app.get('/api/admin/sessions', (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'painel_master_acesso')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Apenas administradores Master podem visualizar as sessões ativas.' });
  }

  const config = dbInstance.getConfig();
  const timeoutMinutes = config.sessionTimeoutMinutes || 30;
  dbInstance.cleanExpiredSessions(timeoutMinutes);

  const sessions = dbInstance.getActiveSessions();
  res.json({ success: true, sessions, blockNewConnections: !!config.blockNewConnections });
});

// Desconectar Todas as Sessões Ativas (exceto a sessão atual)
app.post('/api/admin/sessions/terminate-all', (req, res) => {
  const user = getSessionUser(req);
  if (!user || user.perfilAcesso !== 'Master') {
    return res.status(403).json({ success: false, message: 'Acesso negado. Apenas o perfil Master pode encerrar todas as sessões.' });
  }

  const currentToken = req.headers['x-session-token'] as string;
  const sessions = dbInstance.getActiveSessions();
  const keepSessions = sessions.filter(s => s.token === currentToken);
  dbInstance.saveActiveSessions(keepSessions);

  for (const [tok, sess] of activeSessionsMap.entries()) {
    if (tok !== currentToken) {
      activeSessionsMap.delete(tok);
    }
  }

  logActivity(req, 'Desconexão em Massa', 'seguranca', `Todas as sessões ativas foram encerradas pelo usuário Master (${user.email}).`);
  res.json({ success: true, message: 'Todas as outras sessões ativas foram encerradas com sucesso.' });
});

// Alternar Bloqueio de Novas Conexões
app.post('/api/admin/sessions/toggle-block-new', (req, res) => {
  const user = getSessionUser(req);
  if (!user || user.perfilAcesso !== 'Master') {
    return res.status(403).json({ success: false, message: 'Acesso negado. Apenas o perfil Master pode alterar a regra de conexões.' });
  }

  const sysConfig = dbInstance.getConfig();
  sysConfig.blockNewConnections = !sysConfig.blockNewConnections;
  dbInstance.saveConfig(sysConfig);

  const statusTxt = sysConfig.blockNewConnections ? 'bloqueadas' : 'desbloqueadas';
  logActivity(req, 'Controle de Conexões', 'seguranca', `Novas conexões foram ${statusTxt} pelo usuário Master (${user.email}).`);
  res.json({
    success: true,
    blockNewConnections: sysConfig.blockNewConnections,
    message: `Novas conexões foram ${statusTxt} com sucesso.`
  });
});

// Revogar/Encerrar Sessão Ativa
app.delete('/api/admin/sessions/:sessionId', (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'painel_master_acesso')) {
    return res.status(403).json({ success: false, message: 'Acesso negado.' });
  }

  const targetId = req.params.sessionId;
  const sessions = dbInstance.getActiveSessions();
  const targetSession = sessions.find(s => s.sessionId === targetId || s.token === targetId);

  if (!targetSession) {
    return res.status(404).json({ success: false, message: 'Sessão não encontrada.' });
  }

  activeSessionsMap.delete(targetSession.token);
  dbInstance.removeActiveSession(targetSession.token);

  logActivity(req, 'Revogação de Sessão', 'seguranca', `Sessão ${targetSession.sessionId} do usuário ${targetSession.userEmail} revogada por ${user.email}`);
  res.json({ success: true, message: 'Sessão revogada com sucesso.' });
});

// Troca obrigatória de senha inicial e liberação de acesso
app.post('/api/auth/first-access-reset', (req, res) => {
  const { email, password, novaSenha, confirmarSenha, perguntasSeguranca, empresaObj, apiConfig } = req.body;
  
  if (!email || !password || !novaSenha) {
    return res.status(400).json({ success: false, message: 'E-mail, senha atual e nova senha são obrigatórios.' });
  }

  const users = dbInstance.getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

  if (!user) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  if (!user.salt) user.salt = generateSalt();

  if (!verifyAndMigratePassword(password, user)) {
    logActivity(req, 'Falha de Autenticação', 'seguranca', `Tentativa de primeiro acesso inválida (senha inicial incorreta) para o usuário: ${email}`);
    return res.status(401).json({ success: false, message: 'Senha atual incorreta.' });
  }

  // Validar nova senha
  if (novaSenha.length < 6) {
    return res.status(400).json({ success: false, message: 'A nova senha precisa ter no mínimo 6 caracteres.' });
  }

  if (confirmarSenha && novaSenha !== confirmarSenha) {
    return res.status(400).json({ success: false, message: 'A nova senha e a confirmação não coincidem.' });
  }

  if (novaSenha === password) {
    return res.status(400).json({ success: false, message: 'A nova senha não pode ser igual à senha atual.' });
  }

  // Se perguntasSeguranca forem fornecidas opcionalmente, atualizar
  if (perguntasSeguranca && Array.isArray(perguntasSeguranca) && perguntasSeguranca.length === 3) {
    user.perguntasSeguranca = perguntasSeguranca.map((item: any) => ({
      pergunta: item.pergunta,
      respostaHash: hashAnswer(item.resposta)
    }));
  }

  // Se empresaObj for fornecida opcionalmente, cadastrar
  if (empresaObj && empresaObj.razaoSocial && empresaObj.cnpj) {
    const empresas = dbInstance.getEmpresas();
    const existingIndex = empresas.findIndex(e => e.cnpj === empresaObj.cnpj);
    const newEmpresa: Empresa = {
      id: existingIndex >= 0 ? empresas[existingIndex].id : `emp_${Date.now()}`,
      cnpj: empresaObj.cnpj,
      razaoSocial: empresaObj.razaoSocial,
      nomeFantasia: empresaObj.nomeFantasia || empresaObj.razaoSocial
    };
    if (existingIndex >= 0) {
      empresas[existingIndex] = newEmpresa;
    } else {
      empresas.push(newEmpresa);
    }
    dbInstance.saveEmpresas(empresas);
    user.empresa = empresaObj.razaoSocial;
    user.identifier = empresaObj.cnpj;
  }

  // Se apiConfig for fornecida opcionalmente, atualizar
  const config = dbInstance.getConfig();
  if (apiConfig) {
    if (apiConfig.host) config.hostDimep = apiConfig.host;
    if (apiConfig.key) config.key = apiConfig.key;
    if (apiConfig.identifier) config.identifier = apiConfig.identifier;
  }
  dbInstance.saveConfig(config);

  // Sucesso: atualizar senha com salt e limpar a flag de troca obrigatória
  user.salt = generateSalt();
  user.passwordHash = hashPasswordWithSalt(novaSenha, user.salt);
  user.precisaTrocarSenha = false;
  user.forcarTrocaSenha = false;
  user.tentativasLogin = 0;
  user.bloqueadoAte = null;
  user.dataUltimaAlteracao = new Date().toISOString();
  if (!user.dataUltimoAcesso) {
    user.dataUltimoAcesso = new Date().toISOString();
  }
  dbInstance.saveUsers(users);

  const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  logActivity(req, 'Troca de Senha de Usuário', 'seguranca', `Definição de nova senha realizada com sucesso para o usuário (${email}). Acesso liberado à aplicação. IP: ${ip}`);

  res.json({ success: true, message: 'Senha atualizada com sucesso! Acesso liberado à aplicação.', user: toSafeUserDTO(user) });
});

// Recuperação de Senha - Etapa 1: Validar e-mail e obter as 3 perguntas
app.post('/api/auth/recover/step1', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'E-mail é obrigatório.' });
  }

  dbInstance.ensureMasterAccount();

  const users = dbInstance.getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!user) {
    return res.status(404).json({ success: false, message: 'E-mail não encontrado no cadastro do sistema.' });
  }

  if (user.status === 'BLOQUEADO') {
    return res.status(403).json({ success: false, message: 'Acesso negado. Usuário bloqueado administrativamente.' });
  }

  // Verificar bloqueio temporário
  if (user.bloqueadoAte && new Date(user.bloqueadoAte) > new Date()) {
    const tempoRestante = Math.ceil((new Date(user.bloqueadoAte).getTime() - Date.now()) / 1000 / 60);
    return res.status(403).json({ success: false, message: `Recuperação bloqueada temporariamente. Tente novamente em ${tempoRestante} minutos.` });
  }

  // Auto-healing: Se o usuário não possuir perguntas salvas, gera as perguntas de verificação padrão
  if (!user.perguntasSeguranca || user.perguntasSeguranca.length < 3) {
    user.perguntasSeguranca = getDefaultSecurityQuestions(user.email, user.empresa, user.identifier);
    dbInstance.saveUsers(users);
  }

  // Retorna apenas as perguntas (sem as respostas)
  const perguntas = user.perguntasSeguranca.map(p => p.pergunta);
  res.json({ success: true, perguntas });
});

// Recuperação de Senha - Etapa 2: Validar respostas e redefinir senha
app.post('/api/auth/recover/complete', (req, res) => {
  const { email, respostas, novaSenha } = req.body;
  if (!email || !respostas || !Array.isArray(respostas) || respostas.length < 3 || !novaSenha) {
    return res.status(400).json({ success: false, message: 'Dados insuficientes para redefinição de senha.' });
  }

  if (novaSenha.length < 6) {
    return res.status(400).json({ success: false, message: 'A nova senha precisa ter no mínimo 6 caracteres.' });
  }

  const users = dbInstance.getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!user) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  if (user.status === 'BLOQUEADO') {
    return res.status(403).json({ success: false, message: 'Acesso negado. Usuário bloqueado.' });
  }

  // Verificar bloqueio temporário
  if (user.bloqueadoAte && new Date(user.bloqueadoAte) > new Date()) {
    const tempoRestante = Math.ceil((new Date(user.bloqueadoAte).getTime() - Date.now()) / 1000 / 60);
    return res.status(403).json({ success: false, message: `Recuperação bloqueada temporariamente. Tente novamente em ${tempoRestante} minutos.` });
  }

  if (!user.perguntasSeguranca || user.perguntasSeguranca.length < 3) {
    user.perguntasSeguranca = getDefaultSecurityQuestions(user.email, user.empresa, user.identifier);
    dbInstance.saveUsers(users);
  }

  const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';

  // Validar respostas de segurança
  let todasCorretas = true;
  for (let i = 0; i < 3; i++) {
    const userQuestion = user.perguntasSeguranca[i];
    const inputAnswer = respostas[i] || '';
    const normInput = inputAnswer.toLowerCase().trim();
    const hashedInputAnswer = hashAnswer(normInput);
    const hashedLegacy = hashPassword(normInput);

    if (userQuestion.respostaHash !== hashedInputAnswer && userQuestion.respostaHash !== hashedLegacy) {
      todasCorretas = false;
    }
  }

  if (!todasCorretas) {
    // Incrementar tentativas inválidas
    user.tentativasLogin = (user.tentativasLogin || 0) + 1;
    if (user.tentativasLogin >= 3) {
      user.bloqueadoAte = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      user.tentativasLogin = 0;
      dbInstance.saveUsers(users);
      logActivity(req, 'Bloqueio de Usuário', 'seguranca', `Usuário ${email} bloqueado temporariamente por múltiplos erros na recuperação de senha.`);
      return res.status(403).json({ success: false, message: 'Usuário temporariamente bloqueado devido a múltiplos erros de recuperação (15 min).' });
    }
    dbInstance.saveUsers(users);
    logActivity(req, 'Tentativas inválidas', 'seguranca', `Falha na tentativa de recuperação para o usuário: ${email}. IP: ${ip}. Tentativas: ${user.tentativasLogin}/3`);
    return res.status(400).json({ success: false, message: 'Respostas das perguntas de segurança incorretas.' });
  }

  // Sucesso: Redefinir senha com salt novo e limpar tentativas/bloqueio
  user.salt = generateSalt();
  user.passwordHash = hashPasswordWithSalt(novaSenha, user.salt);
  user.tentativasLogin = 0;
  user.bloqueadoAte = null;
  user.precisaTrocarSenha = false;
  user.dataUltimaAlteracao = new Date().toISOString();
  dbInstance.saveUsers(users);

  logActivity(req, 'Recuperação de Senha', 'seguranca', `Senha redefinida com sucesso para o usuário: ${email}. IP: ${ip}, Horário: ${new Date().toLocaleTimeString()}`);
  res.json({ success: true, message: 'Senha redefinida com sucesso!' });
});

// ----------------------------------------------------
// ENDPOINTS DE ADMINISTRAÇÃO E CADASTROS
// ----------------------------------------------------

// CRUD de Usuários
app.get('/api/admin/users', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'usuarios_criar') && !hasPermission(user, 'usuarios_editar') && !hasPermission(user, 'usuarios_bloquear') && !hasPermission(user, 'usuarios_excluir'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para visualizar usuários.' });
  }
  res.json(dbInstance.getUsers().map(u => toSafeUserDTO(u)));
});

app.post('/api/admin/users', (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'usuarios_criar')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para cadastrar novos usuários.' });
  }

  const { nomeCompleto, email, password, key, identifier, empresa, status, perfilAcesso, perguntasSeguranca, forcarTrocaSenha, sincronizarAoEntrar } = req.body;
  if (!nomeCompleto || !email || !password || !perfilAcesso) {
    return res.status(400).json({ success: false, message: 'Nome, E-mail, Senha e Perfil são obrigatórios.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return res.status(400).json({ success: false, message: 'E-mail inválido.' });
  }

  const users = dbInstance.getUsers();
  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ success: false, message: 'Usuário já cadastrado com este e-mail.' });
  }

  // Validar se o perfil associado existe ou é o Master
  const profiles = dbInstance.getProfiles();
  const matchedProfile = profiles.find(p => p.id === perfilAcesso || p.nome.toLowerCase() === perfilAcesso.toLowerCase().trim());
  if (!matchedProfile && perfilAcesso !== 'Master') {
    return res.status(400).json({ success: false, message: 'O perfil de acesso informado é inválido ou não cadastrado no sistema.' });
  }

  let hashedQuestions = undefined;
  if (perguntasSeguranca && Array.isArray(perguntasSeguranca)) {
    hashedQuestions = perguntasSeguranca.map((item: any) => ({
      pergunta: item.pergunta,
      respostaHash: hashAnswer(item.resposta)
    }));
  }

  const resolvedPerfil = perfilAcesso === 'Master' ? 'Master' : (matchedProfile ? matchedProfile.nome : perfilAcesso);
  const salt = generateSalt();

  // Sincroniza dados de integração (CNPJ, Key, Empresa) via Fonte Central Unificada
  if (identifier || key || empresa) {
    dbInstance.syncCentralIntegrationData({
      cnpj: identifier,
      key: key,
      razaoSocial: empresa
    });
  }

  const sysConfig = dbInstance.getConfig();
  const matchedEmp = sysConfig.empresasRest?.find(e => cleanIdentifier(e.cnpj) === cleanIdentifier(identifier || ''));

  const newUser: User = {
    id: 'user_' + Date.now(),
    nomeCompleto: nomeCompleto.trim(),
    email: cleanEmail,
    salt,
    passwordHash: hashPasswordWithSalt(password, salt),
    key: matchedEmp ? matchedEmp.key : (key || sysConfig.key || ''),
    identifier: matchedEmp ? matchedEmp.cnpj : (identifier || sysConfig.identifier || ''),
    empresa: matchedEmp ? matchedEmp.razaoSocial : (empresa || sysConfig.nomeEmpresaConectada || ''),
    dataCadastro: new Date().toISOString(),
    dataUltimaAlteracao: new Date().toISOString(),
    dataUltimoAcesso: null,
    status: status || 'ATIVO',
    perfilAcesso: resolvedPerfil,
    criadorEmail: user.email,
    perguntasSeguranca: hashedQuestions || getDefaultSecurityQuestions(cleanEmail, empresa, identifier),
    tentativasLogin: 0,
    bloqueadoAte: null,
    precisaTrocarSenha: !!forcarTrocaSenha,
    forcarTrocaSenha: !!forcarTrocaSenha,
    sincronizarAoEntrar: !!sincronizarAoEntrar
  };

  users.push(newUser);
  dbInstance.saveUsers(users);

  logActivity(req, 'Criação de Usuário', 'usuarios', `Novo usuário cadastrado por ${user.email}: ${cleanEmail} (Perfil: ${resolvedPerfil})`);
  res.json({ success: true, user: toSafeUserDTO(newUser) });
});

app.put('/api/admin/users/:id', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'usuarios_editar') && !hasPermission(user, 'usuarios_bloquear'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para editar usuários.' });
  }

  const targetId = req.params.id;
  const users = dbInstance.getUsers();
  const targetUser = users.find(u => u.id === targetId);

  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  const { nomeCompleto, email, password, key, identifier, empresa, status, perfilAcesso, perguntasSeguranca, forcarTrocaSenha, sincronizarAoEntrar } = req.body;

  if (nomeCompleto) targetUser.nomeCompleto = nomeCompleto.trim();
  if (email) {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return res.status(400).json({ success: false, message: 'E-mail inválido.' });
    }
    if (cleanEmail !== targetUser.email.toLowerCase() && users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ success: false, message: 'E-mail já está em uso.' });
    }
    targetUser.email = cleanEmail;
  }
  if (forcarTrocaSenha !== undefined) {
    targetUser.forcarTrocaSenha = !!forcarTrocaSenha;
    targetUser.precisaTrocarSenha = !!forcarTrocaSenha;
  }
  if (sincronizarAoEntrar !== undefined) {
    targetUser.sincronizarAoEntrar = !!sincronizarAoEntrar;
  }
  if (password) {
    const salt = generateSalt();
    targetUser.salt = salt;
    targetUser.passwordHash = hashPasswordWithSalt(password, salt);
    // Ao alterar a senha pelo painel, zerar tentativas e bloqueios imediatamente
    targetUser.tentativasLogin = 0;
    targetUser.bloqueadoAte = null;
    targetUser.precisaTrocarSenha = !!targetUser.forcarTrocaSenha;
  }
  if (key !== undefined) targetUser.key = key;
  if (identifier !== undefined) targetUser.identifier = identifier;
  if (empresa !== undefined) targetUser.empresa = empresa;

  if (targetUser.identifier || targetUser.key || targetUser.empresa) {
    dbInstance.syncCentralIntegrationData({
      cnpj: targetUser.identifier,
      key: targetUser.key,
      razaoSocial: targetUser.empresa
    });
    writeOpLog('SUCESSO', 'Atualização de Parâmetros REST', `Parâmetros de Integração REST e Empresa atualizados via edição de usuário (${targetUser.email}). CNPJ: ${targetUser.identifier}`, `Atualizado por ${user.email}`);
  }
  
  if (status && status !== targetUser.status) {
    if (!hasPermission(user, 'usuarios_bloquear')) {
      return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para alterar o status/bloquear usuários.' });
    }
    const operacaoLog = status === 'BLOQUEADO' ? 'Bloqueio de Usuário' : 'Alteração de Status de Usuário';
    logActivity(req, operacaoLog, 'usuarios', `Status do usuário ${targetUser.email} alterado de ${targetUser.status} para ${status} por ${user.email}.`);
    targetUser.status = status;
    if (status === 'ATIVO') {
      targetUser.tentativasLogin = 0;
      targetUser.bloqueadoAte = null;
    }
  }
  
  if (perfilAcesso) {
    if (targetUser.perfilAcesso === 'Master' && perfilAcesso !== 'Master' && targetUser.email === 'tecnicodimepdf@gmail.com') {
      return res.status(400).json({ success: false, message: 'Não é permitido restringir o usuário Master padrão.' });
    }
    
    // Validar se o perfil associado existe
    const profiles = dbInstance.getProfiles();
    const matchedProfile = profiles.find(p => p.id === perfilAcesso || p.nome.toLowerCase() === perfilAcesso.toLowerCase().trim());
    if (!matchedProfile && perfilAcesso !== 'Master') {
      return res.status(400).json({ success: false, message: 'O perfil de acesso informado é inválido ou não cadastrado.' });
    }

    const resolvedPerfil = perfilAcesso === 'Master' ? 'Master' : (matchedProfile ? matchedProfile.nome : perfilAcesso);
    
    logActivity(req, 'Alteração de Perfil de Usuário', 'usuarios', `Perfil do usuário ${targetUser.email} alterado de ${targetUser.perfilAcesso} para ${resolvedPerfil} por ${user.email}.`);
    targetUser.perfilAcesso = resolvedPerfil;
  }

  if (perguntasSeguranca && Array.isArray(perguntasSeguranca)) {
    targetUser.perguntasSeguranca = perguntasSeguranca.map((item: any) => ({
      pergunta: item.pergunta,
      respostaHash: hashAnswer(item.resposta)
    }));
  }

  targetUser.dataUltimaAlteracao = new Date().toISOString();
  dbInstance.saveUsers(users);

  // Sincronizar em memória e no banco
  const sessions = dbInstance.getActiveSessions();
  for (const s of sessions) {
    if (s.userId === targetUser.id) {
      s.userEmail = targetUser.email;
      s.nomeCompleto = targetUser.nomeCompleto;
      s.empresa = targetUser.empresa;
      s.perfilAcesso = targetUser.perfilAcesso;
    }
  }
  dbInstance.saveActiveSessions(sessions);

  for (const [tok, sess] of activeSessionsMap.entries()) {
    if (sess.userId === targetUser.id) {
      sess.userEmail = targetUser.email;
      sess.nomeCompleto = targetUser.nomeCompleto;
      sess.empresa = targetUser.empresa;
      sess.perfilAcesso = targetUser.perfilAcesso;
    }
  }

  logActivity(req, 'Alteração de Usuário', 'usuarios', `Usuário editado por ${user.email}: ${targetUser.email}`);
  res.json({ success: true, user: toSafeUserDTO(targetUser) });
});

app.delete('/api/admin/users/:id', (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'usuarios_excluir')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para excluir usuários.' });
  }

  const targetId = req.params.id;
  const users = dbInstance.getUsers();
  const targetUser = users.find(u => u.id === targetId);

  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  if (targetUser.email === 'tecnicodimepdf@gmail.com') {
    return res.status(400).json({ success: false, message: 'Não é permitido excluir o usuário Master padrão.' });
  }

  const filteredUsers = users.filter(u => u.id !== targetId);
  dbInstance.saveUsers(filteredUsers);

  // Invalidar sessões do usuário excluído
  const updatedSessions = dbInstance.getActiveSessions().filter(s => s.userId !== targetId);
  dbInstance.saveActiveSessions(updatedSessions);

  for (const [tok, sess] of activeSessionsMap.entries()) {
    if (sess.userId === targetId) {
      activeSessionsMap.delete(tok);
    }
  }

  logActivity(req, 'Exclusão de Usuário', 'usuarios', `Usuário excluído por ${user.email}: ${targetUser.email}`);
  res.json({ success: true });
});

// CRUD de Perfis
app.get('/api/admin/profiles', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'perfis_criar') && !hasPermission(user, 'perfis_editar') && !hasPermission(user, 'perfis_excluir'))) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para visualizar os perfis de acesso.' });
  }
  res.json(dbInstance.getProfiles());
});

app.post('/api/admin/profiles', (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(403).json({ success: false, message: 'Acesso negado.' });
  }

  const { id, nome, descricao, permissoes, status } = req.body;
  if (!nome || !permissoes) {
    return res.status(400).json({ success: false, message: 'Nome e permissões são obrigatórios.' });
  }

  const profiles = dbInstance.getProfiles();
  const existingIndex = profiles.findIndex(p => p.id === id || p.nome.toLowerCase() === nome.toLowerCase().trim());

  if (existingIndex >= 0) {
    // É Edição
    if (!hasPermission(user, 'perfis_editar')) {
      return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para editar perfis.' });
    }
    const existingProf = profiles[existingIndex];
    if (existingProf.nome.toLowerCase() === 'master' || existingProf.id === 'prof_master') {
      return res.status(400).json({ success: false, message: 'O perfil Master não pode ser modificado.' });
    }

    const oldPerms: string[] = existingProf.permissoes || [];
    const newPerms: string[] = Array.isArray(permissoes) ? permissoes : [];

    const adicionadas = newPerms.filter(p => !oldPerms.includes(p));
    const removidas = oldPerms.filter(p => !newPerms.includes(p));

    const updatedProfile: Profile = {
      ...existingProf,
      nome: nome.trim(),
      descricao: descricao || '',
      permissoes: newPerms,
      status: status || existingProf.status || 'ATIVO',
      dataUltimaAlteracao: new Date().toISOString()
    };

    profiles[existingIndex] = updatedProfile;

    const detalhesLog = `Alteração do Perfil "${existingProf.nome}". Responsável: ${user.email} (${user.nomeCompleto || 'Master'}). ` +
      `Permissões adicionadas: [${adicionadas.join(', ') || 'nenhuma'}]. ` +
      `Permissões removidas: [${removidas.join(', ') || 'nenhuma'}].`;

    logActivity(req, 'Alteração de Perfil', 'seguranca', detalhesLog);
    dbInstance.saveProfiles(profiles);
    return res.json({ success: true, profile: updatedProfile });
  } else {
    // É Criação
    if (!hasPermission(user, 'perfis_criar')) {
      return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para criar perfis.' });
    }

    const newProfile: Profile = {
      id: id || 'prof_' + Date.now(),
      nome: nome.trim(),
      descricao: descricao || '',
      permissoes,
      status: status || 'ATIVO',
      dataCriacao: new Date().toISOString(),
      dataUltimaAlteracao: new Date().toISOString(),
      criadorEmail: user.email
    };

    profiles.push(newProfile);
    logActivity(req, 'Criação de Perfil', 'seguranca', `Novo perfil de permissões criado por ${user.email}: ${nome}`);
    dbInstance.saveProfiles(profiles);
    return res.json({ success: true, profile: newProfile });
  }
});

app.delete('/api/admin/profiles/:id', (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'perfis_excluir')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para excluir perfis.' });
  }

  const targetId = req.params.id;
  if (targetId === 'prof_master' || targetId === 'prof_admin' || targetId === 'prof_comum') {
    return res.status(400).json({ success: false, message: 'Perfis de sistema nativos não podem ser excluídos.' });
  }

  const profiles = dbInstance.getProfiles();
  const targetProf = profiles.find(p => p.id === targetId);
  if (!targetProf) {
    return res.status(404).json({ success: false, message: 'Perfil não encontrado.' });
  }

  if (targetProf.nome.toLowerCase() === 'master' || targetProf.id === 'prof_master') {
    return res.status(400).json({ success: false, message: 'O perfil Master não pode ser excluído.' });
  }

  // Validar se há usuários associados ao perfil antes de excluir
  const users = dbInstance.getUsers();
  const hasAssociatedUsers = users.some(u => u.perfilAcesso === targetProf.nome || u.perfilAcesso === targetProf.id);
  if (hasAssociatedUsers) {
    return res.status(400).json({ success: false, message: 'Não é possível excluir o perfil pois há usuários associados a ele.' });
  }

  const filtered = profiles.filter(p => p.id !== targetId);
  dbInstance.saveProfiles(filtered);

  logActivity(req, 'Exclusão de Perfil', 'seguranca', `Perfil excluído por ${user.email}: ${targetProf.nome}`);
  res.json({ success: true });
});

// Centralized Log Management (Requirement 4)
app.get('/api/admin/logs/centralized', (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'painel_master_acesso')) {
    return res.status(403).json({ success: false, message: 'Acesso negado.' });
  }

  const auditoria = dbInstance.getActivityLogs();
  const tecnico = dbInstance.getSyncLogs();
  const sistema = readOpLogs(); // From logger.ts
  const usage = dbInstance.getUsageStats();

  res.json({
    success: true,
    data: {
      auditoria: auditoria.slice(0, 500),
      tecnico: tecnico.slice(0, 500),
      sistema: sistema,
      usage: usage
    }
  });
});

app.post('/api/admin/logs/clear', (req, res) => {
  const user = getSessionUser(req);
  if (!user || user.perfilAcesso !== 'Master') {
    return res.status(403).json({ success: false, message: 'Acesso negado. Apenas o Master pode limpar logs.' });
  }

  const { category } = req.body;
  if (category === 'sistema') {
    clearOpLogs();
  } else {
    dbInstance.clearLogs(category);
  }

  logActivity(req, 'Limpeza de Logs', 'seguranca', `Logs da categoria ${category} foram limpos por ${user.email}.`);
  res.json({ success: true, message: `Logs da categoria ${category} limpos com sucesso.` });
});

// Alteração Rápida de Status de Usuário (ATIVO / BLOQUEADO / INATIVO)
app.patch('/api/admin/users/:id/status', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'usuarios_bloquear') && !hasPermission(user, 'usuarios_editar') && user.perfilAcesso !== 'Master')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para alterar o status do usuário.' });
  }

  const targetId = req.params.id;
  const { status } = req.body;
  if (!status || !['ATIVO', 'BLOQUEADO', 'INATIVO'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status inválido. Deve ser ATIVO, BLOQUEADO ou INATIVO.' });
  }

  const users = dbInstance.getUsers();
  const targetUser = users.find(u => u.id === targetId);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  if (targetUser.email === 'tecnicodimepdf@gmail.com' && status !== 'ATIVO') {
    return res.status(400).json({ success: false, message: 'Não é permitido inativar ou bloquear a conta Master padrão.' });
  }

  const oldStatus = targetUser.status;
  targetUser.status = status;
  if (status === 'ATIVO') {
    targetUser.tentativasLogin = 0;
    targetUser.bloqueadoAte = null;
  }
  targetUser.dataUltimaAlteracao = new Date().toISOString();
  dbInstance.saveUsers(users);

  if (status !== 'ATIVO') {
    const sessions = dbInstance.getActiveSessions().filter(s => s.userId !== targetId);
    dbInstance.saveActiveSessions(sessions);
    for (const [tok, sess] of activeSessionsMap.entries()) {
      if (sess.userId === targetId) {
        activeSessionsMap.delete(tok);
      }
    }
  }

  logActivity(req, 'Alteração de Status', 'usuarios', `Status do usuário ${targetUser.email} alterado de ${oldStatus} para ${status} por ${user.email}.`);
  res.json({ success: true, user: toSafeUserDTO(targetUser) });
});

// Desbloqueio Imediato e Reset de Tentativas pelo Master/Admin
app.post('/api/admin/users/:id/unlock', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'usuarios_bloquear') && user.perfilAcesso !== 'Master')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Permissão insuficiente para desbloquear usuários.' });
  }

  const targetId = req.params.id;
  const users = dbInstance.getUsers();
  const targetUser = users.find(u => u.id === targetId);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  // Zera contagem de tentativas e remove qualquer bloqueio temporal
  targetUser.tentativasLogin = 0;
  targetUser.bloqueadoAte = null;
  if (targetUser.status === 'BLOQUEADO') {
    targetUser.status = 'ATIVO';
  }
  targetUser.dataUltimaAlteracao = new Date().toISOString();
  dbInstance.saveUsers(users);

  logActivity(req, 'Desbloqueio de Usuário', 'seguranca', `Tentativas de login e bloqueios do usuário ${targetUser.email} foram zerados pelo Master/Admin (${user.email}). Status: ATIVO.`);
  res.json({ success: true, message: 'Usuário desbloqueado e tentativas de login zeradas com sucesso!', user: toSafeUserDTO(targetUser) });
});

// Redefinição Rápida de Senha pelo Master/Admin
app.post('/api/admin/users/:id/reset-password', (req, res) => {
  const user = getSessionUser(req);
  if (!user || (!hasPermission(user, 'usuarios_reset_senha') && user.perfilAcesso !== 'Master')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para redefinir senhas.' });
  }

  const targetId = req.params.id;
  const { novaSenha, exigirTrocaNoProximoAcesso } = req.body;
  if (!novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  const users = dbInstance.getUsers();
  const targetUser = users.find(u => u.id === targetId);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  targetUser.salt = generateSalt();
  targetUser.passwordHash = hashPasswordWithSalt(novaSenha, targetUser.salt);
  // Reset completo de bloqueios e tentativas para que o próximo acesso funcione imediatamente
  targetUser.tentativasLogin = 0;
  targetUser.bloqueadoAte = null;
  if (targetUser.status === 'BLOQUEADO') {
    targetUser.status = 'ATIVO';
  }
  // Só exige troca se o Master explicitamente marcou a opção; por padrão NÃO força troca
  const deveForcar = !!exigirTrocaNoProximoAcesso;
  targetUser.precisaTrocarSenha = deveForcar;
  targetUser.forcarTrocaSenha = deveForcar;
  targetUser.dataUltimaAlteracao = new Date().toISOString();
  dbInstance.saveUsers(users);

  logActivity(req, 'Redefinição de Senha', 'usuarios', `Senha do usuário ${targetUser.email} foi redefinida por ${user.email}. Tentativas zeradas e bloqueios removidos. Exigir troca: ${deveForcar ? 'SIM' : 'NÃO'}.`);
  res.json({ success: true, message: deveForcar ? 'Senha redefinida com sucesso! O usuário deverá cadastrar uma nova senha no próximo acesso.' : 'Senha redefinida e conta liberada com sucesso para acesso imediato!', user: toSafeUserDTO(targetUser) });
});

// Histórico do Usuário (Logins, Sincronizações e Erros de Autenticação)
app.get('/api/admin/users/:id/history', (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'painel_master_acesso')) {
    return res.status(403).json({ success: false, message: 'Acesso negado.' });
  }

  const targetId = req.params.id;
  const users = dbInstance.getUsers();
  const targetUser = users.find(u => u.id === targetId);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  const allLogs = dbInstance.getActivityLogs();
  const userEmail = targetUser.email.toLowerCase();

  const userLogs = allLogs.filter(l => l.usuario.toLowerCase() === userEmail);
  const loginHistory = userLogs.filter(l => l.operacao === 'Login' || l.operacao === 'Logout');
  const authErrors = userLogs.filter(l => l.operacao.includes('Falha') || l.operacao.includes('Tentativas') || l.operacao.includes('Bloqueio'));
  const syncLogs = dbInstance.getSyncLogs().slice(0, 20);

  res.json({
    success: true,
    user: {
      id: targetUser.id,
      nomeCompleto: targetUser.nomeCompleto,
      email: targetUser.email,
      perfilAcesso: targetUser.perfilAcesso,
      status: targetUser.status
    },
    loginHistory: loginHistory.slice(0, 30),
    authErrors: authErrors.slice(0, 30),
    syncHistory: syncLogs
  });
});

// Teste de Conexão com Credenciais Específicas do Usuário (Para Suporte e Diagnóstico)
app.post('/api/admin/users/:id/test-connection', async (req, res) => {
  const user = getSessionUser(req);
  if (!user || user.perfilAcesso !== 'Master') {
    return res.status(403).json({ success: false, message: 'Acesso negado. Apenas o perfil Master pode executar testes com credenciais de terceiros.' });
  }

  const targetId = req.params.id;
  const users = dbInstance.getUsers();
  const targetUser = users.find(u => u.id === targetId);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  const sysConfig = dbInstance.getConfig();
  const keyToUse = targetUser.key || sysConfig.key;
  const identifierToUse = targetUser.identifier || sysConfig.identifier;
  const hostToUse = sysConfig.host || 'https://www.dimepkairos.com.br';

  if (!keyToUse || !identifierToUse) {
    return res.status(400).json({ success: false, message: 'O usuário selecionado não possui REST API Key e CNPJ/CPF cadastrados.' });
  }

  const start = Date.now();
  try {
    const result = await testConnection(hostToUse, identifierToUse, keyToUse);
    const latencyMs = Date.now() - start;

    logActivity(req, 'Teste de Conexão por Usuário', 'configuracao', `Master (${user.email}) executou teste de conexão para as credenciais do usuário ${targetUser.email}. Resultado: ${result.success ? 'SUCESSO' : 'FALHA'}. Latência: ${latencyMs}ms`);

    res.json({
      success: result.success,
      message: result.message,
      companyName: result.companyName,
      latencyMs,
      targetUserEmail: targetUser.email,
      identifierUsed: cleanIdentifier(identifierToUse)
    });
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    logActivity(req, 'Falha no Teste de Conexão por Usuário', 'configuracao', `Erro no teste de conexão do usuário ${targetUser.email}: ${err.message || err}`);
    res.status(500).json({
      success: false,
      message: err.message || 'Falha ao testar conexão com o Kairos',
      latencyMs
    });
  }
});

// Sincronização Manual Executada pelo Master Usando Credenciais do Usuário
app.post('/api/admin/users/:id/sync', async (req, res) => {
  const user = getSessionUser(req);
  if (!user || user.perfilAcesso !== 'Master') {
    return res.status(403).json({ success: false, message: 'Acesso negado. Apenas o perfil Master pode disparar sincronizações sob demanda de outros usuários.' });
  }

  const targetId = req.params.id;
  const users = dbInstance.getUsers();
  const targetUser = users.find(u => u.id === targetId);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  }

  const sysConfig = dbInstance.getConfig();
  const customConfig: DimepConfig = {
    ...sysConfig,
    key: targetUser.key || sysConfig.key,
    identifier: targetUser.identifier || sysConfig.identifier,
    nomeEmpresaConectada: targetUser.empresa || sysConfig.nomeEmpresaConectada
  };

  dbInstance.addSyncLog({
    dataHora: new Date().toISOString(),
    status: 'EM_ANDAMENTO',
    detalhes: `Sincronização manual disparada pelo Master para credenciais do usuário ${targetUser.email}...`,
    registrosColetados: 0
  });

  try {
    const syncResult = await syncRealDimepKairos(dbInstance, customConfig);
    logActivity(req, 'Sincronização por Usuário', 'configuracao', `Sincronização manual concluída para credenciais de ${targetUser.email}. Registros: ${syncResult.count}`);
    res.json({
      success: true,
      message: syncResult.message,
      count: syncResult.count
    });
  } catch (err: any) {
    logActivity(req, 'Falha na Sincronização por Usuário', 'configuracao', `Erro na sincronização manual de ${targetUser.email}: ${err.message || err}`);
    res.status(500).json({
      success: false,
      message: err.message || 'Erro ao sincronizar com o Kairos.'
    });
  }
});

// Diagnóstico da Aplicação e Saúde do Servidor em Tempo Real
app.get('/api/admin/diagnostics', async (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'painel_master_acesso')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Apenas o perfil Master tem acesso ao Diagnóstico da Aplicação.' });
  }

  const sysConfig = dbInstance.getConfig();
  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  let apiStatus: 'Conectada' | 'Desconectada' | 'Modo Demonstração' = 'Modo Demonstração';
  let apiLatencyMs = 0;
  let apiMessage = 'Modo Demonstração Ativo';

  if (sysConfig.appMode === 'REAL' && sysConfig.key && sysConfig.identifier) {
    const start = Date.now();
    try {
      const connTest = await testConnection(sysConfig.host || 'https://www.dimepkairos.com.br', sysConfig.identifier, sysConfig.key);
      apiLatencyMs = Date.now() - start;
      if (connTest.success) {
        apiStatus = 'Conectada';
        apiMessage = connTest.message || 'Comunicação OK com API Kairos';
      } else {
        apiStatus = 'Desconectada';
        apiMessage = connTest.message || 'Falha de conexão com API Kairos';
      }
    } catch (err: any) {
      apiLatencyMs = Date.now() - start;
      apiStatus = 'Desconectada';
      apiMessage = err.message || 'Erro de rede ou timeout na API Kairos';
    }
  }

  const dbFilePath = path.join(process.cwd(), 'data', 'db.json');
  let dbSizeBytes = 0;
  let dbExists = false;
  try {
    if (fs.existsSync(dbFilePath)) {
      dbExists = true;
      dbSizeBytes = fs.statSync(dbFilePath).size;
    }
  } catch (e) {
    // ignore
  }

  const users = dbInstance.getUsers();
  const profiles = dbInstance.getProfiles();
  const activityLogs = dbInstance.getActivityLogs();
  const syncLogs = dbInstance.getSyncLogs();
  const funcs = dbInstance.getFuncionarios();
  const marcs = dbInstance.getMarcacoes();
  const activeSessions = dbInstance.getActiveSessions();

  const lastSync = syncLogs.length > 0 ? syncLogs[0] : null;

  const recentErrors = activityLogs
    .filter(l => l.operacao.includes('Falha') || l.operacao.includes('Erro') || l.operacao.includes('Bloqueio'))
    .slice(0, 10);

  const masterOk = users.some(u => u.email === 'tecnicodimepdf@gmail.com' && u.perfilAcesso === 'Master');
  const profilesOk = profiles.length > 0;
  const configOk = !!sysConfig;

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    api: {
      status: apiStatus,
      latencyMs: apiLatencyMs,
      message: apiMessage,
      appMode: sysConfig.appMode || 'REAL',
      host: sysConfig.host || 'https://www.dimepkairos.com.br',
      cnpjs: sysConfig.identifier || 'N/A'
    },
    database: {
      exists: dbExists,
      sizeBytes: dbSizeBytes,
      sizeFormatted: `${(dbSizeBytes / 1024).toFixed(1)} KB`,
      usersCount: users.length,
      profilesCount: profiles.length,
      activityLogsCount: activityLogs.length,
      syncLogsCount: syncLogs.length,
      funcionariosCount: funcs.length,
      marcacoesCount: marcs.length
    },
    sync: {
      lastSyncDate: sysConfig.dataUltimaSincronizacao || (lastSync ? lastSync.dataHora : null),
      lastSyncStatus: lastSync ? lastSync.status : 'Nenhuma',
      lastSyncDetails: lastSync ? lastSync.detalhes : 'Nenhum registro',
      queueState: 'Livre'
    },
    sessions: {
      activeSessionsCount: activeSessions.length,
      blockNewConnections: !!sysConfig.blockNewConnections,
      heartbeatIntervalMinutes: sysConfig.heartbeatIntervalMinutes || 5,
      sessionTimeoutMinutes: sysConfig.sessionTimeoutMinutes || 30,
      heartbeatStatus: 'Operacional'
    },
    server: {
      memory: {
        rssMb: (memoryUsage.rss / 1024 / 1024).toFixed(2),
        heapTotalMb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
        heapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2)
      },
      uptimeSeconds,
      uptimeFormatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
      nodeVersion: process.version,
      platform: process.platform
    },
    integrity: {
      configValid: configOk,
      profilesValid: profilesOk,
      usersValid: users.length > 0,
      masterAccountOk: masterOk,
      persistenceReadWriteOk: dbExists
    },
    recentErrors
  });
});

// Painel de Estatísticas de Utilização
app.get('/api/admin/usage', (req, res) => {
  const user = getSessionUser(req);
  if (!user || !hasPermission(user, 'painel_master_acesso')) {
    return res.status(403).json({ success: false, message: 'Acesso negado. Você não possui permissão para acessar o painel administrativo de utilização.' });
  }
  
  const users = dbInstance.getUsers();
  const empresas = dbInstance.getEmpresas();
  const logs = dbInstance.getActivityLogs();

  const activeUsersCount = users.filter(u => u.status === 'ATIVO').length;
  const blockedUsersCount = users.filter(u => u.status === 'BLOQUEADO').length;
  
  const userActivityCounts: Record<string, number> = {};
  logs.forEach(l => {
    userActivityCounts[l.usuario] = (userActivityCounts[l.usuario] || 0) + 1;
  });

  const consumoPorUsuario = Object.keys(userActivityCounts).map(email => {
    const u = users.find(x => x.email === email);
    return {
      email,
      nome: u ? u.nomeCompleto : 'Desconhecido',
      perfil: u ? u.perfilAcesso : 'N/A',
      acoes: userActivityCounts[email]
    };
  }).sort((a, b) => b.acoes - a.acoes);

  // Calcular métricas de segurança baseadas nos registros do log de auditoria
  const tentativasLoginTotal = logs.filter(l => l.operacao === 'Login' || l.operacao === 'Falha de Autenticação' || l.operacao === 'Tentativas inválidas').length;
  const recuperacoesSenhaTotal = logs.filter(l => l.operacao === 'Recuperação de Senha').length;
  const bloqueiosRealizadosTotal = logs.filter(l => l.operacao === 'Bloqueio de Usuário' || l.operacao === 'Bloqueio de Usuário' || l.operacao === 'Bloqueio').length;

  res.json({
    usersCount: users.length,
    activeUsersCount,
    blockedUsersCount,
    empresasCount: empresas.length,
    usageStats: dbInstance.getUsageStats(),
    consumoPorUsuario,
    securityStats: {
      tentativasLoginTotal,
      recuperacoesSenhaTotal,
      bloqueiosRealizadosTotal
    }
  });
});

// Exportar Backup Completo (Configurações, Usuários, Perfis, Logs, etc.)
app.get('/api/admin/backup/export', (req, res) => {
  const user = getSessionUser(req);
  if (!user || user.perfilAcesso !== 'Master') {
    return res.status(403).json({ success: false, message: 'Acesso negado.' });
  }

  logActivity(req, 'Backup', 'backup', 'Exportação e backup completo do banco de dados realizado.');
  
  const rawData = dbInstance.getRawData();
  res.setHeader('Content-disposition', `attachment; filename=backup_ambientes_auditoria_${Date.now()}.json`);
  res.setHeader('Content-type', 'application/json');
  res.write(JSON.stringify(rawData, null, 2), 'utf-8');
  res.end();
});

// Importar Backup e Restaurar Ambiente Completo (Restauração com Validação)
app.post('/api/admin/backup/import', (req, res) => {
  const user = getSessionUser(req);
  if (!user || user.perfilAcesso !== 'Master') {
    return res.status(403).json({ success: false, message: 'Acesso negado.' });
  }

  try {
    const importData = req.body;
    
    if (!importData || typeof importData !== 'object') {
      return res.status(400).json({ success: false, message: 'Dados de importação inválidos ou formato incorreto.' });
    }

    if (!importData.config || !Array.isArray(importData.users)) {
      return res.status(400).json({ success: false, message: 'Arquivo de backup inválido. Chaves fundamentais de segurança ou configurações ausentes.' });
    }

    const success = dbInstance.restoreRawData(importData);
    if (success) {
      logActivity(req, 'Restauração', 'backup', 'Restauração completa do banco de dados efetuada com sucesso.');
      res.json({ success: true, message: 'Banco de dados restaurado com sucesso!' });
    } else {
      res.status(500).json({ success: false, message: 'Falha interna ao aplicar restauração no banco de dados.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Erro ao importar dados: ${err.message || err}` });
  }
});

// ----------------------------------------------------
// VITE MIDDLEWARE SETUP E INTEGRACAO FRONTEND
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
