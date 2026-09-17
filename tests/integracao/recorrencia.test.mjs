/**
 * PULSO — Testes de integração: Recorrências (Fase 10.3)
 *
 * Cobre: cadastro, persistência, consulta, edição, ativação/desativação,
 * arquivamento (terminal), relação com o serviço, isolamento por jogador,
 * validações (datas, frequência, valor), filtros, persistência fechar/reabrir,
 * operações inválidas em arquivada e o TESTE OBRIGATÓRIO:
 * criar uma recorrência NÃO gera conta, NÃO cria transação e NÃO altera o saldo.
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
import { RepositorioRecorrencia } from "../../src/core/database/repositorios/recorrencia.js";
import { RepositorioCarteira } from "../../src/core/database/repositorios/carteira.js";
import { RepositorioTransacao } from "../../src/core/database/repositorios/transacao.js";
import { RepositorioOrcamento } from "../../src/core/database/repositorios/orcamento.js";
import { ServicoFinanca } from "../../src/core/aplicacao/servico-financa.js";
import { ServicoJogador } from "../../src/core/aplicacao/servico-jogador.js";
import { ServicoServicos } from "../../src/core/aplicacao/servico-servicos.js";
import { ServicoRecorrencias } from "../../src/core/aplicacao/servico-recorrencias.js";
import { dataComDiaAjustado } from "../../src/core/dominio/recorrencia.js";
import { ErroValidacao, ErroConflito, ErroTransicao } from "../../src/core/erros.js";

/** Monta um ambiente isolado (banco temporário + serviços do núcleo). */
function criarAmbiente() {
  const dir = mkdtempSync(join(tmpdir(), "pulso-recorrencia-"));
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
  const servicoRecorrencias = new ServicoRecorrencias({
    repositorio: new RepositorioRecorrencia(db),
    repositorioServico,
    repositorioJogador,
  });
  return { dir, db, servicoJogador, servicoFinanca, servicoServicos, servicoRecorrencias, repositorioJogador };
}

function liberar({ dir, db }) {
  try {
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Jogador + serviço "Internet" prontos para receber recorrências. */
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
test("recorrência: criar, persistir, consultar e editar", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id,
      frequencia: "mensal",
      dataInicio: "2026-09-01",
      dataFim: null,
      diaVencimento: 15,
      descricao: "Internet mensal",
      valorEsperado: 12000,
    });
    assert.ok(recorrencia.id > 0);
    assert.equal(recorrencia.jogadorId, jogador.id);
    assert.equal(recorrencia.servicoId, servico.id);
    assert.equal(recorrencia.frequencia, "mensal");
    assert.equal(recorrencia.dataInicio, "2026-09-01");
    assert.equal(recorrencia.dataFim, null);
    assert.equal(recorrencia.diaVencimento, 15);
    assert.equal(recorrencia.valorEsperado, 12000, "valor em centavos");
    assert.equal(recorrencia.estado, "ativa", "recorrência criada nasce ATIVA");
    assert.ok(recorrencia.criadoEm);
    assert.equal(recorrencia.arquivadoEm, null);

    const relida = ambiente.servicoRecorrencias.obter(recorrencia.id);
    assert.equal(relida.frequencia, "mensal");
    assert.equal(relida.descricao, "Internet mensal");

    const editada = ambiente.servicoRecorrencias.atualizar(recorrencia.id, {
      frequencia: "trimestral",
      diaVencimento: 20,
      valorEsperado: 13500,
      dataFim: "2027-09-01",
      descricao: "Internet trimestral",
    });
    assert.equal(editada.frequencia, "trimestral");
    assert.equal(editada.diaVencimento, 20);
    assert.equal(editada.valorEsperado, 13500);
    assert.equal(editada.dataFim, "2027-09-01");
    assert.equal(editada.descricao, "Internet trimestral");
    assert.equal(editada.servicoId, servico.id, "serviço não muda na edição");
    assert.equal(editada.estado, "ativa");
  } finally {
    liberar(ambiente);
  }
});

// ---- Ciclo de vida: ativação, desativação, arquivamento ----
test("recorrência: nasce ativa, desativa, reativa e arquiva (terminal)", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id,
      frequencia: "mensal",
      dataInicio: "2026-09-01",
      diaVencimento: 10,
      valorEsperado: 8000,
    });
    assert.equal(recorrencia.estado, "ativa");

    const inativa = ambiente.servicoRecorrencias.desativar(recorrencia.id);
    assert.equal(inativa.estado, "inativa");

    const reativada = ambiente.servicoRecorrencias.ativar(recorrencia.id);
    assert.equal(reativada.estado, "ativa");

    const arquivada = ambiente.servicoRecorrencias.arquivar(recorrencia.id);
    assert.equal(arquivada.estado, "arquivada");
    assert.ok(arquivada.arquivadoEm, "arquivamento grava arquivado_em");

    // operações inválidas em recorrência arquivada
    assert.throws(() => ambiente.servicoRecorrencias.ativar(recorrencia.id), ErroTransicao);
    assert.throws(() => ambiente.servicoRecorrencias.desativar(recorrencia.id), ErroTransicao);
    assert.throws(() => ambiente.servicoRecorrencias.arquivar(recorrencia.id), ErroTransicao);
    assert.throws(
      () => ambiente.servicoRecorrencias.atualizar(recorrencia.id, { valorEsperado: 9000 }),
      ErroValidacao,
      "arquivada não pode ser editada",
    );
  } finally {
    liberar(ambiente);
  }
});

// ---- Relação com o serviço ----
test("recorrência: serviço inexistente ou de outro jogador é rejeitado", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    // segundo jogador inserido direto no repositório (a aplicação é single-player;
    // aqui testamos o isolamento da REGRA de recorrência, não o limite de jogador)
    const outro = ambiente.repositorioJogador.criar({ nome: "Outro", codinome: null });

    assert.throws(
      () =>
        ambiente.servicoRecorrencias.criar(jogador.id, {
          servicoId: 99999,
          frequencia: "mensal",
          dataInicio: "2026-09-01",
          diaVencimento: 15,
          valorEsperado: 12000,
        }),
      ErroConflito,
      "serviço inexistente é rejeitado",
    );

    assert.throws(
      () =>
        ambiente.servicoRecorrencias.criar(outro.id, {
          servicoId: servico.id,
          frequencia: "mensal",
          dataInicio: "2026-09-01",
          diaVencimento: 15,
          valorEsperado: 12000,
        }),
      ErroValidacao,
      "serviço de outro jogador é rejeitado",
    );

    assert.equal(
      ambiente.db.prepare("SELECT COUNT(*) AS n FROM servico_recorrencia").get().n,
      0,
      "nenhuma recorrência foi criada nas tentativas inválidas",
    );
  } finally {
    liberar(ambiente);
  }
});

// ---- Validações ----
test("recorrência: valida datas (término antes do início), frequência e valor", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const base = {
      servicoId: servico.id,
      frequencia: "mensal",
      dataInicio: "2026-09-01",
      diaVencimento: 15,
      valorEsperado: 12000,
    };

    // datas
    assert.throws(
      () => ambiente.servicoRecorrencias.criar(jogador.id, { ...base, dataInicio: "2026-13-01" }),
      ErroValidacao,
      "início com mês inexistente é rejeitado",
    );
    assert.throws(
      () => ambiente.servicoRecorrencias.criar(jogador.id, { ...base, dataInicio: "2026-02-30" }),
      ErroValidacao,
      "início em data inexistente é rejeitado",
    );
    assert.throws(
      () => ambiente.servicoRecorrencias.criar(jogador.id, { ...base, dataInicio: null }),
      ErroValidacao,
      "data de início é obrigatória",
    );
    assert.throws(
      () => ambiente.servicoRecorrencias.criar(jogador.id, { ...base, dataFim: "2026-08-31" }),
      ErroValidacao,
      "término anterior ao início é rejeitado",
    );
    // término IGUAL ao início é válido (regra: não pode ser ANTERIOR)
    const mesmoDia = ambiente.servicoRecorrencias.criar(jogador.id, {
      ...base, dataFim: base.dataInicio,
    });
    assert.equal(mesmoDia.dataFim, base.dataInicio);

    // frequência inválida (fora da lista controlada)
    assert.throws(
      () => ambiente.servicoRecorrencias.criar(jogador.id, { ...base, frequencia: "quinzenal" }),
      ErroValidacao,
    );
    // valor inválido (negativo, zero, fracionário)
    assert.throws(
      () => ambiente.servicoRecorrencias.criar(jogador.id, { ...base, valorEsperado: -12000 }),
      ErroValidacao,
      "valor negativo é rejeitado",
    );
    assert.throws(
      () => ambiente.servicoRecorrencias.criar(jogador.id, { ...base, valorEsperado: 0 }),
      ErroValidacao,
      "valor zero é rejeitado",
    );
    assert.throws(
      () => ambiente.servicoRecorrencias.criar(jogador.id, { ...base, valorEsperado: 120.5 }),
      ErroValidacao,
      "valor fracionário é rejeitado",
    );
    // dia de vencimento inválido
    assert.throws(
      () => ambiente.servicoRecorrencias.criar(jogador.id, { ...base, diaVencimento: 0 }),
      ErroValidacao,
    );
    assert.throws(
      () => ambiente.servicoRecorrencias.criar(jogador.id, { ...base, diaVencimento: 32 }),
      ErroValidacao,
    );

    // edição: término anterior ao início COMBINADO é rejeitado
    const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, base);
    assert.throws(
      () => ambiente.servicoRecorrencias.atualizar(recorrencia.id, { dataInicio: "2027-01-01", dataFim: "2026-12-31" }),
      ErroValidacao,
      "edição não pode deixar o término antes do início",
    );
    // edição de estado direto é bloqueada (só por ações de domínio)
    assert.throws(
      () => ambiente.servicoRecorrencias.atualizar(recorrencia.id, { estado: "inativa" }),
      ErroValidacao,
    );
    // edição sem campo válido é bloqueada
    assert.throws(
      () => ambiente.servicoRecorrencias.atualizar(recorrencia.id, {}),
      ErroValidacao,
    );
    // serviço não pode ser trocado na edição
    assert.throws(
      () => ambiente.servicoRecorrencias.atualizar(recorrencia.id, { servicoId: servico.id + 999 }),
      ErroValidacao,
    );
    // jogador dono não pode ser trocado na edição
    assert.throws(
      () => ambiente.servicoRecorrencias.atualizar(recorrencia.id, { jogadorId: jogador.id + 999 }),
      ErroValidacao,
    );
  } finally {
    liberar(ambiente);
  }
});

// ---- Isolamento por jogador e filtros ----
test("recorrência: isolamento por jogador e filtros por estado/serviço", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador: joao, servico: internet } = prepararCenario(ambiente, "João");
    // segundo jogador direto no repositório (single-player da aplicação)
    const maria = ambiente.repositorioJogador.criar({ nome: "Maria", codinome: null });
    const academia = ambiente.servicoServicos.criar(maria.id, {
      nome: "Academia", categoria: "saude", valorEsperado: 10000,
    });

    const mensal = ambiente.servicoRecorrencias.criar(joao.id, {
      servicoId: internet.id, frequencia: "mensal", dataInicio: "2026-09-01",
      diaVencimento: 10, valorEsperado: 12000,
    });
    const anual = ambiente.servicoRecorrencias.criar(joao.id, {
      servicoId: internet.id, frequencia: "anual", dataInicio: "2026-01-01",
      diaVencimento: 5, valorEsperado: 100000,
    });
    ambiente.servicoRecorrencias.desativar(anual.id);
    ambiente.servicoRecorrencias.criar(maria.id, {
      servicoId: academia.id, frequencia: "mensal", dataInicio: "2026-09-05",
      diaVencimento: 5, valorEsperado: 10000,
    });

    // isolamento: João só vê as suas duas; Maria só vê a dela
    const doJoao = ambiente.servicoRecorrencias.listar(joao.id);
    assert.equal(doJoao.length, 2);
    assert.ok(doJoao.every((r) => r.jogadorId === joao.id));
    const daMaria = ambiente.servicoRecorrencias.listar(maria.id);
    assert.equal(daMaria.length, 1);
    assert.ok(daMaria.every((r) => r.jogadorId === maria.id));

    // filtros por estado
    assert.equal(ambiente.servicoRecorrencias.listar(joao.id, { estado: "ativa" }).length, 1);
    assert.equal(ambiente.servicoRecorrencias.listar(joao.id, { estado: "inativa" }).length, 1);
    assert.equal(ambiente.servicoRecorrencias.listar(joao.id, { estado: "arquivada" }).length, 0);

    // filtro por serviço
    const porInternet = ambiente.servicoRecorrencias.listar(joao.id, { servicoId: internet.id });
    assert.equal(porInternet.length, 2);
    assert.ok(porInternet.every((r) => r.servicoId === internet.id));

    // estado inválido em filtro é rejeitado
    assert.throws(
      () => ambiente.servicoRecorrencias.listar(joao.id, { estado: "ativa2" }),
      ErroValidacao,
    );

    // resumo
    const resumoJoao = ambiente.servicoRecorrencias.resumo(joao.id);
    assert.equal(resumoJoao.ativas, 1);
    assert.equal(resumoJoao.inativas, 1);
    assert.equal(resumoJoao.arquivadas, 0);
    assert.equal(resumoJoao.total, 2);
    assert.equal(resumoJoao.valorEsperadoAtivas, 12000);
  } finally {
    liberar(ambiente);
  }
});

// ---- Regras mensal e anual armazenadas (o cálculo da ocorrência é da 10.4) ----
test("recorrência: regras mensal e anual persistem; dia 31 é resolvido pela regra do último dia", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);
    const mensal = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-01-31",
      diaVencimento: 31, valorEsperado: 12000,
    });
    const anual = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "anual", dataInicio: "2026-01-01",
      diaVencimento: 1, valorEsperado: 120000,
    });
    assert.equal(mensal.frequencia, "mensal");
    assert.equal(mensal.diaVencimento, 31);
    assert.equal(anual.frequencia, "anual");

    // A REGRA pura do domínio: dia 31 cai no último dia válido do mês.
    // A recorrência armazenada NÃO muda; a geração de contas é a Fase 10.4.
    assert.equal(dataComDiaAjustado(2026, 2, mensal.diaVencimento), "2026-02-28");
    assert.equal(dataComDiaAjustado(2024, 2, mensal.diaVencimento), "2024-02-29");
    assert.equal(dataComDiaAjustado(2026, 4, mensal.diaVencimento), "2026-04-30");
    assert.equal(dataComDiaAjustado(2027, 1, anual.diaVencimento), "2027-01-01");

    // nenhuma conta foi criada (a regra não gera ocorrências)
    assert.equal(ambiente.db.prepare("SELECT COUNT(*) AS n FROM servico_conta").get().n, 0);
  } finally {
    liberar(ambiente);
  }
});

// ---- TESTE CRÍTICO: a recorrência não é uma conta e não é dinheiro ----
test("teste obrigatório: criar/editar/ativar recorrência de R$ 120,00 não altera o saldo, não cria conta e não cria transação", () => {
  const ambiente = criarAmbiente();
  try {
    const { jogador, servico } = prepararCenario(ambiente);

    // carteira com saldo conhecido: uma receita de R$ 1.000,00
    ambiente.servicoFinanca.criarTransacao(jogador.id, {
      tipo: "receita", valorCentavos: 100000, categoria: "salario",
      data: "2026-09-01", descricao: "Salário de setembro",
    });
    assert.equal(ambiente.servicoFinanca.obterCarteira(jogador.id).saldo, 100000, "saldo antes: R$ 1.000,00");
    const transacoesAntes = ambiente.db.prepare("SELECT COUNT(*) AS n FROM transacao").get().n;
    const contasAntes = ambiente.db.prepare("SELECT COUNT(*) AS n FROM servico_conta").get().n;
    assert.equal(contasAntes, 0);

    // criar a RECORRÊNCIA de R$ 120,00 (12000 centavos)
    const recorrencia = ambiente.servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id,
      frequencia: "mensal",
      dataInicio: "2026-09-01",
      diaVencimento: 15,
      valorEsperado: 12000,
    });
    assert.equal(recorrencia.valorEsperado, 12000, "recorrência de R$ 120,00");

    // verificar carteira: saldo permanece EXATAMENTE igual
    assert.equal(
      ambiente.servicoFinanca.obterCarteira(jogador.id).saldo,
      100000,
      "saldo depois: R$ 1.000,00 — inalterado pela criação da recorrência",
    );
    // nenhuma conta e nenhuma transação financeira foram criadas
    assert.equal(
      ambiente.db.prepare("SELECT COUNT(*) AS n FROM servico_conta").get().n,
      0,
      "NENHUMA conta é gerada ao criar a recorrência (geração é a Fase 10.4)",
    );
    assert.equal(
      ambiente.db.prepare("SELECT COUNT(*) AS n FROM transacao").get().n,
      transacoesAntes,
      "nenhuma transação financeira é criada",
    );

    // editar, desativar e reativar também não movimentam nada
    ambiente.servicoRecorrencias.atualizar(recorrencia.id, { valorEsperado: 13500, diaVencimento: 20 });
    ambiente.servicoRecorrencias.desativar(recorrencia.id);
    ambiente.servicoRecorrencias.ativar(recorrencia.id);

    assert.equal(
      ambiente.servicoFinanca.obterCarteira(jogador.id).saldo,
      100000,
      "editar/ativar/desativar também não movimentam o saldo",
    );
    assert.equal(ambiente.db.prepare("SELECT COUNT(*) AS n FROM servico_conta").get().n, 0);
    assert.equal(ambiente.db.prepare("SELECT COUNT(*) AS n FROM transacao").get().n, transacoesAntes);

    // arquivar também não movimenta nada
    ambiente.servicoRecorrencias.arquivar(recorrencia.id);
    assert.equal(
      ambiente.servicoFinanca.obterCarteira(jogador.id).saldo,
      100000,
      "arquivar não movimenta o saldo",
    );
    assert.equal(ambiente.db.prepare("SELECT COUNT(*) AS n FROM servico_conta").get().n, 0);
    assert.equal(ambiente.db.prepare("SELECT COUNT(*) AS n FROM transacao").get().n, transacoesAntes);
  } finally {
    liberar(ambiente);
  }
});

// ---- Persistência ----
test("recorrência: persistência — fechar e reabrir o banco mantém as recorrências", () => {
  const dir = mkdtempSync(join(tmpdir(), "pulso-recorrencia-persistente-"));
  let db = new DatabaseSync(join(dir, "pulso.db"));
  try {
    db.exec("PRAGMA foreign_keys = ON");
    aplicarMigracoes(db);
    const repositorioJogador = new RepositorioJogador(db);
    const repositorioServico = new RepositorioServico(db);
    const servicoServicos = new ServicoServicos({ repositorio: repositorioServico, repositorioJogador });
    const servicoJogador = new ServicoJogador({ repositorio: repositorioJogador, banco: db, aoCriar: () => {} });
    const servicoRecorrencias = new ServicoRecorrencias({
      repositorio: new RepositorioRecorrencia(db), repositorioServico, repositorioJogador,
    });
    const jogador = servicoJogador.criar({ nome: "Persistente" });
    const servico = servicoServicos.criar(jogador.id, {
      nome: "Internet", categoria: "telecomunicacoes", valorEsperado: 12000,
    });
    const recorrencia = servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "mensal", dataInicio: "2026-09-01",
      descricao: "Fatura", diaVencimento: 15, valorEsperado: 12000,
    });
    const desativadaDepois = servicoRecorrencias.criar(jogador.id, {
      servicoId: servico.id, frequencia: "anual", dataInicio: "2026-01-01",
      diaVencimento: 5, valorEsperado: 100000,
    });
    servicoRecorrencias.desativar(desativadaDepois.id);
    db.close();

    // reabre o MESMO arquivo
    db = new DatabaseSync(join(dir, "pulso.db"));
    db.exec("PRAGMA foreign_keys = ON");
    const repositorioJogador2 = new RepositorioJogador(db);
    const repositorioServico2 = new RepositorioServico(db);
    const servicoRecorrencias2 = new ServicoRecorrencias({
      repositorio: new RepositorioRecorrencia(db),
      repositorioServico: repositorioServico2,
      repositorioJogador: repositorioJogador2,
    });
    const relida = servicoRecorrencias2.obter(recorrencia.id);
    assert.equal(relida.frequencia, "mensal");
    assert.equal(relida.dataInicio, "2026-09-01");
    assert.equal(relida.descricao, "Fatura");
    assert.equal(relida.diaVencimento, 15);
    assert.equal(relida.valorEsperado, 12000);
    assert.equal(relida.jogadorId, jogador.id);
    assert.equal(relida.estado, "ativa");
    assert.equal(servicoRecorrencias2.listar(jogador.id).length, 2);
    assert.equal(servicoRecorrencias2.obter(desativadaDepois.id).estado, "inativa");
    assert.equal(servicoRecorrencias2.listarInativas(jogador.id).length, 1);
  } finally {
    try { db.close(); } catch { /* já fechado */ }
    rmSync(dir, { recursive: true, force: true });
  }
});
