/**
 * PULSO — Testes de integração: Dashboard (Fase 15)
 *
 * O dashboard é uma CAMADA DE CONSOLIDAÇÃO: estes testes validam que os
 * valores exibidos CORRESPONDEM aos sistemas de origem (Fases 03–10), sem
 * banco próprio, sem dados fictícios e sem escrita.
 *
 * Cobre: jogador sem dados adicionais; jogador com missões; com projetos e
 * progresso; dados financeiros e filtro de período (saldo atual constante);
 * contas vencidas (destacadas sem alterar o estado persistido); contas
 * próximas; múltiplos dados simultaneamente; atualização após criar/concluir
 * entidade e após transação financeira; persistência após reinicialização.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { aplicarMigracoes } from "../../src/core/database/migracoes.js";
import { RepositorioJogador } from "../../src/core/database/repositorios/jogador.js";
import { RepositorioStatus } from "../../src/core/database/repositorios/status.js";
import { RepositorioMissao } from "../../src/core/database/repositorios/missao.js";
import { RepositorioProjeto } from "../../src/core/database/repositorios/projeto.js";
import { RepositorioProgressao } from "../../src/core/database/repositorios/progressao.js";
import { RepositorioAtributos } from "../../src/core/database/repositorios/atributos.js";
import { RepositorioCarteira } from "../../src/core/database/repositorios/carteira.js";
import { RepositorioTransacao } from "../../src/core/database/repositorios/transacao.js";
import { RepositorioOrcamento } from "../../src/core/database/repositorios/orcamento.js";
import { RepositorioServico } from "../../src/core/database/repositorios/servico.js";
import { RepositorioConta } from "../../src/core/database/repositorios/conta.js";
import { ServicoJogador } from "../../src/core/aplicacao/servico-jogador.js";
import { ServicoStatus } from "../../src/core/aplicacao/servico-status.js";
import { ServicoMissao } from "../../src/core/aplicacao/servico-missao.js";
import { ServicoProjeto } from "../../src/core/aplicacao/servico-projeto.js";
import { ServicoProgressao } from "../../src/core/aplicacao/servico-progressao.js";
import { ServicoFinanca } from "../../src/core/aplicacao/servico-financa.js";
import { ServicoServicos } from "../../src/core/aplicacao/servico-servicos.js";
import { ServicoContas } from "../../src/core/aplicacao/servico-contas.js";
import { ServicoDashboard } from "../../src/core/aplicacao/servico-dashboard.js";
import { ErroConflito } from "../../src/core/erros.js";

/** Instante fixo do dashboard: 21/09/2026 (mês do período padrão). */
const AGORA = () => new Date(2026, 8, 21, 12, 0, 0);
/** Datas civis independentes do relógio da máquina (AAAA-MM-DD). */
const PASSADO = "2020-01-01";
const FUTURO = "2999-01-01";
/** Prazos de missão/projeto são persistidos em ISO pelo domínio. */
const PRAZO_PASSADO = new Date(PASSADO).toISOString();
const PRAZO_FUTURO = new Date(FUTURO).toISOString();

/** Liga todos os serviços existentes sobre uma conexão já migrada. */
function montarServicos(db, { agora = AGORA } = {}) {
  const repositorioJogador = new RepositorioJogador(db);
  const repositorioStatus = new RepositorioStatus(db);
  const repositorioMissao = new RepositorioMissao(db);
  const repositorioProjeto = new RepositorioProjeto(db);
  const repositorioProgressao = new RepositorioProgressao(db);
  const repositorioAtributos = new RepositorioAtributos(db);
  const repositorioServico = new RepositorioServico(db);
  const repositorioConta = new RepositorioConta(db);

  const servicoFinanca = new ServicoFinanca({
    repositorioCarteira: new RepositorioCarteira(db),
    repositorioTransacao: new RepositorioTransacao(db),
    repositorioOrcamento: new RepositorioOrcamento(db),
    repositorioJogador,
  });
  const servicoStatus = new ServicoStatus({ repositorio: repositorioStatus, repositorioJogador });
  const servicoProgressao = new ServicoProgressao({
    repositorioProgressao, repositorioAtributos, repositorioJogador, banco: db,
  });
  const servicoJogador = new ServicoJogador({
    repositorio: repositorioJogador,
    banco: db,
    aoCriar: (jogador) => {
      servicoStatus.criarInicial(jogador.id);
      servicoProgressao.criarInicial(jogador.id);
      servicoFinanca.criarCarteiraInicial(jogador.id);
    },
  });
  const servicoMissao = new ServicoMissao({ repositorio: repositorioMissao });
  const servicoProjeto = new ServicoProjeto({
    repositorio: repositorioProjeto, repositorioMissao, repositorioJogador,
  });
  const servicoServicos = new ServicoServicos({ repositorio: repositorioServico, repositorioJogador });
  const servicoContas = new ServicoContas({
    repositorio: repositorioConta, repositorioServico, repositorioJogador,
  });

  const servicoDashboard = new ServicoDashboard({
    servicoJogador, servicoStatus, servicoProgressao, servicoMissao,
    servicoProjeto, servicoFinanca, servicoServicos, servicoContas, agora,
  });

  return {
    servicoJogador, servicoStatus, servicoProgressao, servicoMissao, servicoProjeto,
    servicoFinanca, servicoServicos, servicoContas, servicoDashboard,
    repositorioJogador, repositorioMissao, repositorioProjeto, repositorioConta,
  };
}

/** Ambiente isolado: banco temporário + serviços + dashboard (instante fixo). */
function criarAmbiente(opcoes = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pulso-dashboard-"));
  const caminho = join(dir, "pulso.db");
  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA foreign_keys = ON");
  aplicarMigracoes(db);
  return { dir, caminho, db, ...montarServicos(db, opcoes) };
}

function liberar({ dir, db }) {
  try {
    db.close();
  } catch {
    // já fechado (testes de persistência fecham e reabrem o arquivo)
  }
  rmSync(dir, { recursive: true, force: true });
}

/** Jogador padrão com dinheiro inicial de R$ 1.000,00 (setembro/2026). */
function prepararJogador(amb, nome = "Operador") {
  const jogador = amb.servicoJogador.criar({ nome });
  amb.servicoFinanca.criarTransacao(jogador.id, {
    tipo: "receita",
    valorCentavos: 100000,
    categoria: "salario",
    descricao: "Saldo inicial",
    data: "2026-09-01",
  });
  return jogador;
}

// ── Carregamento e estados vazios ────────────────────────────────────────

test("dashboard: sem jogador configurado → conflito (nada consultado)", () => {
  const amb = criarAmbiente();
  try {
    assert.throws(() => amb.servicoDashboard.visao(), ErroConflito);
  } finally {
    liberar(amb);
  }
});

test("jogador sem dados adicionais: dashboard funcional, zeros reais", () => {
  const amb = criarAmbiente();
  try {
    const jogador = amb.servicoJogador.criar({ nome: "Operador Zero", codinome: "zero" });
    const visao = amb.servicoDashboard.visao();

    assert.equal(visao.jogador.nome, "Operador Zero");
    assert.equal(visao.jogador.codinome, "zero");
    // status inicial (Fase 04) e progressão inicial (Fase 06) — nada inventado
    assert.deepEqual(
      { e: visao.status.energia, f: visao.status.foco, x: visao.status.estresse, c: visao.status.criatividade },
      { e: 100, f: 100, x: 0, c: 100 },
    );
    assert.equal(visao.progressao.nivel, 1);
    assert.equal(visao.progressao.xpTotal, 0);
    assert.equal(visao.progressao.pontosDisponiveis, 0);
    assert.equal(visao.progressao.atributos.tecnologia, 1);
    assert.deepEqual(visao.missoes, {
      total: 0, pendentes: 0, emAndamento: 0, concluidas: 0, canceladas: 0, atrasadas: 0,
    });
    assert.equal(visao.projetos.total, 0);
    assert.deepEqual(visao.projetos.emAndamentoLista, []);
    // carteira existe (Fase 08) com saldo zero — sem transações
    assert.equal(visao.financas.saldoAtualCentavos, 0);
    assert.equal(visao.financas.receitasPeriodoCentavos, 0);
    assert.equal(visao.financas.despesasPeriodoCentavos, 0);
    assert.deepEqual(visao.financas.orcamentos, []);
    assert.equal(visao.contas.total, 0);
    assert.equal(visao.contas.valorEmAbertoCentavos, 0);
    assert.deepEqual(visao.contas.proximas, []);
    assert.equal(visao.servicos.total, 0);
    assert.equal(visao.jogador.id, jogador.id);
  } finally {
    liberar(amb);
  }
});

// ── Missões: contagens correspondem ao módulo de origem (Fase 05) ────────

test("missões: contagens conferem com a lista do serviço de missões", () => {
  const amb = criarAmbiente();
  try {
    const jogador = prepararJogador(amb);
    const pendente = amb.servicoMissao.criar(jogador.id, { titulo: "Pendente no prazo", prazo: PRAZO_FUTURO });
    amb.servicoMissao.criar(jogador.id, { titulo: "Atrasada", prazo: PRAZO_PASSADO });
    const andamento = amb.servicoMissao.criar(jogador.id, { titulo: "Andamento" });
    amb.servicoMissao.iniciar(andamento.id);
    const concluida = amb.servicoMissao.criar(jogador.id, { titulo: "Concluída" });
    amb.servicoMissao.iniciar(concluida.id);
    amb.servicoMissao.concluir(concluida.id);
    const cancelada = amb.servicoMissao.criar(jogador.id, { titulo: "Cancelada" });
    amb.servicoMissao.cancelar(cancelada.id);

    const visao = amb.servicoDashboard.visao();
    assert.equal(visao.missoes.total, 5);
    assert.equal(visao.missoes.pendentes, 2);
    assert.equal(visao.missoes.emAndamento, 1);
    assert.equal(visao.missoes.concluidas, 1);
    assert.equal(visao.missoes.canceladas, 1);
    assert.equal(visao.missoes.atrasadas, 1);

    // conferência independente contra a fonte (serviço de missões)
    const missoes = amb.servicoMissao.listar(jogador.id);
    assert.equal(visao.missoes.total, missoes.length);
    assert.equal(visao.missoes.pendentes, missoes.filter((m) => m.estado === "pendente").length);
    assert.equal(visao.missoes.emAndamento, missoes.filter((m) => m.estado === "em_andamento").length);
    assert.equal(visao.missoes.concluidas, missoes.filter((m) => m.estado === "concluida").length);
    assert.equal(visao.missoes.canceladas, missoes.filter((m) => m.estado === "cancelada").length);
    assert.equal(visao.missoes.atrasadas, missoes.filter((m) => m.prazo === PRAZO_PASSADO).length);
    assert.equal(pendente.estado, "pendente");
  } finally {
    liberar(amb);
  }
});

// ── Projetos: progresso vem da Fase 07 ───────────────────────────────────

test("projetos: contagens e progresso correspondem ao serviço de projetos", () => {
  const amb = criarAmbiente();
  try {
    const jogador = prepararJogador(amb);
    const projeto = amb.servicoProjeto.criar(jogador.id, { titulo: "Projeto Piloto", prazo: PRAZO_FUTURO });
    const m1 = amb.servicoMissao.criar(jogador.id, { titulo: "Parte 1" });
    const m2 = amb.servicoMissao.criar(jogador.id, { titulo: "Parte 2" });
    amb.servicoProjeto.associarMissao(projeto.id, m1.id);
    amb.servicoProjeto.associarMissao(projeto.id, m2.id);
    amb.servicoProjeto.iniciar(projeto.id);
    amb.servicoMissao.iniciar(m1.id);
    amb.servicoMissao.concluir(m1.id);
    const atrasado = amb.servicoProjeto.criar(jogador.id, { titulo: "Atrasado", prazo: PRAZO_PASSADO });
    amb.servicoProjeto.iniciar(atrasado.id);

    const visao = amb.servicoDashboard.visao();
    const origem = amb.servicoProjeto.listar(jogador.id);
    assert.equal(visao.projetos.total, origem.length);
    assert.equal(visao.projetos.emAndamento, 2);
    assert.equal(visao.projetos.atrasados, 1);
    assert.equal(visao.projetos.emAndamentoLista.length, 2);

    // progresso e atraso exibidos são EXATAMENTE os do serviço (Fase 07)
    const pilotoOrigem = origem.find((p) => p.id === projeto.id);
    const pilotoVisao = visao.projetos.emAndamentoLista.find((p) => p.id === projeto.id);
    assert.equal(pilotoVisao.progresso, pilotoOrigem.progresso);
    assert.equal(pilotoVisao.missoesConcluidas, pilotoOrigem.missoesConcluidas);
    assert.equal(pilotoVisao.totalMissoes, 2);
    assert.equal(pilotoVisao.atrasado, pilotoOrigem.atrasado);
  } finally {
    liberar(amb);
  }
});

// ── Finanças (Fase 08): valores e filtro de período ──────────────────────

test("finanças: receitas/despesas do período e saldo atual vêm da Fase 08", () => {
  const amb = criarAmbiente();
  try {
    const jogador = prepararJogador(amb); // +R$ 1.000,00 em setembro
    amb.servicoFinanca.criarTransacao(jogador.id, {
      tipo: "despesa", valorCentavos: 25000, categoria: "alimentacao", descricao: "Mercado", data: "2026-09-10",
    });
    amb.servicoFinanca.criarTransacao(jogador.id, {
      tipo: "receita", valorCentavos: 5000, categoria: "outra_receita", descricao: "Extra", data: "2026-09-20",
    });
    // outubro NÃO entra no período padrão (setembro)
    amb.servicoFinanca.criarTransacao(jogador.id, {
      tipo: "despesa", valorCentavos: 9999, categoria: "lazer", descricao: "Outubro", data: "2026-10-05",
    });

    const visao = amb.servicoDashboard.visao(); // setembro/2026 (instante fixo)
    assert.equal(visao.periodo.anoMes, "2026-09");
    assert.equal(visao.financas.receitasPeriodoCentavos, 100000 + 5000);
    assert.equal(visao.financas.despesasPeriodoCentavos, 25000);
    // saldo ATUAL: R$ 1.000 + R$ 50 − R$ 250 − R$ 99,99
    assert.equal(visao.financas.saldoAtualCentavos, 100000 + 5000 - 25000 - 9999);
    assert.equal(visao.financas.moeda, "BRL");

    // conferência direta com a fonte (Fase 08)
    const setembro = amb.servicoFinanca.obterSaldo(jogador.id, { inicio: "2026-09-01", fim: "2026-09-30" });
    assert.equal(visao.financas.receitasPeriodoCentavos, setembro.receitas);
    assert.equal(visao.financas.despesasPeriodoCentavos, setembro.despesas);
    assert.equal(visao.financas.saldoAtualCentavos, amb.servicoFinanca.obterCarteira(jogador.id).saldo);

    // filtro de período: outubro mostra somente a despesa de outubro;
    // o SALDO ATUAL permanece o mesmo
    const outubro = amb.servicoDashboard.visao({ anoMes: "2026-10" });
    assert.equal(outubro.financas.receitasPeriodoCentavos, 0);
    assert.equal(outubro.financas.despesasPeriodoCentavos, 9999);
    assert.equal(outubro.financas.saldoAtualCentavos, visao.financas.saldoAtualCentavos);
    // período sem movimentação: zeros (nunca dados fictícios)
    const vazio = amb.servicoDashboard.visao({ anoMes: "2026-07" });
    assert.equal(vazio.financas.receitasPeriodoCentavos, 0);
    assert.equal(vazio.financas.despesasPeriodoCentavos, 0);
  } finally {
    liberar(amb);
  }
});

test("orçamento: só os vigentes no período, com a situação da Fase 08", () => {
  const amb = criarAmbiente();
  try {
    const jogador = prepararJogador(amb);
    const orcamento = amb.servicoFinanca.criarOrcamento(jogador.id, {
      categoria: "alimentacao", nome: "Alimentação", valorCentavos: 50000,
      inicio: "2026-09-01", fim: "2026-09-30",
    });
    amb.servicoFinanca.criarTransacao(jogador.id, {
      tipo: "despesa", valorCentavos: 20000, categoria: "alimentacao", descricao: "Mercado", data: "2026-09-15",
    });
    const outroMes = amb.servicoFinanca.criarOrcamento(jogador.id, {
      categoria: "lazer", nome: "Lazer", valorCentavos: 10000,
      inicio: "2026-11-01", fim: "2026-11-30",
    });

    const visao = amb.servicoDashboard.visao();
    assert.equal(visao.financas.orcamentos.length, 1);
    const exibido = visao.financas.orcamentos[0];
    assert.equal(exibido.id, orcamento.id);
    assert.equal(exibido.gastoCentavos, 20000);
    assert.equal(exibido.percentual, 0.4);
    assert.equal(exibido.estourado, false);
    // a situação exibida é a calculada pelo serviço financeiro (fonte)
    const origem = amb.servicoFinanca.listarOrcamentos(jogador.id).find((o) => o.id === orcamento.id);
    assert.equal(exibido.gastoCentavos, origem.situacao.gasto);
    assert.equal(exibido.percentual, origem.situacao.percentual);
    assert.equal(visao.financas.orcamentos.some((o) => o.id === outroMes.id), false);
  } finally {
    liberar(amb);
  }
});

// ── Serviços e contas (Fase 10): vencidas destacadas sem alterar dados ───

test("contas: vencidas são contadas sem alterar o estado persistido", () => {
  const amb = criarAmbiente();
  try {
    const jogador = prepararJogador(amb);
    const servico = amb.servicoServicos.criar(jogador.id, { nome: "Internet", categoria: "telecomunicacoes", valorEsperado: 12000 });
    const vencida = amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-08", vencimento: PASSADO, valorEsperado: 12000,
    });
    amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-09", vencimento: FUTURO, valorEsperado: 12000,
    });

    const visao = amb.servicoDashboard.visao();
    assert.equal(visao.contas.vencidas, 1);
    assert.equal(visao.contas.pendentes, 1);
    assert.equal(visao.contas.valorEmAbertoCentavos, 24000);
    assert.equal(visao.servicos.ativos, 1);

    // conferência com a fonte (situação DERIVADA pelo serviço de contas)
    const origem = amb.servicoContas.listar(jogador.id);
    assert.equal(visao.contas.vencidas, origem.filter((c) => c.situacao === "vencida").length);
    assert.equal(visao.contas.pendentes, origem.filter((c) => c.situacao === "pendente").length);

    // o destaque NÃO reescreve nada: o estado persistido segue pendente
    assert.equal(amb.repositorioConta.buscarPorId(vencida.id).estado, "pendente");
    // e nenhuma transação foi criada pelas contas em si
    assert.equal(amb.servicoFinanca.listarTransacoes(jogador.id).length, 1);
  } finally {
    liberar(amb);
  }
});

test("contas: próximas ordenadas por vencimento, limitadas a 5, com nome do serviço", () => {
  const amb = criarAmbiente();
  try {
    const jogador = prepararJogador(amb);
    const internet = amb.servicoServicos.criar(jogador.id, { nome: "Internet", categoria: "telecomunicacoes", valorEsperado: 12000 });
    const luz = amb.servicoServicos.criar(jogador.id, { nome: "Energia", categoria: "moradia", valorEsperado: 8000 });
    // 6 contas em aberto: vencida (mais urgente) + 5 pendentes
    amb.servicoContas.criar(jogador.id, {
      servicoId: internet.id, referencia: "2026-08", vencimento: PASSADO, valorEsperado: 12000,
    });
    const referencias = ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01"];
    const vencimentosPendentes = ["2027-01-10", "2027-02-10", "2027-03-10", "2027-04-10", "2027-05-10"];
    for (const [indice, referencia] of referencias.entries()) {
      amb.servicoContas.criar(jogador.id, {
        servicoId: luz.id,
        referencia,
        vencimento: vencimentosPendentes[indice],
        valorEsperado: 8000,
      });
    }

    const visao = amb.servicoDashboard.visao();
    assert.equal(visao.contas.total, 6);
    assert.equal(visao.contas.proximas.length, 5); // limite do dashboard
    // a vencida aparece primeiro
    assert.equal(visao.contas.proximas[0].situacao, "vencida");
    assert.equal(visao.contas.proximas[0].nomeServico, "Internet");
    // ordenação crescente por vencimento
    const vencimentos = visao.contas.proximas.map((c) => c.vencimento);
    assert.deepEqual(vencimentos, [...vencimentos].sort());
    assert.equal(visao.contas.valorEmAbertoCentavos, 12000 + 5 * 8000);
  } finally {
    liberar(amb);
  }
});

// ── Múltiplos dados simultaneamente ──────────────────────────────────────

test("múltiplos dados: todos os módulos consolidados numa única visão", () => {
  const amb = criarAmbiente();
  try {
    const jogador = prepararJogador(amb);
    // missões
    amb.servicoMissao.criar(jogador.id, { titulo: "Atrasada", prazo: PASSADO });
    const m = amb.servicoMissao.criar(jogador.id, { titulo: "Em curso" });
    amb.servicoMissao.iniciar(m.id);
    // projeto com progresso
    const projeto = amb.servicoProjeto.criar(jogador.id, { titulo: "Projeto" });
    amb.servicoProjeto.associarMissao(projeto.id, m.id);
    amb.servicoProjeto.iniciar(projeto.id);
    // finanças
    amb.servicoFinanca.criarTransacao(jogador.id, {
      tipo: "despesa", valorCentavos: 15000, categoria: "transporte", descricao: "Ônibus", data: "2026-09-05",
    });
    // serviços e contas (1 vencida + 1 pendente)
    const servico = amb.servicoServicos.criar(jogador.id, { nome: "Streaming", categoria: "assinaturas", valorEsperado: 4000 });
    amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-08", vencimento: PASSADO, valorEsperado: 4000,
    });
    amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-09", vencimento: FUTURO, valorEsperado: 4000,
    });
    amb.servicoStatus.alterar(jogador.id, "energia", -30);

    const visao = amb.servicoDashboard.visao();
    assert.equal(visao.missoes.total, 2);
    assert.equal(visao.missoes.atrasadas, 1);
    assert.equal(visao.projetos.emAndamento, 1);
    assert.equal(visao.projetos.emAndamentoLista[0].totalMissoes, 1);
    assert.equal(visao.financas.receitasPeriodoCentavos, 100000);
    assert.equal(visao.financas.despesasPeriodoCentavos, 15000);
    assert.equal(visao.contas.vencidas, 1);
    assert.equal(visao.contas.pendentes, 1);
    assert.equal(visao.servicos.ativos, 1);
    assert.equal(visao.status.energia, 70);
    assert.equal(visao.jogador.id, jogador.id);
  } finally {
    liberar(amb);
  }
});

// ── Atualização após criar/concluir entidades e após transação ───────────

test("atualização: criar/concluir missão, criar projeto e lançar transação mudam a visão", () => {
  const amb = criarAmbiente();
  try {
    const jogador = prepararJogador(amb);
    const antes = amb.servicoDashboard.visao();
    assert.equal(antes.missoes.total, 0);
    assert.equal(antes.projetos.total, 0);
    assert.equal(antes.financas.despesasPeriodoCentavos, 0);

    // criar missão → pendentes sobe
    const missao = amb.servicoMissao.criar(jogador.id, { titulo: "Nova" });
    const depoisCriar = amb.servicoDashboard.visao();
    assert.equal(depoisCriar.missoes.total, 1);
    assert.equal(depoisCriar.missoes.pendentes, 1);

    // iniciar + concluir → pendentes volta a zero e concluídas sobe
    amb.servicoMissao.iniciar(missao.id);
    assert.equal(amb.servicoDashboard.visao().missoes.emAndamento, 1);
    amb.servicoMissao.concluir(missao.id);
    const depoisConcluir = amb.servicoDashboard.visao();
    assert.equal(depoisConcluir.missoes.concluidas, 1);
    assert.equal(depoisConcluir.missoes.pendentes, 0);

    // criar projeto e iniciar → entra na lista de progresso
    const projeto = amb.servicoProjeto.criar(jogador.id, { titulo: "Novo projeto" });
    assert.equal(amb.servicoDashboard.visao().projetos.planejados, 1);
    amb.servicoProjeto.iniciar(projeto.id);
    assert.equal(amb.servicoDashboard.visao().projetos.emAndamentoLista.length, 1);

    // transação financeira → período e saldo atualização
    const saldoAntes = amb.servicoDashboard.visao().financas.saldoAtualCentavos;
    amb.servicoFinanca.criarTransacao(jogador.id, {
      tipo: "despesa", valorCentavos: 12000, categoria: "lazer", descricao: "Cinema", data: "2026-09-08",
    });
    const depoisTransacao = amb.servicoDashboard.visao();
    assert.equal(depoisTransacao.financas.despesasPeriodoCentavos, 12000);
    assert.equal(depoisTransacao.financas.saldoAtualCentavos, saldoAntes - 12000);
  } finally {
    liberar(amb);
  }
});

// ── Persistência após reinicialização ────────────────────────────────────

test("persistência: dashboard reconstrói a mesma visão após reabrir o banco", () => {
  const amb = criarAmbiente();
  try {
    const jogador = prepararJogador(amb);
    const missao = amb.servicoMissao.criar(jogador.id, { titulo: "Persistente", prazo: PASSADO });
    const projeto = amb.servicoProjeto.criar(jogador.id, { titulo: "Projeto persistente" });
    amb.servicoProjeto.associarMissao(projeto.id, missao.id);
    amb.servicoProjeto.iniciar(projeto.id);
    const servico = amb.servicoServicos.criar(jogador.id, { nome: "Água", categoria: "moradia", valorEsperado: 6000 });
    amb.servicoContas.criar(jogador.id, {
      servicoId: servico.id, referencia: "2026-08", vencimento: PASSADO, valorEsperado: 6000,
    });
    amb.servicoFinanca.criarTransacao(jogador.id, {
      tipo: "despesa", valorCentavos: 6000, categoria: "moradia", descricao: "Água", data: "2026-09-12",
    });

    const antes = amb.servicoDashboard.visao();
    const caminho = amb.caminho;
    amb.db.close();

    // reabre o MESMO arquivo com serviços/dashboard novos
    const db2 = new DatabaseSync(caminho);
    db2.exec("PRAGMA foreign_keys = ON");
    const amb2 = { dir: amb.dir, caminho, db: db2, ...montarServicos(db2) };
    const depois = amb2.servicoDashboard.visao();

    assert.deepEqual(depois.missoes, antes.missoes);
    assert.deepEqual(depois.projetos.emAndamentoLista, antes.projetos.emAndamentoLista);
    assert.deepEqual(depois.financas, antes.financas);
    assert.deepEqual(depois.contas, antes.contas);
    assert.deepEqual(depois.servicos, antes.servicos);
    assert.equal(depois.jogador.nome, antes.jogador.nome);

    amb2.db.close();
    rmSync(amb2.dir, { recursive: true, force: true });
  } catch (erro) {
    liberar(amb);
    throw erro;
  }
});
