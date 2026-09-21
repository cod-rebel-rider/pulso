/**
 * PULSO — Testes unitários: domínio de Contas / Despesas (Fase 10.2)
 *
 * Regras puras: referência (AAAA-MM), vencimento, valores em centavos,
 * estado persistido × situação DERIVADA (vencida), cancelamento e conversor.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  FORMATO_REFERENCIA,
  ROTULOS_MESES,
  validarReferencia,
  rotuloReferencia,
  validarDataIso,
  dataHojeIso,
  ESTADOS_CONTA,
  ESTADOS_CONTA_ORDEM,
  ESTADOS_CONTA_ROTULOS,
  ESTADO_CONTA_INICIAL,
  SITUACOES_CONTA,
  SITUACOES_CONTA_ORDEM,
  SITUACOES_CONTA_ROTULOS,
  validarEstadoConta,
  contaCancelada,
  exigirCancelamentoConta,
  situacaoConta,
  validarDescricaoConta,
  validarValorEsperadoConta,
  validarServicoIdConta,
  validarContaCriacao,
  validarContaEdicao,
  paraConta,
} from "../../src/core/dominio/conta.js";
import { ErroValidacao, ErroTransicao } from "../../src/core/erros.js";

// ---- Referência ----
test("referência: formato canônico AAAA-MM e rótulo humano", () => {
  assert.equal(FORMATO_REFERENCIA, "AAAA-MM");
  assert.equal(validarReferencia("2026-09"), "2026-09");
  assert.equal(validarReferencia(" 2026-12 "), "2026-12");
  assert.equal(rotuloReferencia("2026-09"), "Setembro/2026");
  assert.equal(rotuloReferencia("2026-01"), "Janeiro/2026");
  assert.equal(ROTULOS_MESES.length, 12);
  assert.throws(() => validarReferencia("Setembro/2026"), ErroValidacao);
  assert.throws(() => validarReferencia("09/2026"), ErroValidacao);
  assert.throws(() => validarReferencia("2026-13"), ErroValidacao);
  assert.throws(() => validarReferencia("2026-00"), ErroValidacao);
  assert.throws(() => validarReferencia("2026"), ErroValidacao);
  assert.throws(() => validarReferencia(null), ErroValidacao);
});

test("referência distingue ocorrências: setembro e outubro são diferentes", () => {
  assert.notEqual(validarReferencia("2026-09"), validarReferencia("2026-10"));
  assert.equal(rotuloReferencia("invalida"), "invalida");
});

// ---- Vencimento ----
test("vencimento: data civil AAAA-MM-DD válida e inexistente rejeitada", () => {
  assert.equal(validarDataIso("2026-09-15"), "2026-09-15");
  assert.equal(validarDataIso("2024-02-29"), "2024-02-29"); // bissexto
  assert.throws(() => validarDataIso("2026-02-30"), ErroValidacao);
  assert.throws(() => validarDataIso("2026-13-01"), ErroValidacao);
  assert.throws(() => validarDataIso("15/09/2026"), ErroValidacao);
  assert.throws(() => validarDataIso("2026-9-5"), ErroValidacao);
  assert.throws(() => validarDataIso(null), ErroValidacao);
});

test("dataHojeIso: data local em AAAA-MM-DD", () => {
  const hoje = dataHojeIso(new Date(2026, 8, 15, 12, 0, 0)); // 15/09/2026 local
  assert.equal(hoje, "2026-09-15");
});

// ---- Estados e situações ----
test("estados persistidos: pendente/cancelada; VENCIDA não é persistida", () => {
  assert.deepEqual(ESTADOS_CONTA_ORDEM, ["pendente", "cancelada"]);
  assert.equal(ESTADO_CONTA_INICIAL, "pendente");
  assert.equal(ESTADOS_CONTA_ROTULOS.cancelada, "Cancelada");
  assert.equal(ESTADOS_CONTA.VENCIDA, undefined, "VENCIDA não existe como estado persistido");
  assert.deepEqual(SITUACOES_CONTA_ORDEM, ["pendente", "vencida", "cancelada"]);
  assert.equal(SITUACOES_CONTA_ROTULOS.vencida, "Vencida");
  assert.equal(validarEstadoConta("pendente"), "pendente");
  assert.throws(() => validarEstadoConta("vencida"), ErroValidacao);
  assert.throws(() => validarEstadoConta("paga"), ErroValidacao);
});

test("situacaoConta: vencida é DERIVADA do vencimento, sem alterar o registro", () => {
  const base = { estado: "pendente", vencimento: "2026-09-15" };
  assert.equal(situacaoConta(base, "2026-09-14"), SITUACOES_CONTA.PENDENTE); // futura
  assert.equal(situacaoConta(base, "2026-09-15"), SITUACOES_CONTA.PENDENTE); // vence hoje
  assert.equal(situacaoConta(base, "2026-09-16"), SITUACOES_CONTA.VENCIDA); // passado
  const cancelada = { estado: "cancelada", vencimento: "2026-09-15" };
  assert.equal(situacaoConta(cancelada, "2026-09-16"), SITUACOES_CONTA.CANCELADA);
  assert.equal(situacaoConta(null), null);
  // o objeto original permanece intacto (nada é gravado)
  assert.equal(base.estado, "pendente");
});

// ---- Cancelamento ----
test("cancelamento: permitido no pendente, bloqueado quando já cancelada", () => {
  assert.equal(contaCancelada("cancelada"), true);
  assert.equal(contaCancelada("pendente"), false);
  assert.doesNotThrow(() => exigirCancelamentoConta("pendente"));
  assert.throws(() => exigirCancelamentoConta("cancelada"), ErroTransicao);
});

// ---- Campos ----
test("valor esperado: centavos inteiros maiores que zero", () => {
  assert.equal(validarValorEsperadoConta(12000), 12000);
  assert.throws(() => validarValorEsperadoConta(0), ErroValidacao);
  assert.throws(() => validarValorEsperadoConta(-100), ErroValidacao);
  assert.throws(() => validarValorEsperadoConta("1200"), ErroValidacao);
  assert.throws(() => validarValorEsperadoConta(99.9), ErroValidacao);
  assert.throws(() => validarValorEsperadoConta(null), ErroValidacao);
});

test("serviço e descrição da conta", () => {
  assert.equal(validarServicoIdConta(1), 1);
  assert.throws(() => validarServicoIdConta(0), ErroValidacao);
  assert.throws(() => validarServicoIdConta(1.5), ErroValidacao);
  assert.throws(() => validarServicoIdConta(null), ErroValidacao);
  assert.equal(validarDescricaoConta(null), null);
  assert.equal(validarDescricaoConta("   "), null);
  assert.equal(validarDescricaoConta(" Fatura do mês "), "Fatura do mês");
  assert.throws(() => validarDescricaoConta(42), ErroValidacao);
});
// ---- Criação e edição ----
test("validarContaCriacao: campos completos e recusas", () => {
  const dados = validarContaCriacao({
    servicoId: 7,
    referencia: "2026-09",
    descricao: "Fatura de setembro",
    valorEsperado: 12000,
    vencimento: "2026-09-15",
  });
  assert.equal(dados.servicoId, 7);
  assert.equal(dados.referencia, "2026-09");
  assert.equal(dados.valorEsperado, 12000);
  assert.equal(dados.vencimento, "2026-09-15");
  const minimo = validarContaCriacao({ servicoId: 1, referencia: "2026-09", valorEsperado: 5000, vencimento: "2026-09-01" });
  assert.equal(minimo.descricao, null);
  assert.throws(() => validarContaCriacao({ referencia: "2026-09", valorEsperado: 5000, vencimento: "2026-09-01" }), ErroValidacao);
  assert.throws(() => validarContaCriacao({ servicoId: 1, referencia: "2026-09", valorEsperado: 5000 }), ErroValidacao);
});

test("validarContaEdicao: parcial e validado", () => {
  assert.deepEqual(validarContaEdicao({ valorEsperado: 13000 }), { valorEsperado: 13000 });
  assert.deepEqual(validarContaEdicao({ vencimento: "2026-10-15" }), { vencimento: "2026-10-15" });
  assert.deepEqual(validarContaEdicao({}), {});
  assert.throws(() => validarContaEdicao({ valorEsperado: -5 }), ErroValidacao);
  assert.throws(() => validarContaEdicao({ referencia: "Setembro" }), ErroValidacao);
});

// ---- Conversor ----
test("paraConta: converte linha do banco em objeto camelCase", () => {
  const conta = paraConta({
    id: 3,
    jogador_id: 1,
    servico_id: 2,
    referencia: "2026-09",
    descricao: "Fatura de setembro",
    valor_esperado_centavos: 12000,
    vencimento: "2026-09-15",
    estado: "pendente",
    criado_em: "2026-09-01T10:00:00.000Z",
    atualizado_em: "2026-09-01T10:00:00.000Z",
    cancelado_em: null,
  });
  assert.equal(conta.id, 3);
  assert.equal(conta.jogadorId, 1);
  assert.equal(conta.servicoId, 2);
  assert.equal(conta.referencia, "2026-09");
  assert.equal(conta.valorEsperado, 12000);
  assert.equal(conta.vencimento, "2026-09-15");
  assert.equal(conta.estado, "pendente");
  assert.equal(conta.canceladoEm, null);
  assert.equal(paraConta(null), null);
});

test("paraConta: conta cancelada preserva canceladoEm", () => {
  const conta = paraConta({
    id: 4,
    jogador_id: 1,
    servico_id: 2,
    referencia: "2026-08",
    descricao: null,
    valor_esperado_centavos: 9000,
    vencimento: "2026-08-15",
    estado: "cancelada",
    criado_em: "2026-08-01T10:00:00.000Z",
    atualizado_em: "2026-08-10T10:00:00.000Z",
    cancelado_em: "2026-08-10T10:00:00.000Z",
  });
  assert.equal(conta.estado, "cancelada");
  assert.equal(conta.canceladoEm, "2026-08-10T10:00:00.000Z");
});