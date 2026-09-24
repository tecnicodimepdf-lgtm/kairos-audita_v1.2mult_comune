/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor central de auditoria trabalhista.
 *
 * PRINCÍPIOS:
 * 1. "Marcação existente" e "marcação válida para jornada" são conceitos diferentes.
 * 2. A visão diária deve conter TODOS os dias do período de auditoria, inclusive dias sem marcação.
 * 3. Jornadas são reconstruídas em ordem cronológica real.
 * 4. Interjornada utiliza exclusivamente SAÍDA real -> ENTRADA real.
 * 5. As regras de auditoria não devem reconstruir novamente os dados.
 * 6. Cada regra possui uma única fonte de verdade.
 */

import {
  Funcionario,
  Marcacao,
  JornadaCalculada,
  Ocorrencia,
  GravidadeOcorrencia,
  VisaoDiaria,
  FaixaDuracaoDiaria,
} from '../src/types';

import { resolverEConsolidarVinculos } from '../src/utils/funcionarios';

export { resolverEConsolidarVinculos };

/* ============================================================================
 * CONSTANTES
 * ========================================================================== */

const MINUTOS_DIA = 1440;
const MINUTOS_4_HORAS = 240;
const MINUTOS_6_HORAS = 360;
const MINUTOS_10_HORAS = 600;
const MINUTOS_11_HORAS = 660;

const FERIADOS_NACIONAIS = [
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência do Brasil
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25', // Natal
];

/* ============================================================================
 * TIPOS INTERNOS
 * ========================================================================== */

interface MarcacaoOrdenada extends Marcacao {
  timestampMinutos: number;
}

interface PeriodoReconstruido {
  entrada: Marcacao;
  saida: Marcacao;
  inicio: number;
  fim: number;
  duracaoMinutos: number;
}

interface ReconstrucaoPeriodo {
  marcacoesOrdenadas: Marcacao[];
  periodos: PeriodoReconstruido[];
  marcacoesSemPar: Marcacao[];
}

interface ContextoDiario {
  data: string;
  marcacoes: Marcacao[];
  marcacoesValidas: Marcacao[];
  periodos: PeriodoReconstruido[];
  primeiraEntrada: string | null;
  ultimaSaida: string | null;
  totalMinutosTrabalhados: number;
  intervalosIntrajornada: number[];
  intervaloIntrajornadaPrincipal: number;
  marcacoesSemPar: Marcacao[];
}

/* ============================================================================
 * FUNÇÕES DE DATA E HORA
 * ========================================================================== */

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;

  const normalized = String(timeStr).trim();
  const parts = normalized.split(':');

  const hrs = Number.parseInt(parts[0] || '0', 10);
  const mins = Number.parseInt(parts[1] || '0', 10);

  if (!Number.isFinite(hrs) || !Number.isFinite(mins)) {
    return 0;
  }

  return hrs * 60 + mins;
}

export function minutesToTimeStr(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hrs = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}`;
}

export function diffHours(start: string, end: string): number {
  let startMinutes = timeToMinutes(start);
  let endMinutes = timeToMinutes(end);

  if (endMinutes < startMinutes) {
    endMinutes += MINUTOS_DIA;
  }

  return (endMinutes - startMinutes) / 60;
}

function normalizeDate(dateStr: string): string {
  return String(dateStr || '').substring(0, 10);
}

function parseDateParts(dateStr: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = normalizeDate(dateStr)
    .split('-')
    .map(Number);

  return {
    year: Number.isFinite(year) ? year : 1970,
    month: Number.isFinite(month) ? month : 1,
    day: Number.isFinite(day) ? day : 1,
  };
}

function dateToDayNumber(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function dayNumberToDate(dayNumber: number): string {
  const date = new Date(dayNumber * 86400000);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(dateStr: string, amount: number): string {
  return dayNumberToDate(dateToDayNumber(dateStr) + amount);
}

function dateDifferenceInDays(startDate: string, endDate: string): number {
  return dateToDayNumber(endDate) - dateToDayNumber(startDate);
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = normalizeDate(dateStr).split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

function buildDateRange(
  startDate: string,
  endDate: string
): string[] {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);

  if (!start || !end || start > end) {
    return [];
  }

  const totalDays = dateDifferenceInDays(start, end);

  if (totalDays < 0) {
    return [];
  }

  const result: string[] = [];

  for (let i = 0; i <= totalDays; i++) {
    result.push(addDays(start, i));
  }

  return result;
}

export function isSunday(dateStr: string): boolean {
  const { year, month, day } = parseDateParts(dateStr);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return date.getUTCDay() === 0;
}

export function isSaturday(dateStr: string): boolean {
  const { year, month, day } = parseDateParts(dateStr);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return date.getUTCDay() === 6;
}

export function getDiaDaSemana(
  dateStr: string
):
  | 'DOMINGO'
  | 'SEGUNDA'
  | 'TERCA'
  | 'QUARTA'
  | 'QUINTA'
  | 'SEXTA'
  | 'SABADO' {
  const { year, month, day } = parseDateParts(dateStr);

  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const days: (
    | 'DOMINGO'
    | 'SEGUNDA'
    | 'TERCA'
    | 'QUARTA'
    | 'QUINTA'
    | 'SEXTA'
    | 'SABADO'
  )[] = [
    'DOMINGO',
    'SEGUNDA',
    'TERCA',
    'QUARTA',
    'QUINTA',
    'SEXTA',
    'SABADO',
  ];

  return days[date.getUTCDay()];
}

export function isHoliday(dateStr: string): boolean {
  const normalized = normalizeDate(dateStr);
  const monthDay = normalized.substring(5);

  return FERIADOS_NACIONAIS.includes(monthDay);
}

/* ============================================================================
 * HORAS NOTURNAS
 * ========================================================================== */

export function calcularHorasNoturnas(
  inicio: string,
  fim: string
): number {
  let start = timeToMinutes(inicio);
  let end = timeToMinutes(fim);

  if (end < start) {
    end += MINUTOS_DIA;
  }

  let minutosNoturnos = 0;

  for (let minute = start; minute < end; minute++) {
    const normalized = minute % MINUTOS_DIA;

    if (normalized >= 22 * 60 || normalized < 5 * 60) {
      minutosNoturnos++;
    }
  }

  if (minutosNoturnos === 0) {
    return 0;
  }

  return (minutosNoturnos / 60) * (60 / 52.5);
}

/* ============================================================================
 * IDENTIDADE E CLASSIFICAÇÃO DAS MARCAÇÕES
 * ========================================================================== */

/**
 * Determina se o valor representa "true" em diferentes formatos aceitos
 * pelo legado da aplicação.
 */
function isTruthyFlag(value: unknown): boolean {
  return (
    value === true ||
    String(value).toLowerCase() === 'true' ||
    String(value) === '1' ||
    String(value).toLowerCase() === 'sim'
  );
}

function origemAdministrativa(marcacao: Marcacao): boolean {
  const origem = String(marcacao.origem || '').toUpperCase();
  const descricao = String(marcacao.descricao || '').toUpperCase();

  const termos = [
    'FOLGA',
    'DSR',
    'FERIADO',
    'FERIAS',
    'AFAST',
    'ABONO',
    'FALTA',
    'DIA LIVRE',
    'EVENTO ADMINISTRATIVO',
  ];

  return termos.some(
    (termo) =>
      origem.includes(termo) ||
      descricao.includes(termo)
  );
}

/**
 * MARCAÇÃO EXISTENTE:
 *
 * Considera a existência física de uma batida de ponto.
 *
 * É utilizada pelas regras:
 * - Trabalho s/ Folga 7 Dias
 * - Dois Domingos Seguidos
 *
 * Uma marcação desprezada continua sendo uma marcação existente.
 */
export function isMarcacaoExistente(
  m: Marcacao
): boolean {
  if (!m) return false;

  const tipo = String(m.tipo || '').toUpperCase();

  if (tipo !== 'ENTRADA' && tipo !== 'SAIDA') {
    return false;
  }

  if (origemAdministrativa(m)) {
    return false;
  }

  if (!String(m.hora || '').trim()) {
    return false;
  }

  return true;
}

/**
 * MARCAÇÃO VÁLIDA PARA JORNADA:
 *
 * É usada exclusivamente para reconstrução das horas.
 *
 * Marcações desprezadas não participam do cálculo da jornada.
 * Eventos administrativos não participam do cálculo da jornada.
 */
export function isMarcacaoValidaParaJornada(
  m: Marcacao
): boolean {
  if (!m) return false;

  const tipo = String(m.tipo || '').toUpperCase();

  if (tipo !== 'ENTRADA' && tipo !== 'SAIDA') {
    return false;
  }

  if (origemAdministrativa(m)) {
    return false;
  }

  if (
    isTruthyFlag(m.desprezado) ||
    isTruthyFlag((m as any).desprezada) ||
    String((m as any).status || '').toUpperCase().includes('DESPREZAD') ||
    String((m as any).descricao || '').toUpperCase().includes('DESPREZAD')
  ) {
    return false;
  }

  if (!String(m.hora || '').trim()) {
    return false;
  }

  return true;
}

/**
 * Compatibilidade com chamadas legadas.
 */
export function isMarcacaoValida(m: Marcacao): boolean {
  return isMarcacaoValidaParaJornada(m);
}

/**
 * Dia com marcação física.
 */
export function isDiaComMarcacao(
  dayPuncs: Marcacao[]
): boolean {
  if (!dayPuncs || dayPuncs.length === 0) {
    return false;
  }

  return dayPuncs.some(isMarcacaoExistente);
}

/**
 * Esta função é mantida para compatibilidade.
 *
 * Atenção:
 * - "dia com marcação" é utilizado para regras de presença;
 * - "dia trabalhado" aqui significa existência de marcação válida
 *   para cálculo da jornada.
 */
export function isDiaTrabalhado(
  dayPuncs: Marcacao[]
): boolean {
  if (!dayPuncs || dayPuncs.length === 0) {
    return false;
  }

  return dayPuncs.some(isMarcacaoValidaParaJornada);
}

/* ============================================================================
 * NORMALIZAÇÃO E ORDENAÇÃO
 * ========================================================================== */

function buildTimestampMinutes(marcacao: Marcacao): number {
  const data = normalizeDate(marcacao.data);
  const dayNumber = dateToDayNumber(data);

  return (
    dayNumber * MINUTOS_DIA +
    timeToMinutes(marcacao.hora)
  );
}

function getMarcacaoIdentity(
  marcacao: Marcacao
): string {
  const id = String((marcacao as any).id || '').trim();

  if (id) {
    return `id:${id}`;
  }

  return [
    normalizeDate(marcacao.data),
    String(marcacao.hora || '').substring(0, 8),
    String(marcacao.tipo || ''),
    String(marcacao.funcionarioId || ''),
    String(marcacao.origem || ''),
  ].join('|');
}

/**
 * Normaliza e ordena cronologicamente.
 *
 * IMPORTANTE:
 * O código anterior dizia que ordenava, mas não ordenava.
 * Agora a ordenação é efetivamente executada.
 */
export function normalizarMarcacoes(
  marcacoes: Marcacao[]
): Marcacao[] {
  if (!Array.isArray(marcacoes) || marcacoes.length === 0) {
    return [];
  }

  const seen = new Set<string>();

  return marcacoes
    .filter(isMarcacaoValidaParaJornada)
    .filter((marcacao) => {
      const identity = getMarcacaoIdentity(marcacao);

      if (seen.has(identity)) {
        return false;
      }

      seen.add(identity);
      return true;
    })
    .sort((a, b) => {
      const timeA = buildTimestampMinutes(a);
      const timeB = buildTimestampMinutes(b);

      if (timeA !== timeB) {
        return timeA - timeB;
      }

      const tipoA = String(a.tipo || '');
      const tipoB = String(b.tipo || '');

      return tipoA.localeCompare(tipoB);
    });
}

/* ============================================================================
 * RECONSTRUÇÃO DE JORNADA
 * ========================================================================== */

function reconstruirJornadas(
  marcacoes: Marcacao[]
): ReconstrucaoPeriodo {
  const ordered = normalizarMarcacoes(marcacoes);

  const marcacoesOrdenadasComTimestamp: MarcacaoOrdenada[] =
    ordered.map((m) => ({
      ...m,
      timestampMinutos: buildTimestampMinutes(m),
    }));

  const periodos: PeriodoReconstruido[] = [];
  const marcacoesSemPar: Marcacao[] = [];

  let entradaPendente: MarcacaoOrdenada | null = null;

  for (const marcacao of marcacoesOrdenadasComTimestamp) {
    const tipo = String(marcacao.tipo || '').toUpperCase();

    if (tipo === 'ENTRADA') {
      if (entradaPendente) {
        marcacoesSemPar.push(entradaPendente);
      }

      entradaPendente = marcacao;
      continue;
    }

    if (tipo === 'SAIDA') {
      if (!entradaPendente) {
        marcacoesSemPar.push(marcacao);
        continue;
      }

      const inicio = entradaPendente.timestampMinutos;
      const fim = marcacao.timestampMinutos;

      if (fim <= inicio) {
        marcacoesSemPar.push(entradaPendente);
        marcacoesSemPar.push(marcacao);
        entradaPendente = null;
        continue;
      }

      periodos.push({
        entrada: entradaPendente,
        saida: marcacao,
        inicio,
        fim,
        duracaoMinutos: fim - inicio,
      });

      entradaPendente = null;
    }
  }

  if (entradaPendente) {
    marcacoesSemPar.push(entradaPendente);
  }

  return {
    marcacoesOrdenadas: ordered,
    periodos,
    marcacoesSemPar,
  };
}

/**
 * Calcula uma jornada a partir das marcações recebidas.
 *
 * Pode receber marcações de mais de uma data, portanto jornadas que
 * atravessam a meia-noite são tratadas corretamente.
 */
export function calcularJornadaEfetiva(
  marcacoes: Marcacao[]
): JornadaEfetiva {
  const reconstruida = reconstruirJornadas(marcacoes);

  if (
    reconstruida.marcacoesOrdenadas.length === 0
  ) {
    return {
      primeiraMarcacao: null,
      ultimaMarcacao: null,
      quantidadeMarcacoes: 0,
      periodosTrabalhados: [],
      intervalos: [],
      totalMinutosTrabalhados: 0,
      totalHorasTrabalhadas: '00:00',
      duracaoBrutaMinutos: 0,
      marcacaoImpar: false,
      jornadaIncompleta: false,
      horasNoturnas: 0,
    };
  }

  const primeira =
    reconstruida.marcacoesOrdenadas[0];

  const ultima =
    reconstruida.marcacoesOrdenadas[
      reconstruida.marcacoesOrdenadas.length - 1
    ];

  const periodosTrabalhados: PeriodoTrabalhado[] =
    reconstruida.periodos.map((periodo) => ({
      entrada: String(periodo.entrada.hora).substring(0, 5),
      saida: String(periodo.saida.hora).substring(0, 5),
      duracaoMinutos: periodo.duracaoMinutos,
    }));

  const intervalos: Intervalo[] = [];

  for (
    let i = 0;
    i < reconstruida.periodos.length - 1;
    i++
  ) {
    const atual = reconstruida.periodos[i];
    const proximo = reconstruida.periodos[i + 1];

    const intervalo = proximo.inicio - atual.fim;

    if (intervalo > 0) {
      intervalos.push({
        inicio: String(atual.saida.hora).substring(0, 5),
        fim: String(proximo.entrada.hora).substring(0, 5),
        duracaoMinutos: intervalo,
      });
    }
  }

  const totalMinutosTrabalhados =
    reconstruida.periodos.reduce(
      (total, periodo) =>
        total + periodo.duracaoMinutos,
      0
    );

  const duracaoBrutaMinutos =
    reconstruida.marcacoesOrdenadas.length >= 2
      ? Math.max(
          0,
          buildTimestampMinutes(ultima) -
            buildTimestampMinutes(primeira)
        )
      : 0;

  let horasNoturnas = 0;

  reconstruida.periodos.forEach((periodo) => {
    horasNoturnas += calcularHorasNoturnas(
      String(periodo.entrada.hora).substring(0, 5),
      String(periodo.saida.hora).substring(0, 5)
    );
  });

  return {
    primeiraMarcacao: String(
      primeira.hora || ''
    ).substring(0, 5),
    ultimaMarcacao: String(
      ultima.hora || ''
    ).substring(0, 5),
    quantidadeMarcacoes:
      reconstruida.marcacoesOrdenadas.length,
    periodosTrabalhados,
    intervalos,
    totalMinutosTrabalhados,
    totalHorasTrabalhadas:
      minutesToTimeStr(totalMinutosTrabalhados),
    duracaoBrutaMinutos,
    marcacaoImpar:
      reconstruida.marcacoesSemPar.length > 0,
    jornadaIncompleta:
      reconstruida.marcacoesSemPar.length > 0,
    horasNoturnas,
  };
}

/* ============================================================================
 * VISÃO DIÁRIA
 * ========================================================================== */

function classificarFaixaDuracao(
  totalMinutos: number
): FaixaDuracaoDiaria {
  if (totalMinutos <= 0) {
    return 'SEM_MARCACAO';
  }

  if (totalMinutos < MINUTOS_4_HORAS) {
    return 'MENOS_DE_4H';
  }

  if (totalMinutos <= MINUTOS_6_HORAS) {
    return 'DE_4_A_6H';
  }

  return 'MAIS_DE_6H';
}

function construirContextosDiarios(
  datas: string[],
  marcacoes: Marcacao[]
): Map<string, ContextoDiario> {
  const result = new Map<string, ContextoDiario>();

  datas.forEach((data) => {
    result.set(data, {
      data,
      marcacoes: [],
      marcacoesValidas: [],
      periodos: [],
      primeiraEntrada: null,
      ultimaSaida: null,
      totalMinutosTrabalhados: 0,
      intervalosIntrajornada: [],
      intervaloIntrajornadaPrincipal: 0,
      marcacoesSemPar: [],
    });
  });

  const marcacoesPorData = new Map<string, Marcacao[]>();

  marcacoes.forEach((marcacao) => {
    const data = normalizeDate(marcacao.data);

    if (!marcacoesPorData.has(data)) {
      marcacoesPorData.set(data, []);
    }

    marcacoesPorData.get(data)!.push(marcacao);
  });

  result.forEach((contexto, data) => {
    contexto.marcacoes =
      marcacoesPorData.get(data) || [];

    contexto.marcacoesValidas =
      normalizarMarcacoes(contexto.marcacoes);
  });

  const reconstruida = reconstruirJornadas(marcacoes);

  /**
   * Marcações sem par são associadas ao respectivo dia.
   */
  reconstruida.marcacoesSemPar.forEach(
    (marcacao) => {
      const data = normalizeDate(marcacao.data);

      const contexto = result.get(data);

      if (contexto) {
        contexto.marcacoesSemPar.push(
          marcacao
        );
      }
    }
  );

  /**
   * Cada período é posteriormente distribuído
   * entre os dias do calendário que ele atravessa.
   */
  reconstruida.periodos.forEach((periodo) => {
    const dataInicial =
      normalizeDate(periodo.entrada.data);

    const dataFinal =
      normalizeDate(periodo.saida.data);

    const primeiroDia =
      dateToDayNumber(dataInicial);

    const ultimoDia =
      dateToDayNumber(dataFinal);

    const inicioPeriodo =
      periodo.inicio;

    const fimPeriodo =
      periodo.fim;

    for (
      let dayNumber = primeiroDia;
      dayNumber <= ultimoDia;
      dayNumber++
    ) {
      const data = dayNumberToDate(dayNumber);
      const contexto = result.get(data);

      if (!contexto) {
        continue;
      }

      const inicioDia =
        dayNumber * MINUTOS_DIA;

      const fimDia =
        inicioDia + MINUTOS_DIA;

      const inicioIntersecao = Math.max(
        inicioPeriodo,
        inicioDia
      );

      const fimIntersecao = Math.min(
        fimPeriodo,
        fimDia
      );

      if (fimIntersecao <= inicioIntersecao) {
        continue;
      }

      const duracaoDia =
        fimIntersecao - inicioIntersecao;

      contexto.totalMinutosTrabalhados +=
        duracaoDia;

      contexto.periodos.push(periodo);
    }
  });

  /**
   * Calcula entrada/saída reais por calendário.
   */
  result.forEach((contexto, data) => {
    const periodosDoDia = contexto.periodos
      .filter(
        (periodo) =>
          normalizeDate(periodo.entrada.data) ===
          data
      )
      .sort((a, b) => a.inicio - b.inicio);

    const primeiraEntrada =
      periodosDoDia[0]?.entrada?.hora;

    contexto.primeiraEntrada =
      primeiraEntrada
        ? String(primeiraEntrada).substring(0, 5)
        : null;

    const saidasDoDia =
      reconstruida.periodos.filter(
        (periodo) =>
          normalizeDate(periodo.saida.data) ===
          data
      );

    saidasDoDia.sort((a, b) => a.fim - b.fim);

    const ultimaSaida =
      saidasDoDia.length > 0
        ? saidasDoDia[saidasDoDia.length - 1].saida
            .hora
        : null;

    contexto.ultimaSaida =
      ultimaSaida
        ? String(ultimaSaida).substring(0, 5)
        : null;

    /**
     * Intervalos intrajornada:
     * somente entre períodos que iniciam no mesmo dia.
     * Não confundir com interjornada.
     */
    for (
      let i = 0;
      i < periodosDoDia.length - 1;
      i++
    ) {
      const atual = periodosDoDia[i];
      const proximo = periodosDoDia[i + 1];

      const mesmaDataEntrada =
        normalizeDate(
          atual.entrada.data
        ) === data &&
        normalizeDate(
          proximo.entrada.data
        ) === data;

      if (!mesmaDataEntrada) {
        continue;
      }

      const intervalo =
        proximo.inicio - atual.fim;

      /**
       * Se o período seguinte começa depois da saída,
       * existe uma pausa entre jornadas naquele mesmo dia.
       */
      if (intervalo > 0) {
        contexto.intervalosIntrajornada.push(
          intervalo
        );
      }
    }

    contexto.intervaloIntrajornadaPrincipal =
      contexto.intervalosIntrajornada.length > 0
        ? Math.max(
            ...contexto.intervalosIntrajornada
          )
        : 0;
  });

  return result;
}

function calcularInterjornadaPorData(
  datas: string[],
  marcacoes: Marcacao[]
): Map<
  string,
  {
    saidaAnterior: string | null;
    dataSaidaAnterior: string | null;
    entradaAtual: string | null;
    interjornadaHoras: number | null;
  }
> {
  const resultado = new Map<
    string,
    {
      saidaAnterior: string | null;
      dataSaidaAnterior: string | null;
      entradaAtual: string | null;
      interjornadaHoras: number | null;
    }
  >();

  datas.forEach((data) => {
    resultado.set(data, {
      saidaAnterior: null,
      dataSaidaAnterior: null,
      entradaAtual: null,
      interjornadaHoras: null,
    });
  });

  const reconstruida = reconstruirJornadas(
    marcacoes
  );

  const periodos = [...reconstruida.periodos].sort(
    (a, b) => a.inicio - b.inicio
  );

  for (let i = 1; i < periodos.length; i++) {
    const anterior = periodos[i - 1];
    const atual = periodos[i];

    const dataEntradaAtual =
      normalizeDate(atual.entrada.data);

    /**
     * A interjornada é uma relação:
     *
     * SAÍDA REAL ANTERIOR
     *          ↓
     * PRIMEIRA ENTRADA REAL ATUAL
     */
    if (!resultado.has(dataEntradaAtual)) {
      continue;
    }

    const diferenca =
      atual.inicio - anterior.fim;

    resultado.set(dataEntradaAtual, {
      saidaAnterior: String(
        anterior.saida.hora || ''
      ).substring(0, 5),
      dataSaidaAnterior: normalizeDate(
        anterior.saida.data
      ),
      entradaAtual: String(
        atual.entrada.hora || ''
      ).substring(0, 5),
      interjornadaHoras:
        diferenca > 0
          ? diferenca / 60
          : null,
    });
  }

  return resultado;
}

export function gerarVisaoDiaria(
  func: Funcionario,
  datas: string[],
  funcMarcacoesPorData: Record<string, Marcacao[]>
): VisaoDiaria[] {
  const periodoDatas = [...datas]
    .map(normalizeDate)
    .sort();

  const marcacoesDaFunc = periodoDatas.flatMap(
    (data) =>
      funcMarcacoesPorData[data] || []
  );

  const contextos = construirContextosDiarios(
    periodoDatas,
    marcacoesDaFunc
  );

  const interjornadas =
    calcularInterjornadaPorData(
      periodoDatas,
      marcacoesDaFunc
    );

  return periodoDatas.map((data) => {
    const contexto = contextos.get(data)!;
    const inter = interjornadas.get(data)!;

    const diaDaSemana =
      getDiaDaSemana(data);

    const domingo =
      diaDaSemana === 'DOMINGO';

    const horas =
      contexto.totalMinutosTrabalhados / 60;

    const horasFormat =
      minutesToTimeStr(
        contexto.totalMinutosTrabalhados
      );

    const possuiMarcacao =
      isDiaComMarcacao(
        contexto.marcacoes
      );

    const possuiMarcacaoValidaParaJornada =
      contexto.marcacoesValidas.length > 0;

    return {
      funcionarioId: func.id,
      funcionarioNome: func.nome,
      funcionarioMatricula: func.matricula,
      empresaId: func.empresaId,
      data,
      diaDaSemana,
      domingo,
      quantidadeMarcacoes:
        contexto.marcacoes.length,
      marcacoesDoDia:
        contexto.marcacoes,
      possuiMarcacao,
      possuiMarcacaoValidaParaJornada,
      primeiraEntrada:
        contexto.primeiraEntrada,
      ultimaSaida:
        contexto.ultimaSaida,
      horasEfetivamenteTrabalhadas:
        horas,
      horasEfetivamenteTrabalhadasFormat:
        horasFormat,
      totalMinutosTrabalhados:
        contexto.totalMinutosTrabalhados,
      faixaDuracao:
        classificarFaixaDuracao(
          contexto.totalMinutosTrabalhados
        ),
      intervaloIntrajornadaMinutos:
        contexto.intervaloIntrajornadaPrincipal,
      saidaAnterior:
        inter.saidaAnterior,
      dataSaidaAnterior:
        inter.dataSaidaAnterior,
      entradaAtual:
        inter.entradaAtual,
      interjornadaHoras:
        inter.interjornadaHoras,
    };
  });
}

/* ============================================================================
 * FUNÇÕES DE CRIAÇÃO DE OCORRÊNCIA
 * ========================================================================== */

function baseOcorrencia(
  func: Funcionario,
  data: string,
  tipo: Ocorrencia['tipo'],
  descricao: string,
  gravidade: GravidadeOcorrencia,
  valorConstatado: string,
  valorPermitido: string
): Ocorrencia {
  return {
    id: `oc_${func.id}_${data}_${tipo.toLowerCase()}`,
    funcionarioId: func.id,
    funcionarioNome: func.nome,
    funcionarioMatricula: func.matricula,
    funcionarioDepartamento: func.departamento,
    funcionarioSexo: (func as any).sexo || 'MASCULINO',
    data,
    tipo,
    descricao,
    gravidade,
    valorConstatado,
    valorPermitido,
  };
}

/* ============================================================================
 * MARCAÇÃO ÍMPAR
 * ========================================================================== */

export function auditarMarcacaoImpar(
  funcOrVisao: Funcionario | VisaoDiaria,
  data?: string,
  times?: string[]
): Ocorrencia | null {
  let func: Funcionario;
  let dataStr: string;
  let timesArr: string[];

  if ('horasEfetivamenteTrabalhadas' in funcOrVisao) {
    const visao = funcOrVisao as VisaoDiaria;

    func = {
      id: visao.funcionarioId,
      nome: visao.funcionarioNome,
      matricula: visao.funcionarioMatricula,
      empresaId: visao.empresaId,
    } as Funcionario;

    dataStr = visao.data;

    const reconstruida =
      reconstruirJornadas(
        visao.marcacoesDoDia
      );

    timesArr =
      reconstruida.marcacoesSemPar.map(
        (m) =>
          String(m.hora || '').substring(0, 5)
      );
  } else {
    func = funcOrVisao;
    dataStr = data || '';
    timesArr = times || [];
  }

  if (timesArr.length === 0) {
    return null;
  }

  return baseOcorrencia(
    func,
    dataStr,
    'MARCACAO_IMPAR',
    `Marcação sem par identificada: ${timesArr.join(
      ', '
    )}. A sequência de registros não permitiu formar uma jornada completa.`,
    'MEDIO',
    `${timesArr.length} marcação(ões) sem par`,
    'Entrada e saída em sequência compatível'
  );
}

/* ============================================================================
 * INTERJORNADA
 * ========================================================================== */

/**
 * Audita o descanso mínimo de 11 horas consecutivas entre duas jornadas de trabalho (Art. 66 CLT).
 * Compara a última saída válida do Dia N com a primeira entrada válida do próximo dia trabalhado.
 */
export function auditarInterjornada(
  visoes: VisaoDiaria[],
  func: Funcionario
): Ocorrencia[] {
  const ocorrencias: Ocorrencia[] = [];

  // 1. Filtrar apenas dias que possuem marcação física e pareamento válido de entrada/saída
  const diasTrabalhados = visoes
    .filter((v) => {
      const marcs = (v as any).marcacoes || v.marcacoesDoDia || [];
      return v.possuiMarcacao === true && Array.isArray(marcs) && marcs.length >= 2;
    })
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  // Se trabalhou menos de 2 dias no período, é impossível haver infração de interjornada
  if (diasTrabalhados.length < 2) {
    return ocorrencias;
  }

  // 2. Compara o Dia I (jornada anterior) com o Dia I+1 (próxima jornada trabalhada)
  for (let i = 0; i < diasTrabalhados.length - 1; i++) {
    const diaAnterior = diasTrabalhados[i];
    const diaSeguinte = diasTrabalhados[i + 1];

    const marcsAnt = (diaAnterior as any).marcacoes || diaAnterior.marcacoesDoDia || [];
    const marcsSeg = (diaSeguinte as any).marcacoes || diaSeguinte.marcacoesDoDia || [];

    // Utiliza apenas a ÚLTIMA SAÍDA VÁLIDA do dia anterior e a PRIMEIRA ENTRADA VÁLIDA do dia seguinte (oriundas dos períodos reconstruídos)
    const recAnt = reconstruirJornadas(marcsAnt);
    const recSeg = reconstruirJornadas(marcsSeg);

    const ultimaSaidaStr = diaAnterior.ultimaSaida || (recAnt.periodos.length > 0 ? recAnt.periodos[recAnt.periodos.length - 1].saida.hora : null);
    const primeiraEntradaStr = diaSeguinte.primeiraEntrada || (recSeg.periodos.length > 0 ? recSeg.periodos[0].entrada.hora : null);

    if (!ultimaSaidaStr || !primeiraEntradaStr) {
      continue;
    }

    // 3. Converte ambas as batidas para timestamps UTC exatos
    const timestampSaida = criarTimestampDataHora(diaAnterior.data, ultimaSaidaStr);
    const timestampEntrada = criarTimestampDataHora(diaSeguinte.data, primeiraEntradaStr);

    // Se por inconsistência a entrada for anterior à saída, ignora
    if (timestampEntrada <= timestampSaida) {
      continue;
    }

    // 4. Calcula o descanso efetivo em minutos e em horas
    const descansoEmMinutos = Math.round((timestampEntrada - timestampSaida) / (1000 * 60));
    const limiteMinimoMinutos = 11 * 60; // 660 minutos (11 horas)

    // 5. Se o descanso for menor que 11h (660 min), gera a infração do Art. 66 CLT
    if (descansoEmMinutos < limiteMinimoMinutos) {
      const minutosDevidos = limiteMinimoMinutos - descansoEmMinutos;
      const horasEfetivasStr = formatarMinutosParaHHMM(descansoEmMinutos);
      const horasDevidasStr = formatarMinutosParaHHMM(minutosDevidos);

      ocorrencias.push({
        id: `INTERJORNADA_${func.id}_${diaAnterior.data}_${diaSeguinte.data}`,
        funcionarioId: func.id,
        funcionarioNome: func.nome,
        funcionarioMatricula: func.matricula,
        funcionarioDepartamento: func.departamento,
        funcionarioSexo: (func as any).sexo || 'MASCULINO',
        // Campo 'data' obrigatório para exibição no componente Auditorias.tsx.
        // Utiliza a data da jornada seguinte, que é quando a infração é constatada.
        data: diaSeguinte.data,
        tipo: 'INTERJORNADA_INSUFICIENTE',
        descricao: `Descanso interjornada insuficiente entre ${diaAnterior.data} (${ultimaSaidaStr}) e ${diaSeguinte.data} (${primeiraEntradaStr}). Descanso realizado: ${horasEfetivasStr}h (Mínimo legal: 11:00h - Art. 66 CLT). Saldo devido como HE: ${horasDevidasStr}h.`,
        dataInicio: diaAnterior.data,
        dataFim: diaSeguinte.data,
        quantidadeDias: 1,
        gravidade: 'ALTO',
        valorConstatado: horasEfetivasStr,
        valorPermitido: '11:00',
        passivoEstimado: 120 + Math.round((minutosDevidos / 60) * 50), // Base R$120 + Adicional
        status: 'PENDENTE'
      } as any);
    }
  }

  return ocorrencias;
}

/**
 * Auxiliar para converter Data (YYYY-MM-DD) e Hora (HH:mm ou HH:mm:ss) em Timestamp milissegundos
 */
function criarTimestampDataHora(dataStr: string, horaStr: string): number {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const partesHora = horaStr.split(':').map(Number);
  const hora = partesHora[0] || 0;
  const minuto = partesHora[1] || 0;
  const segundo = partesHora[2] || 0;

  return Date.UTC(ano, mes - 1, dia, hora, minuto, segundo);
}

/**
 * Auxiliar para formatar minutos em string HH:mm
 */
function formatarMinutosParaHHMM(minutosTotais: number): string {
  const horas = Math.floor(minutosTotais / 60);
  const mins = minutosTotais % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/* ============================================================================
 * DOMINGO EXCESSIVO
 * ========================================================================== */

export function auditarDomingoExcessivo(
  funcOrVisao: Funcionario | VisaoDiaria,
  data?: string,
  minutosTrabalhadosInput?: number,
  tipoDiaInput?: string
): Ocorrencia | null {
  let func: Funcionario;
  let dataStr: string;
  let minutosTrabalhados: number;
  let domingo: boolean;

  if ('horasEfetivamenteTrabalhadas' in funcOrVisao) {
    const visao = funcOrVisao as VisaoDiaria;

    func = {
      id: visao.funcionarioId,
      nome: visao.funcionarioNome,
      matricula: visao.funcionarioMatricula,
      empresaId: visao.empresaId,
    } as Funcionario;

    dataStr = visao.data;
    minutosTrabalhados =
      visao.totalMinutosTrabalhados;
    domingo = visao.domingo;
  } else {
    func = funcOrVisao;
    dataStr = data || '';
    minutosTrabalhados =
      minutosTrabalhadosInput || 0;
    domingo =
      tipoDiaInput === 'DOMINGO' ||
      isSunday(dataStr);
  }

  if (!domingo) {
    return null;
  }

  /**
   * REGRA:
   * <= 06:00 = normal
   * > 06:00 = desvio
   */
  if (
    minutosTrabalhados <=
    MINUTOS_6_HORAS
  ) {
    return null;
  }

  const excesso =
    minutosTrabalhados -
    MINUTOS_6_HORAS;

  const gravidade: GravidadeOcorrencia =
    minutosTrabalhados > 480
      ? 'CRITICO'
      : 'ALTO';

  return baseOcorrencia(
    func,
    dataStr,
    'DOMINGO_EXCESSIVO',
    `Trabalho em domingo de ${minutesToTimeStr(
      minutosTrabalhados
    )}, superior ao limite operacional de 06:00. Excedente: ${minutesToTimeStr(
      excesso
    )}. Fundamento legal contextual: CLT Art. 67.`,
    gravidade,
    minutesToTimeStr(
      minutosTrabalhados
    ),
    '06:00'
  );
}

export const auditarDomingoExcesso =
  auditarDomingoExcessivo;

/* ============================================================================
 * INTERVALO INTRAJORNADA
 * ========================================================================== */

export function auditarIntervaloIntrajornada(
  funcOrVisao: Funcionario | VisaoDiaria,
  data?: string,
  minutosTrabalhadosInput?: number,
  timesLengthInput?: number,
  intervaloRealizadoInput?: number
): Ocorrencia | null {
  let func: Funcionario;
  let dataStr: string;
  let minutosTrabalhados: number;
  let quantidadeMarcacoes: number;
  let intervaloRealizado: number;

  if ('horasEfetivamenteTrabalhadas' in funcOrVisao) {
    const visao = funcOrVisao as VisaoDiaria;

    func = {
      id: visao.funcionarioId,
      nome: visao.funcionarioNome,
      matricula: visao.funcionarioMatricula,
      empresaId: visao.empresaId,
    } as Funcionario;

    dataStr = visao.data;
    minutosTrabalhados =
      visao.totalMinutosTrabalhados;
    quantidadeMarcacoes =
      visao.quantidadeMarcacoes;
    intervaloRealizado =
      visao.intervaloIntrajornadaMinutos;
  } else {
    func = funcOrVisao;
    dataStr = data || '';
    minutosTrabalhados =
      minutosTrabalhadosInput || 0;
    quantidadeMarcacoes =
      timesLengthInput || 0;
    intervaloRealizado =
      intervaloRealizadoInput || 0;
  }

  /**
   * Jornada superior a 6h:
   * intervalo inferior a 60min.
   */
  if (
    minutosTrabalhados >
    MINUTOS_6_HORAS
  ) {
    if (
      quantidadeMarcacoes < 4 ||
      intervaloRealizado === 0
    ) {
      return baseOcorrencia(
        func,
        dataStr,
        'INTERVALO_INSUFICIENTE',
        `Jornada de ${minutesToTimeStr(
          minutosTrabalhados
        )} sem intervalo intrajornada registrado. Para o critério operacional adotado, é necessário intervalo mínimo de 01:00. Fundamento legal: CLT Art. 71.`,
        'CRITICO',
        '00:00',
        '01:00'
      );
    }

    if (intervaloRealizado < 60) {
      return baseOcorrencia(
        func,
        dataStr,
        'INTERVALO_INSUFICIENTE',
        `Intervalo intrajornada de ${minutesToTimeStr(
          intervaloRealizado
        )}, inferior ao mínimo operacional de 01:00 para jornada superior a 06:00. Fundamento legal: CLT Art. 71.`,
        intervaloRealizado < 30
          ? 'CRITICO'
          : 'ALTO',
        minutesToTimeStr(
          intervaloRealizado
        ),
        '01:00'
      );
    }

    return null;
  }

  /**
   * Jornada de 4h até 6h:
   * intervalo inferior a 15min.
   */
  if (
    minutosTrabalhados >
      MINUTOS_4_HORAS &&
    minutosTrabalhados <=
      MINUTOS_6_HORAS
  ) {
    if (
      quantidadeMarcacoes < 4 ||
      intervaloRealizado === 0
    ) {
      return baseOcorrencia(
        func,
        dataStr,
        'INTERVALO_INSUFICIENTE',
        `Jornada de ${minutesToTimeStr(
          minutosTrabalhados
        )} sem intervalo intrajornada registrado. Para o critério operacional adotado, é necessário intervalo mínimo de 00:15. Fundamento legal: CLT Art. 71.`,
        'MEDIO',
        '00:00',
        '00:15'
      );
    }

    if (intervaloRealizado < 15) {
      return baseOcorrencia(
        func,
        dataStr,
        'INTERVALO_INSUFICIENTE',
        `Intervalo intrajornada de ${minutesToTimeStr(
          intervaloRealizado
        )}, inferior ao mínimo operacional de 00:15 para jornada entre 04:00 e 06:00. Fundamento legal: CLT Art. 71.`,
        'ALTO',
        minutesToTimeStr(
          intervaloRealizado
        ),
        '00:15'
      );
    }
  }

  return null;
}

/* ============================================================================
 * JORNADA EXCESSIVA
 * ========================================================================== */

/**
 * Audita o limite máximo de horas trabalhadas em um único dia (Art. 59 CLT - Máx 10 horas/dia).
 * Seleciona APENAS dias em que a soma do tempo efetivamente trabalhado é > 10h (600 minutos).
 */
export function auditarJornadaExcessiva(
  visoesOrVisao: VisaoDiaria[] | VisaoDiaria,
  funcInput?: Funcionario
): any {
  let visoesList: VisaoDiaria[] = [];
  let func: Funcionario;

  if (Array.isArray(visoesOrVisao)) {
    visoesList = visoesOrVisao;
    func = funcInput || ({ id: 'desconhecido', nome: '' } as Funcionario);
  } else if (visoesOrVisao && typeof visoesOrVisao === 'object' && 'data' in visoesOrVisao) {
    const visao = visoesOrVisao as VisaoDiaria;
    visoesList = [visao];
    func = funcInput || ({
      id: visao.funcionarioId,
      nome: visao.funcionarioNome,
      matricula: visao.funcionarioMatricula,
      empresaId: visao.empresaId,
    } as Funcionario);
  } else {
    return Array.isArray(visoesOrVisao) ? [] : null;
  }

  const ocorrencias: Ocorrencia[] = [];

  for (const dia of visoesList) {
    const marcs = (dia as any).marcacoes || dia.marcacoesDoDia || [];
    const marcsValidas = normalizarMarcacoes(marcs);
    // Exige que o dia tenha batida física e um número par e válido de marcações (mínimo 2: Entrada e Saída)
    if (
      !dia.possuiMarcacao ||
      !Array.isArray(marcsValidas) ||
      marcsValidas.length < 2 ||
      marcsValidas.length % 2 !== 0
    ) {
      continue;
    }

    // Obtém o tempo líquido trabalhado a partir da reconstrução oficial dos períodos pareados do dia (Fonte Única da Verdade)
    const periodosDia = reconstruirJornadas(marcsValidas).periodos;
    const minutosTrabalhadosNoDia = periodosDia.reduce((acc, p) => acc + p.duracaoMinutos, 0);

    const LIMITE_10_HORAS_MINUTOS = 10 * 60; // 600 minutos exatos (10h)

    // TRAVA ESTRITA: Seleciona se o tempo LÍQUIDO for maior ou igual a 10h (600 min)
    if (minutosTrabalhadosNoDia >= LIMITE_10_HORAS_MINUTOS) {
      const horasFormatadas = minutesToTimeStr(minutosTrabalhadosNoDia);
      const minutosExcedentes = minutosTrabalhadosNoDia - LIMITE_10_HORAS_MINUTOS;
      const excedenteFormatado = minutesToTimeStr(minutosExcedentes);

      let gravidade: GravidadeOcorrencia = 'MEDIO';
      if (minutosTrabalhadosNoDia > 720) gravidade = 'ALTO';
      if (minutosTrabalhadosNoDia > 840) gravidade = 'CRITICO';

      ocorrencias.push({
        id: `JORNADA_EXCESSIVA_${func.id}_${dia.data}`,
        funcionarioId: func.id,
        funcionarioNome: func.nome || dia.funcionarioNome,
        funcionarioMatricula: func.matricula || dia.funcionarioMatricula,
        data: dia.data,
        tipo: 'JORNADA_EXCESSIVA',
        descricao: `Jornada excessiva no dia ${dia.data}. Tempo efetivo trabalhado: ${horasFormatadas}h (Limite legal: 10:00h - Art. 59 CLT). Excedente: ${excedenteFormatado}h.`,
        dataInicio: dia.data,
        dataFim: dia.data,
        quantidadeDias: 1,
        gravidade,
        valorConstatado: horasFormatadas,
        valorPermitido: '10:00',
        totalMinutosTrabalhados: minutosTrabalhadosNoDia,
        limiteMinutos: LIMITE_10_HORAS_MINUTOS,
        excedenteMinutos: minutosExcedentes,
        passivoEstimado: 100 + Math.round((minutosExcedentes / 60) * 45),
        status: 'PENDENTE'
      } as Ocorrencia);
    }
  }

  if (Array.isArray(visoesOrVisao)) {
    return ocorrencias;
  }
  return ocorrencias.length > 0 ? ocorrencias[0] : null;
}

/**
 * Auxiliar para converter Hora (HH:mm ou HH:mm:ss) em minutos a partir de 00:00
 */
function converterHoraParaMinutos(horaStr: string): number {
  if (!horaStr) return 0;
  const partes = horaStr.split(':').map(Number);
  const hora = partes[0] || 0;
  const minuto = partes[1] || 0;
  return hora * 60 + minuto;
}

/* ============================================================================
 * 7 DIAS CONSECUTIVOS (CLT Art. 67 / Art. 7º, XV CF)
 * ========================================================================== */

/**
 * REFATORAÇÃO DO MOTOR DE AUDITORIA: TRABALHO SEM FOLGA POR 7+ DIAS CONSECUTIVOS
 *
 * CORREÇÃO DE BUG (FALSOS POSITIVOS):
 * 1. Validação estrita de marcação física (`visao.possuiMarcacao === true`):
 *    - Apenas dias com registros físicos de ponto no relógio Dimep Kairos são contabilizados.
 *    - Eventos administrativos sem batida (folgas, feriados, DSR) zeram o contador imediatamente.
 * 2. Salvaguarda de continuidade temporal (`diferenca === 1`):
 *    - Validação de diferença de exatamente 1 dia entre iterações consecutivas.
 *    - Lacunas ou datas ausentes na ordenação reiniciam a contagem.
 * 3. Consolidação de sequências longas (7+ dias):
 *    - Evita duplicatas criando um registro único acumulado por bloco trabalhado.
 */
export function auditarTrabalho7Dias(
  visoes: VisaoDiaria[],
  func: Funcionario
): Ocorrencia[] {
  const ocorrencias: Ocorrencia[] = [];

  if (!visoes || visoes.length === 0) {
    return [];
  }

  // 1. Garante ordenação cronológica estrita por data (YYYY-MM-DD)
  const visoesOrdenadas = [...visoes].sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  let blocoTrabalhado: VisaoDiaria[] = [];

  for (let i = 0; i < visoesOrdenadas.length; i++) {
    const diaAtual = visoesOrdenadas[i];

    // 2. Trava estrita: só é considerado dia trabalhado se tiver marcação física real
    const marcs = (diaAtual as any).marcacoes || diaAtual.marcacoesDoDia || [];
    const temBatidaEfetiva =
      diaAtual.possuiMarcacao === true &&
      Array.isArray(marcs) &&
      marcs.length > 0;

    if (temBatidaEfetiva) {
      // Se já temos um bloco em andamento, verifica a continuidade temporal (exatamente +1 dia)
      if (blocoTrabalhado.length > 0) {
        const ultimoDiaDoBloco = blocoTrabalhado[blocoTrabalhado.length - 1];
        const diferencaDias = calcularDiferencaDias(ultimoDiaDoBloco.data, diaAtual.data);

        // Se houve um salto de datas no calendário (dia intermediário sem registro)
        if (diferencaDias !== 1) {
          // Processa o bloco anterior acumulado até aqui (sem incluir o dia atual)
          validarEGerarOcorrencia(blocoTrabalhado, func, ocorrencias);
          // Reinicia o bloco zerado apenas com o dia atual
          blocoTrabalhado = [diaAtual];
        } else {
          blocoTrabalhado.push(diaAtual);
        }
      } else {
        blocoTrabalhado.push(diaAtual);
      }

      // Limita a busca a ocorrências de exatamente 7 dias sem folga (não gerando mais de 7 dias)
      if (blocoTrabalhado.length === 7) {
        validarEGerarOcorrencia(blocoTrabalhado, func, ocorrencias);
        blocoTrabalhado = [];
      }
    } else {
      // 3. DIA SEM MARCAÇÃO ENCONTRADO:
      // O dia sem marcação INTERROMPE IMEDIATAMENTE a contagem.
      // Avalia o bloco acumulado ATÉ O DIA ANTERIOR.
      validarEGerarOcorrencia(blocoTrabalhado, func, ocorrencias);

      // Limpa o bloco para garantir que o dia sem marcação JAMAIS faça parte de uma sequência
      blocoTrabalhado = [];
    }
  }

  // Avalia o último bloco pendente no encerramento do loop
  validarEGerarOcorrencia(blocoTrabalhado, func, ocorrencias);

  return ocorrencias;
}

/**
 * Valida se o bloco de dias APENAS COM BATIDA FÍSICA atingiu 7 ou mais dias consecutivos.
 */
function validarEGerarOcorrencia(
  bloco: VisaoDiaria[],
  func: Funcionario,
  ocorrencias: Ocorrencia[]
) {
  // Apenas blocos com exatamente 7 dias COM BATIDA FÍSICA geram a infração (limitado a 7 dias)
  if (bloco.length >= 7) {
    const blocoAjustado = bloco.slice(0, 7);
    const dataInicio = blocoAjustado[0].data;
    const dataFim = blocoAjustado[blocoAjustado.length - 1].data;
    const totalDias = blocoAjustado.length;

    const base = baseOcorrencia(
      func,
      dataFim,
      'SEM_FOLGA_7_DIAS',
      `Trabalho contínuo por ${totalDias} dias consecutivos sem Descanso Semanal Remunerado (CLT Art. 67). Período: ${formatDateBR(dataInicio)} a ${formatDateBR(dataFim)}.`,
      'ALTO',
      `${totalDias} dias`,
      'Até 6 dias consecutivos'
    );

    ocorrencias.push({
      ...base,
      id: `SEM_FOLGA_${func.id}_${dataInicio}_${dataFim}`,
      dataInicio,
      dataFim,
      quantidadeDias: totalDias,
      passivoEstimado: totalDias * 250,
      status: 'PENDENTE'
    } as any);
  }
}

/**
 * Auxiliar para calcular a diferença exata em dias civis entre duas datas (YYYY-MM-DD)
 */
function calcularDiferencaDias(dataInicioStr: string, dataFimStr: string): number {
  const [ano1, mes1, dia1] = dataInicioStr.split('-').map(Number);
  const [ano2, mes2, dia2] = dataFimStr.split('-').map(Number);

  const d1 = Date.UTC(ano1, mes1 - 1, dia1);
  const d2 = Date.UTC(ano2, mes2 - 1, dia2);

  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/* ============================================================================
 * DOIS DOMINGOS CONSECUTIVOS
 * ========================================================================== */

export function auditarDoisDomingosSeguidos(
  visoes: VisaoDiaria[],
  func: Funcionario
): Ocorrencia[] {
  const ocorrencias: Ocorrencia[] = [];

  const domingos =
    [...visoes]
      .filter(
        (visao) =>
          visao.domingo &&
          visao.possuiMarcacao
      )
      .sort(
        (a, b) =>
          dateToDayNumber(a.data) -
          dateToDayNumber(b.data)
      );

  for (let i = 0; i < domingos.length; i++) {
    const primeiro = domingos[i];
    const esperadoSegundo =
      addDays(primeiro.data, 7);

    const segundo = visoes.find(
      (visao) =>
        visao.data ===
          esperadoSegundo &&
        visao.domingo &&
        visao.possuiMarcacao
    );

    if (!segundo) {
      continue;
    }

    ocorrencias.push({
      ...baseOcorrencia(
        func,
        segundo.data,
        'DOMINGOS_SEGUIDOS',
        `Foram identificados registros de ponto em dois domingos consecutivos: ${formatDateBR(
          primeiro.data
        )} e ${formatDateBR(
          segundo.data
        )}. Para esta regra, uma única marcação já comprova a existência de registro no domingo. Fundamento legal contextual: CLT Art. 67.`,
        'ALTO',
        '2 domingos consecutivos',
        '1 domingo'
      ),
      id: `oc_${func.id}_dom_seg_${primeiro.data}`,
    });
  }

  return ocorrencias;
}

/* ============================================================================
 * PROCESSAMENTO CENTRAL
 * ========================================================================== */

function determinarPeriodoAuditoria(
  marcacoes: Marcacao[],
  dataInicio?: string,
  dataFim?: string
): string[] {
  if (dataInicio && dataFim) {
    return buildDateRange(
      dataInicio,
      dataFim
    );
  }

  const datas = marcacoes
    .map((m) => normalizeDate(m.data))
    .filter(Boolean)
    .sort();

  if (datas.length === 0) {
    return [];
  }

  /**
   * Por padrão, processa os últimos 32 dias,
   * terminando na data mais recente recebida.
   */
  const fim =
    datas[datas.length - 1];

  const inicio = addDays(
    fim,
    -31
  );

  return buildDateRange(
    inicio,
    fim
  );
}

export function processarAuditoria(
  funcionarios: Funcionario[],
  marcacoes: Marcacao[],
  dataInicio?: string,
  dataFim?: string
): {
  jornadas: JornadaCalculada[];
  ocorrencias: Ocorrencia[];
  visoesDiarias?: VisaoDiaria[];
} {
  const jornadas: JornadaCalculada[] = [];
  const ocorrencias: Ocorrencia[] = [];
  const todasVisoesDiarias: VisaoDiaria[] = [];

  const consolidacao =
    resolverEConsolidarVinculos(
      funcionarios
    );

  const targetFuncionarios = consolidacao.todos;

  /**
   * Define o período completo da auditoria.
   * Inclui datas sem marcação.
   */
  const datasAuditoria =
    determinarPeriodoAuditoria(
      marcacoes,
      dataInicio,
      dataFim
    );

  /**
   * Agrupamento das marcações por funcionário e data.
   */
  const marcacoesPorFuncionario: Record<string, Record<string, Marcacao[]>> = {};

  marcacoes.forEach((marcacao) => {
    // Mantemos o funcionarioId original (o contrato) para auditar cada loja separadamente
    const originalId = marcacao.funcionarioId;

    if (!marcacoesPorFuncionario[originalId]) {
      marcacoesPorFuncionario[originalId] = {};
    }

    const data = normalizeDate(marcacao.data);

    if (!marcacoesPorFuncionario[originalId][data]) {
      marcacoesPorFuncionario[originalId][data] = [];
    }

    marcacoesPorFuncionario[originalId][data].push(marcacao);
  });

  /**
   * Controla quais activeIds já foram processados para evitar duplicação de ocorrências
   * quando um funcionário possui múltiplos vínculos (histórico + ativo) e ambos aparecem
   * em consolidacao.todos. Sem esse controle, o mesmo funcionário seria auditado N vezes,
   * gerando duplicação de jornadas e falsos positivos (ex: Jornada Excessiva duplicada).
   */
  const activeIdsProcessados = new Set<string>();

  targetFuncionarios.forEach(
    (func) => {
      const activeId = consolidacao.mapaHistoricoParaAtivo[func.id] || func.id;

      /**
       * Se este activeId já foi processado (por um vínculo anterior do mesmo funcionário),
       * pula sem redirecionar as marcações — evita auditar a mesma pessoa duas vezes.
       */
      if (activeIdsProcessados.has(activeId)) {
        return;
      }
      activeIdsProcessados.add(activeId);

      /**
       * Consolida as marcações de todos os vínculos históricos deste funcionário
       * em um único mapa por data, garantindo que nenhum registro seja perdido
       * e nenhum seja duplicado ou reatribuído incorretamente.
       */
      const porDataConsolidado: Record<string, Marcacao[]> = {};

      // Coleta marcações de todos os IDs históricos que mapeiam para este activeId
      targetFuncionarios.forEach((outro) => {
        const outroActiveId = consolidacao.mapaHistoricoParaAtivo[outro.id] || outro.id;
        if (outroActiveId !== activeId) return;

        const marcacoesDoVinculo = marcacoesPorFuncionario[outro.id] || {};
        Object.entries(marcacoesDoVinculo).forEach(([data, marcsData]) => {
          if (!porDataConsolidado[data]) {
            porDataConsolidado[data] = [];
          }
          // Evita duplicação de marcações com mesmo ID
          marcsData.forEach((marc) => {
            const jaExiste = porDataConsolidado[data].some(
              (m) => m.id && marc.id && m.id === marc.id
            );
            if (!jaExiste) {
              porDataConsolidado[data].push(marc);
            }
          });
        });
      });

      // Usa o registro com activeId como base do funcionário para a auditoria
      const funcBase = targetFuncionarios.find((f) => f.id === activeId) || func;
      const funcParaAuditoria = { ...funcBase, id: activeId };

      /**
       * CRÍTICO:
       * usamos TODO o período de auditoria,
       * e não somente os dias que possuem marcação.
       */
      const visoes =
        gerarVisaoDiaria(
          funcParaAuditoria,
          datasAuditoria,
          porDataConsolidado
        );

      todasVisoesDiarias.push(...visoes);

      visoes.forEach(
        (visao) => {
          const marcacoesValidas =
            normalizarMarcacoes(
              visao.marcacoesDoDia
            );

          const tipoDia:
            | 'UTIL'
            | 'DOMINGO'
            | 'SABADO'
            | 'FERIADO' =
            isHoliday(visao.data)
              ? 'FERIADO'
              : visao.domingo
                ? 'DOMINGO'
                : isSaturday(visao.data)
                  ? 'SABADO'
                  : 'UTIL';

          /**
           * Marcação ímpar:
           * usa somente marcações realmente sem par.
           */
          const reconstruida =
            reconstruirJornadas(
              visao.marcacoesDoDia
            );

          if (
            reconstruida.marcacoesSemPar
              .length > 0
          ) {
            const tempos =
              reconstruida
                .marcacoesSemPar
                .filter(
                  (m) =>
                    normalizeDate(
                      m.data
                    ) === visao.data
                )
                .map(
                  (m) =>
                    String(
                      m.hora
                    ).substring(0, 5)
                );

            if (tempos.length > 0) {
              const ocImpar =
                auditarMarcacaoImpar(
                  funcParaAuditoria,
                  visao.data,
                  tempos
                );

              if (ocImpar) {
                ocorrencias.push(
                  ocImpar
                );
              }
            }
          }

          /**
           * Regras baseadas em horas efetivamente trabalhadas.
           */
          if (
            visao.totalMinutosTrabalhados >
            0
          ) {
            const ocJornada =
              auditarJornadaExcessiva(
                visao
              );

            if (ocJornada) {
              ocorrencias.push(
                ocJornada
              );
            }

            const ocIntervalo =
              auditarIntervaloIntrajornada(
                visao
              );

            if (ocIntervalo) {
              ocorrencias.push(
                ocIntervalo
              );
            }

            const ocDomingo =
              auditarDomingoExcessivo(
                visao
              );

            if (ocDomingo) {
              ocorrencias.push(
                ocDomingo
              );
            }
          }

          const jornada:
            JornadaCalculada = {
              id: `jorn_${activeId}_${visao.data}_${func.id}`,
              funcionarioId:
                activeId,
              data: visao.data,
              primeiraEntrada:
                visao.primeiraEntrada,
              ultimaSaida:
                visao.ultimaSaida,
              marcações:
                marcacoesValidas.map(
                  (m) =>
                    String(
                      m.hora
                    ).substring(
                      0,
                      5
                    )
                ),
              horasTrabalhadas:
                visao.horasEfetivamenteTrabalhadas,
              horasNoturnas:
                calcularJornadaEfetiva(
                  marcacoesValidas
                ).horasNoturnas,
              horasTrabalhadasFormat:
                visao.horasEfetivamenteTrabalhadasFormat,
              intervaloRealizado:
                visao.intervaloIntrajornadaMinutos,
              descansoInterjornada:
                visao.interjornadaHoras,
              tipoDia,
            };

          jornadas.push(
            jornada
          );
        }
      );

      /**
       * Regras de período.
       */
      const ocorrenciasInterjornada =
        auditarInterjornada(
          visoes,
          funcParaAuditoria
        );

      ocorrencias.push(
        ...ocorrenciasInterjornada
      );

      const ocorrencias7Dias =
        auditarTrabalho7Dias(
          visoes,
          funcParaAuditoria
        );

      ocorrencias.push(
        ...ocorrencias7Dias
      );

      const ocorrenciasDomingos =
        auditarDoisDomingosSeguidos(
          visoes,
          funcParaAuditoria
        );

      ocorrencias.push(
        ...ocorrenciasDomingos
      );
    }
  );

  return {
    jornadas,
    ocorrencias,
    visoesDiarias:
      todasVisoesDiarias,
  };
}

/* ============================================================================
 * SCORE DE RISCO
 * ========================================================================== */

export function calcularScoresFuncionarios(
  funcionarios: Funcionario[],
  ocorrencias: Ocorrencia[]
): Funcionario[] {
  const ocorrenciasPorFunc:
    Record<string, Ocorrencia[]> =
    {};

  ocorrencias.forEach(
    (ocorrencia) => {
      if (
        !ocorrenciasPorFunc[
          ocorrencia.funcionarioId
        ]
      ) {
        ocorrenciasPorFunc[
          ocorrencia.funcionarioId
        ] = [];
      }

      ocorrenciasPorFunc[
        ocorrencia.funcionarioId
      ].push(ocorrencia);
    }
  );

  return funcionarios.map(
    (funcionario) => {
      const ocs =
        ocorrenciasPorFunc[
          funcionario.id
        ] || [];

      let totalPontos = 0;

      ocs.forEach(
        (ocorrencia) => {
          if (
            ocorrencia.gravidade ===
            'CRITICO'
          ) {
            totalPontos += 25;
          } else if (
            ocorrencia.gravidade ===
            'ALTO'
          ) {
            totalPontos += 10;
          } else if (
            ocorrencia.gravidade ===
            'MEDIO'
          ) {
            totalPontos += 4;
          } else {
            totalPontos += 1;
          }
        }
      );

      const scoreRisco =
        Math.min(
          totalPontos,
          100
        );

      let grauRisco:
        | 'BAIXO'
        | 'MEDIO'
        | 'ALTO'
        | 'CRITICO' =
        'BAIXO';

      if (
        scoreRisco >= 50
      ) {
        grauRisco =
          'CRITICO';
      } else if (
        scoreRisco >= 25
      ) {
        grauRisco =
          'ALTO';
      } else if (
        scoreRisco >= 10
      ) {
        grauRisco =
          'MEDIO';
      }

      return {
        ...funcionario,
        scoreRisco,
        grauRisco,
      };
    }
  );
}

/* ============================================================================
 * INTERFACES UTILIZADAS PELO MOTOR
 * ========================================================================== */

export interface PeriodoTrabalhado {
  entrada: string;
  saida: string;
  duracaoMinutos: number;
}

export interface Intervalo {
  inicio: string;
  fim: string;
  duracaoMinutos: number;
}

export interface JornadaEfetiva {
  primeiraMarcacao: string | null;
  ultimaMarcacao: string | null;
  quantidadeMarcacoes: number;
  periodosTrabalhados: PeriodoTrabalhado[];
  intervalos: Intervalo[];
  totalMinutosTrabalhados: number;
  totalHorasTrabalhadas: string;
  duracaoBrutaMinutos: number;
  marcacaoImpar: boolean;
  jornadaIncompleta: boolean;
  horasNoturnas: number;
}