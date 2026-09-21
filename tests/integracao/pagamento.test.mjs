/**
 * PULSO — Testes de integração: Pagamentos (Fase 10.5).
 *
 * Cobre: pagamento de conta pendente e vencida, valor diferente do esperado,
 * criação da transação DESPESA, alteração correta do saldo, vínculo
 * conta↔transação, idempotência/de-duplicação, bloqueios (cancelada, já paga,
 * inexistente, jogador incorreto, valor inválido), atomicidade em caso de falha
 * e persistência após reinicialização.
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
import { ServicoPagamentos } from "../../src/core/aplicacao/servico-pagamentos.js";
import { ErroConflito, ErroValidacao } from "../../src/core/erros.js";

function criarAmbiente() {
  const dir = mkdtempSync(join(tmpdir(), "pulso-pagamento-"));
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
  const servicoPagamentos = new ServicoPagamentos({
    repositorio: new RepositorioConta(db),
    servicoFinanca,
    banco: db,
  });

  // Jogador + serviço "Internet", com saldo inicial de R$1000,00.
  const jogador = servicoJogador.criar({ nome: "Operador" });
  servicoFinanca.criarTransacao(jogador.id, {
    tipo: "receita",
    valorCentavos: 100000,
    categoria: "salario",
    descricao: "Saldo inicial de teste",
    data: "2026-09-01",
  });
  const servico = servicoServicos.criar(jogador.id, {
    nome: "Internet",
    categoria: "telecomunicacoes",
    valorEsperado: 12000,
  });

  return { dir, db, jogador, servico, servicoJogador, servicoContas, servicoPagamentos, servicoFinanca };
}

function liberar({ dir, db }) {
  try {
    db.close();
  } catch {
    // já fechado (ex.: teste de persistência fecha e reabre o arquivo)
  }
  rmSync(dir, { recursive: true, force: true });
}

function saldoAtual(amb) {
  return amb.servicoFinanca.obterSaldo(amb.jogador.id).saldo;
}

test("pagamento: conta pendente cria DESPESA, ajusta saldo e vincula transação", () => {
  const amb = criarAmbiente();
  try {
    const conta = amb.servicoContas.criar(amb.jogador.id, {
      servicoId: amb.servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15",
      valorEsperado: 12000,
    });

    const saldoAntes = saldoAtual(amb);
    assert.equal(saldoAntes, 100000);

    const resultado = amb.servicoPagamentos.registrarPagamento(amb.jogador.id, conta.id, {
      valorPagoCentavos: 12500,
      paidAt: "2026-09-20",
      paymentDescription: "Pago com troco",
    });

    const contaPaga = amb.servicoContas.obter(conta.id);
    assert.equal(contaPaga.estado, "paga");
    assert.equal(contaPaga.paidAmount, 12500);
    assert.equal(contaPaga.paidAt, "2026-09-20");
    assert.equal(contaPaga.paymentDescription, "Pago com troco");
    assert.equal(contaPaga.transactionId, resultado.transacao.id);

    const transacao = amb.servicoFinanca.obterTransacao(resultado.transacao.id);
    assert.equal(transacao.tipo, "despesa");
    assert.equal(transacao.valorCentavos, 12500);

    assert.equal(saldoAtual(amb), 87500);
  } finally {
    liberar(amb);
  }
});

test("pagamento: conta vencida (faixa vermelha) também pode ser paga", () => {
  const amb = criarAmbiente();
  try {
    const conta = amb.servicoContas.criar(amb.jogador.id, {
      servicoId: amb.servico.id,
      referencia: "2026-08",
      vencimento: "2026-08-01",
      valorEsperado: 12000,
    });

    const saldoAntes = saldoAtual(amb);
    amb.servicoPagamentos.registrarPagamento(amb.jogador.id, conta.id, {
      valorPagoCentavos: 12000,
      paidAt: "2026-09-10",
    });

    const contaPaga = amb.servicoContas.obter(conta.id);
    assert.equal(contaPaga.estado, "paga");
    assert.equal(saldoAtual(amb), saldoAntes - 12000);
  } finally {
    liberar(amb);
  }
});

test("pagamento: valor pago diferente do esperado registra o valor REAL", () => {
  const amb = criarAmbiente();
  try {
    const conta = amb.servicoContas.criar(amb.jogador.id, {
      servicoId: amb.servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15",
      valorEsperado: 12000,
    });

    const { transacao } = amb.servicoPagamentos.registrarPagamento(amb.jogador.id, conta.id, {
      valorPagoCentavos: 12750,
      paidAt: "2026-09-20",
    });

    const t = amb.servicoFinanca.obterTransacao(transacao.id);
    assert.equal(t.valorCentavos, 12750);
    const c = amb.servicoContas.obter(conta.id);
    assert.equal(c.paidAmount, 12750);
    assert.equal(c.valorEsperado, 12000);
  } finally {
    liberar(amb);
  }
});

test("pagamento: duplicidade — conta já PAGA não pode ser paga de novo", () => {
  const amb = criarAmbiente();
  try {
    const conta = amb.servicoContas.criar(amb.jogador.id, {
      servicoId: amb.servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15",
      valorEsperado: 12000,
    });

    amb.servicoPagamentos.registrarPagamento(amb.jogador.id, conta.id, {
      valorPagoCentavos: 12000,
      paidAt: "2026-09-20",
    });

    assert.throws(
      () =>
        amb.servicoPagamentos.registrarPagamento(amb.jogador.id, conta.id, {
          valorPagoCentavos: 1000,
          paidAt: "2026-09-21",
        }),
      ErroConflito,
    );

    assert.equal(
      amb.servicoFinanca.obterSaldo(amb.jogador.id).saldo,
      100000 - 12000,
      "segundo pagamento não altera saldo",
    );
  } finally {
    liberar(amb);
  }
});

test("pagamento: bloqueios — cancelada, inexistente, jogador incorreto, valor inválido", () => {
  const amb = criarAmbiente();
  try {
    const conta = amb.servicoContas.criar(amb.jogador.id, {
      servicoId: amb.servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15",
      valorEsperado: 12000,
    });
    amb.servicoContas.cancelar(conta.id);

    assert.throws(
      () => amb.servicoPagamentos.registrarPagamento(amb.jogador.id, conta.id, {
        valorPagoCentavos: 12000,
        paidAt: "2026-09-20",
      }),
      ErroConflito,
    );

    assert.throws(
      () => amb.servicoPagamentos.registrarPagamento(amb.jogador.id, 9999, {
        valorPagoCentavos: 12000,
        paidAt: "2026-09-20",
      }),
      ErroConflito,
    );

    const conta2 = amb.servicoContas.criar(amb.jogador.id, {
      servicoId: amb.servico.id,
      referencia: "2026-10",
      vencimento: "2026-10-15",
      valorEsperado: 12000,
    });
    assert.throws(
      () => amb.servicoPagamentos.registrarPagamento(amb.jogador.id, conta2.id, {
        valorPagoCentavos: 0,
        paidAt: "2026-09-20",
      }),
      ErroValidacao,
    );

    // o PULSO é single-player pelo serviço; o segundo jogador entra direto
    // pelo banco para provar o bloqueio de conta alheia
    const outroJogador = amb.db
      .prepare("INSERT INTO jogador (nome) VALUES ('Outro') RETURNING id")
      .get();
    assert.throws(
      () => amb.servicoPagamentos.registrarPagamento(outroJogador.id, conta2.id, {
        valorPagoCentavos: 12000,
        paidAt: "2026-09-20",
      }),
      ErroConflito,
    );
  } finally {
    liberar(amb);
  }
});

test("pagamento: atomicidade — falha na DESPESA não altera saldo nem estado da conta", () => {
  const amb = criarAmbiente();
  try {
    const conta = amb.servicoContas.criar(amb.jogador.id, {
      servicoId: amb.servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15",
      valorEsperado: 12000,
    });

    const servicoComFinancaQuebrada = new ServicoPagamentos({
      repositorio: new RepositorioConta(amb.db),
      servicoFinanca: {
        criarTransacao: () => {
          throw new Error("simulação de falha na finança");
        },
      },
      banco: amb.db,
    });

    const saldoAntes = saldoAtual(amb);
    assert.throws(() =>
      servicoComFinancaQuebrada.registrarPagamento(amb.jogador.id, conta.id, {
        valorPagoCentavos: 12000,
        paidAt: "2026-09-20",
      }),
    );

    const contaDepois = amb.servicoContas.obter(conta.id);
    assert.equal(contaDepois.estado, "pendente");
    assert.equal(saldoAtual(amb), saldoAntes);
  } finally {
    liberar(amb);
  }
});

test("pagamento: persistência — após reabrir o banco a conta continua PAGA", () => {
  const amb = criarAmbiente();
  const caminho = join(amb.dir, "pulso.db");
  const dbOriginal = amb.db;
  try {
    const conta = amb.servicoContas.criar(amb.jogador.id, {
      servicoId: amb.servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15",
      valorEsperado: 12000,
    });

    const resultado = amb.servicoPagamentos.registrarPagamento(amb.jogador.id, conta.id, {
      valorPagoCentavos: 12000,
      paidAt: "2026-09-20",
    });

    const saldoPago = saldoAtual(amb);

    // Fechar e reabrir o banco real (não memorado).
    dbOriginal.close();
    const db2 = new DatabaseSync(caminho);
    db2.exec("PRAGMA foreign_keys = ON");

    const repoConta = new RepositorioConta(db2);
    const contaReab = repoConta.buscarPorId(conta.id);
    assert.equal(contaReab.estado, "paga");
    assert.equal(contaReab.paidAmount, 12000);
    assert.equal(contaReab.paidAt, "2026-09-20");
    assert.ok(contaReab.transactionId, "o vínculo com a transação deve persistir");
    assert.equal(contaReab.transactionId, resultado.transacao.id);

    const repoFinanca = new ServicoFinanca({
      repositorioCarteira: new RepositorioCarteira(db2),
      repositorioTransacao: new RepositorioTransacao(db2),
      repositorioOrcamento: new RepositorioOrcamento(db2),
      repositorioJogador: new RepositorioJogador(db2),
    });
    assert.equal(repoFinanca.obterSaldo(amb.jogador.id).saldo, saldoPago);

    db2.close();
  } finally {
    liberar(amb);
  }
});

test("pagamento: isolamento — pagamento de uma conta não afeta outro jogador", () => {
  const amb = criarAmbiente();
  try {
    // mesmo padrão dos testes de geração: segundo jogador entra via SQL
    const outroJogador = amb.db
      .prepare("INSERT INTO jogador (nome) VALUES ('B') RETURNING id")
      .get();
    amb.servicoFinanca.criarCarteiraInicial(outroJogador.id);
    amb.servicoFinanca.criarTransacao(outroJogador.id, {
      tipo: "receita",
      valorCentavos: 50000,
      categoria: "salario",
      descricao: "Saldo B",
      data: "2026-09-01",
    });

    const contaA = amb.servicoContas.criar(amb.jogador.id, {
      servicoId: amb.servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15",
      valorEsperado: 12000,
    });

    assert.throws(
      () => amb.servicoPagamentos.registrarPagamento(outroJogador.id, contaA.id, {
        valorPagoCentavos: 12000,
        paidAt: "2026-09-20",
      }),
      ErroConflito,
    );

    assert.equal(saldoAtual(amb), 100000, "jogador A inalterado");
    assert.equal(
      amb.servicoFinanca.obterSaldo(outroJogador.id).saldo,
      50000,
      "jogador B inalterado",
    );
  } finally {
    liberar(amb);
  }
});

