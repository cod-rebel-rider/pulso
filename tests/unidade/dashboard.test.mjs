/**
 * PULSO — Testes unitários: domínio do Dashboard (Fase 15)
 *
 * Regras PURAS da camada de consolidação: período do mês civil, deslocamento
 * de competência, contagens por situação (reutilizando `estaAtrasada` do
 * domínio de missões e os indicadores do serviço de projetos), próximas
 * contas ordenadas por vencimento, orçamentos vigentes no período e rótulos.
 *
 * O dashboard NÃO tem regras próprias: estes testes garantem que ele apenas
 * AGREGA o que os módulos existentes produzem.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  ultimoDiaDoMes,
  validarAnoMes,
  anoMesAtual,
  deslocarAnoMes,
  rotuloAnoMes,
  periodoDoMes,
  contarMissoes,
  contarProjetos,
  projetosEmAndamento,
  contarContas,
  proximasContas,
  contarServicos,
  orcamentosNoPeriodo,
  STATUS_ORDEM_DASHBOARD,
  STATUS_ROTULOS_DASHBOARD,
  ATRIBUTOS_ORDEM_DASHBOARD,
  ATRIBUTOS_ROTULOS_DASHBOARD,
} from "../../src/core/dominio/dashboard.js";
import { ErroValidacao } from "../../src/core/erros.js";

// ---- Período (mês civil) ----
test("período: AAAA-MM válido, limites do mês e rótulo humano", () => {
  assert.equal(validarAnoMes("2026-09"), "2026-09");
  assert.equal(validarAnoMes(" 2026-12 "), "2026-12");
  assert.throws(() => validarAnoMes("2026-13"), ErroValidacao);
  assert.throws(() => validarAnoMes("2026"), ErroValidacao);
  assert.throws(() => validarAnoMes(null), ErroValidacao);

  const setembro = periodoDoMes("2026-09", new Date(2026, 8, 21, 12));
  assert.deepEqual(
    { inicio: setembro.inicio, fim: setembro.fim, rotulo: setembro.rotulo },
    { inicio: "2026-09-01", fim: "2026-09-30", rotulo: "SETEMBRO/2026" },
  );
  assert.equal(setembro.anterior, "2026-08");
  assert.equal(setembro.proximo, "2026-10");
  assert.equal(setembro.atual, true);

  // mês curto: fevereiro bissexto e não bissexto
  assert.equal(ultimoDiaDoMes(2026, 2), 28);
  assert.equal(ultimoDiaDoMes(2024, 2), 29);
  assert.equal(periodoDoMes("2026-02").fim, "2026-02-28");
  assert.equal(periodoDoMes("2024-02").fim, "2024-02-29");
});

test("período: virada de ano e mês atual dependem do instante", () => {
  assert.equal(deslocarAnoMes("2026-01", -1), "2025-12");
  assert.equal(deslocarAnoMes("2025-12", 1), "2026-01");
  assert.equal(deslocarAnoMes("2026-06", 0), "2026-06");
  assert.equal(deslocarAnoMes("2026-06", -18), "2024-12");

  const instante = new Date(2026, 8, 21, 12); // 21/09/2026 local
  assert.equal(anoMesAtual(instante), "2026-09");
  assert.equal(rotuloAnoMes("2026-09"), "SETEMBRO/2026");
  assert.equal(rotuloAnoMes("2026-01"), "JANEIRO/2026");
  const corrente = periodoDoMes(null, instante);
  assert.equal(corrente.anoMes, "2026-09");
  assert.equal(corrente.atual, true);
  // período pedido diferente do mês atual → marcado como não atual
  assert.equal(periodoDoMes("2026-03", instante).atual, false);
});

// ---- Missões: usa a MESMA regra de atraso do domínio de missões ----
test("missões: conta por estado e atrasadas pela regra do domínio", () => {
  const missoes = [
    { estado: "pendente", prazo: "2020-01-01" }, // atrasada (passado)
    { estado: "pendente", prazo: "2999-01-01" }, // futura
    { estado: "pendente", prazo: null }, // sem prazo
    { estado: "em_andamento", prazo: "2020-01-01" }, // atrasada
    { estado: "em_andamento", prazo: null },
    { estado: "concluida", prazo: "2020-01-01" }, // terminal → não atrasa
    { estado: "cancelada", prazo: "2020-01-01" }, // terminal → não atrasa
  ];
  const contagem = contarMissoes(missoes, "2026-09-21");
  assert.deepEqual(contagem, {
    total: 7,
    pendentes: 3,
    emAndamento: 2,
    concluidas: 1,
    canceladas: 1,
    atrasadas: 2,
  });
  assert.equal(Object.isFrozen(contagem), true);

  // estado desconhecido não quebra a contagem (somente leitura)
  assert.equal(contarMissoes([{ estado: "???", prazo: null }], "2026-09-21").total, 1);
  assert.equal(contarMissoes(null, "2026-09-21").total, 0);
  assert.throws(() => contarMissoes([], "21/09/2026"), ErroValidacao);
});

// ---- Projetos: sinalizadores vêm do serviço (Fase 07) ----
test("projetos: conta por estado e respeita o sinalizador atrasado", () => {
  const projetos = [
    { estado: "planejado", atrasado: false },
    { estado: "em_andamento", atrasado: true, progresso: 0.5, totalMissoes: 4, missoesConcluidas: 2, titulo: "A", id: 1 },
    { estado: "em_andamento", atrasado: false, progresso: 0, totalMissoes: 0, missoesConcluidas: 0, titulo: "B", id: 2 },
    { estado: "concluido", atrasado: false },
    { estado: "cancelado", atrasado: false },
    { estado: "arquivado", atrasado: false },
  ];
  assert.deepEqual(contarProjetos(projetos), {
    total: 6,
    planejados: 1,
    emAndamento: 2,
    concluidos: 1,
    cancelados: 1,
    arquivados: 1,
    atrasados: 1,
  });

  const emAndamento = projetosEmAndamento(projetos);
  assert.equal(emAndamento.length, 2);
  assert.deepEqual(emAndamento[0], {
    id: 1, titulo: "A", progresso: 0.5, totalMissoes: 4, missoesConcluidas: 2, atrasado: true,
  });
  assert.equal(Object.isFrozen(emAndamento[0]), true);
});

// ---- Contas: situação derivada (Fase 10.2) ----
test("contas: conta pela situação derivada, sem reescrever nada", () => {
  const contas = [
    { situacao: "pendente" },
    { situacao: "vencida" },
    { situacao: "vencida" },
    { situacao: "cancelada" },
    { situacao: "paga" },
  ];
  assert.deepEqual(contarContas(contas), {
    total: 5, pendentes: 1, vencidas: 2, canceladas: 1, pagas: 1,
  });
  assert.equal(contarContas(undefined).total, 0);
});

test("contas: próximas ordenadas por vencimento (vencidas primeiro) e limitadas", () => {
  const contas = [
    { id: 3, situacao: "pendente", vencimento: "2026-10-10", valorEsperado: 3000 },
    { id: 1, situacao: "vencida", vencimento: "2026-09-01", valorEsperado: 1000 },
    { id: 2, situacao: "pendente", vencimento: "2026-09-20", valorEsperado: 2000 },
    { id: 4, situacao: "cancelada", vencimento: "2026-08-01", valorEsperado: 4000 },
    { id: 5, situacao: "paga", vencimento: "2026-08-02", valorEsperado: 5000 },
  ];
  const proximas = proximasContas(contas, 2);
  assert.equal(proximas.length, 2);
  assert.deepEqual(proximas.map((c) => c.id), [1, 2]);
  assert.deepEqual(proximas.map((c) => c.situacao), ["vencida", "pendente"]);
  assert.equal(Object.isFrozen(proximas), true);

  // limite zero e lista vazia
  assert.equal(proximasContas(contas, 0).length, 0);
  assert.equal(proximasContas([], 5).length, 0);

  // sem vencimento vai para o fim, desempate por id
  const semData = proximasContas([
    { id: 9, situacao: "pendente", vencimento: null },
    { id: 5, situacao: "pendente", vencimento: null },
    { id: 1, situacao: "pendente", vencimento: "2026-09-30" },
  ], 5);
  assert.deepEqual(semData.map((c) => c.id), [1, 5, 9]);
});

// ---- Serviços (Fase 10.1) ----
test("serviços: conta por estado do módulo de serviços", () => {
  assert.deepEqual(
    contarServicos([
      { estado: "ativo" }, { estado: "ativo" }, { estado: "inativo" }, { estado: "arquivado" },
    ]),
    { total: 4, ativos: 2, inativos: 1, arquivados: 1 },
  );
  assert.deepEqual(contarServicos(null), { total: 0, ativos: 0, inativos: 0, arquivados: 0 });
});

// ---- Orçamentos: recorte do período, situação vem do motor financeiro ----
test("orçamentos: apenas os vigentes no período, sem novo cálculo", () => {
  const orcamentos = [
    { id: 1, nome: "Alimentação", categoria: "alimentacao", valorCentavos: 60000, inicio: "2026-09-01", fim: "2026-09-30", situacao: { gasto: 30000, percentual: 0.5, estourado: false } },
    { id: 2, nome: "Transporte", categoria: "transporte", valorCentavos: 20000, inicio: "2026-10-01", fim: "2026-10-31" },
    { id: 3, nome: "Lazer", categoria: "lazer", valorCentavos: 10000, inicio: "2026-08-15", fim: "2026-09-15", situacao: { gasto: 12000, percentual: 1.2, estourado: true } },
    { id: 4, nome: "Curso", categoria: "educacao", valorCentavos: 50000, inicio: "2026-07-01", fim: "2026-07-31" },
  ];
  const vigentes = orcamentosNoPeriodo(orcamentos, "2026-09-01", "2026-09-30");
  assert.deepEqual(vigentes.map((o) => o.id), [1, 3]);
  assert.equal(vigentes[1].estourado, true);
  assert.equal(vigentes[1].gastoCentavos, 12000);
  // orçamento sem situação calculada → zeros (nunca inventa gasto)
  assert.equal(orcamentosNoPeriodo([{ id: 9, inicio: "2026-09-01", fim: "2026-09-30" }], "2026-09-01", "2026-09-30")[0].gastoCentavos, 0);
  assert.equal(orcamentosNoPeriodo([], "2026-09-01", "2026-09-30").length, 0);
  assert.throws(() => orcamentosNoPeriodo([], "2026-13-01", "2026-09-30"), ErroValidacao);
});

// ---- Rótulos de apresentação (ordem dos módulos) ----
test("rótulos: ordem e nomes de status/atributos vêm dos módulos existentes", () => {
  assert.deepEqual(STATUS_ORDEM_DASHBOARD, ["energia", "foco", "estresse", "criatividade"]);
  assert.equal(STATUS_ROTULOS_DASHBOARD.estresse, "ESTRESSE");
  assert.deepEqual(
    ATRIBUTOS_ORDEM_DASHBOARD,
    ["tecnologia", "criatividade", "musica", "social", "energia", "foco", "disciplina"],
  );
  assert.equal(ATRIBUTOS_ROTULOS_DASHBOARD.musica, "MÚSICA");
  assert.equal(Object.isFrozen(STATUS_ORDEM_DASHBOARD), true);
  assert.equal(Object.isFrozen(ATRIBUTOS_ORDEM_DASHBOARD), true);
});
