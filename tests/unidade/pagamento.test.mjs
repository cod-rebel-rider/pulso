/**
 * PULSO — Testes unitários: domínio de Pagamentos (Fase 10.5).
 *
 * Regras puras (sem E/S): validação dos dados de pagamento (valor positivo
 * em centavos inteiros, data civil válida e não futura, observação opcional
 * truncada), bloqueio de duplicidade e de contas em estado terminal, derivação
 * da situação de pagamento (A_PAGAR vs PAGO).
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  validarPagamento,
  podePagareLancar,
  situacaoPagamento,
  ROTULOS_SITUACAO_PAGAMENTO,
  SITUACOES_PAGAMENTO,
} from "../../src/core/dominio/pagamento.js";
import { ErroConflito, ErroValidacao } from "../../src/core/erros.js";

// ---- Dados de pagamento ----

test("validarPagamento: valor positivo e data válida", () => {
  const dados = validarPagamento({
    valorPagoCentavos: 12500,
    paidAt: "2026-09-15",
    observacao: "Fatura de setembro",
  });
  assert.equal(dados.valorPagoCentavos, 12500);
  assert.equal(dados.paidAt, "2026-09-15");
  assert.equal(dados.paymentDescription, "Fatura de setembro");
});

test("validarPagamento: ignora diferenças de case e nomes alternativos", () => {
  assert.equal(
    validarPagamento({ valorPago: 15000, data: "2026-08-20" }).valorPagoCentavos,
    15000,
  );
  assert.equal(
    validarPagamento({ valorPagoCentavos: 15000, paid_at: "2026-08-20" }).paidAt,
    "2026-08-20",
  );
  assert.equal(
    validarPagamento({ amount: 8000, paymentDate: "2026-08-25" }).valorPagoCentavos,
    8000,
  );
});

test("validarPagamento: observação opcional truncada e repetições de espaços", () => {
  assert.equal(
    validarPagamento({ valorPagoCentavos: 1000, paidAt: "2026-09-01", observacao: "  Nota  " }).paymentDescription,
    "Nota",
  );
  assert.equal(
    validarPagamento({ valorPagoCentavos: 1000, paidAt: "2026-09-01", observacao: "a".repeat(600) }).paymentDescription.length,
    500,
  );
  assert.equal(
    validarPagamento({ valorPagoCentavos: 1000, paidAt: "2026-09-01", observacao: "   " }).paymentDescription,
    null,
  );
  assert.equal(
    validarPagamento({ valorPagoCentavos: 1000, paidAt: "2026-09-01" }).paymentDescription,
    null,
  );
});

test("validarPagamento: rejeita valor zero, negativo e centavos fracionários", () => {
  assert.throws(() => validarPagamento({ valorPagoCentavos: 0, paidAt: "2026-09-01" }), ErroValidacao);
  assert.throws(() => validarPagamento({ valorPagoCentavos: -100, paidAt: "2026-09-01" }), ErroValidacao);
  assert.throws(() => validarPagamento({ valorPagoCentavos: 100.5, paidAt: "2026-09-01" }), ErroValidacao);
});

test("validarPagamento: rejeita data de pagamento inválida ou inexistente", () => {
  assert.throws(
    () => validarPagamento({ valorPagoCentavos: 1000, paidAt: "2026-02-30" }),
    ErroValidacao,
  );
  assert.throws(
    () => validarPagamento({ valorPagoCentavos: 1000, paidAt: "13/09/2026" }),
    ErroValidacao,
  );
  assert.throws(
    () => validarPagamento({ valorPagoCentavos: 1000, paidAt: "invalida" }),
    ErroValidacao,
  );
  assert.throws(
    () => validarPagamento({ valorPagoCentavos: 1000 }),
    ErroValidacao,
  );
});

test("validarPagamento: hoje é permitido (pagamento no dia)", () => {
  const pagamento = validarPagamento({
    valorPagoCentavos: 1000,
    paidAt: "2026-09-15",
  });
  assert.equal(pagamento.paidAt, "2026-09-15");
});

// ---- Bloqueios (quem pode ser pago) ----

test("podePagareLancar: conta pendente é aprovada", () => {
  assert.doesNotThrow(() =>
    podePagareLancar({ id: 1, jogadorId: 1, estado: "pendente", vencimento: "2026-09-15" }, 1),
  );
});

test("podePagareLancar: conta vencida (estado pendente) é aprovada", () => {
  assert.doesNotThrow(() =>
    podePagareLancar({ id: 1, jogadorId: 1, estado: "pendente", vencimento: "2026-01-01" }, 1),
  );
});

test("podePagareLancar: conta paga é bloqueada (duplicidade)", () => {
  assert.throws(
    () => podePagareLancar({ id: 1, jogadorId: 1, estado: "paga", vencimento: "2026-09-15" }, 1),
    ErroConflito,
  );
});

test("podePagareLancar: conta cancelada é bloqueada", () => {
  assert.throws(
    () => podePagareLancar({ id: 1, jogadorId: 1, estado: "cancelada", vencimento: "2026-09-15" }, 1),
    ErroConflito,
  );
});

test("podePagareLancar: conta inexistente lança", () => {
  assert.throws(() => podePagareLancar(null), ErroConflito);
  assert.throws(() => podePagareLancar(undefined), ErroConflito);
});

test("podePagareLancar: bloqueia conta de outro jogador", () => {
  assert.throws(
    () => podePagareLancar({ id: 1, jogadorId: 2, estado: "pendente", vencimento: "2026-09-15" }, 1),
    ErroConflito,
  );
});

// ---- Situação de pagamento (derivada) ----

test("situacaoPagamento: conta paga com paidAt é PAGO", () => {
  const conta = { id: 1, estado: "paga", paidAt: "2026-09-15" };
  assert.equal(situacaoPagamento(conta), SITUACOES_PAGAMENTO.PAGO);
      assert.equal(ROTULOS_SITUACAO_PAGAMENTO.pago, "Pago");
});

test("situacaoPagamento: conta pendente é A_PAGAR", () => {
  const conta = { id: 1, estado: "pendente", vencimento: "2026-09-15" };
  assert.equal(situacaoPagamento(conta), SITUACOES_PAGAMENTO.A_PAGAR);
      assert.equal(ROTULOS_SITUACAO_PAGAMENTO.a_pagar, "A Pagar");
});

test("situacaoPagamento: conta sem estado é NAO_APLICAVEL", () => {
  assert.equal(situacaoPagamento(null), SITUACOES_PAGAMENTO.NAO_APLICAVEL);
  assert.equal(situacaoPagamento(undefined), SITUACOES_PAGAMENTO.NAO_APLICAVEL);
      assert.equal(ROTULOS_SITUACAO_PAGAMENTO.nao_aplicavel, "—");
});
