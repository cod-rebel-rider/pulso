/**
 * PULSO — Domínio: Recorrências (Fase 10.3 — Recorrências)
 *
 * Uma RECORRÊNCIA é a REGRA DE REPETIÇÃO de um SERVIÇO (estrutura
 * permanente). Ela ensina o PULSO QUANDO uma nova conta poderá existir —
 * mas NÃO gera conta, NÃO cria transação e NÃO altera saldo/carteira:
 *
 *   SERVIÇO (Internet)  →  RECORRÊNCIA (mensal, vence dia 15, R$ 120,00)
 *                          ↓
 *                    CONTA (ocorrência concreta — Fase 10.4)
 *
 * Decisões desta subfase:
 * - a recorrência é apenas uma REGRA armazenada; a transformação em
 *   ocorrências concretas é EXCLUSIVIDADE da Fase 10.4;
 * - valores SEMPRE em centavos (inteiro), reusando `validarValorCentavos`
 *   da FASE 08 — não existe segunda implementação de dinheiro;
 * - datas são datas civis `AAAA-MM-DD` (início obrigatório; término
 *   opcional e nunca anterior ao início);
 * - `diaVencimento` é o dia do mês (1–31) ancorado à regra;
 * - MESES COM DIAS DIFERENTES (regra canônica, documentada em
 *   docs/recorrencias.md): quando o mês não tem o dia da regra (ex.: dia 31
 *   em fevereiro), a ocorrência correspondente usa o ÚLTIMO DIA VÁLIDO do
 *   mês — `ajustarDiaNoMes(2026, 2, 31) → 28`. Nenhuma ocorrência é
 *   descartada e nenhuma é empurrada para o mês seguinte;
 * - estado PERSISTIDO: `ativa` | `inativa` | `arquivada`. Nasce `ativa`;
 *   pode desativar e reativar; ARQUIVAR é TERMINAL nesta subfase.
 *
 * Regras puras, sem E/S — nunca no renderer, nunca no SQL.
 */

import { ErroValidacao, ErroTransicao } from '../erros.js';
import { validarValorCentavos } from './financa.js';

// ── Frequências (lista controlada, extensível) ───────────────────────────
/**
 * Cada frequência informa quantos MESES separam ocorrências consecutivas
 * (`meses`). Novas frequências futuras (ex.: semanal, quinzenal) podem ser
 * ACRESCENTADAS aqui — o restante do sistema lê a lista, sem lógica espalhada.
 * O gerador da Fase 10.4 usará `meses` para avançar o calendário.
 */
export const FREQUENCIAS_RECORRENCIA = Object.freeze([
  Object.freeze({ valor: 'mensal', rotulo: 'MENSAL', meses: 1 }),
  Object.freeze({ valor: 'bimestral', rotulo: 'BIMESTRAL', meses: 2 }),
  Object.freeze({ valor: 'trimestral', rotulo: 'TRIMESTRAL', meses: 3 }),
  Object.freeze({ valor: 'semestral', rotulo: 'SEMESTRAL', meses: 6 }),
  Object.freeze({ valor: 'anual', rotulo: 'ANUAL', meses: 12 }),
]);

export const FREQUENCIAS_RECORRENCIA_VALORES = Object.freeze(
  FREQUENCIAS_RECORRENCIA.map((f) => f.valor),
);

export const ROTULO_FREQUENCIA_RECORRENCIA = Object.freeze(
  Object.fromEntries(FREQUENCIAS_RECORRENCIA.map((f) => [f.valor, f.rotulo])),
);

/** Meses entre ocorrências de uma frequência (0 se desconhecida). */
export function mesesDaFrequencia(frequencia) {
  return FREQUENCIAS_RECORRENCIA.find((f) => f.valor === frequencia)?.meses ?? 0;
}

export function validarFrequencia(frequencia) {
  if (!FREQUENCIAS_RECORRENCIA_VALORES.includes(frequencia)) {
    throw new ErroValidacao(
      `Frequência inválida: ${String(frequencia)}. Frequências: ${FREQUENCIAS_RECORRENCIA_VALORES.join(', ')}.`,
      'frequencia',
    );
  }
  return frequencia;
}

// ── Estados (máquina de estados da Fase 10.3) ────────────────────────────
export const ESTADOS_RECORRENCIA = Object.freeze({
  ATIVA: 'ativa',
  INATIVA: 'inativa',
  ARQUIVADA: 'arquivada',
});

export const ESTADOS_RECORRENCIA_ORDEM = Object.freeze([
  ESTADOS_RECORRENCIA.ATIVA,
  ESTADOS_RECORRENCIA.INATIVA,
  ESTADOS_RECORRENCIA.ARQUIVADA,
]);

export const ESTADOS_RECORRENCIA_ROTULOS = Object.freeze({
  [ESTADOS_RECORRENCIA.ATIVA]: 'Ativa',
  [ESTADOS_RECORRENCIA.INATIVA]: 'Inativa',
  [ESTADOS_RECORRENCIA.ARQUIVADA]: 'Arquivada',
});

/** Recorrência nasce ATIVA (regra criada entra em vigor). */
export const ESTADO_RECORRENCIA_INICIAL = ESTADOS_RECORRENCIA.ATIVA;

/**
 * Transições permitidas:
 *   ATIVA → INATIVA | ARQUIVADA
 *   INATIVA → ATIVA | ARQUIVADA
 * ARQUIVADA é TERMINAL nesta subfase — reativar arquivada fica para decisão
 * futura de arquitetura (igual ao serviço, Fase 10.1).
 */
const TRANSICOES_RECORRENCIA = Object.freeze({
  [ESTADOS_RECORRENCIA.ATIVA]: Object.freeze([
    ESTADOS_RECORRENCIA.INATIVA,
    ESTADOS_RECORRENCIA.ARQUIVADA,
  ]),
  [ESTADOS_RECORRENCIA.INATIVA]: Object.freeze([
    ESTADOS_RECORRENCIA.ATIVA,
    ESTADOS_RECORRENCIA.ARQUIVADA,
  ]),
  [ESTADOS_RECORRENCIA.ARQUIVADA]: Object.freeze([]),
});

export function validarEstadoRecorrencia(estado) {
  if (!ESTADOS_RECORRENCIA_ORDEM.includes(estado)) {
    throw new ErroValidacao(
      `Estado de recorrência inválido: ${String(estado)}. Estados: ${ESTADOS_RECORRENCIA_ORDEM.join(', ')}.`,
      'estado',
    );
  }
  return estado;
}

export function transicaoRecorrenciaPermitida(atual, proximo) {
  validarEstadoRecorrencia(atual);
  validarEstadoRecorrencia(proximo);
  return TRANSICOES_RECORRENCIA[atual].includes(proximo);
}

export function exigirTransicaoRecorrencia(atual, proximo) {
  if (!transicaoRecorrenciaPermitida(atual, proximo)) {
    throw new ErroTransicao(
      `Transição de estado não permitida: ${ESTADOS_RECORRENCIA_ROTULOS[atual]} → ${ESTADOS_RECORRENCIA_ROTULOS[proximo]}.`,
    );
  }
}

/** Estado encerrado: arquivada não é editada nem reativada nesta subfase. */
export function recorrenciaArquivada(estado) {
  return estado === ESTADOS_RECORRENCIA.ARQUIVADA;
}

// ── Datas (civis, AAAA-MM-DD) ────────────────────────────────────────────
const PADRAO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida uma data civil `AAAA-MM-DD`, rejeitando datas inexistentes
 * (ex.: 2026-02-30). Comparação lexical é válida nesse formato.
 */
export function validarDataCivil(data, campo = 'data') {
  if (typeof data !== 'string' || !PADRAO_DATA.test(data.trim())) {
    throw new ErroValidacao('A data deve estar no formato AAAA-MM-DD.', campo);
  }
  const limpo = data.trim();
  const ano = Number(limpo.slice(0, 4));
  const mes = Number(limpo.slice(5, 7));
  const dia = Number(limpo.slice(8, 10));
  const verificacao = new Date(Date.UTC(ano, mes - 1, dia));
  const existe =
    verificacao.getUTCFullYear() === ano &&
    verificacao.getUTCMonth() === mes - 1 &&
    verificacao.getUTCDate() === dia;
  if (!existe) {
    throw new ErroValidacao(`Data inexistente: ${limpo}.`, campo);
  }
  return limpo;
}

/** Data de hoje (`AAAA-MM-DD`) a partir de um instante, no fuso local. */
export function dataHojeIso(agora = new Date()) {
  const ano = String(agora.getFullYear()).padStart(4, '0');
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// ── Meses com dias diferentes (regra canônica) ────────────────────────────
/** Último dia válido do mês (bissexto incluso): fev/2024 → 29; fev/2026 → 28. */
export function ultimoDiaDoMes(ano, mes) {
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new ErroValidacao('Mês ou ano inválido para calcular o último dia.', 'data');
  }
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Regra canônica para o dia da regra em meses menores (docs/recorrencias.md):
 *
 *   O dia de vencimento é APROXIMADO ao fim do mês quando o mês não o tem:
 *   dia 31 em fevereiro → 28 (29 em bissexto); dia 31 em abril → 30.
 *
 * A ocorrência correspondente NUNCA é descartada e NUNCA é empurrada para o
 * mês seguinte. O cálculo é puro — a geração de ocorrências é da Fase 10.4.
 */
export function ajustarDiaNoMes(ano, mes, dia) {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    throw new ErroValidacao('O dia de vencimento deve estar entre 1 e 31.', 'diaVencimento');
  }
  const ultimo = ultimoDiaDoMes(ano, mes);
  return Math.min(dia, ultimo);
}

/** Dia de vencimento em determinado mês/ano, formatado `AAAA-MM-DD`. */
export function dataComDiaAjustado(ano, mes, dia) {
  const diaAjustado = ajustarDiaNoMes(ano, mes, dia);
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(diaAjustado).padStart(2, '0')}`;
}

// ── Campos ────────────────────────────────────────────────────────────────
const TAM_DESCRICAO_MAX = 2000;

/** Identificador de serviço: inteiro positivo. */
export function validarServicoIdRecorrencia(servicoId) {
  if (typeof servicoId !== 'number' || !Number.isInteger(servicoId) || servicoId <= 0) {
    throw new ErroValidacao('O serviço da recorrência é obrigatório.', 'servicoId');
  }
  return servicoId;
}

/** Dia do mês em que a conta vence (1–31; ajustado em meses menores). */
export function validarDiaVencimento(dia) {
  if (typeof dia !== 'number' || !Number.isInteger(dia) || dia < 1 || dia > 31) {
    throw new ErroValidacao(
      'O dia de vencimento deve ser um número inteiro entre 1 e 31.',
      'diaVencimento',
    );
  }
  return dia;
}

/** Descrição é texto livre opcional. */
export function validarDescricaoRecorrencia(descricao) {
  if (descricao === null || descricao === undefined) return null;
  if (typeof descricao !== 'string') {
    throw new ErroValidacao('A descrição deve ser um texto.', 'descricao');
  }
  const limpo = descricao.trim();
  if (limpo.length === 0) return null;
  if (limpo.length > TAM_DESCRICAO_MAX) {
    throw new ErroValidacao(
      `A descrição deve ter até ${TAM_DESCRICAO_MAX} caracteres.`,
      'descricao',
    );
  }
  return limpo;
}

/**
 * Valor ESPERADO da ocorrência em centavos, inteiro e > 0.
 * Reusa o mecanismo monetário da FASE 08 — é expectativa, não dinheiro gasto.
 * Negativo, zero, fracionário e não-numérico são rejeitados.
 */
export function validarValorEsperadoRecorrencia(centavos) {
  const valor = validarValorCentavos(centavos);
  if (valor <= 0) {
    throw new ErroValidacao(
      'O valor esperado da recorrência deve ser maior que zero (em centavos).',
      'valorEsperado',
    );
  }
  return valor;
}

/** Término, quando informado, não pode ser anterior ao início. */
export function validarPeriodoRecorrencia(inicio, fim) {
  if (fim !== null && fim < inicio) {
    throw new ErroValidacao(
      'A data de término não pode ser anterior à data de início.',
      'dataFim',
    );
  }
  return fim;
}

// ── Validações de criação e edição ────────────────────────────────────────
export function validarRecorrenciaCriacao(dados) {
  const entrada = dados ?? {};
  const servicoId = validarServicoIdRecorrencia(Number(entrada.servicoId ?? entrada.serviceId));
  const frequencia = validarFrequencia(entrada.frequencia);
  const inicio = validarDataCivil(entrada.dataInicio ?? entrada.startDate, 'dataInicio');
  const fimBruta = entrada.dataFim ?? entrada.endDate ?? null;
  const fim = fimBruta === null || fimBruta === undefined || fimBruta === ''
    ? null
    : validarDataCivil(fimBruta, 'dataFim');
  validarPeriodoRecorrencia(inicio, fim);
  return Object.freeze({
    servicoId,
    frequencia,
    dataInicio: inicio,
    dataFim: fim,
    diaVencimento: validarDiaVencimento(
      entrada.diaVencimento ?? entrada.dueDay ?? entrada.dia_vencimento,
    ),
    descricao: validarDescricaoRecorrencia(entrada.descricao ?? null),
    valorEsperado: validarValorEsperadoRecorrencia(
      entrada.valorEsperado ?? entrada.valorEsperadoCentavos ?? entrada.expectedAmount,
    ),
  });
}

/**
 * Edição parcial: apenas campos presentes são validados e devolvidos.
 * Serviço, jogador e estado NÃO são editáveis (preservam a identidade).
 * O período (início × término) é revalidado pela aplicação com os campos
 * finais combinados.
 */
export function validarRecorrenciaEdicao(dados) {
  const entrada = dados ?? {};
  const resultado = {};
  if ('frequencia' in entrada) resultado.frequencia = validarFrequencia(entrada.frequencia);
  if ('dataInicio' in entrada || 'startDate' in entrada) {
    resultado.dataInicio = validarDataCivil(entrada.dataInicio ?? entrada.startDate, 'dataInicio');
  }
  if ('dataFim' in entrada || 'endDate' in entrada) {
    const bruta = entrada.dataFim ?? entrada.endDate;
    resultado.dataFim = bruta === null || bruta === undefined || bruta === ''
      ? null
      : validarDataCivil(bruta, 'dataFim');
  }
  if ('diaVencimento' in entrada || 'dueDay' in entrada) {
    resultado.diaVencimento = validarDiaVencimento(entrada.diaVencimento ?? entrada.dueDay);
  }
  if ('descricao' in entrada) resultado.descricao = validarDescricaoRecorrencia(entrada.descricao);
  if ('valorEsperado' in entrada || 'valorEsperadoCentavos' in entrada || 'expectedAmount' in entrada) {
    resultado.valorEsperado = validarValorEsperadoRecorrencia(
      entrada.valorEsperado ?? entrada.valorEsperadoCentavos ?? entrada.expectedAmount,
    );
  }
  return Object.freeze(resultado);
}

// ── Conversor linha → objeto (camelCase, congelado) ───────────────────────
export function paraRecorrencia(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    servicoId: linha.servico_id,
    frequencia: linha.frequencia,
    dataInicio: linha.data_inicio,
    dataFim: linha.data_fim ?? null,
    diaVencimento: linha.dia_vencimento,
    descricao: linha.descricao ?? null,
    valorEsperado: linha.valor_esperado_centavos,
    estado: linha.estado,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    arquivadoEm: linha.arquivado_em ?? null,
  });
}
