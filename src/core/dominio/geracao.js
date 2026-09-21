/**
 * PULSO — Domínio: Geração de Ocorrências (Fase 10.4)
 *
 * A GERAÇÃO transforma a REGRA (recorrência, Fase 10.3) em OCORRÊNCIAS
 * CONCRETAS (contas em `servico_conta`, Fase 10.2) dentro de um período:
 *
 *   RECORRÊNCIA (regra)  →  GERAÇÃO  →  CONTAS / OCORRÊNCIAS (pendentes)
 *
 * Decisões desta subfase:
 * - só regras ATIVAS geram: INATIVA está pausada (nada é gerado até
 *   reativar) e ARQUIVADA está encerrada (nunca mais gera);
 * - a âncora da sequência é o MÊS de `dataInicio`; cada passo avança
 *   `mesesDaFrequencia` — a cadência da regra nunca muda e meses fora da
 *   janela são simplesmente filtrados (não "recuperados" em lote);
 * - o vencimento de cada ocorrência usa a regra canônica de MESES COM DIAS
 *   DIFERENTES (`dataComDiaAjustado`): dia 31 em fevereiro → 28 (29 em
 *   bissexto); nenhuma ocorrência é descartada nem empurrada ao mês
 *   seguinte, e nenhuma data inválida pode existir;
 * - uma ocorrência é válida quando o VENCIMENTO (data real) respeita a
 *   validade da regra (`dataInicio` ≤ vencimento ≤ `dataFim`, quando há
 *   término) E está dentro do período informado — a comparação é pela data
 *   do vencimento, não pela competência;
 * - a identidade da ocorrência é (servico_id, competencia `AAAA-MM`) — a
 *   MESMA unicidade da Fase 10.2 (`UNIQUE`), que garante a IDEMPOTÊNCIA:
 *   executar a geração de novo NÃO duplica a mesma conta;
 * - gerar NÃO paga, NÃO cria transação e NÃO altera carteira/saldo — as
 *   contas nascem PENDENTES; o dinheiro só entra no fluxo no pagamento
 *   (Fase 10.5).
 *
 * Regras puras, sem E/S — nunca no renderer, nunca no SQL.
 */

import { ErroValidacao } from '../erros.js';
import {
  ESTADOS_RECORRENCIA,
  mesesDaFrequencia,
  validarDataCivil,
  validarDiaVencimento,
  dataComDiaAjustado,
} from './recorrencia.js';

// ── Período da geração ────────────────────────────────────────────────────
const REGEX_COMPETENCIA = /^\d{4}-\d{2}$/; // `AAAA-MM`
const REGEX_CIVIL = /^\d{4}-\d{2}-\d{2}$/; // `AAAA-MM-DD`

/** Normaliza o início do período: aceita competência (`AAAA-MM`, normalizada
 * para o primeiro dia) ou data civil (`AAAA-MM-DD`). */
function normalizarInicioPeriodo(value) {
  if (typeof value !== 'string') {
    throw new ErroValidacao('Período inválido.', 'periodoInicio');
  }
  if (REGEX_COMPETENCIA.test(value)) {
    return `${value}-01`;
  }
  return value; // civil: validarDataCivil valida abaixo
}

/** Normaliza o fim do período: aceita competência (`AAAA-MM`, normalizada
 * para o último dia do mês) ou data civil (`AAAA-MM-DD`). */
function normalizarFimPeriodo(value) {
  if (typeof value !== 'string') {
    throw new ErroValidacao('Período inválido.', 'periodoFim');
  }
  if (REGEX_COMPETENCIA.test(value)) {
    const ano = Number(value.slice(0, 4));
    const mes = Number(value.slice(5, 7));
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    return `${value}-${String(ultimoDia).padStart(2, '0')}`;
  }
  return value; // civil: validarDataCivil valida abaixo
}

/**
 * Valida o período informado pelo usuário (De / Até). Aceita competência
 * (`AAAA-MM`) ou data civil (`AAAA-MM-DD`) em ambas as pontas — a competência
 * é normalizada para o primeiro (início) e último (fim) dias do mês. Ambas as
 * datas são obrigatórias, civis, e o fim não pode ser anterior ao início. A
 * geração só considera vencimentos dentro desse período (inclusivo).
 */
export function validarPeriodoGeracao(inicio, fim) {
  const comeco = validarDataCivil(normalizarInicioPeriodo(inicio), 'periodoInicio');
  const termino = validarDataCivil(normalizarFimPeriodo(fim), 'periodoFim');
  if (termino < comeco) {
    throw new ErroValidacao(
      'O fim do período de geração não pode ser anterior ao início.',
      'periodoFim',
    );
  }
  return Object.freeze({ inicio: comeco, fim: termino });
}

/** Somente a regra ATIVA gera ocorrências (inativa = pausada; arquivada = encerrada). */
export function podeGerarOcorrencias(recorrencia) {
  return recorrencia?.estado === ESTADOS_RECORRENCIA.ATIVA;
}

/** Índice linear de uma competência `AAAA-MM` (meses desde o ano zero, 0-based). */
function indiceMes(competencia) {
  return Number(competencia.slice(0, 4)) * 12 + (Number(competencia.slice(5, 7)) - 1);
}

/** Competência `AAAA-MM` deslocada em `meses` (aritmética de calendário pura). */
function avancarCompetencia(competencia, meses) {
  const total = indiceMes(competencia) + meses;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
}

/**
 * Calcula as ocorrências da recorrência dentro do período — o CORAÇÃO da
 * Fase 10.4. Puro: não consulta banco, não cria conta.
 *
 * @param {{ frequencia: string, dataInicio: string, dataFim: string|null,
 *           diaVencimento: number }} recorrencia regra da Fase 10.3
 * @param {{ inicio: string, fim: string }} periodo janela pedida (De / Até)
 * @returns {ReadonlyArray<{competencia: string, vencimento: string}>}
 *   competência `AAAA-MM` (identidade da ocorrência) e vencimento
 *   `AAAA-MM-DD` (data real, já com a regra de meses curtos)
 */
export function calcularOcorrencias(recorrencia, periodo) {
  if (!recorrencia || typeof recorrencia !== 'object') {
    throw new ErroValidacao('A recorrência da geração é obrigatória.');
  }
  const intervalo = mesesDaFrequencia(recorrencia.frequencia);
  if (!Number.isInteger(intervalo) || intervalo <= 0) {
    throw new ErroValidacao(
      `Frequência inválida: ${String(recorrencia.frequencia)}.`,
      'frequencia',
    );
  }
  const dia = validarDiaVencimento(recorrencia.diaVencimento);
  const janela = validarPeriodoGeracao(periodo.inicio, periodo.fim);

  // Janela efetiva = interseção da validade da REGRA com o período pedido.
  // O vencimento (data real) precisa cair nessa interseção — assim
  // `start_date` e `end_date` da recorrência são respeitados mesmo quando
  // o período pede datas fora dela.
  const inicioValido = recorrencia.dataInicio > janela.inicio
    ? recorrencia.dataInicio
    : janela.inicio;
  const fimValido = recorrencia.dataFim !== null && recorrencia.dataFim < janela.fim
    ? recorrencia.dataFim
    : janela.fim;

  const ocorrencias = [];
  // A cadência é ancorada no mês de data_inicio da regra (ex.: bimestral
  // criada em set/2026 gera set → nov → jan …, mesmo que o período comece
  // depois). O vencimento nunca sai do próprio mês, então nenhuma
  // competência além do mês de fimValido pode gerar ocorrência válida.
  let competencia = recorrencia.dataInicio.slice(0, 7);
  while (indiceMes(competencia) <= indiceMes(fimValido.slice(0, 7))) {
    const ano = Number(competencia.slice(0, 4));
    const mes = Number(competencia.slice(5, 7));
    const vencimento = dataComDiaAjustado(ano, mes, dia);
    if (vencimento >= inicioValido && vencimento <= fimValido) {
      ocorrencias.push(Object.freeze({ competencia, vencimento }));
    }
    competencia = avancarCompetencia(competencia, intervalo);
  }
  return Object.freeze(ocorrencias);
}