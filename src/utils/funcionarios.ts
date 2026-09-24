/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Funcionario } from '../types';

export interface ConsolidacaoVinculos {
  ativos: Funcionario[];
  desligados: Funcionario[];
  todos: Funcionario[];
  mapaHistoricoParaAtivo: Record<string, string>;
}

/**
 * Consolida múltiplos vínculos e cadastros históricos de uma mesma pessoa (agrupados por CPF/PIS/Nome),
 * identificando o cadastro atualmente ATIVO para ser utilizado de forma exclusiva em exibições,
 * auditorias e relatórios. Vínculos encerrados de pessoas ativas são desconsiderados na visão de Ativos,
 * e seus eventos históricos são automaticamente remapeados para o vínculo ativo atual.
 */
export function resolverEConsolidarVinculos(funcionarios: Funcionario[]): ConsolidacaoVinculos {
  if (!funcionarios || funcionarios.length === 0) {
    return { ativos: [], desligados: [], todos: [], mapaHistoricoParaAtivo: {} };
  }

  const gruposPessoa = new Map<string, Funcionario[]>();

  funcionarios.forEach((f) => {
    const cleanCpf = (f.cpf || '').replace(/\D/g, '');
    const cleanPis = (f.pis || '').replace(/\D/g, '');
    const normNome = (f.nome || '').toUpperCase().trim();
    const empId = f.empresaId || '';

    let key = '';
    if (cleanCpf && cleanCpf.length >= 8) {
      key = `CPF_${cleanCpf}`;
    } else if (cleanPis && cleanPis.length >= 8) {
      key = `PIS_${cleanPis}`;
    } else {
      key = `NOME_${normNome}_${empId}`;
    }

    if (!gruposPessoa.has(key)) {
      gruposPessoa.set(key, []);
    }
    gruposPessoa.get(key)!.push(f);
  });

  const ativos: Funcionario[] = [];
  const desligados: Funcionario[] = [];
  const todos: Funcionario[] = [];
  const mapaHistoricoParaAtivo: Record<string, string> = {};

  gruposPessoa.forEach((registros) => {
    // Procura por vínculo ativo: status === 'ATIVO' e situacao !== 'DESLIGADO'
    const registroAtivo =
      registros.find(
        (r) =>
          (r.status || 'ATIVO').toUpperCase().trim() === 'ATIVO' &&
          (r.situacao || '').toUpperCase().trim() !== 'DESLIGADO'
      ) ||
      registros.find((r) => (r.status || 'ATIVO').toUpperCase().trim() === 'ATIVO');

    if (registroAtivo) {
      // Pessoa possui vínculo ativo: o vínculo ativo é o único para exibição padrão e auditoria
      ativos.push(registroAtivo);
      todos.push(registroAtivo);

      registros.forEach((r) => {
        mapaHistoricoParaAtivo[r.id] = registroAtivo.id;
        if (r.id !== registroAtivo.id) {
          // Registros históricos de colaboradores ativos são mantidos apenas no grupo TODOS
          todos.push(r);
        }
      });
    } else {
      // Nenhum vínculo ativo: o colaborador está inteiramente DESLIGADO
      const desligadoPrincipal = registros[0];
      desligados.push(desligadoPrincipal);
      todos.push(desligadoPrincipal);

      registros.forEach((r) => {
        mapaHistoricoParaAtivo[r.id] = desligadoPrincipal.id;
        if (r.id !== desligadoPrincipal.id) {
          todos.push(r);
        }
      });
    }
  });

  return { ativos, desligados, todos, mapaHistoricoParaAtivo };
}
