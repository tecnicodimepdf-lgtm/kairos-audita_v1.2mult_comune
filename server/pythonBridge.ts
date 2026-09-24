/**
 * Bridge de integração que delega as chamadas de auditoria diretamente para o motor único
 * de regras trabalhistas em server/engine.ts, garantindo 100% de consistência e determinismo.
 */

import { Funcionario, Marcacao, JornadaCalculada, Ocorrencia } from '../src/types';
import { processarAuditoria as engineProcessarAuditoria, calcularScoresFuncionarios as engineCalcularScores } from './engine';

export interface AuditResult {
  jornadas: JornadaCalculada[];
  ocorrencias: Ocorrencia[];
  funcionariosAtualizados: Funcionario[];
  engine: 'typescript_fallback';
}

/**
 * Executa a auditoria de 100% dos dados via a ÚNICA fonte da verdade (server/engine.ts).
 */
export async function runPythonAudit(
  funcionarios: Funcionario[],
  marcacoes: Marcacao[],
  _timeoutMs: number = 15000
): Promise<AuditResult> {
  const { jornadas, ocorrencias } = engineProcessarAuditoria(funcionarios, marcacoes);
  const funcionariosAtualizados = engineCalcularScores(funcionarios, ocorrencias);
  return {
    jornadas,
    ocorrencias,
    funcionariosAtualizados,
    engine: 'typescript_fallback'
  };
}
