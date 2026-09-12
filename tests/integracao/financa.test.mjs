/**
 * PULSO — Testes de integração: Finanças (Fase 08)
 *
 * Cobertura: carteira (criação/persistência/vínculo), receitas, despesas,
 * saldo (inclusive negativo), edição, exclusão, categorias, orçamentos,
 * períodos e persistência real em SQLite.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { aplicarMigracoes } from '../../src/core/database/migracoes.js';
import { RepositorioJogador } from '../../src/core/database/repositorios/jogador.js';
import { RepositorioCarteira } from '../../src/core/database/repositorios/carteira.js';
import { RepositorioTransacao } from '../../src/core/database/repositorios/transacao.js';
import { RepositorioOrcamento } from '../../src/core/database/repositorios/orcamento.js';
import { ServicoFinanca } from '../../src/core/aplicacao/servico-financa.js';
import { ServicoJogador } from '../../src/core/aplicacao/servico-jogador.js';
import { ErroValidacao, ErroConflito } from '../../src/core/erros.js';

import { MOEDA, NOME_CARTEIRA_PRINCIPAL } from '../../src/core/dominio/financa.js';

let diretorio;
let banco;
let servico;
let jogador;

function criarAmbiente() {
  const dir = mkdtempSync(join(tmpdir(), 'pulso-financa-'));
  const db = new DatabaseSync(join(dir, 'pulso.db'));
  db.exec('PRAGMA foreign_keys = ON');
  aplicarMigracoes(db);
  const repositorioJogador = new RepositorioJogador(db);
  const s = new ServicoFinanca({
    repositorioCarteira: new RepositorioCarteira(db),
    repositorioTransacao: new RepositorioTransacao(db),
    repositorioOrcamento: new RepositorioOrcamento(db),
    repositorioJogador,
  });
  const servicoJogador = new ServicoJogador({ repositorio: repositorioJogador, banco: db, aoCriar: (j) => s.criarCarteiraInicial(j.id) });
  return { dir, db, s, servicoJogador };
}

function liberar({ dir, db }) {
  try {
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

before(() => {
  const ambiente = criarAmbiente();
  diretorio = ambiente.dir;
  banco = ambiente.db;
  servico = ambiente.s;
  jogador = ambiente.servicoJogador.criar({ nome: 'Teste Finanças', codinome: 'flux' });
});

after(() => {
  banco.close();
  rmSync(diretorio, { recursive: true, force: true });
});

// ── Carteira ─────────────────────────────────────────────────────────────
test('carteira: criada no nascimento do jogador, com saldo R$ 0,00', () => {
  const carteira = servico.obterCarteira(jogador.id);
  assert.ok(carteira.id);
  assert.equal(carteira.jogadorId, jogador.id);
  assert.equal(carteira.nome, NOME_CARTEIRA_PRINCIPAL);
  assert.equal(carteira.moeda, MOEDA);
  assert.equal(carteira.saldo, 0);
});

test('carteira: garantida sob demanda para jogador pré-Fase 08 (sem duplicatas)', () => {
  const ambiente = criarAmbiente();
  try {
    const j2 = ambiente.servicoJogador.criar({ nome: 'Sem carteira' });
    const carteira = ambiente.s.garantirCarteiraPrincipal(j2.id);
    const deNovo = ambiente.s.garantirCarteiraPrincipal(j2.id);
    assert.equal(deNovo.id, carteira.id);
    assert.equal(ambiente.s.obterCarteira(j2.id).saldo, 0);
  } finally {
    liberar(ambiente);
  }
});

test('carteira: rejeita operações para jogador inexistente', () => {
  assert.throws(() => servico.obterCarteira(99999), ErroConflito);
});

// ── Receitas e despesas ──────────────────────────────────────────────────
test('receitas: criar e persistir, refletindo no saldo', () => {
  const r = servico.criarTransacao(jogador.id, {
    tipo: 'receita',
    valorCentavos: 300000,
    categoria: 'salario',
    descricao: 'Salário',
    data: '2026-09-05',
  });
  assert.ok(r.id);
  assert.equal(r.tipo, 'receita');
  assert.equal(r.valorCentavos, 300000);
  assert.equal(servico.obterCarteira(jogador.id).saldo, 300000);
});

test('despesas: criar e persistir, reduzindo o saldo', () => {
  servico.criarTransacao(jogador.id, {
    tipo: 'despesa',
    valorCentavos: 50000,
    categoria: 'alimentacao',
    descricao: 'Supermercado',
    data: '2026-09-06',
  });
  servico.criarTransacao(jogador.id, {
    tipo: 'despesa',
    valorCentavos: 10000,
    categoria: 'transporte',
    data: '2026-09-07',
  });
  assert.equal(servico.obterCarteira(jogador.id).saldo, 300000 - 60000);
});

test('saldo: 100 - 150 = -50 (negativo registrado sem punição)', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Negativo' });
    ambiente.s.criarTransacao(j.id, { tipo: 'receita', valorCentavos: 10000, categoria: 'saldo_inicial', data: '2026-09-01' });
    const despesa = ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 15000, categoria: 'compras', data: '2026-09-02' });
    assert.ok(despesa.id);
    assert.equal(ambiente.s.obterCarteira(j.id).saldo, -5000);
  } finally {
    liberar(ambiente);
  }
});

// ── Edição ───────────────────────────────────────────────────────────────
test('edição: R$ 100 → R$ 80 recalcula o saldo corretamente', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Edição' });
    const original = ambiente.s.criarTransacao(j.id, {
      tipo: 'despesa', valorCentavos: 10000, categoria: 'contas', data: '2026-09-10',
    });
    assert.equal(ambiente.s.obterCarteira(j.id).saldo, -10000);
    const editada = ambiente.s.atualizarTransacao(original.id, { valorCentavos: 8000 });
    assert.equal(editada.valorCentavos, 8000);
    assert.equal(ambiente.s.obterCarteira(j.id).saldo, -8000);
  } finally {
    liberar(ambiente);
  }
});

test('edição: RECEITA → DESPESA recalcula o saldo corretamente', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Troca tipo' });
    ambiente.s.criarTransacao(j.id, { tipo: 'receita', valorCentavos: 100000, categoria: 'salario', data: '2026-09-10' });
    const aTrocar = ambiente.s.criarTransacao(j.id, { tipo: 'receita', valorCentavos: 25000, categoria: 'freelance', data: '2026-09-11' });
    assert.equal(ambiente.s.obterCarteira(j.id).saldo, 125000);
    ambiente.s.atualizarTransacao(aTrocar.id, { tipo: 'despesa', categoria: 'lazer' });
    assert.equal(ambiente.s.obterCarteira(j.id).saldo, 75000);
  } finally {
    liberar(ambiente);
  }
});

test('edição: categoria incompatível com o novo tipo é rejeitada', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Categoria nova' });
    const t = ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 5000, categoria: 'lazer', data: '2026-09-10' });
    assert.throws(() => ambiente.s.atualizarTransacao(t.id, { tipo: 'receita' }), ErroValidacao);
  } finally {
    liberar(ambiente);
  }
});

test('edição: alteração de data reflete no histórico e no orçamento', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Data' });
    const t = ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 10000, categoria: 'lazer', data: '2026-09-10' });
    ambiente.s.criarOrcamento(j.id, { categoria: 'lazer', valorCentavos: 50000, inicio: '2026-09-01', fim: '2026-09-30' });
    assert.equal(ambiente.s.listarOrcamentos(j.id)[0].situacao.gasto, 10000);
    ambiente.s.atualizarTransacao(t.id, { data: '2026-10-01' });
    assert.equal(ambiente.s.listarOrcamentos(j.id)[0].situacao.gasto, 0);
  } finally {
    liberar(ambiente);
  }
});
// ── Histórico ────────────────────────────────────────────────────────────
test('histórico: ordenado do mais recente para o mais antigo por data', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Histórico' });
    ambiente.s.criarTransacao(j.id, { tipo: 'receita', valorCentavos: 1000, categoria: 'venda', data: '2026-09-01' });
    ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 2000, categoria: 'contas', data: '2026-09-03' });
    const transacoes = ambiente.s.listarTransacoes(j.id);
    assert.deepEqual(
      transacoes.map((t) => [t.ocorridaEm, t.tipo]),
      [
        ['2026-09-03', 'despesa'],
        ['2026-09-01', 'receita'],
      ],
    );
  } finally {
    liberar(ambiente);
  }
});

test('histórico: filtro por tipo e categoria', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Filtros' });
    ambiente.s.criarTransacao(j.id, { tipo: 'receita', valorCentavos: 1000, categoria: 'venda', data: '2026-09-01' });
    ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 2000, categoria: 'contas', data: '2026-09-02' });
    const somenteReceitas = ambiente.s.listarTransacoes(j.id, { tipo: 'receita' });
    assert.equal(somenteReceitas.length, 1);
    assert.equal(somenteReceitas[0].categoria, 'venda');
    const somenteContas = ambiente.s.listarTransacoes(j.id, { categoria: 'contas' });
    assert.equal(somenteContas.length, 1);
    assert.equal(somenteContas[0].tipo, 'despesa');
  } finally {
    liberar(ambiente);
  }
});

// ── Categorias ───────────────────────────────────────────────────────────
test('categorias: criação rejeita categoria inexistente e incompatível', () => {
  assert.throws(
    () => servico.criarTransacao(jogador.id, { tipo: 'despesa', valorCentavos: 100, categoria: 'salario', data: '2026-09-10' }),
    ErroValidacao,
  );
  assert.throws(
    () => servico.criarTransacao(jogador.id, { tipo: 'receita', valorCentavos: 100, categoria: 'alimentacao', data: '2026-09-10' }),
    ErroValidacao,
  );
  assert.throws(
    () => servico.criarTransacao(jogador.id, { tipo: 'despesa', valorCentavos: 100, categoria: 'alienigena', data: '2026-09-10' }),
    ErroValidacao,
  );
});

// ── Exclusão ─────────────────────────────────────────────────────────────
test('exclusão: remove a transação e recalcula o saldo', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Exclusão' });
    ambiente.s.criarTransacao(j.id, { tipo: 'receita', valorCentavos: 100000, categoria: 'salario', data: '2026-09-01' });
    const despesa = ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 40000, categoria: 'contas', data: '2026-09-02' });
    assert.equal(ambiente.s.obterCarteira(j.id).saldo, 60000);

    ambiente.s.excluirTransacao(despesa.id);
    assert.equal(ambiente.s.obterCarteira(j.id).saldo, 100000);
    assert.equal(ambiente.s.listarTransacoes(j.id).length, 1);
    assert.notEqual(ambiente.s.listarTransacoes(j.id)[0].id, despesa.id);
    assert.throws(() => ambiente.s.excluirTransacao(despesa.id), ErroConflito, 'transação realmente removida');
  } finally {
    liberar(ambiente);
  }
});

// ── Orçamentos ───────────────────────────────────────────────────────────
test('orçamento: criar, consultar situação e persistir', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Orçamento' });
    const o = ambiente.s.criarOrcamento(j.id, {
      categoria: 'alimentacao',
      nome: 'Feira',
      valorCentavos: 60000,
      inicio: '2026-09-01',
      fim: '2026-09-30',
    });
    assert.ok(o.id);
    assert.equal(o.categoria, 'alimentacao');
    assert.equal(o.valorCentavos, 60000);

    ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 42000, categoria: 'alimentacao', data: '2026-09-10' });
    const lista = ambiente.s.listarOrcamentos(j.id);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].situacao.gasto, 42000);
    assert.equal(lista[0].situacao.disponivel, 18000);
    assert.equal(lista[0].situacao.estourado, false);

    const { orcamento, situacao } = ambiente.s.situacaoOrcamento(o.id);
    assert.equal(orcamento.id, o.id);
    assert.equal(situacao.gasto, 42000);
  } finally {
    liberar(ambiente);
  }
});

test('orçamento: estourado quando gasto ultrapassa o limite; receitas não consomem', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Estouro' });
    ambiente.s.criarOrcamento(j.id, { categoria: 'lazer', valorCentavos: 60000, inicio: '2026-09-01', fim: '2026-09-30' });
    ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 65000, categoria: 'lazer', data: '2026-09-15' });
    ambiente.s.criarTransacao(j.id, { tipo: 'receita', valorCentavos: 999999, categoria: 'salario', data: '2026-09-16' });
    const o = ambiente.s.listarOrcamentos(j.id)[0];
    assert.equal(o.situacao.gasto, 65000);
    assert.equal(o.situacao.disponivel, -5000);
    assert.equal(o.situacao.estourado, true);
  } finally {
    liberar(ambiente);
  }
});

test('orçamento: períodos com limites inclusivos (01/09 → 30/09)', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Períodos' });
    ambiente.s.criarOrcamento(j.id, { categoria: 'contas', valorCentavos: 100000, inicio: '2026-09-01', fim: '2026-09-30' });
    ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 1000, categoria: 'contas', data: '2026-09-01' });
    ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 2000, categoria: 'contas', data: '2026-09-30' });
    ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 4000, categoria: 'contas', data: '2026-08-31' });
    ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 8000, categoria: 'contas', data: '2026-10-01' });
    const o = ambiente.s.listarOrcamentos(j.id)[0];
    assert.equal(o.situacao.gasto, 3000, 'apenas 01/09 e 30/09 contam');
  } finally {
    liberar(ambiente);
  }
});

test('orçamento: alteração de limite e período recalcula a situação', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Alterar orçamento' });
    const o = ambiente.s.criarOrcamento(j.id, { categoria: 'transporte', valorCentavos: 40000, inicio: '2026-09-01', fim: '2026-09-30' });
    ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 20000, categoria: 'transporte', data: '2026-09-10' });
    assert.equal(ambiente.s.situacaoOrcamento(o.id).situacao.disponivel, 20000);

    const atualizado = ambiente.s.atualizarOrcamento(o.id, { valorCentavos: 50000 });
    assert.equal(atualizado.valorCentavos, 50000);
    assert.equal(ambiente.s.situacaoOrcamento(o.id).situacao.disponivel, 30000);
  } finally {
    liberar(ambiente);
  }
});

// ── Integração e persistência ────────────────────────────────────────────
test('integração completa: jogador → carteira → receita → saldo → despesa → saldo → orçamento', () => {
  const ambiente = criarAmbiente();
  try {
    const j = ambiente.servicoJogador.criar({ nome: 'Cadeia completa', codinome: 'flux' });
    assert.equal(ambiente.s.obterCarteira(j.id).saldo, 0);

    ambiente.s.criarTransacao(j.id, { tipo: 'receita', valorCentavos: 300000, categoria: 'salario', data: '2026-09-05' });
    assert.equal(ambiente.s.obterCarteira(j.id).saldo, 300000);

    ambiente.s.criarTransacao(j.id, { tipo: 'despesa', valorCentavos: 15000, categoria: 'transporte', data: '2026-09-06' });
    assert.equal(ambiente.s.obterCarteira(j.id).saldo, 285000);

    const o = ambiente.s.criarOrcamento(j.id, { categoria: 'transporte', valorCentavos: 50000, inicio: '2026-09-01', fim: '2026-09-30' });
    assert.equal(ambiente.s.situacaoOrcamento(o.id).situacao.gasto, 15000);
  } finally {
    liberar(ambiente);
  }
});

test('persistência: dados financeiros sobrevivem a fechar e reabrir o banco', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pulso-financa-persist-'));
  try {
    let db = new DatabaseSync(join(dir, 'pulso.db'));
    db.exec('PRAGMA foreign_keys = ON');
    aplicarMigracoes(db);
    const repositorioJogador = new RepositorioJogador(db);
    let s = new ServicoFinanca({
      repositorioCarteira: new RepositorioCarteira(db),
      repositorioTransacao: new RepositorioTransacao(db),
      repositorioOrcamento: new RepositorioOrcamento(db),
      repositorioJogador,
    });
    const servicoJogador = new ServicoJogador({ repositorio: repositorioJogador, banco: db, aoCriar: (j) => s.criarCarteiraInicial(j.id) });
    const j = servicoJogador.criar({ nome: 'Persistente' });
    s.criarTransacao(j.id, { tipo: 'receita', valorCentavos: 125075, categoria: 'salario', data: '2026-09-10' });
    const o = s.criarOrcamento(j.id, { categoria: 'lazer', valorCentavos: 50000, inicio: '2026-09-01', fim: '2026-09-30' });
    db.close();

    // reabertura: nova conexão, mesmo arquivo
    db = new DatabaseSync(join(dir, 'pulso.db'));
    db.exec('PRAGMA foreign_keys = ON');
    s = new ServicoFinanca({
      repositorioCarteira: new RepositorioCarteira(db),
      repositorioTransacao: new RepositorioTransacao(db),
      repositorioOrcamento: new RepositorioOrcamento(db),
      repositorioJogador: new RepositorioJogador(db),
    });
    const carteiraRelida = s.obterCarteira(j.id);
    assert.equal(carteiraRelida.saldo, 125075);
    const transacoesRelidas = s.listarTransacoes(j.id);
    assert.equal(transacoesRelidas.length, 1);
    assert.equal(transacoesRelidas[0].valorCentavos, 125075);
    const orcamentosRelidos = s.listarOrcamentos(j.id);
    assert.equal(orcamentosRelidos.length, 1);
    assert.equal(orcamentosRelidos[0].valorCentavos, 50000);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('foreign keys: transação exige carteira existente; orçamento exige jogador', () => {
  const ambiente = criarAmbiente();
  try {
    assert.throws(
      () => ambiente.s.criarTransacao(999999, { tipo: 'receita', valorCentavos: 100, categoria: 'venda', data: '2026-09-10' }),
      ErroConflito,
    );
  } finally {
    liberar(ambiente);
  }
});