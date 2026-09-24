/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  BarChart3,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Database,
  Users,
  ShieldCheck,
  LogOut
} from 'lucide-react';

import { hasPermission } from '../utils/permissions';
import { useCompany } from '../contexts/CompanyContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isDemoActive?: boolean;
  empresaNome?: string;
  empresaCnpj?: string;
  user?: {
    nomeCompleto: string;
    email: string;
    perfilAcesso: string;
    permissoes?: string[];
  } | null;
  onLogout?: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isDemoActive: propIsDemoActive,
  empresaNome: propEmpresaNome,
  empresaCnpj: propEmpresaCnpj,
  user,
  onLogout
}: SidebarProps) {
  const company = useCompany();
  const isDemoActive = propIsDemoActive ?? company.isDemoActive;
  const empresaNome = propEmpresaNome ?? company.empresaNome;
  const empresaCnpj = propEmpresaCnpj ?? company.empresaCnpj;
  const rawMenuItems = [
    { id: 'executivo', label: 'Dashboard Executivo', icon: LayoutDashboard, requiredPerms: ['dashboard_executivo_visualizar'] },
    { id: 'rh', label: 'Dashboard RH / CLT', icon: ShieldAlert, requiredPerms: ['dashboard_rh_visualizar'] },
    { id: 'gerencial', label: 'BI / Analítico', icon: BarChart3, requiredPerms: ['dashboard_gerencial_visualizar'] },
    { id: 'funcionarios', label: 'Funcionários', icon: Users, requiredPerms: ['funcionarios_consultar', 'funcionarios_visualizar', 'funcionarios_ativos'] },
    { id: 'auditorias', label: 'Auditoria de Jornadas', icon: ClipboardCheck, requiredPerms: ['auditoria_visualizar'] },
    { id: 'relatorios', label: 'Relatórios Exportáveis', icon: FileSpreadsheet, requiredPerms: ['relatorios_visualizar'] },
    { id: 'configuracao', label: 'Configurações Kairos', icon: Settings, requiredPerms: ['configuracao_visualizar', 'configuracao_empresa', 'configuracao_sincronizar', 'configuracao_rest_api'] }
  ];

  const menuItems = rawMenuItems.filter(item => hasPermission(user, item.requiredPerms));

  // Adiciona painel de controle administrativo para perfis autorizados
  if (user && hasPermission(user, ['painel_master_acesso', 'usuarios_criar', 'perfis_criar', 'painel_master_usuarios', 'painel_master_perfis'])) {
    menuItems.push({
      id: 'admin_panel',
      label: 'Painel Master',
      icon: ShieldCheck,
      requiredPerms: ['painel_master_acesso']
    });
  }

  return (
    <aside
      className={`bg-[#064e3b] text-white flex flex-col justify-between transition-all duration-300 border-r border-[#043d2e] select-none no-print ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header do Logo */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#043d2e] shrink-0">
          {!isCollapsed ? (
            <>
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 bg-[#10b981] rounded flex items-center justify-center shrink-0 shadow-sm">
                  <Database className="h-4.5 w-4.5 text-white" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-bold text-white tracking-tight text-xs">
                    Auditoria Trabalhista
                  </span>
                  <span className="text-[9px] text-emerald-200 uppercase tracking-widest font-bold font-mono">
                    CLT Compliance
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1 hover:bg-[#043d2e] rounded transition-colors text-emerald-100 hover:text-white cursor-pointer"
                id="toggle-sidebar"
                aria-label="Minimizar menu"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center w-full space-y-3">
              <div className="w-8 h-8 bg-[#10b981] rounded flex items-center justify-center shadow-sm">
                <Database className="h-4.5 w-4.5 text-white" />
              </div>
              <button
                onClick={() => setIsCollapsed(false)}
                className="p-1 hover:bg-[#043d2e] rounded transition-colors text-emerald-100 hover:text-white cursor-pointer"
                id="toggle-sidebar-expand"
                aria-label="Expandir menu"
                title="Expandir menu"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Menu de Navegação */}
        <nav className="p-3 space-y-1 flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'space-x-3 p-3'} rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-white/15 text-white font-bold ring-1 ring-white/20'
                    : 'text-emerald-100/70 hover:bg-white/10 hover:text-white'
                }`}
                id={`btn-nav-${item.id}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-emerald-100/70'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}

          {onLogout && (
            <button
              onClick={() => onLogout()}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3 mt-4' : 'space-x-3 p-3 mt-4'} rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer text-rose-400 hover:bg-rose-500/10 hover:text-rose-300`}
              id="btn-nav-logout"
            >
              <LogOut className="h-5 w-5 shrink-0 text-rose-400" />
              {!isCollapsed && <span className="truncate">Sair do Sistema</span>}
            </button>
          )}
        </nav>
      </div>

      {/* Footer / Status da Conexão */}
      <div className="p-4 border-t border-[#043d2e] bg-emerald-950/20 shrink-0">
        {!isCollapsed ? (
          <div className="bg-[#043d2e] border border-emerald-800/40 rounded-lg p-3.5 space-y-1.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">API Status</span>
              <div className={`w-2 h-2 rounded-full shrink-0 ${isDemoActive ? 'bg-orange-400 animate-pulse' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'}`}></div>
            </div>
            <p className="text-xs text-white font-mono leading-tight font-semibold">
              {isDemoActive ? 'Demo Active' : 'Kairos Connected'}
            </p>
            {!isDemoActive && empresaCnpj && (
              <p className="text-[10px] text-emerald-100 font-mono font-bold leading-tight">
                CNPJ: {empresaCnpj}
              </p>
            )}
            {!isDemoActive && empresaNome && (
              <p className="text-[10px] text-emerald-100 font-bold leading-tight truncate" title={empresaNome}>
                Empresa: {empresaNome}
              </p>
            )}
            <p className="text-[10px] text-emerald-400/80 leading-normal font-medium">
              {isDemoActive
                ? 'Exibindo dados simulados.'
                : 'Integrado ao Kairos API.'}
            </p>
          </div>
        ) : (
          <div className="flex justify-center p-1">
            <div className={`w-2 h-2 rounded-full shrink-0 ${isDemoActive ? 'bg-orange-400 animate-pulse' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'}`}></div>
          </div>
        )}
      </div>
    </aside>
  );
}
