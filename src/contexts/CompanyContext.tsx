/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { DimepConfig, EmpresaRestConfig } from '../types';

export interface CompanyContextType {
  config: DimepConfig | null;
  empresaAtiva: EmpresaRestConfig | null;
  empresaNome: string;
  empresaCnpj: string;
  apiKey: string;
  isDemoActive: boolean;
  empresasRest: EmpresaRestConfig[];
  isLoadingCompany: boolean;
  refreshCompanyConfig: () => Promise<DimepConfig | null>;
  saveConfig: (newConfig: Partial<DimepConfig>) => Promise<{ success: boolean; config?: DimepConfig; message?: string }>;
  selectActiveEmpresa: (empresaId: string) => Promise<{ success: boolean; config?: DimepConfig; message?: string }>;
  saveEmpresaRest: (payload: EmpresaRestConfig) => Promise<{ success: boolean; config?: DimepConfig; message?: string }>;
  deleteEmpresaRest: (empresaId: string) => Promise<{ success: boolean; config?: DimepConfig; message?: string }>;
  updateLocalConfig: (updater: (prev: DimepConfig | null) => DimepConfig | null) => void;
  clearCompanyState: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfigState] = useState<DimepConfig | null>(() => {
    try {
      const cached = localStorage.getItem('@kairos_config_cache');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Erro ao carregar cache inicial de config:', e);
    }
    return null;
  });

  const [isLoadingCompany, setIsLoadingCompany] = useState<boolean>(false);

  // Deriva o objeto da empresa ativa
  const empresaAtiva = React.useMemo<EmpresaRestConfig | null>(() => {
    if (!config) return null;
    if (config.empresasRest && config.empresasRest.length > 0) {
      return config.empresasRest.find(e => e.ativa) || config.empresasRest[0];
    }
    return null;
  }, [config]);

  // Deriva nome da empresa conectada
  const empresaNome = React.useMemo<string>(() => {
    if (empresaAtiva?.razaoSocial) return empresaAtiva.razaoSocial;
    if (config?.nomeEmpresaConectada) return config.nomeEmpresaConectada;
    try {
      const cachedEmpresas = localStorage.getItem('@kairos_empresas_cache');
      if (cachedEmpresas) {
        const empresas = JSON.parse(cachedEmpresas);
        if (empresas && empresas.length > 0) return empresas[0].razaoSocial || empresas[0].nomeFantasia || '';
      }
    } catch (e) {}
    return '';
  }, [empresaAtiva, config?.nomeEmpresaConectada]);

  // Deriva CNPJ
  const empresaCnpj = React.useMemo<string>(() => {
    if (empresaAtiva?.cnpj) return empresaAtiva.cnpj;
    if (config?.identifier) return config.identifier;
    try {
      const cachedEmpresas = localStorage.getItem('@kairos_empresas_cache');
      if (cachedEmpresas) {
        const empresas = JSON.parse(cachedEmpresas);
        if (empresas && empresas.length > 0) return empresas[0].cnpj || '';
      }
    } catch (e) {}
    return '';
  }, [empresaAtiva, config?.identifier]);

  // Deriva Rest API Key
  const apiKey = React.useMemo<string>(() => {
    if (empresaAtiva?.key) return empresaAtiva.key;
    if (config?.key) return config.key;
    return '';
  }, [empresaAtiva, config?.key]);

  // Deriva se o modo demonstração está ativo
  const isDemoActive = React.useMemo<boolean>(() => {
    return !apiKey;
  }, [apiKey]);

  // Deriva lista de empresas cadastradas
  const empresasRest = React.useMemo<EmpresaRestConfig[]>(() => {
    return config?.empresasRest || [];
  }, [config?.empresasRest]);

  // Função auxiliar para atualizar o estado de config e salvar no cache do browser
  const updateConfigAndCache = useCallback((newConfig: DimepConfig | null) => {
    setConfigState(newConfig);
    if (newConfig) {
      try {
        localStorage.setItem('@kairos_config_cache', JSON.stringify(newConfig));
      } catch (e) {}

      // Notifica componentes legados/listeners de evento se houver
      const active = newConfig.empresasRest?.find(e => e.ativa) || newConfig.empresasRest?.[0];
      const nome = active?.razaoSocial || newConfig.nomeEmpresaConectada || '';
      const cnpj = active?.cnpj || newConfig.identifier || '';
      window.dispatchEvent(new CustomEvent('empresaAtivaChanged', { detail: { nome, cnpj } }));
    }
  }, []);

  const updateLocalConfig = useCallback((updater: (prev: DimepConfig | null) => DimepConfig | null) => {
    setConfigState(prev => {
      const next = updater(prev);
      if (next) {
        try {
          localStorage.setItem('@kairos_config_cache', JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  }, []);

  // Busca configurações no servidor
  const refreshCompanyConfig = useCallback(async (): Promise<DimepConfig | null> => {
    setIsLoadingCompany(true);
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data: DimepConfig = await res.json();
        updateConfigAndCache(data);
        return data;
      }
    } catch (err) {
      console.error('[CompanyContext] Erro ao carregar configurações de empresa:', err);
    } finally {
      setIsLoadingCompany(false);
    }
    return null;
  }, [updateConfigAndCache]);

  // Salva configurações gerais de integração REST
  const saveConfig = useCallback(async (newConfig: Partial<DimepConfig>) => {
    updateLocalConfig(prev => {
      if (!prev) return null;
      return { ...prev, ...newConfig };
    });

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      const data = await res.json();
      if (res.ok && data.config) {
        updateConfigAndCache(data.config);
        return { success: true, config: data.config, message: data.message };
      } else {
        await refreshCompanyConfig();
        return { success: false, message: data.message || 'Erro ao salvar configurações.' };
      }
    } catch (err) {
      console.error('[CompanyContext] Erro ao salvar configurações:', err);
      await refreshCompanyConfig();
      return { success: false, message: 'Erro ao conectar com o servidor.' };
    }
  }, [updateLocalConfig, updateConfigAndCache, refreshCompanyConfig]);

  // Seleciona uma empresa como ativa
  const selectActiveEmpresa = useCallback(async (empresaId: string) => {
    // Atualização Otimista
    updateLocalConfig(prev => {
      if (!prev) return null;
      const empresas = prev.empresasRest ? [...prev.empresasRest] : [];
      const selectedEmp = empresas.find(e => e.id === empresaId);
      const novasEmpresas = empresas.map(emp => ({
        ...emp,
        ativa: emp.id === empresaId
      }));
      return {
        ...prev,
        empresasRest: novasEmpresas,
        identifier: selectedEmp ? selectedEmp.cnpj : prev.identifier,
        key: selectedEmp ? selectedEmp.key : prev.key,
        nomeEmpresaConectada: selectedEmp ? (selectedEmp.razaoSocial || prev.nomeEmpresaConectada) : prev.nomeEmpresaConectada
      };
    });

    try {
      const res = await fetch('/api/empresas-rest/selecionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.config) {
          updateConfigAndCache(data.config);
        }
        return { success: true, config: data.config, message: data.message };
      } else {
        await refreshCompanyConfig(); // Reverte em caso de falha
        return { success: false, message: data.message || 'Erro ao selecionar empresa ativa.' };
      }
    } catch (err) {
      console.error('[CompanyContext] Erro ao selecionar empresa ativa:', err);
      await refreshCompanyConfig();
      return { success: false, message: 'Erro ao comunicar com o servidor.' };
    }
  }, [updateLocalConfig, updateConfigAndCache, refreshCompanyConfig]);

  // Salva/Edita uma empresa na lista de multiempresa
  const saveEmpresaRest = useCallback(async (payload: EmpresaRestConfig) => {
    // Atualização Otimista
    updateLocalConfig(prev => {
      if (!prev) return null;
      let novasEmpresas = prev.empresasRest ? [...prev.empresasRest] : [];
      const index = novasEmpresas.findIndex(e => e.id === payload.id);
      if (index >= 0) {
        novasEmpresas[index] = { ...novasEmpresas[index], ...payload };
      } else {
        novasEmpresas.push(payload);
      }
      if (payload.ativa) {
        novasEmpresas = novasEmpresas.map(emp => ({ ...emp, ativa: emp.id === payload.id }));
      }
      const activeEmp = novasEmpresas.find(e => e.ativa) || novasEmpresas[0];
      return {
        ...prev,
        empresasRest: novasEmpresas,
        identifier: activeEmp ? activeEmp.cnpj : prev.identifier,
        key: activeEmp ? activeEmp.key : prev.key,
        nomeEmpresaConectada: activeEmp ? (activeEmp.razaoSocial || prev.nomeEmpresaConectada) : prev.nomeEmpresaConectada
      };
    });

    try {
      const res = await fetch('/api/empresas-rest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.config) {
          updateConfigAndCache(data.config);
        }
        return { success: true, config: data.config, message: data.message };
      } else {
        await refreshCompanyConfig();
        return { success: false, message: data.message || 'Erro ao salvar empresa.' };
      }
    } catch (err) {
      console.error('[CompanyContext] Erro ao salvar empresa:', err);
      await refreshCompanyConfig();
      return { success: false, message: 'Erro ao conectar com o servidor.' };
    }
  }, [updateLocalConfig, updateConfigAndCache, refreshCompanyConfig]);

  // Remove uma empresa da lista de multiempresa
  const deleteEmpresaRest = useCallback(async (empresaId: string) => {
    // Atualização Otimista
    updateLocalConfig(prev => {
      if (!prev) return null;
      const novasEmpresas = (prev.empresasRest || []).filter(e => e.id !== empresaId);
      const activeEmp = novasEmpresas.find(e => e.ativa) || novasEmpresas[0];
      return {
        ...prev,
        empresasRest: novasEmpresas,
        identifier: activeEmp ? activeEmp.cnpj : '',
        key: activeEmp ? activeEmp.key : '',
        nomeEmpresaConectada: activeEmp ? (activeEmp.razaoSocial || '') : ''
      };
    });

    try {
      const res = await fetch(`/api/empresas-rest/${empresaId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.config) {
          updateConfigAndCache(data.config);
        }
        return { success: true, config: data.config, message: data.message };
      } else {
        await refreshCompanyConfig();
        return { success: false, message: data.message || 'Erro ao remover empresa.' };
      }
    } catch (err) {
      console.error('[CompanyContext] Erro ao remover empresa:', err);
      await refreshCompanyConfig();
      return { success: false, message: 'Erro ao comunicar com o servidor.' };
    }
  }, [updateLocalConfig, updateConfigAndCache, refreshCompanyConfig]);

  const clearCompanyState = useCallback(() => {
    setConfigState(null);
    try {
      localStorage.removeItem('@kairos_config_cache');
      localStorage.removeItem('@kairos_empresas_cache');
    } catch (e) {}
  }, []);

  return (
    <CompanyContext.Provider
      value={{
        config,
        empresaAtiva,
        empresaNome,
        empresaCnpj,
        apiKey,
        isDemoActive,
        empresasRest,
        isLoadingCompany,
        refreshCompanyConfig,
        saveConfig,
        selectActiveEmpresa,
        saveEmpresaRest,
        deleteEmpresaRest,
        updateLocalConfig,
        clearCompanyState
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = (): CompanyContextType => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany deve ser utilizado dentro de um CompanyProvider');
  }
  return context;
};
