/**
 * PULSO — Testes de integração: Geração de Ocorrências (Fase 10.4)
 *
 * Cobre: a transformação da REGRA (recorrência) em CONTAS concretas dentro
 * de um período; idempotência (gerar de novo não duplica); duplicidade com
 * conta manual; frequências mensal…anual; start_date/end_date; período
 * limitado; meses com menos dias; recorrência inativa/arquivada; cópia do
 * valor no momento da geração; vínculo com o serviço; isolamento por
 * jogador; persistência fechar/reabrir e o TESTE OBRIGATÓRIO: gerar 3
 * contas de R$ 120,00 NÃO altera o saldo, NÃO cria transação.
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
import { ErroValidacao, ErroConflito } from "../../src/core/erros.js";

/** Monta um ambiente isolado (banco temporário + serviços do núcleo). */
function criarAmbiente() {
  const dir = mkdtempSync(join(tmpdir(), "pulso-geracao-"));
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
  return {
    dir, db, servicoJogador, servicoFinanca, servicoServicos, servicoContas,
    servicoRecorrencias, servicoGeracao,
  };
}

function liberar({ dir, db }) {
  try {
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Jogador + serviço "Internet" prontos para receber a regra. */
function prepararCenario(ambiente, nome = "Operador") {
  const jogador = ambiente.servicoJogador.criar({ nome });
  const servico = ambiente.servicoServicos.criar(jogador.id, {
    nome: "Internet",
    categoria: "telecomunicacoes",
    valorEsperado: 12000,
  });
  return { jogador, servico };
}

/** Instante fixo para derivar situações de forma determinística. */
const HOJE_FIXO = "2026-09-18";

function contasNoBanco(ambiente) {
  return ambiente.db
    .prepare(`
      SELECT jogador_id, servico_id, referencia, valor_esperado_centavos,
             vencimento, estado, recorrencia_id
      FROM servico_conta
      ORDER BY vencimento ASC, id ASC
    `)
    .all();
}

// ---- Geração básica ----
test("geração mensal: transforma a regra em contas pendentes com valor copiado e vínculo", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id,
      frequencia: "mensal",
      dataInicio: "2026-09-01",
      diaVencimento: 15,
      valorEsperado: 12000,
      descricao: "Fatura da internet",
    });

    const geracao = ambiente.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-10-01",
      periodoFim: "2026-12-31",
      hoje: HOJE_FIXO,
    });

    assert.deepEqual(
      { encontradas: geracao.encontradas, criadas: geracao.criadas, existentes: geracao.existentes },
      { encontradas: 3, criadas: 3, existentes: 0 },
    );
    assert.equal(geracao.contas.length, 3);

    const primeira = geracao.contas[0];
    assert.equal(primeira.referencia, "2026-10");
    assert.equal(primeira.vencimento, "2026-10-15");
    assert.equal(primeira.valorEsperado, 12000, "valor copiado da recorrência");
    assert.equal(primeira.estado, "pendente", "toda conta gerada nasce PENDENTE");
    assert.equal(primeira.recorrenciaId, recorrencia.id, "vínculo com a recorrência (rastreabilidade)");
    assert.equal(primeira.servicoId, servico.id, "vínculo com o serviço");
    assert.equal(primeira.jogadorId, jogador.id, "conta pertence ao jogador da regra");
    assert.equal(primeira.descricao, "Fatura da internet");
    assert.equal(primeira.situacao, "pendente", "situação derivada pela regra da Fase 10.2");

    // persistidas exatamente como calculadas
    assert.deepEqual(contasNoBanco(ambiente).map((c) => [c.referencia, c.vencimento]), [
      ["2026-10", "2026-10-15"],
      ["2026-11", "2026-11-15"],
      ["2026-12", "2026-12-15"],
    ]);
    assert.ok(contasNoBanco(ambiente).every((c) => c.estado === "pendente"));
  } finally {
    liberar(ambiente);
  }
});

// ---- Idempotência ----
test("geração repetida: executar de novo não duplica a mesma ocorrência", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-09-01",
      diaVencimento: 15, valorEsperado: 12000,
    });
    const periodo = { periodoInicio: "2026-10-01", periodoFim: "2026-12-31", hoje: HOJE_FIXO };
    const primeira = ambiente.servicoGeracao.gerar(recorrencia.id, periodo);
    assert.equal(primeira.criadas, 3);

    const segunda = ambiente.servicoGeracao.gerar(recorrencia.id, periodo);
    assert.deepEqual(
      { encontradas: segunda.encontradas, criadas: segunda.criadas, existentes: segunda.existentes },
      { encontradas: 3, criadas: 0, existentes: 3 },
    );
    assert.equal(contasNoBanco(ambiente).length, 3, "nenhuma conta duplicada");

    // período sobreposto: só os meses novos viram contas
    const terceira = ambiente.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-11-01", periodoFim: "2027-01-31", hoje: HOJE_FIXO,
    });
    assert.deepEqual(
      { encontradas: terceira.encontradas, criadas: terceira.criadas, existentes: terceira.existentes },
      { encontradas: 3, criadas: 1, existentes: 2 },
    );
    assert.equal(contasNoBanco(ambiente).length, 4);
    assert.ok(contasNoBanco(ambiente).some((c) => c.referencia === "2027-01"));
  } finally {
    liberar(ambiente);
  }
});

// ---- Duplicidade com conta manual ----
test("duplicidade: conta manual já existente na competência é preservada e contada", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-09-01",
      diaVencimento: 15, valorEsperado: 12000,
    });
    // conta manual da Fase 10.2 na MESMA competência (outro vencimento/valor)
    const manual = ambiente.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-11", vencimento: "2026-11-20",
      valorEsperado: 9999, descricao: "Lançada à mão",
    });

    const geracao = ambiente.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-10-01", periodoFim: "2026-12-31", hoje: HOJE_FIXO,
    });
    assert.deepEqual(
      { encontradas: geracao.encontradas, criadas: geracao.criadas, existentes: geracao.existentes },
      { encontradas: 3, criadas: 2, existentes: 1 },
    );

    // a conta manual permanece intacta (não é sobrescrita nem duplicada)
    const relida = ambiente.servicoContas.obter(manual.id);
    assert.equal(relida.vencimento, "2026-11-20");
    assert.equal(relida.valorEsperado, 9999);
    assert.equal(relida.recorrenciaId, null, "conta manual não ganha vínculo");
    assert.equal(contasNoBanco(ambiente).length, 3);
  } finally {
    liberar(ambiente);
  }
});

// ---- Frequências ----
test("frequências bimestral, trimestral, semestral e anual geram as competências certas", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador } = prepararCenario(ambiente);
    const casos = [
      { frequencia: "bimestral", dataInicio: "2026-09-01", fim: "2027-04-30", esperado: ["2026-09", "2026-11", "2027-01", "2027-03"] },
      { frequencia: "trimestral", dataInicio: "2026-01-01", fim: "2026-12-31", esperado: ["2026-01", "2026-04", "2026-07", "2026-10"] },
      { frequencia: "semestral", dataInicio: "2026-03-01", fim: "2027-06-30", esperado: ["2026-03", "2026-09", "2027-03"] },
      { frequencia: "anual", dataInicio: "2024-05-01", fim: "2027-12-31", esperado: ["2024-05", "2025-05", "2026-05", "2027-05"] },
    ];
    for (const caso of casos) {
      // serviço próprio por frequência: a unicidade (servico_id, referencia)
      // é por serviço e regras diferentes não podem colidir no teste
      const servico = ambiente.servicoServicos.criar(jogador.id, {
        nome: `Assinatura ${caso.frequencia}`,
        categoria: "assinaturas",
        valorEsperado: 5000,
      });
      const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, {
        servicoId: servico.id, frequencia: caso.frequencia,
        dataInicio: caso.dataInicio, diaVencimento: 10, valorEsperado: 5000,
      });
      const geracao = ambiente.servicoGeracao.gerar(recorrencia.id, {
        periodoInicio: caso.dataInicio, periodoFim: caso.fim, hoje: HOJE_FIXO,
      });
      assert.equal(geracao.criadas, caso.esperado.length, caso.frequencia);
      assert.deepEqual(
        ambiente.servicoContas
          .listar(jogador.id, { servicoId: servico.id })
          .map((c) => c.referencia)
          .sort(),
        [...caso.esperado].sort(),
        `frequência ${caso.frequencia}`,
      );
    }
  } finally {
    liberar(ambiente);
  }
});

// ---- start_date / end_date / período limitado ----
test("start_date e end_date: nada é gerado fora da validade da recorrência", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-09-20",
      dataFim: "2026-11-15", diaVencimento: 15, valorEsperado: 12000,
    });
    // período pedido é mais amplo que a validade da regra
    const geracao = ambiente.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-08-01", periodoFim: "2026-12-31", hoje: HOJE_FIXO,
    });
    assert.deepEqual(
      { encontradas: geracao.encontradas, criadas: geracao.criadas, existentes: geracao.existentes },
      { encontradas: 2, criadas: 2, existentes: 0 },
      "setembro (vence 15/09 < start 20/09) e dezembro (vence 15/12 > end 15/11) ficam fora",
    );
    assert.deepEqual(contasNoBanco(ambiente).map((c) => c.referencia), ["2026-10", "2026-11"]);

    // períodos totalmente fora da validade não criam nada
    const antes = ambiente.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-01-01", periodoFim: "2026-05-31", hoje: HOJE_FIXO,
    });
    const depois = ambiente.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-12-01", periodoFim: "2026-12-31", hoje: HOJE_FIXO,
    });
    assert.equal(antes.criadas, 0, "antes do start_date não gera");
    assert.equal(depois.criadas, 0, "depois do end_date não gera");
    assert.equal(contasNoBanco(ambiente).length, 2);
  } finally {
    liberar(ambiente);
  }
});

// ---- Meses com menos dias ----
test("meses com menos dias: dia 31 vira o último dia válido (inclusive em bissexto)", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-01-01",
      diaVencimento: 31, valorEsperado: 12000,
    });
    ambiente.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-01-01", periodoFim: "2026-04-30", hoje: HOJE_FIXO,
    });
    assert.deepEqual(contasNoBanco(ambiente).map((c) => [c.referencia, c.vencimento]), [
      ["2026-01", "2026-01-31"],
      ["2026-02", "2026-02-28"],
      ["2026-03", "2026-03-31"],
      ["2026-04", "2026-04-30"],
    ]);

    // bissexto: fevereiro/2024 → 29 (regra canônica preservada na geração)
    const bissexta = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2024-01-01",
      diaVencimento: 31, valorEsperado: 12000,
    });
    ambiente.servicoGeracao.gerar(bissexta.id, {
      periodoInicio: "2024-02-01", periodoFim: "2024-02-29", hoje: HOJE_FIXO,
    });
    const fevereiro = contasNoBanco(ambiente).find((c) => c.recorrencia_id === bissexta.id);
    assert.equal(fevereiro.vencimento, "2024-02-29");
  } finally {
    liberar(ambiente);
  }
});

// ---- Estados da recorrência e entradas inválidas ----
test("recorrência inativa, arquivada, inexistente e período inválido não geram nada", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const inativa = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-09-01",
      diaVencimento: 15, valorEsperado: 12000,
    });
    ambiente.servicoRecorrencias.desativar(inativa.id);
    assert.throws(
      () => ambiente.servicoGeracao.gerar(inativa.id, {
        periodoInicio: "2026-10-01", periodoFim: "2026-12-31", hoje: HOJE_FIXO,
      }),
      ErroValidacao,
      "inativa está pausada e não gera",
    );

    const arquivada = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-09-01",
      diaVencimento: 15, valorEsperado: 12000,
    });
    ambiente.servicoRecorrencias.arquivar(arquivada.id);
    assert.throws(
      () => ambiente.servicoGeracao.gerar(arquivada.id, {
        periodoInicio: "2026-10-01", periodoFim: "2026-12-31", hoje: HOJE_FIXO,
      }),
      ErroValidacao,
      "arquivada está encerrada e não gera",
    );

    assert.throws(
      () => ambiente.servicoGeracao.gerar(999999, {
        periodoInicio: "2026-10-01", periodoFim: "2026-12-31", hoje: HOJE_FIXO,
      }),
      ErroConflito,
      "recorrência inexistente é recusada",
    );

    const valida = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-09-01",
      diaVencimento: 15, valorEsperado: 12000,
    });
    assert.throws(
      () => ambiente.servicoGeracao.gerar(valida.id, {
        periodoInicio: "2026-12-31", periodoFim: "2026-10-01", hoje: HOJE_FIXO,
      }),
      ErroValidacao,
      "período invertido é recusado",
    );
    assert.throws(
      () => ambiente.servicoGeracao.gerar(valida.id, {
        periodoInicio: "2026-02-30", periodoFim: "2026-12-31", hoje: HOJE_FIXO,
      }),
      ErroValidacao,
      "data inexistente no período é recusada",
    );
    // nenhuma conta foi criada em nenhuma tentativa
    assert.equal(contasNoBanco(ambiente).length, 0);
  } finally {
    liberar(ambiente);
  }
});

// ---- Valor copiado no momento da geração ----
test("novo valor da regra não altera contas já geradas (cópia no momento)", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-09-01",
      diaVencimento: 15, valorEsperado: 12000,
    });
    ambiente.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-10-01", periodoFim: "2026-12-31", hoje: HOJE_FIXO,
    });

    // a regra muda DEPOIS: valor e vencimento novos
    ambiente.servicoRecorrencias.atualizar(recorrencia.id, {
      valorEsperado: 15000, diaVencimento: 20,
    });

    // as contas antigas permanecem com o valor/vencimento DE CADA GERAÇÃO
    const antigas = contasNoBanco(ambiente);
    assert.ok(antigas.every((c) => c.valor_esperado_centavos === 12000));
    assert.ok(antigas.every((c) => c.vencimento.endsWith("-15")));

    // geração futura usa o valor VIGENTE no momento (15.000, dia 20)
    const nova = ambiente.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2027-01-01", periodoFim: "2027-01-31", hoje: HOJE_FIXO,
    });
    assert.equal(nova.criadas, 1);
    assert.equal(nova.contas[0].valorEsperado, 15000);
    assert.equal(nova.contas[0].vencimento, "2027-01-20");
  } finally {
    liberar(ambiente);
  }
});

// ---- Isolamento por jogador ----
test("isolamento por jogador: contas geradas ficam com o dono da regra", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador: alice, servico: internet } = prepararCenario(ambiente, "Alice");
    // o PULSO é single-player pelo serviço, mas o banco aceita um segundo
    // jogador via repositório — necessário para provar o isolamento
    const bob = ambiente.db
      .prepare("INSERT INTO jogador (nome) VALUES ('Bob') RETURNING id")
      .get();
    const luz = ambiente.servicoServicos.criar(bob.id, {
      nome: "Energia", categoria: "contas", valorEsperado: 8000,
    });

    const regraAlice = ambiente.servicoRecorrencias.criar(alice.id, {
      servicoId: internet.id, frequencia: "mensal", dataInicio: "2026-09-01",
      diaVencimento: 15, valorEsperado: 12000,
    });
    const regraBob = ambiente.servicoRecorrencias.criar(bob.id, {
      servicoId: luz.id, frequencia: "mensal", dataInicio: "2026-09-01",
      diaVencimento: 10, valorEsperado: 8000,
    });
    const geracaoAlice = ambiente.servicoGeracao.gerar(regraAlice.id, {
      periodoInicio: "2026-10-01", periodoFim: "2026-11-30", hoje: HOJE_FIXO,
    });
    const geracaoBob = ambiente.servicoGeracao.gerar(regraBob.id, {
      periodoInicio: "2026-10-01", periodoFim: "2026-11-30", hoje: HOJE_FIXO,
    });

    // o dono da conta vem da RECORRÊNCIA, nunca do contexto da chamada
    assert.ok(geracaoAlice.contas.every((c) => c.jogadorId === alice.id && c.servicoId === internet.id));
    assert.ok(geracaoBob.contas.every((c) => c.jogadorId === bob.id && c.servicoId === luz.id));

    // e a listagem de cada jogador só enxerga as suas contas
    const contasAlice = ambiente.servicoContas.listar(alice.id);
    const contasBob = ambiente.servicoContas.listar(bob.id);
    assert.equal(contasAlice.length, 2);
    assert.equal(contasBob.length, 2);
    assert.ok(contasAlice.every((c) => c.jogadorId === alice.id));
    assert.ok(contasBob.every((c) => c.jogadorId === bob.id));
    assert.equal(contasNoBanco(ambiente).length, 4);
  } finally {
    liberar(ambiente);
  }
});

// ---- TESTE CRÍTICO: gerar não é pagar ----
test("teste obrigatório: gerar 3 contas de R$ 120,00 não altera o saldo e não cria transação", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);

    // carteira com saldo conhecido: uma receita de R$ 1.000,00
    ambiente.servicoFinanca.criarTransacao(jogador.id, {
      tipo: "receita", valorCentavos: 100000, categoria: "salario",
      data: "2026-09-01", descricao: "Salário de setembro",
    });
    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 100000, "saldo antes: R$ 1.000,00");
    const carteiraAntes = ambiente.servicoFinanca.obterCarteira(jogador.id);
    const transacoesAntes = ambiente.db.prepare("SELECT COUNT(*) AS n FROM transacao").get().n;

    const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-09-01",
      diaVencimento: 15, valorEsperado: 12000, // R$ 120,00
    });

    const geracao = ambiente.servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-10-01", periodoFim: "2026-12-31", hoje: HOJE_FIXO,
    });
    assert.equal(geracao.criadas, 3, "3 contas de R$ 120,00 foram criadas");
    assert.equal(geracao.contas[0].estado, "pendente", "nenhuma conta nasce paga");
    assert.ok(geracao.contas.every((c) => c.valorEsperado === 12000));

    // CRÍTICO: nenhuma movimentação financeira
    const carteiraDepois = ambiente.servicoFinanca.obterCarteira(jogador.id);
    assert.equal(carteiraDepois.saldo, 100000, "saldo depois: R$ 1.000,00 — inalterado");
    assert.equal(carteiraDepois.id, carteiraAntes.id);
    assert.equal(carteiraDepois.atualizadoEm, carteiraAntes.atualizadoEm, "carteira inalterada");
    assert.equal(
      ambiente.db.prepare("SELECT COUNT(*) AS n FROM transacao").get().n,
      transacoesAntes,
      "nenhuma transação financeira é criada pela geração",
    );

    // o resumo da Fase 10.2 passa a considerar as contas em aberto, mas o
    // dinheiro continua onde estava (obrigação registrada ≠ dinheiro gasto)
    const resumo = ambiente.servicoContas.resumo(jogador.id, { hoje: HOJE_FIXO });
    assert.equal(resumo.total, 3);
    assert.equal(resumo.valorEsperadoEmAberto, 36000, "R$ 360,00 em obrigações esperadas");
    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 100000);
  } finally {
    liberar(ambiente);
  }
});

// ---- Persistência ----
test("persistência: contas geradas sobrevivem a fechar/reabrir e seguem idempotentes", () => {
  const dir = mkdtempSync(join(tmpdir(), "pulso-geracao-persistente-"));
  let db = new DatabaseSync(join(dir, "pulso.db"));
  let recorrenciaId;
  try {
    db.exec("PRAGMA foreign_keys = ON");
    aplicarMigracoes(db);
    const repositorioJogador = new RepositorioJogador(db);
    const repositorioServico = new RepositorioServico(db);
    const servicoJogador = new ServicoJogador({ repositorio: repositorioJogador, banco: db, aoCriar: () => {} });
    const servicoServicos = new ServicoServicos({ repositorio: repositorioServico, repositorioJogador });
    const servicoRecorrencias = new ServicoRecorrencias({
      repositorio: new RepositorioRecorrencia(db), repositorioServico, repositorioJogador,
    });
    const servicoGeracao = new ServicoGeracaoOcorrencias({
      repositorioRecorrencia: new RepositorioRecorrencia(db),
      repositorioContas: new RepositorioConta(db),
      banco: db,
    });
    const jogador = servicoJogador.criar({ nome: "Persistente" });
    const servico = servicoServicos.criar(jogador.id, {
      nome: "Internet", categoria: "telecomunicacoes", valorEsperado: 12000,
    });
    const recorrencia = servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-09-01",
      diaVencimento: 15, valorEsperado: 12000,
    });
    recorrenciaId = recorrencia.id;
    const geracao = servicoGeracao.gerar(recorrencia.id, {
      periodoInicio: "2026-10-01", periodoFim: "2026-11-30", hoje: HOJE_FIXO,
    });
    assert.equal(geracao.criadas, 2);
    db.close();

    // reabre o MESMO arquivo
    db = new DatabaseSync(join(dir, "pulso.db"));
    db.exec("PRAGMA foreign_keys = ON");
    const servicoGeracao2 = new ServicoGeracaoOcorrencias({
      repositorioRecorrencia: new RepositorioRecorrencia(db),
      repositorioContas: new RepositorioConta(db),
      banco: db,
    });

    const refeito = servicoGeracao2.gerar(recorrenciaId, {
      periodoInicio: "2026-10-01", periodoFim: "2026-11-30", hoje: HOJE_FIXO,
    });
    assert.deepEqual(
      { encontradas: refeito.encontradas, criadas: refeito.criadas, existentes: refeito.existentes },
      { encontradas: 2, criadas: 0, existentes: 2 },
      "após reabrir o banco, a mesma geração não duplica nada",
    );
    const persistidas = db
      .prepare("SELECT referencia, vencimento, valor_esperado_centavos, estado, recorrencia_id FROM servico_conta ORDER BY referencia")
      .all();
    assert.deepEqual(persistidas.map((c) => [c.referencia, c.vencimento]), [
      ["2026-10", "2026-10-15"],
      ["2026-11", "2026-11-15"],
    ]);
    assert.ok(persistidas.every((c) => c.estado === "pendente"));
    assert.ok(persistidas.every((c) => c.recorrencia_id === recorrenciaId), "vínculo persistido");
  } finally {
    try { db.close(); } catch { /* já fechado */ }
    rmSync(dir, { recursive: true, force: true });
  }
});