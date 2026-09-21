/**
 * PULSO — Domínio: Contas / Despesas (Fase 10.2 — Contas e Despesas)
 *
 * Uma CONTA é a OCORRÊNCIA CONCRETA de um SERVIÇO (estrutura permanente):
 *
 *   SERVIÇO (Internet)  →  CONTA (Internet · Setembro/2026 · vence 15/09)
 *
 * A conta registra apenas a EXPECTATIVA (referência, vencimento e valor
 * esperado). Ela NÃO paga, NÃO cria transação e NÃO altera saldo/carteira —
 * o pagamento é uma operação financeira FUTURA (Fase 10.5).
 *
 * Decisões desta subfase:
 * - valores SEMPRE em centavos (inteiro), reusando `validarValorCentavos`
 *   da FASE 08 — não existe segunda implementação de dinheiro;
 * - `referencia` identifica a competência no formato canônico `AAAA-MM`
 *   (ex.: `2026-09`), ordenável e sem ambiguidade; o rótulo humano
 *   (`Setembro/2026`) é derivado para apresentação (`rotuloReferencia`);
 * - `vencimento` é uma data civil no formato `AAAA-MM-DD`;
 * - o estado PERSISTIDO é apenas `pendente` ou `cancelada`. `VENCIDA` é um
 *   estado DERIVADO (`PENDENTE` + vencimento no passado) — o banco nunca é
 *   reescrito só porque uma data passou (ver `situacaoConta`).
 *
 * Regras puras, sem E/S — nunca no renderer, nunca no SQL.
 */

import { ErroValidacao, ErroTransicao } from '../erros.js';
import { validarValorCentavos } from './financa.js';

// ─ Referência (competência da ocorrência) ───────────────────────────────
/** Formato canônico `AAAA-MM` (ex.: 2026-09). */
export const FORMATO_REFERENCIA = 'AAAA-MM';
const PADRAO_REFERENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

export const ROTULOS_MESES = Object.freeze([
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]);

/** Limites do ano aceito na referência (sanidade; não é regra de negócio). */
const ANO_MINIMO_REFERENCIA = 1900;
const ANO_MAXIMO_REFERENCIA = 2999;

/**
 * Valida a referência no formato canônico `AAAA-MM`.
 * A referência distingue ocorrências do MESMO serviço (ex.: Setembro ≠ Outubro).
 */
export function validarReferencia(referencia) {
  if (typeof referencia !== 'string' || !PADRAO_REFERENCIA.test(referencia.trim())) {
    throw new ErroValidacao(
      `A referência deve estar no formato ${FORMATO_REFERENCIA} (ex.: 2026-09).`,
      'referencia',
    );
  }
  const limpo = referencia.trim();
  const ano = Number(limpo.slice(0, 4));
  if (ano < ANO_MINIMO_REFERENCIA || ano > ANO_MAXIMO_REFERENCIA) {
    throw new ErroValidacao(
      `O ano da referência deve estar entre ${ANO_MINIMO_REFERENCIA} e ${ANO_MAXIMO_REFERENCIA}.`,
      'referencia',
    );
  }
  return limpo;
}

/** Nome legível do mês (ex.: `2026-09` → `Setembro/2026`). */
export function rotuloReferencia(referencia) {
  if (typeof referencia !== 'string' || !PADRAO_REFERENCIA.test(referencia.trim())) {
    return String(referencia ?? '—');
  }
  const limpo = referencia.trim();
  const mes = Number(limpo.slice(5, 7));
  return `${ROTULOS_MESES[mes - 1]}/${limpo.slice(0, 4)}`;
}

// ── Vencimento (data civil) ──────────────────────────────────────────────
const PADRAO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida uma data civil `AAAA-MM-DD`, rejeitando datas inexistentes
 * (ex.: 2026-02-30). Comparação lexical é válida nesse formato.
 */
export function validarDataIso(data) {
  if (typeof data !== 'string' || !PADRAO_DATA.test(data.trim())) {
    throw new ErroValidacao('A data deve estar no formato AAAA-MM-DD.', 'vencimento');
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
    throw new ErroValidacao(`Data inexistente: ${limpo}.`, 'vencimento');
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
// ─ Estados (persistidos) e situações (derivadas) ────────────────────────
/**
 * Estado persistido — o que o banco guarda. `VENCIDA` NÃO está aqui de
 * propósito: é derivado do vencimento e nunca gravado automaticamente.
 */
export const ESTADOS_CONTA = Object.freeze({
  PENDENTE: 'pendente',
  CANCELADA: 'cancelada',
});

export const ESTADOS_CONTA_ORDEM = Object.freeze([
  ESTADOS_CONTA.PENDENTE,
  ESTADOS_CONTA.CANCELADA,
]);

export const ESTADOS_CONTA_ROTULOS = Object.freeze({
  [ESTADOS_CONTA.PENDENTE]: 'Pendente',
  [ESTADOS_CONTA.CANCELADA]: 'Cancelada',
});

/** Conta nasce PENDENTE. */
export const ESTADO_CONTA_INICIAL = ESTADOS_CONTA.PENDENTE;

/** Situação apresentada ao jogador: pendente | vencida | cancelada. */
export const SITUACOES_CONTA = Object.freeze({
  PENDENTE: 'pendente',
  VENCIDA: 'vencida',
  CANCELADA: 'cancelada',
});

export const SITUACOES_CONTA_ORDEM = Object.freeze([
  SITUACOES_CONTA.PENDENTE,
  SITUACOES_CONTA.VENCIDA,
  SITUACOES_CONTA.CANCELADA,
]);

export const SITUACOES_CONTA_ROTULOS = Object.freeze({
  [SITUACOES_CONTA.PENDENTE]: 'Pendente',
  [SITUACOES_CONTA.VENCIDA]: 'Vencida',
  [SITUACOES_CONTA.CANCELADA]: 'Cancelada',
});

/** Valida o estado persistido da conta. */
export function validarEstadoConta(estado) {
  if (!ESTADOS_CONTA_ORDEM.includes(estado)) {
    throw new ErroValidacao(
      `Estado de conta inválido: ${String(estado)}. Estados: ${ESTADOS_CONTA_ORDEM.join(', ')}.`,
      'estado',
    );
  }
  return estado;
}

/** Uma conta cancelada é terminal nesta subfase. */
export function contaCancelada(estado) {
  return estado === ESTADOS_CONTA.CANCELADA;
}

/** Cancelamento só é permitido enquanto a conta está pendente. */
export function exigirCancelamentoConta(estado) {
  if (contaCancelada(estado)) {
    throw new ErroTransicao('Esta conta já está cancelada.');
  }
  if (estado !== ESTADOS_CONTA.PENDENTE) {
    throw new ErroTransicao(`Não é possível cancelar uma conta no estado "${estado}".`);
  }
}

/**
 * Situação derivada — NÃO altera o banco.
 *
 *   cancelada                            → CANCELADA
 *   pendente + vencimento < hoje         → VENCIDA
 *   pendente + vencimento >= hoje        → PENDENTE
 *
 * Regra documentada em docs/contas-despesas.md: `VENCIDA` é condição de
 * apresentação/consulta; o registro permanece `pendente` no banco.
 */
export function situacaoConta(conta, hoje = dataHojeIso()) {
  if (!conta) return null;
  if (contaCancelada(conta.estado)) return SITUACOES_CONTA.CANCELADA;
  const referencia = validarDataIso(hoje);
  return String(conta.vencimento) < referencia
    ? SITUACOES_CONTA.VENCIDA
    : SITUACOES_CONTA.PENDENTE;
}

// ── Campos ──────────────────────────────────────────────────────────────
const TAM_DESCRICAO_MAX = 2000;

/** Descrição é texto livre opcional. */
export function validarDescricaoConta(descricao) {
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
 * Representa a expectativa da conta — não é dinheiro gasto.
 */
export function validarValorEsperadoConta(centavos) {
  const valor = validarValorCentavos(centavos);
  if (valor <= 0) {
    throw new ErroValidacao(
      'O valor esperado da conta deve ser maior que zero (em centavos).',
      'valorEsperado',
    );
  }
  return valor;
}

/** Identificador de serviço: inteiro positivo. */
export function validarServicoIdConta(servicoId) {
  if (typeof servicoId !== 'number' || !Number.isInteger(servicoId) || servicoId <= 0) {
    throw new ErroValidacao('O serviço da conta é obrigatório.', 'servicoId');
  }
  return servicoId;
}

// ─ Validações de criação e edição ────────────────────────────────────────
export function validarContaCriacao(dados) {
  const entrada = dados ?? {};
  return Object.freeze({
    servicoId: validarServicoIdConta(Number(entrada.servicoId ?? entrada.serviceId)),
    referencia: validarReferencia(entrada.referencia ?? entrada.reference),
    descricao: validarDescricaoConta(entrada.descricao ?? null),
    valorEsperado: validarValorEsperadoConta(
      entrada.valorEsperado ?? entrada.valorEsperadoCentavos ?? entrada.expectedAmount,
    ),
    vencimento: validarDataIso(entrada.vencimento ?? entrada.dueDate),
  });
}

/**
 * Edição parcial: apenas campos presentes são validados e devolvidos.
 * Serviço, jogador e estado NÃO são editáveis (preservam a identidade).
 */
export function validarContaEdicao(dados) {
  const entrada = dados ?? {};
  const resultado = {};
  if ('referencia' in entrada || 'reference' in entrada) {
    resultado.referencia = validarReferencia(entrada.referencia ?? entrada.reference);
  }
  if ('descricao' in entrada) resultado.descricao = validarDescricaoConta(entrada.descricao);
  if ('valorEsperado' in entrada || 'valorEsperadoCentavos' in entrada || 'expectedAmount' in entrada) {
    resultado.valorEsperado = validarValorEsperadoConta(
      entrada.valorEsperado ?? entrada.valorEsperadoCentavos ?? entrada.expectedAmount,
    );
  }
  if ('vencimento' in entrada || 'dueDate' in entrada) {
    resultado.vencimento = validarDataIso(entrada.vencimento ?? entrada.dueDate);
  }
  return Object.freeze(resultado);
}

// ── Conversor linha → objeto (camelCase, congelado) ───────────────────────
export function paraConta(linha) {
  if (!linha) return null;
  return Object.freeze({
    id: linha.id,
    jogadorId: linha.jogador_id,
    servicoId: linha.servico_id,
    referencia: linha.referencia,
    descricao: linha.descricao ?? null,
    valorEsperado: linha.valor_esperado_centavos,
    vencimento: linha.vencimento,
    estado: linha.estado,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    canceladoEm: linha.cancelado_em ?? null,
    // Recorrência que gerou a conta (Fase 10.4); null nas contas manuais.
    recorrenciaId: linha.recorrencia_id ?? null,
  });
}
