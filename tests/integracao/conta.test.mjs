/**
 * PULSO — Testes de integração: Contas / Despesas (Fase 10.2)
 *
 * Cobre: cadastro, persistência, consulta, edição, cancelamento, relação
 * com o serviço, valores em centavos, datas (futura/pendente/vencida),
 * status derivado, filtros, isolamento por jogador e o TESTE OBRIGATÓRIO:
 * criar uma conta NÃO altera o saldo e NÃO cria transação.
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
import { RepositorioConta } from "../../src/core/database/repositorios/conta.js";
import { RepositorioCarteira } from "../../src/core/database/repositorios/carteira.js";
import { RepositorioTransacao } from "../../src/core/database/repositorios/transacao.js";
import { RepositorioOrcamento } from "../../src/core/database/repositorios/orcamento.js";
import { ServicoFinanca } from "../../src/core/aplicacao/servico-financa.js";
import { ServicoJogador } from "../../src/core/aplicacao/servico-jogador.js";
import { ServicoServicos } from "../../src/core/aplicacao/servico-servicos.js";
import { ServicoContas } from "../../src/core/aplicacao/servico-contas.js";
import { ErroValidacao, ErroConflito, ErroTransicao } from "../../src/core/erros.js";

/** Monta um ambiente isolado (banco temporário + serviços do núcleo). */
function criarAmbiente() {
  const dir = mkdtempSync(join(tmpdir(), "pulso-conta-"));
  const db = new DatabaseSync(join(dir, "pulso.db"));
  db.exec("PRAGMA foreign_keys = ON");
  aplicarMigracoes(db);

  const repositorioJogador = new RepositorioJogador(db);
  const repositorioServico = new RepositorioServico(db);
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
    repositorio: repositorioServico,
    repositorioJogador,
  });
  const servicoContas = new ServicoContas({
    repositorio: new RepositorioConta(db),
    repositorioServico,
    repositorioJogador,
  });
  return { dir, db, servicoJogador, servicoFinanca, servicoServicos, servicoContas, repositorioJogador };
}

function liberar({ dir, db }) {
  try {
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Jogador + serviço "Internet" prontos para receber contas. */
function prepararCenario(ambiente, nome = "Operador") {
  const jogador = ambiente.servicoJogador.criar({ nome });
  const servico = ambiente.servicoServicos.criar(jogador.id, {
    nome: "Internet",
    categoria: "telecomunicacoes",
    valorEsperado: 12000,
  });
  return { jogador, servico };
}

// ---- Cadastro / consulta / edição ----
test("conta: criar, persistir, consultar e editar", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const conta = ambiente.servicoContas.criar(jogador.id, {
      servicoId: servico.id,
      referencia: "2026-09",
      descricao: "Fatura de setembro",
      valorEsperado: 12000,
      vencimento: "2026-09-15",
    });
    assert.ok(conta.id);
    assert.equal(conta.jogadorId, jogador.id);
    assert.equal(conta.servicoId, servico.id);
    assert.equal(conta.referencia, "2026-09");
    assert.equal(conta.valorEsperado, 12000);
    assert.equal(conta.vencimento, "2026-09-15");
    assert.equal(conta.estado, "pendente");
    assert.equal(conta.canceladoEm, null);

    const relida = ambiente.servicoContas.obter(conta.id);
    assert.equal(relida.descricao, "Fatura de setembro");
    assert.equal(relida.vencimento, "2026-09-15");

    const editada = ambiente.servicoContas.atualizar(conta.id, {
      descricao: "Fatura revisada",
      valorEsperado: 13500,
      vencimento: "2026-09-20",
    });
    assert.equal(editada.valorEsperado, 13500);
    assert.equal(editada.vencimento, "2026-09-20");
    assert.equal(editada.descricao, "Fatura revisada");
    assert.equal(editada.referencia, "2026-09"); // idêntica
    assert.notEqual(editada.atualizadoEm, null);
  } finally {
    liberar(ambiente);
  }
});

test("conta: a mesma ocorrência (serviço + referência) não pode duplicar; referências diferentes coexistem", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    ambiente.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-09", valorEsperado: 12000, vencimento: "2026-09-15",
    });
    assert.throws(
      () => ambiente.servicoContas.criar(jogador.id, {
        servicoId: servico.id, referencia: "2026-09", valorEsperado: 12000, vencimento: "2026-09-15",
      }),
      ErroConflito,
    );
    const outubro = ambiente.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-10", valorEsperado: 12500, vencimento: "2026-10-15",
    });
    assert.equal(outubro.referencia, "2026-10");
    assert.equal(ambiente.servicoContas.listar(jogador.id).length, 2);
  } finally {
    liberar(ambiente);
  }
});

// ---- Relação com o serviço ----
test("relação: serviço válido, inexistente e de outro jogador", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente, "Dono");
    const valida = ambiente.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-09", valorEsperado: 12000, vencimento: "2026-09-15",
    });
    assert.equal(valida.servicoId, servico.id);

    // serviço inexistente
    assert.throws(
      () => ambiente.servicoContas.criar(jogador.id, {
        servicoId: 9999, referencia: "2026-09", valorEsperado: 100, vencimento: "2026-09-15",
      }),
      ErroConflito,
    );

    // serviço pertencente a outro jogador: cria o segundo jogador direto no
    // banco (a camada de aplicação impõe single-player) e um serviço dele
    ambiente.db.prepare("INSERT INTO jogador (nome) VALUES ('Intruso')").run();
    const jogador2 = ambiente.repositorioJogador.buscarPorId(2);
    assert.ok(jogador2);
    const servicoAlheio = ambiente.servicoServicos.criar(jogador2.id, {
      nome: "Energia do intruso", categoria: "contas", valorEsperado: 9000,
    });
    assert.throws(
      () => ambiente.servicoContas.criar(jogador.id, {
        servicoId: servicoAlheio.id, referencia: "2026-09", valorEsperado: 100, vencimento: "2026-09-15",
      }),
      ErroValidacao,
      "não é possível vincular a conta a um serviço de outro jogador",
    );
  } finally {
    liberar(ambiente);
  }
});
// ---- Valores ----
test("valores: centavos; valor negativo e valor inválido são rejeitados", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente, "Valores");
    const conta = ambiente.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-09", valorEsperado: 12000, vencimento: "2026-09-15",
    });
    assert.equal(conta.valorEsperado, 12000, "R$ 120,00 → 12000 centavos");
    assert.throws(
      () => ambiente.servicoContas.criar(jogador.id, {
        servicoId: servico.id, referencia: "2026-10", valorEsperado: -100, vencimento: "2026-10-15",
      }),
      ErroValidacao,
    );
    assert.throws(
      () => ambiente.servicoContas.criar(jogador.id, {
        servicoId: servico.id, referencia: "2026-11", valorEsperado: "abc", vencimento: "2026-11-15",
      }),
      ErroValidacao,
    );
    assert.throws(
      () => ambiente.servicoContas.criar(jogador.id, {
        servicoId: servico.id, referencia: "2026-12", valorEsperado: 99.9, vencimento: "2026-12-15",
      }),
      ErroValidacao,
    );
  } finally {
    liberar(ambiente);
  }
});

// ---- Datas e status derivado ----
test("datas: conta futura, que vence hoje e vencida (VENCIDA é derivada, não persistida)", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente, "Datas");
    const base = { servicoId: servico.id, valorEsperado: 12000 };
    const futura = ambiente.servicoContas.criar(jogador.id, { ...base, referencia: "2026-09", vencimento: "2026-09-30" });
    const hoje = ambiente.servicoContas.criar(jogador.id, { ...base, referencia: "2026-10", vencimento: "2026-10-15" });
    const vencida = ambiente.servicoContas.criar(jogador.id, { ...base, referencia: "2026-08", vencimento: "2026-08-15" });

    const referencia = "2026-09-15";
    assert.equal(ambiente.servicoContas.listar(jogador.id, { hoje: referencia }).find((c) => c.id === futura.id).situacao, "pendente");
    assert.equal(ambiente.servicoContas.listar(jogador.id, { hoje: referencia }).find((c) => c.id === hoje.id).situacao, "pendente");
    const vencidas = ambiente.servicoContas.listarVencidas(jogador.id, { hoje: referencia });
    assert.equal(vencidas.length, 1);
    assert.equal(vencidas[0].id, vencida.id);
    assert.equal(vencidas[0].situacao, "vencida");
    assert.equal(vencidas[0].estado, "pendente", "o banco permanece pendente — VENCIDA não é gravada");
    const persistido = ambiente.db.prepare("SELECT estado FROM servico_conta WHERE id = ?").get(vencida.id);
    assert.equal(persistido.estado, "pendente", "nenhuma alteração automática por passagem de data");
  } finally {
    liberar(ambiente);
  }
});

// ---- Cancelamento ----
test("status: cancelamento marca CANCELADA + cancelado_em e não apaga o registro", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente, "Cancelamento");
    const conta = ambiente.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-09", valorEsperado: 12000, vencimento: "2026-09-15",
    });
    const cancelada = ambiente.servicoContas.cancelar(conta.id);
    assert.equal(cancelada.estado, "cancelada");
    assert.equal(cancelada.situacao, "cancelada");
    assert.ok(cancelada.canceladoEm, "cancelado_em preenchido");
    assert.equal(ambiente.servicoContas.obter(conta.id).estado, "cancelada", "registro permanece no banco");
    // operações inválidas
    assert.throws(() => ambiente.servicoContas.cancelar(conta.id), ErroTransicao, "não cancela duas vezes");
    assert.throws(() => ambiente.servicoContas.atualizar(conta.id, { valorEsperado: 13000 }), ErroValidacao, "conta cancelada não é editada");
  } finally {
    liberar(ambiente);
  }
});

test("status: edição não pode mudar serviço, jogador nem estado", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente, "Identidade");
    const conta = ambiente.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-09", valorEsperado: 12000, vencimento: "2026-09-15",
    });
    assert.throws(() => ambiente.servicoContas.atualizar(conta.id, { estado: "cancelada" }), ErroValidacao);
    assert.throws(() => ambiente.servicoContas.atualizar(conta.id, { servicoId: servico.id + 1 }), ErroValidacao);
    assert.throws(() => ambiente.servicoContas.atualizar(conta.id, { jogadorId: jogador.id + 1 }), ErroValidacao);
    assert.throws(() => ambiente.servicoContas.atualizar(conta.id, {}), ErroValidacao, "nada para atualizar");
  } finally {
    liberar(ambiente);
  }
});


// ---- Filtros ----
test("filtros: TODAS, PENDENTES, VENCIDAS, CANCELADAS e por serviço", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente, "Filtros");
    const outroServico = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Energia", categoria: "contas", valorEsperado: 18000,
    });
    const base = { valorEsperado: 12000 };
    const pendente = ambiente.servicoContas.criar(jogador.id, { ...base, servicoId: servico.id, referencia: "2026-09", vencimento: "2026-09-30" });
    const vencida = ambiente.servicoContas.criar(jogador.id, { ...base, servicoId: servico.id, referencia: "2026-08", vencimento: "2026-08-15" });
    const cancelada = ambiente.servicoContas.criar(jogador.id, { ...base, servicoId: outroServico.id, referencia: "2026-09", vencimento: "2026-09-20" });
    ambiente.servicoContas.cancelar(cancelada.id);

    const hoje = "2026-09-15";
    assert.equal(ambiente.servicoContas.listar(jogador.id, { hoje }).length, 3);
    assert.deepEqual(ambiente.servicoContas.listarPendentes(jogador.id, { hoje }).map((c) => c.id), [pendente.id]);
    assert.deepEqual(ambiente.servicoContas.listarVencidas(jogador.id, { hoje }).map((c) => c.id), [vencida.id]);
    assert.deepEqual(ambiente.servicoContas.listarCanceladas(jogador.id, { hoje }).map((c) => c.id), [cancelada.id]);
    assert.deepEqual(
      ambiente.servicoContas.listar(jogador.id, { servicoId: servico.id, hoje }).map((c) => c.id).sort((a, b) => a - b),
      [pendente.id, vencida.id].sort((a, b) => a - b),
    );
    const resumo = ambiente.servicoContas.resumo(jogador.id, { hoje });
    assert.equal(resumo.total, 3);
    assert.equal(resumo.pendentes, 1);
    assert.equal(resumo.vencidas, 1);
    assert.equal(resumo.canceladas, 1);
    assert.equal(resumo.valorEsperadoEmAberto, 24000); // 12000 (pendente) + 12000 (vencida)
  } finally {
    liberar(ambiente);
  }
});

// ---- Financeiro (obrigatório) ----
test("CRÍTICO: criar e cancelar conta não altera o saldo nem cria transação", () => {
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
    const servico = ambiente.servicoServicos.criar(jogador.id, {
      nome: "Internet", categoria: "telecomunicacoes", valorEsperado: 12000,
    });
    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 100000, "saldo antes: R$ 1.000,00");
    const transacoesAntes = ambiente.db.prepare("SELECT COUNT(*) AS n FROM transacao").get().n;

    const conta = ambiente.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-09", valorEsperado: 12000, vencimento: "2026-09-15",
    });
    assert.equal(conta.valorEsperado, 12000, "conta de R$ 120,00");

    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 100000, "saldo depois: R$ 1.000,00");
    assert.equal(ambiente.servicoFinanca.listarTransacoes(jogador.id).length, 1);
    assert.equal(
      ambiente.db.prepare("SELECT COUNT(*) AS n FROM transacao").get().n,
      transacoesAntes,
      "nenhuma transação foi criada ao cadastrar a conta",
    );

    ambiente.servicoContas.atualizar(conta.id, { valorEsperado: 13500, vencimento: "2026-09-20" });
    ambiente.servicoContas.cancelar(conta.id);

    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 100000, "editar/cancelar também não movimenta o saldo");
    assert.equal(ambiente.db.prepare("SELECT COUNT(*) AS n FROM transacao").get().n, transacoesAntes);
  } finally {
    liberar(ambiente);
  }
});

// ---- Persistência ----
test("conta: persistência — fechar e reabrir o banco mantém as contas", () => {
  const dir = mkdtempSync(join(tmpdir(), "pulso-conta-persistente-"));
  let db = new DatabaseSync(join(dir, "pulso.db"));
  try {
    db.exec("PRAGMA foreign_keys = ON");
    aplicarMigracoes(db);
    const repositorioJogador = new RepositorioJogador(db);
    const repositorioServico = new RepositorioServico(db);
    const servicoServicos = new ServicoServicos({ repositorio: repositorioServico, repositorioJogador });
    const servicoJogador = new ServicoJogador({ repositorio: repositorioJogador, banco: db, aoCriar: () => {} });
    const servicoContas = new ServicoContas({
      repositorio: new RepositorioConta(db), repositorioServico, repositorioJogador,
    });
    const jogador = servicoJogador.criar({ nome: "Persistente" });
    const servico = servicoServicos.criar(jogador.id, {
      nome: "Internet", categoria: "telecomunicacoes", valorEsperado: 12000,
    });
    const conta = servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-09", descricao: "Fatura", valorEsperado: 12000, vencimento: "2026-09-15",
    });
    const canceladaDepois = servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-08", valorEsperado: 11000, vencimento: "2026-08-15",
    });
    servicoContas.cancelar(canceladaDepois.id);
    db.close();

    // reabre o MESMO arquivo
    db = new DatabaseSync(join(dir, "pulso.db"));
    db.exec("PRAGMA foreign_keys = ON");
    const repositorioJogador2 = new RepositorioJogador(db);
    const repositorioServico2 = new RepositorioServico(db);
    const servicoContas2 = new ServicoContas({
      repositorio: new RepositorioConta(db),
      repositorioServico: repositorioServico2,
      repositorioJogador: repositorioJogador2,
    });
    const relida = servicoContas2.obter(conta.id);
    assert.equal(relida.referencia, "2026-09");
    assert.equal(relida.descricao, "Fatura");
    assert.equal(relida.valorEsperado, 12000);
    assert.equal(relida.vencimento, "2026-09-15");
    assert.equal(relida.jogadorId, jogador.id);
    assert.equal(servicoContas2.listar(jogador.id).length, 2);
    assert.equal(servicoContas2.obter(canceladaDepois.id).estado, "cancelada");
    assert.equal(servicoContas2.listarCanceladas(jogador.id).length, 1);
  } finally {
    try { db.close(); } catch { /* já fechado */ }
    rmSync(dir, { recursive: true, force: true });
  }
});