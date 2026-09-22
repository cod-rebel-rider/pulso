/**
 * PULSO — Testes unitários: Serviço do Dashboard (Fase 15)
 *
 * O serviço em ISOLAMENTO: dependências fake que implementam SOMENTE
 * operações de leitura. Se o dashboard tentasse gravar, o teste quebraria —
 * é exatamente o contrato da fase (camada de consolidação, sem escrita).
 *
 * Cobre: composição dos blocos, propagação do período para a Fase 08,
 * mapa de nome de serviço nas próximas contas, congelamento da visão,
 * ausência de jogador e serviços da Fase 10 opcionais.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { ServicoDashboard } from "../../src/core/aplicacao/servico-dashboard.js";
import { ErroConflito } from "../../src/core/erros.js";

const INSTANTE = new Date(2026, 8, 21, 12, 0, 0); // 21/09/2026 local
const JOGADOR = { id: 1, nome: "Operador", codinome: "teste" };

/** Chamadas observadas nos serviços fake (para provar somente-leitura). */
function criarFakes(opcoes = {}) {
  const espiao = { chamadas: [] };
  const registrar = (nome) => (...args) => {
    espiao.chamadas.push({ nome, args });
  };
  const fakes = {
    servicoJogador: {
      obter: () => {
        registrar("jogador.obter")();
        return opcoes.semJogador ? null : JOGADOR;
      },
    },
    servicoStatus: {
      obter: (jogadorId) => {
        registrar("status.obter")(jogadorId);
        return { jogadorId, energia: 80, foco: 60, estresse: 20, criatividade: 40 };
      },
    },
    servicoProgressao: {
      obter: (jogadorId) => {
        registrar("progressao.obter")(jogadorId);
        return {
          jogadorId, nivel: 3, xpTotal: 250, pontosDisponiveis: 2,
          atributos: { tecnologia: 2, criatividade: 3, musica: 1, social: 1, energia: 2, foco: 2, disciplina: 4 },
          xpNoNivel: 50, xpNecessario: 200, progresso: 0.25,
        };
      },
    },
    servicoMissao: {
      listar: (jogadorId) => {
        registrar("missao.listar")(jogadorId);
        return opcoes.missoes ?? [
          { estado: "pendente", prazo: "2999-01-01" },
          { estado: "em_andamento", prazo: null },
          { estado: "concluida", prazo: "2020-01-01" },
        ];
      },
    },
    servicoProjeto: {
      listar: (jogadorId) => {
        registrar("projeto.listar")(jogadorId);
        return opcoes.projetos ?? [
          { id: 7, titulo: "Projeto A", estado: "em_andamento", atrasado: false, progresso: 0.5, totalMissoes: 2, missoesConcluidas: 1 },
          { id: 8, titulo: "Projeto B", estado: "planejado", atrasado: false, progresso: 0, totalMissoes: 0, missoesConcluidas: 0 },
        ];
      },
    },
    servicoFinanca: {
      obterSaldo: (jogadorId, periodo) => {
        registrar("financa.obterSaldo")(jogadorId, periodo);
        return {
          receitas: 100000, despesas: 25000, saldo: 75000,
          carteira: { id: 5, jogadorId, nome: "Carteira Principal", moeda: "BRL", saldo: 300000 },
        };
      },
      listarOrcamentos: (jogadorId) => {
        registrar("financa.listarOrcamentos")(jogadorId);
        return opcoes.orcamentos ?? [
          { id: 1, nome: "Alimentação", categoria: "alimentacao", valorCentavos: 50000, inicio: "2026-09-01", fim: "2026-09-30", situacao: { gasto: 25000, percentual: 0.5, estourado: false } },
          { id: 2, nome: "Outro mês", categoria: "lazer", valorCentavos: 10000, inicio: "2026-11-01", fim: "2026-11-30", situacao: { gasto: 0, percentual: 0, estourado: false } },
        ];
      },
    },
    servicoServicos: {
      listar: (jogadorId) => {
        registrar("servico.listar")(jogadorId);
        return opcoes.servicos ?? [{ id: 11, nome: "Internet", estado: "ativo" }, { id: 12, nome: "Streaming", estado: "inativo" }];
      },
    },
    servicoContas: {
      listar: (jogadorId) => {
        registrar("conta.listar")(jogadorId);
        return opcoes.contas ?? [
          { id: 21, servicoId: 11, referencia: "2026-09", descricao: null, valorEsperado: 12000, vencimento: "2026-09-10", situacao: "vencida" },
          { id: 22, servicoId: 12, referencia: "2026-09", descricao: null, valorEsperado: 3000, vencimento: "2026-09-25", situacao: "pendente" },
        ];
      },
    },
  };
  return { fakes, espiao };
}

function criarServico(opcoes = {}) {
  const { fakes, espiao } = criarFakes(opcoes);
  const servico = new ServicoDashboard({ ...fakes, agora: () => INSTANTE });
  return { servico, espiao };
}

test("visão: compõe todos os blocos e usa o período do mês atual", () => {
  const { servico, espiao } = criarServico();
  const visao = servico.visao();

  assert.equal(visao.hoje, "2026-09-21");
  assert.equal(visao.periodo.anoMes, "2026-09");
  assert.equal(visao.periodo.inicio, "2026-09-01");
  assert.equal(visao.periodo.fim, "2026-09-30");
  assert.equal(visao.periodo.rotulo, "SETEMBRO/2026");
  assert.equal(visao.jogador.codinome, "teste");
  assert.equal(visao.status.energia, 80);
  assert.equal(visao.progressao.nivel, 3);
  assert.equal(visao.progressao.atributos.disciplina, 4);
  assert.deepEqual(visao.missoes, {
    total: 3, pendentes: 1, emAndamento: 1, concluidas: 1, canceladas: 0, atrasadas: 0,
  });
  assert.equal(visao.projetos.emAndamento, 1);
  assert.equal(visao.projetos.emAndamentoLista.length, 1);
  assert.equal(visao.financas.saldoAtualCentavos, 300000); // saldo ATUAL (carteira)
  assert.equal(visao.financas.receitasPeriodoCentavos, 100000);
  assert.equal(visao.financas.despesasPeriodoCentavos, 25000);
  assert.equal(visao.financas.orcamentos.length, 1); // só o vigente em setembro
  assert.equal(visao.contas.vencidas, 1);
  assert.equal(visao.contas.pendentes, 1);
  assert.equal(visao.contas.valorEmAbertoCentavos, 15000);
  assert.equal(visao.servicos.ativos, 1);
  assert.equal(Object.isFrozen(visao), true);

  // a Fase 08 recebeu EXATAMENTE o período civil pedido
  const chamadaSaldo = espiao.chamadas.find((c) => c.nome === "financa.obterSaldo");
  assert.deepEqual(chamadaSaldo.args, [1, { inicio: "2026-09-01", fim: "2026-09-30" }]);
});

test("visão: período explícito propaga o mês pedido (saldo atual não muda)", () => {
  const { servico, espiao } = criarServico();
  const visao = servico.visao({ anoMes: "2026-11" });
  assert.equal(visao.periodo.anoMes, "2026-11");
  assert.equal(visao.periodo.rotulo, "NOVEMBRO/2026");
  assert.equal(visao.periodo.atual, false);
  assert.equal(visao.financas.orcamentos.length, 1); // agora o de novembro
  assert.equal(visao.financas.orcamentos[0].nome, "Outro mês");
  const chamadaSaldo = espiao.chamadas.find((c) => c.nome === "financa.obterSaldo");
  assert.deepEqual(chamadaSaldo.args[1], { inicio: "2026-11-01", fim: "2026-11-30" });
  // o saldo exibido é o da carteira (atual), independente do filtro
  assert.equal(visao.financas.saldoAtualCentavos, 300000);
});

test("próximas contas: ordenadas por vencimento e com o NOME do serviço", () => {
  const { servico } = criarServico({
    contas: [
      { id: 3, servicoId: 11, referencia: "2026-09", valorEsperado: 12000, vencimento: "2026-09-30", situacao: "pendente" },
      { id: 2, servicoId: 12, referencia: "2026-09", valorEsperado: 3000, vencimento: "2026-09-05", situacao: "vencida" },
    ],
  });
  const visao = servico.visao();
  assert.deepEqual(visao.contas.proximas.map((c) => [c.id, c.nomeServico, c.situacao]), [
    [2, "Streaming", "vencida"],
    [3, "Internet", "pendente"],
  ]);
  assert.equal(Object.isFrozen(visao.contas.proximas[0]), true);
});

test("sem dados adicionais: zeros e listas vazias (nenhum dado fictício)", () => {
  const { servico } = criarServico({ missoes: [], projetos: [], orcamentos: [], servicos: [], contas: [] });
  const visao = servico.visao();
  assert.deepEqual(visao.missoes, {
    total: 0, pendentes: 0, emAndamento: 0, concluidas: 0, canceladas: 0, atrasadas: 0,
  });
  assert.equal(visao.projetos.total, 0);
  assert.deepEqual(visao.projetos.emAndamentoLista, []);
  assert.deepEqual(visao.financas.orcamentos, []);
  assert.deepEqual(visao.contas.proximas, []);
  assert.equal(visao.contas.valorEmAbertoCentavos, 0);
  assert.equal(visao.servicos.total, 0);
});

test("sem jogador configurado: conflito (nada é consultado)", () => {
  const { servico, espiao } = criarServico({ semJogador: true });
  assert.throws(() => servico.visao(), ErroConflito);
  assert.equal(espiao.chamadas.some((c) => c.nome.startsWith("financa.")), false);
});

test("serviços da Fase 10 são opcionais: o dashboard funciona sem eles", () => {
  const { fakes } = criarFakes();
  delete fakes.servicoServicos;
  delete fakes.servicoContas;
  const servico = new ServicoDashboard({ ...fakes, agora: () => INSTANTE });
  const visao = servico.visao();
  assert.equal(visao.servicos.total, 0);
  assert.equal(visao.contas.total, 0);
  assert.deepEqual(visao.contas.proximas, []);
});
