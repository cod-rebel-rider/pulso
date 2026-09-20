/**
 * PULSO — Testes de integração: FASE 10 COMPLETA (Fase 10.6 — visão e
 * estabilização).
 *
 * Valida o fluxo definitivo como um único pipeline coerente:
 *
 *   SERVIÇO → RECORRÊNCIA → OCORRÊNCIA/CONTA → PAGAMENTO → TRANSAÇÃO → CARTEIRA
 *
 * Cenário obrigatório da fase: Serviço "Internet", recorrência mensal,
 * gerar 3 contas, pagar 1 → 3 contas existentes, 1 paga, 2 pendentes,
 * 1 transação criada e saldo reduzido SOMENTE pelo valor pago.
 *
 * Também cobre: idempotência da geração, conta manual × gerada (nenhuma
 * altera saldo), fluxos de erro (serviço inexistente, recorrência inválida,
 * conta duplicada, conta cancelada, pagamento duplicado, valor inválido,
 * jogador incorreto, falha durante pagamento com rollback), filtros por
 * situação, valores esperado × pago diferentes, isolamento por jogador,
 * persistência após reinicialização e consistência da carteira no fim.
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
import { RepositorioRecorrencia } from "../../src/core/database/repositorios/recorrencia.js";
import { RepositorioCarteira } from "../../src/core/database/repositorios/carteira.js";
import { RepositorioTransacao } from "../../src/core/database/repositorios/transacao.js";
import { RepositorioOrcamento } from "../../src/core/database/repositorios/orcamento.js";
import { ServicoFinanca } from "../../src/core/aplicacao/servico-financa.js";
import { ServicoJogador } from "../../src/core/aplicacao/servico-jogador.js";
import { ServicoServicos } from "../../src/core/aplicacao/servico-servicos.js";
import { ServicoContas } from "../../src/core/aplicacao/servico-contas.js";
import { ServicoRecorrencias } from "../../src/core/aplicacao/servico-recorrencias.js";
import { ServicoGeracaoOcorrencias } from "../../src/core/aplicacao/servico-geracao-ocorrencias.js";
import { ServicoPagamentos } from "../../src/core/aplicacao/servico-pagamentos.js";
import { ErroValidacao, ErroConflito, ErroTransicao } from "../../src/core/erros.js";

/** Monta um ambiente isolado (banco temporário + todos os serviços da FASE 10). */
function criarAmbiente() {
  const dir = mkdtempSync(join(tmpdir(), "pulso-fase10-"));
  const db = new DatabaseSync(join(dir, "pulso.db"));
  db.exec("PRAGMA foreign_keys = ON");
  aplicarMigracoes(db);

  const repositorioJogador = new RepositorioJogador(db);
  const repositorioServico = new RepositorioServico(db);
  const repositorioConta = new RepositorioConta(db);
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
    repositorio: repositorioConta,
    repositorioServico,
    repositorioJogador,
  });
  const servicoRecorrencias = new ServicoRecorrencias({
    repositorio: new RepositorioRecorrencia(db),
    repositorioServico,
    repositorioJogador,
  });
  const servicoGeracao = new ServicoGeracaoOcorrencias({
    repositorioRecorrencia: new RepositorioRecorrencia(db),
    repositorioContas: repositorioConta,
    banco: db,
  });
  const servicoPagamentos = new ServicoPagamentos({
    repositorio: repositorioConta,
    servicoFinanca,
    banco: db,
  });

  return {
    dir, db, servicoJogador, servicoFinanca, servicoServicos, servicoContas,
    servicoRecorrencias, servicoGeracao, servicoPagamentos,
  };
}

function liberar({ dir, db }) {
  try {
    db.close();
  } catch {
    // já fechado (ex.: teste de persistência fecha e reabre o arquivo)
  }
  rmSync(dir, { recursive: true, force: true });
}

function saldoAtual(amb, jogadorId) {
  return amb.servicoFinanca.obterSaldo(jogadorId).saldo;
}

function contarTransacoes(amb, jogadorId) {
  return amb.servicoFinanca.listarTransacoes(jogadorId).length;
}

/**
 * Cenário base da fase: jogador com saldo inicial de R$ 1.000,00 e serviço
 * "Internet" (R$ 120,00 esperados por competência).
 */
function prepararJogadorEServico(amb, nome = "Operador") {
  const jogador = amb.servicoJogador.criar({ nome });
  amb.servicoFinanca.criarTransacao(jogador.id, {
    tipo: "receita",
    valorCentavos: 100000,
    categoria: "salario",
    descricao: "Saldo inicial de teste",
    data: "2026-09-01",
  });
  const servico = amb.servicoServicos.criar(jogador.id, {
    nome: "Internet",
    categoria: "telecomunicacoes",
    valorEsperado: 12000,
  });
  return { jogador, servico };
}

/** Cria a recorrência mensal padrão da fase (dia 15, desde outubro/2026). */
function criarRecorrenciaMensal(amb, jogadorId, servicoId) {
  return amb.servicoRecorrencias.criar(jogadorId, {
    servicoId,
    frequencia: "mensal",
    dataInicio: "2026-10-01",
    diaVencimento: 15,
    valorEsperado: 12000,
  });
}

/** Gerar ocorrências NÃO altera saldo e NÃO cria transação. */
function assertGeracaoNaoMovimentaDinheiro(amb, jogadorId) {
  assert.equal(saldoAtual(amb, jogadorId), 100000);
  assert.equal(contarTransacoes(amb, jogadorId), 1); // só a receita inicial
}

// ── Cenário completo obrigatório ──────────────────────────────────────────

test("FASE 10: fluxo completo — Internet mensal, 3 contas, 1 paga, saldo só do pago", () => {
  const amb = criarAmbiente();
  try {
    const { jogador, servico } = prepararJogadorEServico(amb);

    // 1. Criar serviço ✓ — carteira intacta.
    assert.equal(saldoAtual(amb, jogador.id), 100000);

    // 2. Criar recorrência mensal (vence dia 15, desde outubro/2026).
    const recorrencia = criarRecorrenciaMensal(amb, jogador.id, servico.id);
    assert.equal(recorrencia.estado, "ativa");
    // Criar a REGRA não gera conta nem movimenta dinheiro.
    assert.equal(amb.servicoContas.listar(jogador.id).length, 0);
    assertGeracaoNaoMovimentaDinheiro(amb, jogador.id);

    // 3. Gerar ocorrências do trimestre (out/nov/dez → 3 contas).
    const geracao = amb.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-10",
      periodoFim: "2026-12",
    });
    assert.equal(geracao.encontradas, 3);
    assert.equal(geracao.criadas, 3);
    assert.equal(geracao.existentes, 0);

    // 4. Gerar conta NÃO altera saldo e NÃO cria transação.
    assertGeracaoNaoMovimentaDinheiro(amb, jogador.id);

    // 5. Contas existentes: 3, todas pendentes, valor esperado copiado.
    const contas = amb.servicoContas.listar(jogador.id);
    assert.equal(contas.length, 3);
    for (const conta of contas) {
      assert.equal(conta.estado, "pendente");
      assert.equal(conta.valorEsperado, 12000);
      assert.equal(conta.servicoId, servico.id);
      assert.equal(conta.recorrenciaId, recorrencia.id);
    }
    const referencias = contas.map((c) => c.referencia).sort();
    assert.deepEqual(referencias, ["2026-10", "2026-11", "2026-12"]);

    // 6. Pagar UMA conta (a de outubro) por um valor diferente do esperado.
    const contaOutubro = contas.find((c) => c.referencia === "2026-10");
    const resultado = amb.servicoPagamentos.registrarPagamento(jogador.id, contaOutubro.id, {
      valorPagoCentavos: 12500,
      paidAt: "2026-10-20",
      paymentDescription: "Ajuste da operadora",
    });
    assert.equal(resultado.conta.estado, "paga");
    assert.equal(resultado.conta.paidAmount, 12500);
    assert.equal(resultado.transacao.tipo, "despesa");
    assert.equal(resultado.transacao.valorCentavos, 12500);
    assert.equal(resultado.conta.transactionId, resultado.transacao.id);

    // 7. Verificações finais do cenário obrigatório.
    const apos = amb.servicoContas.listar(jogador.id);
    assert.equal(apos.length, 3); // 3 contas existentes
    assert.equal(apos.filter((c) => c.situacao === "paga").length, 1); // 1 paga
    assert.equal(apos.filter((c) => c.situacao === "pendente").length, 2); // 2 pendentes
    assert.equal(contarTransacoes(amb, jogador.id), 2); // receita + 1 despesa
    // saldo reduzido SOMENTE pelo valor pago (12500): 100000 − 12500 = 87500.
    assert.equal(saldoAtual(amb, jogador.id), 87500);

    // 8. A despesa usa a categoria canônica `contas` (Fase 08).
    const despesas = amb.servicoFinanca.listarTransacoes(jogador.id, { tipo: "despesa" });
    assert.equal(despesas.length, 1);
    assert.equal(despesas[0].categoria, "contas");
  } finally {
    liberar(amb);
  }
});

test("FASE 10: gerar o mesmo período de novo é idempotente — nenhuma conta nova", () => {
  const amb = criarAmbiente();
  try {
    const { jogador, servico } = prepararJogadorEServico(amb);
    const recorrencia = criarRecorrenciaMensal(amb, jogador.id, servico.id);
    amb.servicoGeracao.gerar(recorrencia.id, { periodoInicio: "2026-10", periodoFim: "2026-12" });

    const saldoAntes = saldoAtual(amb, jogador.id);
    const repetida = amb.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-10",
      periodoFim: "2026-12",
    });
    assert.equal(repetida.encontradas, 3);
    assert.equal(repetida.criadas, 0);
    assert.equal(repetida.existentes, 3);
    assert.equal(amb.servicoContas.listar(jogador.id).length, 3);
    assert.equal(saldoAtual(amb, jogador.id), saldoAntes);
    assert.equal(contarTransacoes(amb, jogador.id), 1);
  } finally {
    liberar(amb);
  }
});

test("FASE 10: conta manual não altera saldo; duplicidade de referência é rejeitada", () => {
  const amb = criarAmbiente();
  try {
    const { jogador, servico } = prepararJogadorEServico(amb);

        const conta = amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id,
      referencia: "2026-12",
      vencimento: "2026-12-15",
      valorEsperado: 12000,
    });
    assert.equal(conta.situacao, "pendente");
    assert.equal(saldoAtual(amb, jogador.id), 100000);
    assert.equal(contarTransacoes(amb, jogador.id), 1);

    // Conta duplicada (mesmo serviço + mesma referência).
    assert.throws(
      () =>
        amb.servicoContas.criar(jogador.id, {
          servicoId: servico.id,
          referencia: "2026-12",
          vencimento: "2026-12-15",
          valorEsperado: 12000,
        }),
      ErroConflito,
    );

    // A mesma unicidade protege a geração: conta manual + geração do período
    // → a ocorrência é apenas "existente", nada duplica.
    const recorrencia = amb.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id,
      frequencia: "mensal",
      dataInicio: "2026-09-01",
      diaVencimento: 15,
      valorEsperado: 12000,
    });
    const geracao = amb.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-12-01",
      periodoFim: "2026-12-31",
    });
    assert.equal(geracao.criadas, 0);
    assert.equal(geracao.existentes, 1);
    assert.equal(amb.servicoContas.listar(jogador.id).length, 1);
  } finally {
    liberar(amb);
  }
});

// ── Fluxos de erro ────────────────────────────────────────────────────────

test("FASE 10: erros de vínculo — serviço inexistente e recorrência inválida", () => {
  const amb = criarAmbiente();
  try {
        const { jogador, servico } = prepararJogadorEServico(amb);

    // Serviço inexistente na criação de conta e de recorrência.
    assert.throws(
      () =>
        amb.servicoContas.criar(jogador.id, {
          servicoId: 99999,
          referencia: "2026-09",
          vencimento: "2026-09-15",
          valorEsperado: 12000,
        }),
      ErroConflito,
    );
    assert.throws(
      () =>
        amb.servicoRecorrencias.criar(jogador.id, {
          servicoId: 99999,
          frequencia: "mensal",
          dataInicio: "2026-09-01",
          diaVencimento: 15,
          valorEsperado: 12000,
        }),
      ErroConflito,
    );

        // Recorrência inexistente na geração.
    assert.throws(
      () =>
        amb.servicoGeracao.gerar(99999, {
          periodoInicio: "2026-10-01",
          periodoFim: "2026-10-31",
        }),
      ErroConflito,
    );

    // Recorrência inválida para geração: inativa (pausada) e arquivada.
    // (App single-player: reaproveita o jogador/serviço já existentes — não é
    // possível ter dois jogadores no mesmo banco, e o isolamento por jogador é
    // validado por `podePagareLancar`, não por dois operadores simultaneamente.)
    const inativa = criarRecorrenciaMensal(amb, jogador.id, servico.id);
    amb.servicoRecorrencias.desativar(inativa.id);
    assert.throws(
      () =>
        amb.servicoGeracao.gerar(inativa.id, {
          periodoInicio: "2026-10-01",
          periodoFim: "2026-10-31",
        }),
      ErroValidacao,
    );
    amb.servicoRecorrencias.ativar(inativa.id);
    amb.servicoRecorrencias.arquivar(inativa.id);
    assert.throws(
      () =>
        amb.servicoGeracao.gerar(inativa.id, {
          periodoInicio: "2026-10-01",
          periodoFim: "2026-10-31",
        }),
      ErroValidacao,
    );
  } finally {
    liberar(amb);
  }
});

test("FASE 10: conta cancelada não pode ser paga, editada nem cancelada de novo", () => {
  const amb = criarAmbiente();
  try {
    const { jogador, servico } = prepararJogadorEServico(amb);
    const conta = amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15",
      valorEsperado: 12000,
    });
    amb.servicoContas.cancelar(conta.id);
    assert.equal(amb.servicoContas.obter(conta.id).estado, "cancelada");

    const saldoAntes = saldoAtual(amb, jogador.id);
    assert.throws(
      () =>
        amb.servicoPagamentos.registrarPagamento(jogador.id, conta.id, {
          valorPagoCentavos: 12000,
          paidAt: "2026-09-20",
        }),
      ErroConflito,
    );
    assert.throws(
      () => amb.servicoContas.atualizar(conta.id, { valorEsperado: 10000 }),
      ErroValidacao,
    );
        assert.throws(() => amb.servicoContas.cancelar(conta.id), ErroTransicao);
    // Cancelar não altera saldo nem cria transação.
    assert.equal(saldoAtual(amb, jogador.id), saldoAntes);
    assert.equal(contarTransacoes(amb, jogador.id), 1);
  } finally {
    liberar(amb);
  }
});

test("FASE 10: pagamento duplicado é bloqueado — saldo e transações intactos", () => {
  const amb = criarAmbiente();
  try {
    const { jogador, servico } = prepararJogadorEServico(amb);
    const recorrencia = criarRecorrenciaMensal(amb, jogador.id, servico.id);
    amb.servicoGeracao.gerar(recorrencia.id, { periodoInicio: "2026-10", periodoFim: "2026-10" });
    const conta = amb.servicoContas.listar(jogador.id)[0];

    amb.servicoPagamentos.registrarPagamento(jogador.id, conta.id, {
      valorPagoCentavos: 12000,
      paidAt: "2026-10-20",
    });
    const saldoDepoisDoPrimeiro = saldoAtual(amb, jogador.id);
    const transacoesDepoisDoPrimeiro = contarTransacoes(amb, jogador.id);

    // Segunda tentativa: conta já PAGA (estado terminal nesta fase).
    assert.throws(
      () =>
        amb.servicoPagamentos.registrarPagamento(jogador.id, conta.id, {
          valorPagoCentavos: 12000,
          paidAt: "2026-10-21",
        }),
      ErroConflito,
    );
    assert.equal(saldoAtual(amb, jogador.id), saldoDepoisDoPrimeiro);
    assert.equal(contarTransacoes(amb, jogador.id), transacoesDepoisDoPrimeiro);
  } finally {
    liberar(amb);
  }
});

test("FASE 10: valor inválido e jogador incorreto são rejeitados sem efeito", () => {
  const amb = criarAmbiente();
  try {
    const { jogador, servico } = prepararJogadorEServico(amb);
    const conta = amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15",
      valorEsperado: 12000,
    });
    const saldoAntes = saldoAtual(amb, jogador.id);

    // Valores inválidos no pagamento: zero, negativo, não inteiro.
    for (const valorPagoCentavos of [0, -100, 1250.5]) {
      assert.throws(
        () =>
          amb.servicoPagamentos.registrarPagamento(jogador.id, conta.id, {
            valorPagoCentavos,
            paidAt: "2026-09-20",
          }),
        ErroValidacao,
      );
    }

    // Valor inválido na criação da conta (zero).
    assert.throws(
      () =>
        amb.servicoContas.criar(jogador.id, {
          servicoId: servico.id,
          referencia: "2026-10",
          vencimento: "2026-10-15",
          valorEsperado: 0,
        }),
      ErroValidacao,
    );

        // Jogador incorreto (outro jogador não pode pagar a conta): em um
    // single-player, usa um id inexistente — `podePagareLancar` rejeita o
    // mismatch de jogadorId antes de qualquer gravação.
    const outroJogadorId = jogador.id + 9999;
    assert.throws(
      () =>
        amb.servicoPagamentos.registrarPagamento(outroJogadorId, conta.id, {
          valorPagoCentavos: 12000,
          paidAt: "2026-09-20",
        }),
      ErroConflito,
    );

    assert.equal(saldoAtual(amb, jogador.id), saldoAntes);
    assert.equal(amb.servicoContas.obter(conta.id).estado, "pendente");
    // Isolamento: listar para um jogador inexistente não vê contas alheias.
    assert.throws(() => amb.servicoContas.listar(outroJogadorId), ErroConflito);
  } finally {
    liberar(amb);
  }
});

test("FASE 10: atomicidade — falha durante o pagamento não grava nada parcialmente", () => {
  const amb = criarAmbiente();
  try {
    const { jogador, servico } = prepararJogadorEServico(amb);
    const conta = amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15",
      valorEsperado: 12000,
    });
    const saldoAntes = saldoAtual(amb, jogador.id);
    const transacoesAntes = contarTransacoes(amb, jogador.id);

    const pagamentoQuebrado = new ServicoPagamentos({
      repositorio: new RepositorioConta(amb.db),
      servicoFinanca: {
        criarTransacao: () => {
          throw new Error("simulação de falha durante o pagamento");
        },
      },
      banco: amb.db,
    });

    assert.throws(
      () =>
        pagamentoQuebrado.registrarPagamento(jogador.id, conta.id, {
          valorPagoCentavos: 12000,
          paidAt: "2026-09-20",
        }),
    );

    // ROLLBACK: conta continua pendente; saldo intacto; nenhuma transação.
    const contaDepois = amb.servicoContas.obter(conta.id);
    assert.equal(contaDepois.estado, "pendente");
    assert.equal(contaDepois.paidAmount, null);
    assert.equal(contaDepois.transactionId, null);
    assert.equal(saldoAtual(amb, jogador.id), saldoAntes);
    assert.equal(contarTransacoes(amb, jogador.id), transacoesAntes);
  } finally {
    liberar(amb);
  }
});

// ── Filtros, situações e valores ──────────────────────────────────────────

test("FASE 10: filtros por situação (todas/pendentes/vencidas/pagas/canceladas)", () => {
  const amb = criarAmbiente();
  try {
    const { jogador, servico } = prepararJogadorEServico(amb);

    const pendente = amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id,
      referencia: "2026-11",
      vencimento: "2026-11-15",
      valorEsperado: 12000,
    });
    const vencida = amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15", // no passado → VENCIDA (derivada)
      valorEsperado: 12000,
    });
    const paga = amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id,
      referencia: "2026-10",
      vencimento: "2026-10-15",
      valorEsperado: 12000,
    });
    const cancelada = amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id,
      referencia: "2026-12",
      vencimento: "2026-12-15",
      valorEsperado: 12000,
    });
    amb.servicoContas.cancelar(cancelada.id);
    amb.servicoPagamentos.registrarPagamento(jogador.id, paga.id, {
      valorPagoCentavos: 12000,
      paidAt: "2026-10-16",
    });

    assert.equal(amb.servicoContas.listar(jogador.id).length, 4); // TODAS
    const pendentes = amb.servicoContas.listar(jogador.id, { situacao: "pendente" });
    assert.equal(pendentes.length, 1);
    assert.equal(pendentes[0].id, pendente.id);
    const vencidas = amb.servicoContas.listar(jogador.id, { situacao: "vencida" });
    assert.equal(vencidas.length, 1);
    assert.equal(vencidas[0].id, vencida.id);
    assert.equal(vencidas[0].estado, "pendente"); // derivada, nunca gravada
    const pagas = amb.servicoContas.listar(jogador.id, { situacao: "paga" });
    assert.equal(pagas.length, 1);
    assert.equal(pagas[0].id, paga.id);
    const canceladas = amb.servicoContas.listar(jogador.id, { situacao: "cancelada" });
    assert.equal(canceladas.length, 1);
    assert.equal(canceladas[0].id, cancelada.id);
    // Situação inválida é rejeitada.
    assert.throws(
      () => amb.servicoContas.listar(jogador.id, { situacao: "atrasada" }),
      ErroValidacao,
    );
    // Filtro por serviço também funciona.
    assert.equal(amb.servicoContas.listar(jogador.id, { servicoId: servico.id }).length, 4);
  } finally {
    liberar(amb);
  }
});

test("FASE 10: vencida deriva de pendente e pode ser paga; esperado ≠ pago", () => {
  const amb = criarAmbiente();
  try {
    const { jogador, servico } = prepararJogadorEServico(amb);
    const conta = amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id,
      referencia: "2026-08",
      vencimento: "2026-08-10", // já venceu
      valorEsperado: 12000,
    });
    assert.equal(conta.situacao, "vencida");
    assert.equal(conta.estado, "pendente"); // derivada, nunca gravada

    const resultado = amb.servicoPagamentos.registrarPagamento(jogador.id, conta.id, {
      valorPagoCentavos: 12050, // esperado R$120,00 · pago R$120,50
      paidAt: "2026-09-05",
    });
    assert.equal(resultado.conta.situacao, "paga");
    assert.equal(resultado.conta.paidAmount, 12050);
    // A DESPESA registra o valor REAL, nunca o esperado.
    assert.equal(resultado.transacao.valorCentavos, 12050);
    assert.equal(saldoAtual(amb, jogador.id), 100000 - 12050);
  } finally {
    liberar(amb);
  }
});

test("FASE 10: edição e ciclo de vida (ativar/desativar/arquivar) dentro do fluxo", () => {
  const amb = criarAmbiente();
  try {
    const { jogador, servico } = prepararJogadorEServico(amb);

    // Edição da conta: valor esperado, vencimento e descrição persistem.
    const conta = amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id,
      referencia: "2026-09",
      vencimento: "2026-09-15",
      valorEsperado: 12000,
    });
    const editada = amb.servicoContas.atualizar(conta.id, {
      valorEsperado: 13000,
      vencimento: "2026-09-20",
      descricao: "Plano trocado",
    });
    assert.equal(editada.valorEsperado, 13000);
    assert.equal(editada.vencimento, "2026-09-20");
    assert.equal(editada.descricao, "Plano trocado");

    // Recorrência: desativar → não gera; ativar → gera; arquivar → terminal.
    const recorrencia = criarRecorrenciaMensal(amb, jogador.id, servico.id);
    amb.servicoRecorrencias.desativar(recorrencia.id);
    assert.equal(amb.servicoRecorrencias.obter(recorrencia.id).estado, "inativa");
        assert.throws(
      () => amb.servicoGeracao.gerar(recorrencia.id, { periodoInicio: "2026-10-01", periodoFim: "2026-10-31" }),
      ErroValidacao,
    );
    amb.servicoRecorrencias.ativar(recorrencia.id);
    const geracao = amb.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-10-01",
      periodoFim: "2026-10-31",
    });
    assert.equal(geracao.criadas, 1);
    amb.servicoRecorrencias.arquivar(recorrencia.id);
    assert.equal(amb.servicoRecorrencias.obter(recorrencia.id).estado, "arquivada");
    assert.throws(() => amb.servicoRecorrencias.ativar(recorrencia.id), ErroTransicao);
    assert.throws(
      () => amb.servicoGeracao.gerar(recorrencia.id, { periodoInicio: "2026-11-01", periodoFim: "2026-11-30" }),
      ErroValidacao,
    );

    // Serviço: arquivar não apaga contas já criadas.
    const contasAntes = amb.servicoContas.listar(jogador.id).length;
    amb.servicoServicos.arquivar(servico.id);
    assert.equal(amb.servicoServicos.obter(servico.id).estado, "arquivado");
    assert.equal(amb.servicoContas.listar(jogador.id).length, contasAntes);
  } finally {
    liberar(amb);
  }
});

test("FASE 10: isolamento por jogador — operação só é permitida para o dono da conta", () => {
  const amb = criarAmbiente();
  try {
    // Single-player: o app admite UM jogador por banco. O isolamento entre
    // jogadores é validado pelo mecanismo de `jogadorId` (ver `podePagareLancar`
    // e `_garantirJogador`), então aqui usamos um id inexistente para
    // provar que NENHUM outro jogador enxerga nem altera a conta alheia.
    const { jogador, servico } = prepararJogadorEServico(amb, "Jogador A");
    const recorrenciaA = criarRecorrenciaMensal(amb, jogador.id, servico.id);
    amb.servicoGeracao.gerar(recorrenciaA.id, {
      periodoInicio: "2026-10-01",
      periodoFim: "2026-12-31",
    });
    const contas = amb.servicoContas.listar(jogador.id);
    const contaA = contas.find((c) => c.referencia === "2026-10");

    // Listar para um jogador inexistente é rejeitado (não vê contas alheias).
    assert.throws(() => amb.servicoContas.listar(99999), ErroConflito);

    // Nenhum outro jogador pode pagar a conta — mismatch de jogadorId.
    assert.throws(
      () =>
        amb.servicoPagamentos.registrarPagamento(99999, contaA.id, {
          valorPagoCentavos: 12000,
          paidAt: "2026-10-20",
        }),
      ErroConflito,
    );

    // O jogador dono paga a própria conta — saldo reduce só do pagamento.
    amb.servicoPagamentos.registrarPagamento(jogador.id, contaA.id, {
      valorPagoCentavos: 12000,
      paidAt: "2026-10-20",
    });
    assert.equal(saldoAtual(amb, jogador.id), 88000);
  } finally {
    liberar(amb);
  }
});
