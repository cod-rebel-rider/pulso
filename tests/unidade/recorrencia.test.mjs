/**
 * PULSO — Testes unitários: domínio de Recorrências (Fase 10.3)
 *
 * Regras puras: frequências (lista extensível), estados (ativa/inativa/
 * arquivada com arquivamento terminal), datas civis, dia de vencimento,
 * regra de MESES COM DIAS DIFERENTES (último dia válido do mês), valores
 * em centavos, criação/edição e conversor.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  FREQUENCIAS_RECORRENCIA,
  FREQUENCIAS_RECORRENCIA_VALORES,
  ROTULO_FREQUENCIA_RECORRENCIA,
  mesesDaFrequencia,
  validarFrequencia,
  ESTADOS_RECORRENCIA,
  ESTADOS_RECORRENCIA_ORDEM,
  ESTADOS_RECORRENCIA_ROTULOS,
  ESTADO_RECORRENCIA_INICIAL,
  validarEstadoRecorrencia,
  transicaoRecorrenciaPermitida,
  exigirTransicaoRecorrencia,
  recorrenciaArquivada,
  validarDataCivil,
  dataHojeIso,
  ultimoDiaDoMes,
  ajustarDiaNoMes,
  dataComDiaAjustado,
  validarServicoIdRecorrencia,
  validarDiaVencimento,
  validarDescricaoRecorrencia,
  validarValorEsperadoRecorrencia,
  validarPeriodoRecorrencia,
  validarRecorrenciaCriacao,
  validarRecorrenciaEdicao,
  paraRecorrencia,
} from "../../src/core/dominio/recorrencia.js";
import { ErroValidacao, ErroTransicao } from "../../src/core/erros.js";

// ---- Frequências ----
test("frequências: lista controlada inicial e extensível", () => {
  assert.deepEqual(FREQUENCIAS_RECORRENCIA_VALORES, [
    "mensal", "bimestral", "trimestral", "semestral", "anual",
  ]);
  assert.equal(mesesDaFrequencia("mensal"), 1);
  assert.equal(mesesDaFrequencia("bimestral"), 2);
  assert.equal(mesesDaFrequencia("trimestral"), 3);
  assert.equal(mesesDaFrequencia("semestral"), 6);
  assert.equal(mesesDaFrequencia("anual"), 12);
  assert.equal(mesesDaFrequencia("inexistente"), 0);
  assert.equal(ROTULO_FREQUENCIA_RECORRENCIA.anual, "ANUAL");
  // cada entrada carrega valor, rótulo e meses (base do gerador da 10.4)
  for (const frequencia of FREQUENCIAS_RECORRENCIA) {
    assert.equal(typeof frequencia.valor, "string");
    assert.equal(typeof frequencia.rotulo, "string");
    assert.ok(Number.isInteger(frequencia.meses) && frequencia.meses > 0);
  }
});

test("validarFrequencia: aceita as cinco e rejeita o resto", () => {
  for (const valor of FREQUENCIAS_RECORRENCIA_VALORES) {
    assert.equal(validarFrequencia(valor), valor);
  }
  assert.throws(() => validarFrequencia("quinzenal"), ErroValidacao);
  assert.throws(() => validarFrequencia("semanal"), ErroValidacao);
  assert.throws(() => validarFrequencia("MENSAL"), ErroValidacao);
  assert.throws(() => validarFrequencia(null), ErroValidacao);
  assert.throws(() => validarFrequencia(""), ErroValidacao);
});

// ---- Estados ----
test("estados: ativa/inativa/arquivada; nasce ATIVA; arquivada é terminal", () => {
  assert.deepEqual(ESTADOS_RECORRENCIA_ORDEM, ["ativa", "inativa", "arquivada"]);
  assert.equal(ESTADO_RECORRENCIA_INICIAL, "ativa");
  assert.equal(ESTADOS_RECORRENCIA_ROTULOS.arquivada, "Arquivada");
  assert.equal(validarEstadoRecorrencia("ativa"), "ativa");
  assert.throws(() => validarEstadoRecorrencia("ativa2"), ErroValidacao);
  assert.throws(() => validarEstadoRecorrencia("pendente"), ErroValidacao);

  assert.ok(transicaoRecorrenciaPermitida("ativa", "inativa"));
  assert.ok(transicaoRecorrenciaPermitida("inativa", "ativa"));
  assert.ok(transicaoRecorrenciaPermitida("ativa", "arquivada"));
  assert.ok(transicaoRecorrenciaPermitida("inativa", "arquivada"));
  assert.ok(!transicaoRecorrenciaPermitida("arquivada", "ativa"), "arquivada não reativa");
  assert.ok(!transicaoRecorrenciaPermitida("arquivada", "inativa"));
  assert.ok(!transicaoRecorrenciaPermitida("ativa", "ativa"));

  assert.throws(() => exigirTransicaoRecorrencia("arquivada", "ativa"), ErroTransicao);
  assert.throws(() => exigirTransicaoRecorrencia("ativa", "ativa"), ErroTransicao);
  assert.equal(recorrenciaArquivada("arquivada"), true);
  assert.equal(recorrenciaArquivada("ativa"), false);
});

// ---- Datas ----
test("validarDataCivil: formato AAAA-MM-DD e datas inexistentes rejeitadas", () => {
  assert.equal(validarDataCivil("2026-09-01", "dataInicio"), "2026-09-01");
  assert.equal(validarDataCivil(" 2026-09-01 ", "dataInicio"), "2026-09-01");
  assert.equal(validarDataCivil("2024-02-29"), "2024-02-29"); // bissexto
  assert.throws(() => validarDataCivil("2026-02-30"), ErroValidacao);
  assert.throws(() => validarDataCivil("2026-13-01"), ErroValidacao);
  assert.throws(() => validarDataCivil("01/09/2026"), ErroValidacao);
  assert.throws(() => validarDataCivil("2026-9-1"), ErroValidacao);
  assert.throws(() => validarDataCivil(null), ErroValidacao);
});

test("dataHojeIso: data local em AAAA-MM-DD", () => {
  const hoje = dataHojeIso(new Date(2026, 8, 17, 12, 0, 0)); // 17/09/2026 local
  assert.equal(hoje, "2026-09-17");
});

// ---- Meses com quantidade diferente de dias (regra canônica) ----
test("ultimoDiaDoMes: anos bissextos e meses regulares", () => {
  assert.equal(ultimoDiaDoMes(2026, 2), 28);
  assert.equal(ultimoDiaDoMes(2024, 2), 29); // bissexto
  assert.equal(ultimoDiaDoMes(2000, 2), 29); // bissexto secular
  assert.equal(ultimoDiaDoMes(1900, 2), 28); // não bissexto secular
  assert.equal(ultimoDiaDoMes(2026, 4), 30);
  assert.equal(ultimoDiaDoMes(2026, 6), 30);
  assert.equal(ultimoDiaDoMes(2026, 9), 30);
  assert.equal(ultimoDiaDoMes(2026, 11), 30);
  assert.equal(ultimoDiaDoMes(2026, 1), 31);
  assert.equal(ultimoDiaDoMes(2026, 12), 31);
  assert.throws(() => ultimoDiaDoMes(2026, 13), ErroValidacao);
  assert.throws(() => ultimoDiaDoMes(2026, 0), ErroValidacao);
});

test("ajustarDiaNoMes: dia 31 não quebra em fevereiro, abril, junho — usa o último dia válido", () => {
  // Exemplo da especificação: recorrência mensal com vencimento no dia 31.
  assert.equal(ajustarDiaNoMes(2026, 2, 31), 28, "fevereiro comum → 28");
  assert.equal(ajustarDiaNoMes(2024, 2, 31), 29, "fevereiro bissexto → 29");
  assert.equal(ajustarDiaNoMes(2026, 4, 31), 30, "abril → 30");
  assert.equal(ajustarDiaNoMes(2026, 6, 31), 30, "junho → 30");
  assert.equal(ajustarDiaNoMes(2026, 9, 31), 30, "setembro → 30");
  assert.equal(ajustarDiaNoMes(2026, 11, 31), 30, "novembro → 30");
  // meses com o dia completo não mudam
  assert.equal(ajustarDiaNoMes(2026, 1, 31), 31);
  assert.equal(ajustarDiaNoMes(2026, 3, 31), 31);
  assert.equal(ajustarDiaNoMes(2026, 5, 31), 31);
  assert.equal(ajustarDiaNoMes(2026, 7, 31), 31);
  assert.equal(ajustarDiaNoMes(2026, 8, 31), 31);
  assert.equal(ajustarDiaNoMes(2026, 10, 31), 31);
  assert.equal(ajustarDiaNoMes(2026, 12, 31), 31);
  // dia 30: só fevereiro comum reduz
  assert.equal(ajustarDiaNoMes(2026, 2, 30), 28);
  assert.equal(ajustarDiaNoMes(2024, 2, 30), 29);
  assert.equal(ajustarDiaNoMes(2026, 4, 30), 30);
  // nenhum dia é descartado nem empurrado para o mês seguinte
  assert.throws(() => ajustarDiaNoMes(2026, 2, 0), ErroValidacao);
  assert.throws(() => ajustarDiaNoMes(2026, 2, 32), ErroValidacao);
});

test("dataComDiaAjustado: data civil pronta da ocorrência (base da Fase 10.4)", () => {
  assert.equal(dataComDiaAjustado(2026, 2, 31), "2026-02-28");
  assert.equal(dataComDiaAjustado(2024, 2, 31), "2024-02-29");
  assert.equal(dataComDiaAjustado(2026, 4, 31), "2026-04-30");
  assert.equal(dataComDiaAjustado(2026, 9, 15), "2026-09-15");
  assert.equal(dataComDiaAjustado(2027, 1, 1), "2027-01-01");
});

// ---- Campos ----
test("serviço, dia de vencimento e descrição", () => {
  assert.equal(validarServicoIdRecorrencia(7), 7);
  assert.throws(() => validarServicoIdRecorrencia(0), ErroValidacao);
  assert.throws(() => validarServicoIdRecorrencia(1.5), ErroValidacao);
  assert.throws(() => validarServicoIdRecorrencia(null), ErroValidacao);

  assert.equal(validarDiaVencimento(1), 1);
  assert.equal(validarDiaVencimento(31), 31);
  assert.throws(() => validarDiaVencimento(0), ErroValidacao);
  assert.throws(() => validarDiaVencimento(32), ErroValidacao);
  assert.throws(() => validarDiaVencimento(15.5), ErroValidacao);
  assert.throws(() => validarDiaVencimento("15"), ErroValidacao);
  assert.throws(() => validarDiaVencimento(null), ErroValidacao);

  assert.equal(validarDescricaoRecorrencia(null), null);
  assert.equal(validarDescricaoRecorrencia("   "), null);
  assert.equal(validarDescricaoRecorrencia(" Assinatura mensal "), "Assinatura mensal");
  assert.throws(() => validarDescricaoRecorrencia(42), ErroValidacao);
});

test("valor esperado: centavos inteiros > 0; negativo/zero/fracionário rejeitados", () => {
  assert.equal(validarValorEsperadoRecorrencia(12000), 12000);
  assert.equal(validarValorEsperadoRecorrencia(1), 1);
  assert.throws(() => validarValorEsperadoRecorrencia(0), ErroValidacao);
  assert.throws(() => validarValorEsperadoRecorrencia(-100), ErroValidacao);
  assert.throws(() => validarValorEsperadoRecorrencia("12000"), ErroValidacao);
  assert.throws(() => validarValorEsperadoRecorrencia(99.9), ErroValidacao);
  assert.throws(() => validarValorEsperadoRecorrencia(null), ErroValidacao);
});

// ---- Período ----
test("período: término opcional; quando informado não pode ser anterior ao início", () => {
  assert.equal(validarPeriodoRecorrencia("2026-09-01", null), null);
  assert.equal(validarPeriodoRecorrencia("2026-09-01", "2027-09-01"), "2027-09-01");
  assert.equal(validarPeriodoRecorrencia("2026-09-01", "2026-09-01"), "2026-09-01");
  assert.throws(
    () => validarPeriodoRecorrencia("2026-09-01", "2026-08-31"),
    ErroValidacao,
    "término anterior ao início é rejeitado",
  );
});

// ---- Criação e edição ----
test("validarRecorrenciaCriacao: campos completos e recusas", () => {
  const dados = validarRecorrenciaCriacao({
    servicoId: 7,
    frequencia: "mensal",
    dataInicio: "2026-09-01",
    dataFim: "2027-09-01",
    diaVencimento: 31,
    descricao: "Internet mensal",
    valorEsperado: 12000,
  });
  assert.equal(dados.servicoId, 7);
  assert.equal(dados.frequencia, "mensal");
  assert.equal(dados.dataInicio, "2026-09-01");
  assert.equal(dados.dataFim, "2027-09-01");
  assert.equal(dados.diaVencimento, 31);
  assert.equal(dados.valorEsperado, 12000);

  const minimo = validarRecorrenciaCriacao({
    servicoId: 1,
    frequencia: "anual",
    dataInicio: "2026-09-01",
    diaVencimento: 15,
    valorEsperado: 5000,
  });
  assert.equal(minimo.dataFim, null, "término é opcional");
  assert.equal(minimo.descricao, null);

  assert.throws(
    () => validarRecorrenciaCriacao({ frequencia: "mensal", dataInicio: "2026-09-01", diaVencimento: 15, valorEsperado: 5000 }),
    ErroValidacao,
    "serviço é obrigatório",
  );
  assert.throws(
    () => validarRecorrenciaCriacao({ servicoId: 1, dataInicio: "2026-09-01", diaVencimento: 15, valorEsperado: 5000 }),
    ErroValidacao,
    "frequência é obrigatória",
  );
  assert.throws(
    () => validarRecorrenciaCriacao({ servicoId: 1, frequencia: "mensal", diaVencimento: 15, valorEsperado: 5000 }),
    ErroValidacao,
    "início é obrigatório",
  );
  assert.throws(
    () => validarRecorrenciaCriacao({ servicoId: 1, frequencia: "mensal", dataInicio: "2026-09-01", diaVencimento: 15 }),
    ErroValidacao,
    "valor é obrigatório",
  );
  assert.throws(
    () => validarRecorrenciaCriacao({ servicoId: 1, frequencia: "mensal", dataInicio: "2026-09-01", dataFim: "2026-08-31", diaVencimento: 15, valorEsperado: 5000 }),
    ErroValidacao,
    "término antes do início é rejeitado na criação",
  );
  assert.throws(
    () => validarRecorrenciaCriacao({ servicoId: 1, frequencia: "mensal", dataInicio: "2026-02-30", diaVencimento: 15, valorEsperado: 5000 }),
    ErroValidacao,
    "data inexistente é rejeitada",
  );
});

test("validarRecorrenciaEdicao: parcial e validado", () => {
  assert.deepEqual(validarRecorrenciaEdicao({ valorEsperado: 13000 }), { valorEsperado: 13000 });
  assert.deepEqual(validarRecorrenciaEdicao({ frequencia: "trimestral" }), { frequencia: "trimestral" });
  assert.deepEqual(validarRecorrenciaEdicao({ diaVencimento: 20 }), { diaVencimento: 20 });
  assert.deepEqual(validarRecorrenciaEdicao({ dataFim: "2027-01-31" }), { dataFim: "2027-01-31" });
  assert.deepEqual(validarRecorrenciaEdicao({ dataFim: null }), { dataFim: null }, "remover término");
  assert.deepEqual(validarRecorrenciaEdicao({}), {});
  assert.throws(() => validarRecorrenciaEdicao({ valorEsperado: -5 }), ErroValidacao);
  assert.throws(() => validarRecorrenciaEdicao({ frequencia: "semanal" }), ErroValidacao);
  assert.throws(() => validarRecorrenciaEdicao({ diaVencimento: 40 }), ErroValidacao);
  assert.throws(() => validarRecorrenciaEdicao({ dataFim: "2027-02-30" }), ErroValidacao);
});

// ---- Conversor ----
test("paraRecorrencia: converte linha do banco em objeto camelCase", () => {
  const recorrencia = paraRecorrencia({
    id: 5,
    jogador_id: 1,
    servico_id: 2,
    frequencia: "mensal",
    data_inicio: "2026-09-01",
    data_fim: null,
    dia_vencimento: 15,
    descricao: "Internet mensal",
    valor_esperado_centavos: 12000,
    estado: "ativa",
    criado_em: "2026-09-01T10:00:00.000Z",
    atualizado_em: "2026-09-01T10:00:00.000Z",
    arquivado_em: null,
  });
  assert.equal(recorrencia.id, 5);
  assert.equal(recorrencia.jogadorId, 1);
  assert.equal(recorrencia.servicoId, 2);
  assert.equal(recorrencia.frequencia, "mensal");
  assert.equal(recorrencia.dataInicio, "2026-09-01");
  assert.equal(recorrencia.dataFim, null);
  assert.equal(recorrencia.diaVencimento, 15);
  assert.equal(recorrencia.valorEsperado, 12000);
  assert.equal(recorrencia.estado, "ativa");
  assert.equal(recorrencia.arquivadoEm, null);
  assert.equal(paraRecorrencia(null), null);
});

test("paraRecorrencia: arquivada preserva arquivadoEm", () => {
  const recorrencia = paraRecorrencia({
    id: 6,
    jogador_id: 1,
    servico_id: 2,
    frequencia: "anual",
    data_inicio: "2026-01-01",
    data_fim: "2026-12-31",
    dia_vencimento: 10,
    descricao: null,
    valor_esperado_centavos: 9000,
    estado: "arquivada",
    criado_em: "2026-01-01T10:00:00.000Z",
    atualizado_em: "2026-06-10T10:00:00.000Z",
    arquivado_em: "2026-06-10T10:00:00.000Z",
  });
  assert.equal(recorrencia.estado, "arquivada");
  assert.equal(recorrencia.arquivadoEm, "2026-06-10T10:00:00.000Z");
  assert.equal(recorrencia.dataFim, "2026-12-31");
});
