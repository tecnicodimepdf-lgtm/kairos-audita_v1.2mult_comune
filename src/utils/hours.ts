/**
 * Centraliza a formatação de horas para o padrão HH:MM (sexagesimal).
 * Atende à regra de padronização global da exibição de horas.
 */

/**
 * Converte minutos totais (number) em string formatada HH:MM.
 * Ex: 90 -> "01:30"
 */
export function minutesToHHMM(totalMinutes: number): string {
  const absoluteMinutes = Math.abs(Math.round(totalMinutes));
  const hrs = Math.floor(absoluteMinutes / 60);
  const mins = absoluteMinutes % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Converte horas decimais (number) em string formatada HH:MM.
 * Ex: 1.5 -> "01:30"
 */
export function decimalToHHMM(decimalHours: number): string {
  return minutesToHHMM(decimalHours * 60);
}

/**
 * Tenta formatar qualquer valor de tempo (string ou number) para HH:MM.
 * Útil para campos vindos do backend que podem estar em formatos variados.
 */
export function formatToHHMM(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '00:00';

  // Se já for um número (minutos ou horas decimais - assumimos horas se for pequeno ou minutos se for grande?)
  // Para evitar ambiguidade, preferimos funções explícitas, mas aqui tentamos detectar.
  if (typeof value === 'number') {
    // Se for > 1000, provavelmente são minutos (ex: 1200min = 20h)
    // Se for < 1000, provavelmente são horas decimais (ex: 10.5h)
    // No entanto, para segurança, esta função genérica deve ser usada com cautela.
    return decimalToHHMM(value);
  }

  // Se for string
  const str = String(value).trim().toLowerCase();

  // Caso: "90 min"
  if (str.includes('min')) {
    const mins = parseInt(str.replace('min', '').trim(), 10) || 0;
    return minutesToHHMM(mins);
  }

  // Caso: "10.33h" ou "10.33 h" ou "10.33"
  if (str.includes('h') || str.includes('.') || str.includes(',')) {
    // Extrai apenas a parte numérica
    const cleanStr = str.replace(',', '.').replace(/[^\d.]/g, '');
    const numericPart = parseFloat(cleanStr);
    if (!isNaN(numericPart)) {
      // Se a string original continha apenas dígitos e um ponto/vírgula, ou terminava em 'h'
      return decimalToHHMM(numericPart);
    }
  }

  // Caso: "01:30:00" ou "01:30"
  if (str.includes(':')) {
    const parts = str.split(':');
    if (parts.length >= 2) {
      const h = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      return `${h}:${m}`;
    }
  }

  return str;
}
