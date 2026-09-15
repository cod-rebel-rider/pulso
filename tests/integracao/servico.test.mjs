/**
 * PULSO — Testes de integração: Serviços (Fase 10.1)
 *
 * Cobertura: criação, edição, ciclo de vida (ativar/desativar/arquivar),
 * filtros, isolamento por jogador, persistência e o TESTE CRÍTICO da
 * subfase: criar/editar um serviço NÃO altera o sistema financeiro
 * (nenhuma transação, nenhum movimento de saldo).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { aplicarMigracoes } from "../../src/core/database/migracoes.js";
import { RepositorioJogador } from "../../src/core/database/repositorios/jogador.js";
import { RepositorioServico } from "../../src/core/database/repositorios/servico.js";
import { RepositorioCarteira } from "../../src/core/database/repositorios/carteira.js";
import { RepositorioTransacao } from "../../src/core/database/repositorios/transacao.js";
import { RepositorioOrcamento } from "../../src/core/database/repositorios/orcamento.js";
import { ServicoFinanca } from "../../src/core/aplicacao/servico-financa.js";
import { ServicoJogador } from "../../src/core/aplicacao/servico-jogador.js";
import { ServicoServicos } from "../../src/core/aplicacao/servico-servicos.js";
import { ErroValidacao, ErroConflito, ErroTransicao } from "../../src/core/erros.js";

/**
 * Cria um ambiente isolado: banco temporário + serviços. O serviço de
 * serviços NÃO depende do motor financeiro — a dependência só existe
 * aqui nos testes para PROVAR que não há interação.
 */
function criarAmbiente() {
  const dir = mkdtempSync(join(tmpdir(), "pulso-servico-"));
  const db = new DatabaseSync(join(dir, "pulso.db"));
  db.exec("PRAGMA foreign_keys = ON");
  aplicarMigracoes(db);

  const repositorioJogador = new RepositorioJogador(db);
  const servicoFinanca = new ServicoFinanca({
    repositorioCarteira: new RepositorioCarteira(db),
    repositorioTransacao: new RepositorioTransacao(db),
    repositorioOrcamento: new RepositorioOrcamento(db),
    repositorioJogador,
  });
  const servicoJogador = new ServicoJogador({
    repositorio: repositorioJogador,
    banco: db,
    aoCriar: (j) => servicoFinanca.criarCarteiraInicial(j.id),
  });
  const servicoServicos = new ServicoServicos({
    repositorio: new RepositorioServico(db),
    repositorioJogador,
  });
  return { dir, db, servicoJogador, servicoFinanca, servicoServicos, repositorioJogador };
}

function liberar({ dir, db }) {
  try {
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---- Criação ----
test("serviço: criar, persistir, recuperar e associar ao jogador", () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: "Operador" });
    const servico = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Internet",
      fornecedor: "Claro",
      categoria: "telecomunicacoes",
      descricao: "Plano residencial de 500 Mbps",
      valorEsperado: 12000,
    });
    assert.ok(servico.id);
    assert.equal(servico.jogadorId, jogador.id);
    assert.equal(servico.estado, "ativo");
    assert.equal(servico.valorEsperado, 12000);
    assert.equal(servico.fornecedor, "Claro");

    const relido = ambiente.servicoServicos.obter(servico.id);
    assert.equal(relido.nome, "Internet");
    assert.equal(relido.categoria, "telecomunicacoes");
    assert.equal(relido.arquivadoEm, null);

    const linha = ambiente.db.prepare("SELECT estado, arquivado_em FROM servico WHERE id = ?").get(servico.id);
    assert.equal(linha.estado, "ativo");
    assert.equal(linha.arquivado_em, null);
  } finally {
    liberar(ambiente);
  }
});

// ---- TESTE CRÍTICO da subfase ----
test("CRÍTICO: criar e editar serviço não altera saldo nem cria transações", () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: "Financeiro" });
    // saldo inicial de R$ 1.000,00 via receita registrada
    ambiente.servicoFinanca.criarTransacao(jogador.id, {
      tipo: "receita",
      valorCentavos: 100000,
      categoria: "saldo_inicial",
      descricao: "Saldo inicial",
      data: "2026-09-01",
    });
    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 100000);

    const servico = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Internet",
      categoria: "telecomunicacoes",
      valorEsperado: 12000,
    });
    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 100000);

    ambiente.servicoServicos.atualizar(servico.id, { valorEsperado: 13000 });
    ambiente.servicoServicos.desativar(servico.id);
    ambiente.servicoServicos.ativar(servico.id);
    ambiente.servicoServicos.arquivar(servico.id);

    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 100000);
    assert.equal(ambiente.servicoFinanca.listarTransacoes(jogador.id).length, 1);
    const transacoes = ambiente.db.prepare("SELECT COUNT(*) AS n FROM transacao").get().n;
    assert.equal(transacoes, 1, "nenhuma transação nova criada por operações de serviço");
  } finally {
    liberar(ambiente);
  }
});

// ---- Validação ----
test("serviço: validações de criação", () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: "Validador" });
    const base = { categoria: "contas", valorEsperado: 5000 };
    assert.throws(() => ambiente.servicoServicos.criar(jogador.id, { ...base, nome: "" }), ErroValidacao);
    assert.throws(() => ambiente.servicoServicos.criar(jogador.id, { ...base, nome: "X", categoria: "jardinagem" }), ErroValidacao);
    assert.throws(() => ambiente.servicoServicos.criar(jogador.id, { ...base, nome: "X", valorEsperado: -100 }), ErroValidacao);
    assert.throws(() => ambiente.servicoServicos.criar(jogador.id, { ...base, nome: "X", valorEsperado: 0 }), ErroValidacao);
    assert.throws(() => ambiente.servicoServicos.criar(jogador.id, { ...base, nome: "X", valorEsperado: "abc" }), ErroValidacao);
    assert.throws(() => ambiente.servicoServicos.criar(jogador.id, { ...base, nome: "X", valorEsperado: null }), ErroValidacao);
    assert.throws(
      () => ambiente.servicoServicos.criar(999, { nome: "X", categoria: "contas", valorEsperado: 100 }),
      ErroConflito,
    );
    assert.equal(ambiente.db.prepare("SELECT COUNT(*) AS n FROM servico").get().n, 0);
  } finally {
    liberar(ambiente);
  }
});

// ---- Edição ----
test("serviço: edição altera campos e atualiza atualizado_em", async () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: "Editor" });
    const servico = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Energia elétrica",
      categoria: "contas",
      valorEsperado: 18000,
    });
    const criado = servico.criadoEm;
    await new Promise((resolver) => setTimeout(resolver, 15));

    const editado = ambiente.servicoServicos.atualizar(servico.id, {
      nome: "Energia elétrica (casa)",
      fornecedor: "Enel",
      categoria: "moradia",
      descricao: "Média mensal estimada",
      valorEsperado: 21000,
    });
    assert.equal(editado.nome, "Energia elétrica (casa)");
    assert.equal(editado.fornecedor, "Enel");
    assert.equal(editado.categoria, "moradia");
    assert.equal(editado.descricao, "Média mensal estimada");
    assert.equal(editado.valorEsperado, 21000);
    assert.equal(editado.criadoEm, criado, "criado_em é imutável");
    assert.ok(editado.atualizadoEm > editado.criadoEm, "atualizado_em avança");

    const limpo = ambiente.servicoServicos.atualizar(servico.id, { descricao: null });
    assert.equal(limpo.descricao, null);
    const semFornecedor = ambiente.servicoServicos.atualizar(servico.id, { fornecedor: null });
    assert.equal(semFornecedor.fornecedor, null);

    assert.throws(() => ambiente.servicoServicos.atualizar(servico.id, {}), ErroValidacao);
    assert.throws(() => ambiente.servicoServicos.atualizar(servico.id, { estado: "inativo" }), ErroValidacao);
    assert.throws(() => ambiente.servicoServicos.atualizar(servico.id, { valorEsperado: 0 }), ErroValidacao);
  } finally {
    liberar(ambiente);
  }
});

// ---- Ciclo de vida ----
test("serviço: ciclo ativo → inativo → ativo", () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: "Ciclo" });
    const servico = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Academia",
      categoria: "saude",
      valorEsperado: 9900,
    });
    const inativo = ambiente.servicoServicos.desativar(servico.id);
    assert.equal(inativo.estado, "inativo");
    const reativado = ambiente.servicoServicos.ativar(servico.id);
    assert.equal(reativado.estado, "ativo");
    assert.equal(reativado.arquivadoEm, null);
  } finally {
    liberar(ambiente);
  }
});

test("serviço: arquivamento preenche arquivado_em e bloqueia edição/reativação", () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: "Arquivador" });
    const a = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Streaming",
      categoria: "assinaturas",
      valorEsperado: 3990,
    });
    const arquivado = ambiente.servicoServicos.arquivar(a.id);
    assert.equal(arquivado.estado, "arquivado");
    assert.ok(arquivado.arquivadoEm);

    const linha = ambiente.db.prepare("SELECT * FROM servico WHERE id = ?").get(a.id);
    assert.ok(linha, "registro permanece no banco (sem apagamento físico)");
    assert.equal(linha.estado, "arquivado");
    assert.ok(linha.arquivado_em);

    assert.throws(() => ambiente.servicoServicos.ativar(a.id), ErroTransicao);
    assert.throws(() => ambiente.servicoServicos.desativar(a.id), ErroTransicao);
    assert.throws(() => ambiente.servicoServicos.arquivar(a.id), ErroTransicao);
    assert.throws(() => ambiente.servicoServicos.atualizar(a.id, { nome: "Novo" }), ErroValidacao);

    // inativo → arquivado também é permitido
    const b = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Telefone fixo",
      categoria: "telecomunicacoes",
      valorEsperado: 8000,
    });
    ambiente.servicoServicos.desativar(b.id);
    const bArquivado = ambiente.servicoServicos.arquivar(b.id);
    assert.equal(bArquivado.estado, "arquivado");
  } finally {
    liberar(ambiente);
  }
});

// ---- Filtros ----
test("serviço: filtros por estado e categoria", () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: "Filtrador" });
    const internet = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Internet", categoria: "telecomunicacoes", valorEsperado: 12000,
    });
    const netflix = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Netflix", categoria: "assinaturas", valorEsperado: 3990,
    });
    const agua = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Água", categoria: "contas", valorEsperado: 6500,
    });
    ambiente.servicoServicos.desativar(netflix.id);
    ambiente.servicoServicos.arquivar(internet.id);

    const todos = ambiente.servicoServicos.listar(jogador.id);
    assert.equal(todos.length, 3);
    const ativos = ambiente.servicoServicos.listar(jogador.id, { estado: "ativo" });
    assert.deepEqual(ativos.map((s) => s.nome), ["Água"]);
    const inativos = ambiente.servicoServicos.listar(jogador.id, { estado: "inativo" });
    assert.deepEqual(inativos.map((s) => s.nome), ["Netflix"]);
    const arquivados = ambiente.servicoServicos.listar(jogador.id, { estado: "arquivado" });
    assert.deepEqual(arquivados.map((s) => s.nome), ["Internet"]);
    const porCategoria = ambiente.servicoServicos.listar(jogador.id, { categoria: "assinaturas" });
    assert.deepEqual(porCategoria.map((s) => s.nome), ["Netflix"]);
    const combinado = ambiente.servicoServicos.listar(jogador.id, {
      estado: "ativo", categoria: "contas",
    });
    assert.deepEqual(combinado.map((s) => s.nome), ["Água"]);
    assert.ok(agua.id);
  } finally {
    liberar(ambiente);
  }
});

// ---- Isolamento ----
test("serviço: isolamento por jogador (consulta de outro jogador não enxerga)", () => {
  const ambiente = criarAmbiente();
  try {
    const dono = ambiente.servicoJogador.criar({ nome: "Dono" });
    // PULSO é single-player: o segundo jogador só existe para provar o
    // isolamento e, para não conflitar com o travamento de jogador único da
    // camada de aplicação, é criado direto pelo repositório.
    const outro = ambiente.repositorioJogador.criar({ nome: "Outro", codinome: null });
    const servico = ambiente.servicoServicos.criar(dono.id, {
      nome: "Internet",
      categoria: "telecomunicacoes",
      valorEsperado: 12000,
    });
    // listagens são SEMPRE escopadas por jogador_id no SQL
    assert.equal(ambiente.servicoServicos.listar(outro.id).length, 0);
    assert.equal(ambiente.servicoServicos.listar(dono.id).length, 1);
    const relido = ambiente.servicoServicos.obter(servico.id);
    assert.equal(relido.jogadorId, dono.id, "o serviço permanece vinculado ao dono");
    // listar de jogador inexistente é rejeitado
    assert.throws(() => ambiente.servicoServicos.listar(999), ErroConflito);
  } finally {
    liberar(ambiente);
  }
});

// ---- Resumo ----
test("serviço: resumo com contagens e custo estimado dos ativos", () => {
  const ambiente = criarAmbiente();
  try {
    const jogador = ambiente.servicoJogador.criar({ nome: "Resumo" });
    const internet = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Internet", categoria: "telecomunicacoes", valorEsperado: 12000,
    });
    ambiente.servicoServicos.criar(jogador.id, {
      nome: "Netflix", categoria: "assinaturas", valorEsperado: 3990,
    });
    ambiente.servicoServicos.criar(jogador.id, {
      nome: "Antigo", categoria: "outros", valorEsperado: 5000,
    });
    ambiente.servicoServicos.desativar(internet.id);

    const resumo = ambiente.servicoServicos.resumo(jogador.id);
    assert.equal(resumo.ativos, 2); // Netflix + Antigo
    assert.equal(resumo.inativos, 1); // Internet desativada
    assert.equal(resumo.arquivados, 0);
    assert.equal(resumo.total, 3);
    assert.equal(resumo.custoEstimadoAtivos, 8990); // 3990 + 5000 (estimativa)
  } finally {
    liberar(ambiente);
  }
});

// ---- Persistência ----
test("serviço: persistência — fechar e reabrir o banco mantém os serviços", () => {
  const dir = mkdtempSync(join(tmpdir(), "pulso-servico-persistente-"));
  let db = new DatabaseSync(join(dir, "pulso.db"));
  try {
    db.exec("PRAGMA foreign_keys = ON");
    aplicarMigracoes(db);
    const repositorioJogador = new RepositorioJogador(db);
    const servicoServicos = new ServicoServicos({
      repositorio: new RepositorioServico(db),
      repositorioJogador,
    });
    const servicoJogador = new ServicoJogador({
      repositorio: repositorioJogador,
      banco: db,
      aoCriar: () => {},
    });
    const criado = servicoJogador.criar({ nome: "Persistente" });
    const servico = servicoServicos.criar(criado.id, {
      nome: "Energia elétrica",
      fornecedor: "Enel",
      categoria: "contas",
      valorEsperado: 18000,
    });
    servicoServicos.desativar(servico.id);
    db.close();

    // reabre o MESMO arquivo
    db = new DatabaseSync(join(dir, "pulso.db"));
    db.exec("PRAGMA foreign_keys = ON");
    const repositorioJogador2 = new RepositorioJogador(db);
    const servicoServicos2 = new ServicoServicos({
      repositorio: new RepositorioServico(db),
      repositorioJogador: repositorioJogador2,
    });
    const relido = servicoServicos2.obter(servico.id);
    assert.equal(relido.nome, "Energia elétrica");
    assert.equal(relido.fornecedor, "Enel");
    assert.equal(relido.valorEsperado, 18000);
    assert.equal(relido.estado, "inativo");
    assert.equal(servicoServicos2.listar(criado.id, { estado: "inativo" }).length, 1);
    assert.equal(relido.jogadorId, criado.id);
  } finally {
    try { db.close(); } catch { /* já fechado */ }
    rmSync(dir, { recursive: true, force: true });
  }
});
