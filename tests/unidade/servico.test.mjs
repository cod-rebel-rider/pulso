/**
 * PULSO — Testes unitários: domínio de Serviços (Fase 10.1)
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIAS_SERVICO,
  CATEGORIAS_SERVICO_VALORES,
  ROTULO_CATEGORIA_SERVICO,
  validarCategoriaServico,
  ESTADOS_SERVICO,
  ESTADOS_SERVICO_ORDEM,
  ESTADOS_SERVICO_ROTULOS,
  ESTADO_SERVICO_INICIAL,
  validarEstadoServico,
  transicaoServicoPermitida,
  exigirTransicaoServico,
  servicoArquivado,
  validarNomeServico,
  validarFornecedorServico,
  validarDescricaoServico,
  validarValorEsperado,
  validarServicoCriacao,
  validarServicoEdicao,
  paraServico,
} from "../../src/core/dominio/servico.js";
import { ErroValidacao, ErroTransicao } from "../../src/core/erros.js";

// ---- Categorias ----
test("categorias do serviço: lista controlada com rótulos", () => {
  assert.deepEqual(CATEGORIAS_SERVICO_VALORES, [
    "moradia", "contas", "telecomunicacoes", "assinaturas", "tecnologia",
    "educacao", "saude", "transporte", "lazer", "trabalho", "outros",
  ]);
  assert.equal(ROTULO_CATEGORIA_SERVICO.telecomunicacoes, "TELECOMUNICAÇÕES");
  assert.equal(ROTULO_CATEGORIA_SERVICO.contas, "CONTAS");
  assert.equal(validarCategoriaServico("telecomunicacoes"), "telecomunicacoes");
  assert.throws(() => validarCategoriaServico("inexistente"), ErroValidacao);
  assert.throws(() => validarCategoriaServico(null), ErroValidacao);
});

// ---- Estados e transições ----
test("estados do serviço: rotulos, ordem e estado inicial ATIVO", () => {
  assert.deepEqual(ESTADOS_SERVICO_ORDEM, ["ativo", "inativo", "arquivado"]);
  assert.equal(ESTADO_SERVICO_INICIAL, "ativo");
  assert.equal(ESTADOS_SERVICO_ROTULOS.arquivado, "Arquivado");
  assert.throws(() => validarEstadoServico("encerrado"), ErroValidacao);
});

test("transições válidas do ciclo de vida do serviço", () => {
  assert.equal(transicaoServicoPermitida("ativo", "inativo"), true);
  assert.equal(transicaoServicoPermitida("inativo", "ativo"), true);
  assert.equal(transicaoServicoPermitida("ativo", "arquivado"), true);
  assert.equal(transicaoServicoPermitida("inativo", "arquivado"), true);
});

test("transições inválidas são bloqueadas (arquivado é terminal)", () => {
  assert.equal(transicaoServicoPermitida("arquivado", "ativo"), false);
  assert.equal(transicaoServicoPermitida("arquivado", "inativo"), false);
  assert.equal(transicaoServicoPermitida("ativo", "ativo"), false);
  assert.equal(transicaoServicoPermitida("inativo", "inativo"), false);
  assert.throws(() => exigirTransicaoServico("arquivado", "ativo"), ErroTransicao);
  assert.doesNotThrow(() => exigirTransicaoServico("ativo", "arquivado"));
});

test("servicoArquivado marca apenas o estado terminal", () => {
  assert.equal(servicoArquivado("arquivado"), true);
  assert.equal(servicoArquivado("ativo"), false);
  assert.equal(servicoArquivado("inativo"), false);
});

// ---- Campos ----
test("nome do serviço: obrigatório, aparado e limitado", () => {
  assert.equal(validarNomeServico("Internet"), "Internet");
  assert.equal(validarNomeServico("  Energia elétrica  "), "Energia elétrica");
  assert.throws(() => validarNomeServico(""), ErroValidacao);
  assert.throws(() => validarNomeServico("   "), ErroValidacao);
  assert.throws(() => validarNomeServico(null), ErroValidacao);
  assert.throws(() => validarNomeServico(42), ErroValidacao);
  assert.throws(() => validarNomeServico("a".repeat(121)), ErroValidacao);
  assert.equal(validarNomeServico("a".repeat(120)), "a".repeat(120));
});

test("fornecedor: opcional, aparado e limitado", () => {
  assert.equal(validarFornecedorServico(null), null);
  assert.equal(validarFornecedorServico(undefined), null);
  assert.equal(validarFornecedorServico(""), null);
  assert.equal(validarFornecedorServico("   "), null);
  assert.equal(validarFornecedorServico("  Claro  "), "Claro");
  assert.throws(() => validarFornecedorServico(123), ErroValidacao);
  assert.throws(() => validarFornecedorServico("a".repeat(121)), ErroValidacao);
});

test("descrição: opcional, aparada e limitada", () => {
  assert.equal(validarDescricaoServico(null), null);
  assert.equal(validarDescricaoServico(""), null);
  assert.equal(validarDescricaoServico(" Plano de 500 Mbps "), "Plano de 500 Mbps");
  assert.throws(() => validarDescricaoServico([]), ErroValidacao);
  assert.throws(() => validarDescricaoServico("a".repeat(2001)), ErroValidacao);
});

test("valor esperado: centavos inteiros maiores que zero", () => {
  assert.equal(validarValorEsperado(12000), 12000);
  assert.throws(() => validarValorEsperado(0), ErroValidacao);
  assert.throws(() => validarValorEsperado(-100), ErroValidacao);
  assert.throws(() => validarValorEsperado("abc"), ErroValidacao);
  assert.throws(() => validarValorEsperado(null), ErroValidacao);
  assert.throws(() => validarValorEsperado(99.9), ErroValidacao);
  assert.throws(() => validarValorEsperado(1.5), ErroValidacao);
});

// ---- Criação e edição ----
test("validarServicoCriacao: campos completos e padrões", () => {
  const dados = validarServicoCriacao({
    nome: "Internet",
    fornecedor: "Claro",
    categoria: "telecomunicacoes",
    descricao: "Plano residencial de 500 Mbps",
    valorEsperado: 12000,
  });
  assert.equal(dados.nome, "Internet");
  assert.equal(dados.fornecedor, "Claro");
  assert.equal(dados.valorEsperado, 12000);

  const minimo = validarServicoCriacao({ nome: "Água", categoria: "contas", valorEsperado: 5000 });
  assert.equal(minimo.fornecedor, null);
  assert.equal(minimo.descricao, null);

  assert.throws(
    () => validarServicoCriacao({ nome: "X", categoria: "contas", valorEsperado: 0 }),
    ErroValidacao,
  );
  assert.throws(
    () => validarServicoCriacao({ nome: "X", categoria: "jardinagem", valorEsperado: 100 }),
    ErroValidacao,
  );
});

test("validarServicoEdicao: parcial e validado", () => {
  const soValor = validarServicoEdicao({ valorEsperado: 13000 });
  assert.deepEqual(soValor, { valorEsperado: 13000 });
  const vazio = validarServicoEdicao({});
  assert.deepEqual(vazio, {});
  assert.throws(() => validarServicoEdicao({ valorEsperado: -5 }), ErroValidacao);
  assert.throws(() => validarServicoEdicao({ categoria: "errada" }), ErroValidacao);
  assert.equal(validarServicoEdicao({ fornecedor: "  " }).fornecedor, null);
});

// ---- Conversor ----
test("paraServico: converte linha do banco em objeto camelCase", () => {
  const servico = paraServico({
    id: 1,
    jogador_id: 1,
    nome: "Internet",
    descricao: "Plano residencial",
    fornecedor: "Claro",
    categoria: "telecomunicacoes",
    valor_esperado_centavos: 12000,
    estado: "ativo",
    criado_em: "2026-09-15T10:00:00.000Z",
    atualizado_em: "2026-09-15T10:00:00.000Z",
    arquivado_em: null,
  });
  assert.equal(servico.id, 1);
  assert.equal(servico.jogadorId, 1);
  assert.equal(servico.valorEsperado, 12000);
  assert.equal(servico.estado, "ativo");
  assert.equal(servico.arquivadoEm, null);
});

test("paraServico: arquivado preserva arquivadoEm e null devolve null", () => {
  const servico = paraServico({
    id: 2,
    jogador_id: 1,
    nome: "Streaming",
    descricao: null,
    fornecedor: null,
    categoria: "assinaturas",
    valor_esperado_centavos: 3990,
    estado: "arquivado",
    criado_em: "2026-09-01T10:00:00.000Z",
    atualizado_em: "2026-09-10T10:00:00.000Z",
    arquivado_em: "2026-09-10T10:00:00.000Z",
  });
  assert.equal(servico.arquivadoEm, "2026-09-10T10:00:00.000Z");
  assert.equal(servico.fornecedor, null);
  assert.equal(paraServico(null), null);
});
