/**
 * PULSO — Testes unitários: domínio de Geração de Ocorrências (Fase 10.4)
 *
 * Regras puras (sem E/S): período da geração (De/Até), elegibilidade da
 * recorrência (só ATIVA gera), cálculo das ocorrências por frequência
 * (mensal…anual), ancoragem no mês de data_inicio, respeito a start_date e
 * end_date, período limitado e regra canônica de MESES COM DIAS DIFERENTES.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  validarPeriodoGeracao,
  podeGerarOcorrencias,
  calcularOcorrencias,
} from "../../src/core/dominio/geracao.js";
import { ErroValidacao } from "../../src/core/erros.js";

/** Regra de recorrência pronta para os cálculos (valores da Fase 10.3). */
function recorrencia(sobrescrito = {}) {
  return {
    id: 1,
    servicoId: 1,
    frequencia: "mensal",
    dataInicio: "2026-01-01",
    dataFim: null,
    diaVencimento: 15,
    estado: "ativa",
    ...sobrescrito,
  };
}

const competencias = (ocorrencias) => ocorrencias.map((o) => o.competencia);
const vencimentos = (ocorrencias) => ocorrencias.map((o) => o.vencimento);

// ---- Período ----
test("validarPeriodoGeracao: De/Até obrigatórios, civis e inclusivos", () => {
  assert.deepEqual(validarPeriodoGeracao("2026-10-01", "2026-12-31"), {
    inicio: "2026-10-01",
    fim: "2026-12-31",
  });
  assert.throws(() => validarPeriodoGeracao(null, "2026-12-31"), ErroValidacao);
  assert.throws(() => validarPeriodoGeracao("2026-10-01", null), ErroValidacao);
  assert.throws(() => validarPeriodoGeracao("01/10/2026", "2026-12-31"), ErroValidacao);
  assert.throws(() => validarPeriodoGeracao("2026-02-30", "2026-12-31"), ErroValidacao);
  assert.throws(() => validarPeriodoGeracao("2026-12-31", "2026-10-01"), ErroValidacao);
  // mesma data é aceita (período de um único dia)
  assert.deepEqual(validarPeriodoGeracao("2026-10-15", "2026-10-15"), {
    inicio: "2026-10-15",
    fim: "2026-10-15",
  });
});

// ---- Elegibilidade ----
test("podeGerarOcorrencias: somente ATIVA gera; inativa e arquivada não", () => {
  assert.equal(podeGerarOcorrencias(recorrencia({ estado: "ativa" })), true);
  assert.equal(podeGerarOcorrencias(recorrencia({ estado: "inativa" })), false);
  assert.equal(podeGerarOcorrencias(recorrencia({ estado: "arquivada" })), false);
  assert.equal(podeGerarOcorrencias(null), false);
});

// ---- Frequências ----
test("geração mensal: uma ocorrência por mês dentro do período", () => {
  const ocorrencias = calcularOcorrencias(recorrencia(), {
    inicio: "2026-10-01",
    fim: "2026-12-31",
  });
  assert.deepEqual(competencias(ocorrencias), ["2026-10", "2026-11", "2026-12"]);
  assert.deepEqual(vencimentos(ocorrencias), [
    "2026-10-15", "2026-11-15", "2026-12-15",
  ]);
});

test("geração bimestral: cadência ancorada no mês do início da regra", () => {
  // regra criada em set/2026 → set, nov, jan, mar …
  const ocorrencias = calcularOcorrencias(
    recorrencia({ frequencia: "bimestral", dataInicio: "2026-09-01" }),
    { inicio: "2026-09-01", fim: "2027-04-30" },
  );
  assert.deepEqual(competencias(ocorrencias), [
    "2026-09", "2026-11", "2027-01", "2027-03",
  ]);
});

test("geração trimestral: passos de 3 meses", () => {
  const ocorrencias = calcularOcorrencias(
    recorrencia({ frequencia: "trimestral", dataInicio: "2026-01-01", diaVencimento: 10 }),
    { inicio: "2026-01-01", fim: "2026-12-31" },
  );
  assert.deepEqual(competencias(ocorrencias), [
    "2026-01", "2026-04", "2026-07", "2026-10",
  ]);
  assert.deepEqual(vencimentos(ocorrencias), [
    "2026-01-10", "2026-04-10", "2026-07-10", "2026-10-10",
  ]);
});

test("geração semestral: duas ocorrências no ano", () => {
  const ocorrencias = calcularOcorrencias(
    recorrencia({ frequencia: "semestral", dataInicio: "2026-03-01" }),
    { inicio: "2026-01-01", fim: "2026-12-31" },
  );
  assert.deepEqual(competencias(ocorrencias), ["2026-03", "2026-09"]);
});

test("geração anual: uma ocorrência por ano", () => {
  const ocorrencias = calcularOcorrencias(
    recorrencia({ frequencia: "anual", dataInicio: "2024-05-01" }),
    { inicio: "2024-01-01", fim: "2027-12-31" },
  );
  assert.deepEqual(competencias(ocorrencias), ["2024-05", "2025-05", "2026-05", "2027-05"]);
});

// ---- start_date / end_date ----
test("start_date: ocorrência com vencimento antes do início da regra não existe", () => {
  // regra começa em 20/09; vencimento dia 15 → setembro fica fora; a
  // cadência continua ancorada (out, nov…), sem deslocamento.
  const ocorrencias = calcularOcorrencias(
    recorrencia({ dataInicio: "2026-09-20" }),
    { inicio: "2026-09-01", fim: "2026-11-30" },
  );
  assert.deepEqual(competencias(ocorrencias), ["2026-10", "2026-11"]);
  assert.deepEqual(vencimentos(ocorrencias), ["2026-10-15", "2026-11-15"]);
});

test("end_date: nada é gerado além do término da recorrência", () => {
  const ocorrencias = calcularOcorrencias(
    recorrencia({ dataInicio: "2026-01-01", dataFim: "2026-11-15" }),
    { inicio: "2026-01-01", fim: "2026-12-31" },
  );
  // novembro vence exatamente no término (inclusivo); dezembro não existe.
  assert.deepEqual(competencias(ocorrencias), [
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
    "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11",
  ]);
});

test("período fora da validade da regra: vazio nas duas pontas", () => {
  const regra = recorrencia({
    dataInicio: "2026-06-01",
    dataFim: "2026-08-31",
  });
  assert.deepEqual(
    calcularOcorrencias(regra, { inicio: "2026-01-01", fim: "2026-05-31" }),
    [],
    "período antes do start_date não gera nada",
  );
  assert.deepEqual(
    calcularOcorrencias(regra, { inicio: "2026-09-01", fim: "2026-12-31" }),
    [],
    "período depois do end_date não gera nada",
  );
});

test("período limitado: só os meses pedidos, mesmo com regra mais longa", () => {
  const ocorrencias = calcularOcorrencias(
    recorrencia({ dataInicio: "2026-01-01" }),
    { inicio: "2026-05-01", fim: "2026-07-31" },
  );
  assert.deepEqual(competencias(ocorrencias), ["2026-05", "2026-06", "2026-07"]);
});

test("período parcial no mês: comparação é pela DATA do vencimento", () => {
  // fim do período no dia 10: a conta que vence dia 15 não entra.
  const dia15 = calcularOcorrencias(
    recorrencia({ diaVencimento: 15 }),
    { inicio: "2026-10-01", fim: "2026-11-10" },
  );
  assert.deepEqual(competencias(dia15), ["2026-10"]);
  // dia 31 no fim do período: entra (31 >= 31).
  const dia31 = calcularOcorrencias(
    recorrencia({ diaVencimento: 31 }),
    { inicio: "2026-01-01", fim: "2026-03-31" },
  );
  assert.deepEqual(competencias(dia31), ["2026-01", "2026-02", "2026-03"]);
  // com fim em 30/03, a ocorrência de 31/03 não existe (o dia 31 NÃO é
  // esticado para o mês seguinte nem deslocado — só meses curtos ajustam).
  const dia31limitado = calcularOcorrencias(
    recorrencia({ diaVencimento: 31 }),
    { inicio: "2026-02-01", fim: "2026-03-30" },
  );
  assert.deepEqual(competencias(dia31limitado), ["2026-02"]);
});

// ---- Meses com dias diferentes (regra canônica) ----
test("meses curtos: dia 31 vira o último dia válido, sem descartar nem deslocar", () => {
  const ocorrencias = calcularOcorrencias(
    recorrencia({ diaVencimento: 31, dataInicio: "2026-01-01" }),
    { inicio: "2026-01-01", fim: "2026-04-30" },
  );
  assert.deepEqual(competencias(ocorrencias), ["2026-01", "2026-02", "2026-03", "2026-04"]);
  assert.deepEqual(vencimentos(ocorrencias), [
    "2026-01-31", // janeiro tem 31
    "2026-02-28", // fevereiro/2026 → 28
    "2026-03-31", // março tem 31
    "2026-04-30", // abril → 30
  ]);
});

test("meses curtos: fevereiro bissexto vira 29 (2024)", () => {
  const ocorrencias = calcularOcorrencias(
    recorrencia({ diaVencimento: 31, dataInicio: "2024-01-01" }),
    { inicio: "2024-01-01", fim: "2024-03-31" },
  );
  assert.deepEqual(vencimentos(ocorrencias), [
    "2024-01-31", "2024-02-29", "2024-03-31",
  ]);
});

// ---- Validações e robustez ----
test("calcularOcorrencias: frequência inválida e regra ausente rejeitadas", () => {
  assert.throws(
    () => calcularOcorrencias(recorrencia({ frequencia: "quinzenal" }), {
      inicio: "2026-01-01",
      fim: "2026-12-31",
    }),
    ErroValidacao,
  );
  assert.throws(
    () => calcularOcorrencias(recorrencia({ diaVencimento: 0 }), {
      inicio: "2026-01-01",
      fim: "2026-12-31",
    }),
    ErroValidacao,
  );
  assert.throws(
    () => calcularOcorrencias(null, { inicio: "2026-01-01", fim: "2026-12-31" }),
    ErroValidacao,
  );
});

test("calcularOcorrencias: resultado congelado (ocorrências não mutáveis)", () => {
  const ocorrencias = calcularOcorrencias(recorrencia(), {
    inicio: "2026-10-01",
    fim: "2026-12-31",
  });
  assert.ok(Object.isFrozen(ocorrencias));
  assert.ok(Object.isFrozen(ocorrencias[0]));
});

test("calcularOcorrencias: período de um único dia pega só a conta daquele dia", () => {
  const ocorrencias = calcularOcorrencias(
    recorrencia({ diaVencimento: 15 }),
    { inicio: "2026-10-15", fim: "2026-10-15" },
  );
  assert.deepEqual(competencias(ocorrencias), ["2026-10"]);
});
