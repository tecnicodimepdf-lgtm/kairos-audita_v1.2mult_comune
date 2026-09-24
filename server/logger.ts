/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'data');
const LOG_FILE = path.join(LOG_DIR, 'logs.txt');

/**
 * Registra um log comentado em pt-BR no arquivo 'data/logs.txt'
 * @param status SUCESSO | FALHA | INFO | INICIO
 * @param operation Descrição amigável da operação (ex: 'Sincronização', 'Teste de Conexão', 'Exportação')
 * @param details Detalhes textuais ou mensagem do erro
 * @param comments Comentários adicionais/dicas técnicas para a equipe de suporte (IS) analisar
 */
export function writeOpLog(
  status: 'SUCESSO' | 'FALHA' | 'INFO' | 'INICIO',
  operation: string,
  details: string,
  comments?: string
): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    let logMessage = `${timestamp}\n${status}\nOperação: ${operation}\nDetalhes: ${details}\n`;
    
    if (comments) {
      logMessage += `# Comentário técnico: ${comments}\n`;
    }
    
    logMessage += `------------------------------------------------------------\n`;

    fs.appendFileSync(LOG_FILE, logMessage, 'utf-8');
    console.log(`[Log de Operação] ${status}: ${operation} - ${details}`);
  } catch (err) {
    console.error('Erro ao escrever no arquivo de logs:', err);
  }
}

/**
 * Lê todo o conteúdo do arquivo logs.txt
 */
export function readOpLogs(): string {
  try {
    if (fs.existsSync(LOG_FILE)) {
      return fs.readFileSync(LOG_FILE, 'utf-8');
    }
    return '# Nenhum log registrado até o momento.\n';
  } catch (err) {
    console.error('Erro ao ler arquivo de logs:', err);
    return `# Erro ao carregar arquivo de logs: ${err}`;
  }
}

/**
 * Limpa todo o conteúdo do arquivo logs.txt
 */
export function clearOpLogs(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.writeFileSync(LOG_FILE, '# Logs limpos pelo usuário em ' + new Date().toLocaleString('pt-BR') + '\n', 'utf-8');
  } catch (err) {
    console.error('Erro ao limpar arquivo de logs:', err);
  }
}
