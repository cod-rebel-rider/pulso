/**
 * PULSO — Domínio: Pagamentos (Fase 10.5 — Pagamentos)
 *
 * Transforma uma CONTA (obrigação registrada) em uma DESPESA concreta
 * no mecanismo financeiro da FASE 08. Nada disso movimenta dinheiro antes
 * do pagamento: registrar a conta é a FASE 10.2/10.4; pagar é a 10.5.
 *
 * Decisões desta subfase:
 * - estado `PAGA` é PERSISTIDO — a conta sai de `pendente` e já não pode
 *   mais ser paga (idempotência por estado, não por transação);
 * - valor pago pode diferir do esperado — a DESPESA registra o valor REAL;
 * - tudo em UMA TRANSAÇÃO SQLite (`registrarPagamento` no serviço);
 * - a conta mantém sua identidade (serviço/referencia); só o estado, os
 *   campos de pagamento e o vínculo com a transação mudam;
 * - o vínculo é `conta.transaction_id` apontando para `transacao.id`.
 */

import { ErroValidacao, ErroConflito } from '../erros.js';
import { validarValorCentavos } from './financa.js';
import { ESTADOS_CONTA, contaCancelada, validarDataIso } from './conta.js';

// ── Estados de pagamento (persistidos) ───────────────────────────────────

export const ESTADOS_PAGAMENTO = Object.freeze({
  A_PAGAR: 'a_pagar',
  PAGO: 'pago',
});

/** Situação do pagamento para exibição (derivada do estado + data). */
export const SITUACOES_PAGAMENTO = Object.freeze({
  A_PAGAR: 'a_pagar',
  PAGO: 'pago',
  NAO_APLICAVEL: 'nao_aplicavel',
});

// Campos adicionais da conta, preenchidos no momento do pagamento.
export const CAMPOS_PAGAMENTO = Object.freeze([
  'paid_amount',
  'paid_at',
  'payment_description',
  'transaction_id',
]);

/**
 * Estados da conta onde pagamento é permitido.
 * VENCIDA é DERIVADA (`situacaoConta`) — o estado persistido é `pendente`.
 */
export const ESTADOS_PAGAMENTO_PERMITIDOS = Object.freeze([
  ESTADOS_CONTA.PENDENTE,
]);

/**
 * Valida se a conta pode ser paga.
 *
 * Rejeita, nesta ordem: conta inexistente, conta cancelada, conta já paga
 * (duplicidade) e conta de outro jogador. VENCIDA é variação de apresentação
 * de uma conta `pendente` — portanto é pagável.
 *
 * @param {object|null} conta objeto de domínio (com `estado` e `jogadorId`)
 * @param {number} [jogadorId] dono esperado (isolamento por jogador)
 * @returns {true}
 */
export function podePagareLancar(conta, jogadorId) {
  if (!conta) {
    throw new ErroConflito('Conta não encontrada.');
  }
  if (contaCancelada(conta.estado)) {
    throw new ErroConflito('Não é possível pagar uma conta cancelada.');
  }
  if (conta.estado === ESTADOS_CONTA.PAGA) {
    throw new ErroConflito('Esta conta já foi paga.');
  }
  if (!ESTADOS_PAGAMENTO_PERMITIDOS.includes(conta.estado)) {
    throw new ErroValidacao(
      `Não é possível pagar uma conta no estado "${conta.estado}".`,
      'estado',
    );
  }
  if (jogadorId !== undefined && Number(conta.jogadorId) !== Number(jogadorId)) {
    throw new ErroConflito('Conta não pertence ao jogador informado.');
  }
  return true;
}

/**
 * Valida os dados de pagamento.
 *
 * - valor pago: centavos inteiros > 0 (pode diferir de `expected_amount`);
 * - data do pagamento: data civil existente em `AAAA-MM-DD`;
 * - observação: opcional, texto livre truncado em 500 caracteres.
 *
 * @param {{valorPagoCentavos: number, paidAt: string, observacao?: string}} dados
 * @returns {Readonly<{valorPagoCentavos: number, paidAt: string, paymentDescription: string|null}>}
 */
export function validarPagamento(dados) {
  const entrada = dados ?? {};

  const valorPago = validarValorCentavos(
    entrada.valorPagoCentavos ?? entrada.valorPago ?? entrada.valor ?? entrada.amount,
  );

  // `paidAt` pode vir como `data`, `paid_at`, `dataPagamento` ou `paymentDate`.
  const paidAt = validarDataIso(
    entrada.paidAt ?? entrada.paid_at ?? entrada.data ?? entrada.dataPagamento ?? entrada.paymentDate,
  );

  // A observação pode vir como `observacao`, `paymentDescription` ou `descricao`
  // (o renderer usa `paymentDescription`; o canal aceita os três).
  const brutoObservacao =
    entrada.observacao ?? entrada.paymentDescription ?? entrada.descricao ?? null;
  const observacao =
    typeof brutoObservacao === 'string'
      ? brutoObservacao.trim().slice(0, 500) || null
      : null;

  return Object.freeze({
    valorPagoCentavos: valorPago,
    paidAt,
    paymentDescription: observacao,
  });
}

/** Situação de pagamento derivada: PAGO se estado `paga` e `paid_at` presente. */
export function situacaoPagamento(conta) {
  if (!conta) return SITUACOES_PAGAMENTO.NAO_APLICAVEL;
  if (conta.estado === ESTADOS_CONTA.PAGA && (conta.paidAt ?? conta.paid_at)) {
    return SITUACOES_PAGAMENTO.PAGO;
  }
  return SITUACOES_PAGAMENTO.A_PAGAR;
}

/** Rótulos para apresentação no renderer. */
export const ROTULOS_SITUACAO_PAGAMENTO = Object.freeze({
  [SITUACOES_PAGAMENTO.A_PAGAR]: 'A Pagar',
  [SITUACOES_PAGAMENTO.PAGO]: 'Pago',
  [SITUACOES_PAGAMENTO.NAO_APLICAVEL]: '—',
});
