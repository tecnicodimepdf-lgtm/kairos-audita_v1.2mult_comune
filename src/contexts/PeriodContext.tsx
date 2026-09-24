/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface GlobalPeriod {
  dataInicio: string;
  dataFim: string;
}

interface PeriodContextType {
  globalPeriod: GlobalPeriod;
  setGlobalPeriod: React.Dispatch<React.SetStateAction<GlobalPeriod>>;
  updateDataInicio: (val: string) => void;
  updateDataFim: (val: string) => void;
  setPeriodDates: (dataInicio: string, dataFim: string) => void;
  clearGlobalPeriod: () => void;
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

export const PeriodProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [globalPeriod, setGlobalPeriod] = useState<GlobalPeriod>(() => {
    try {
      const savedInicio = sessionStorage.getItem('global_period_dataInicio') || '';
      const savedFim = sessionStorage.getItem('global_period_dataFim') || '';
      return { dataInicio: savedInicio, dataFim: savedFim };
    } catch {
      return { dataInicio: '', dataFim: '' };
    }
  });

  const updateDataInicio = (val: string) => {
    setGlobalPeriod(prev => {
      const next = { ...prev, dataInicio: val };
      try {
        sessionStorage.setItem('global_period_dataInicio', val);
      } catch {}
      return next;
    });
  };

  const updateDataFim = (val: string) => {
    setGlobalPeriod(prev => {
      const next = { ...prev, dataFim: val };
      try {
        sessionStorage.setItem('global_period_dataFim', val);
      } catch {}
      return next;
    });
  };

  const setPeriodDates = (dataInicio: string, dataFim: string) => {
    setGlobalPeriod({ dataInicio, dataFim });
    try {
      sessionStorage.setItem('global_period_dataInicio', dataInicio);
      sessionStorage.setItem('global_period_dataFim', dataFim);
    } catch {}
  };

  const clearGlobalPeriod = () => {
    setPeriodDates('', '');
  };

  return (
    <PeriodContext.Provider
      value={{
        globalPeriod,
        setGlobalPeriod,
        updateDataInicio,
        updateDataFim,
        setPeriodDates,
        clearGlobalPeriod
      }}
    >
      {children}
    </PeriodContext.Provider>
  );
};

export const usePeriod = (): PeriodContextType => {
  const context = useContext(PeriodContext);
  if (!context) {
    throw new Error('usePeriod deve ser utilizado dentro de um PeriodProvider');
  }
  return context;
};
