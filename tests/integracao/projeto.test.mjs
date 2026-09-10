/**
 * PULSO — Testes de integração: Projetos (Fase 07)
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { aplicarMigracoes } from '../../src/core/database/migracoes.js';
import { RepositorioJogador } from '../../src/core/database/repositorios/jogador.js';
import { RepositorioMissao } from '../../src/core/database/repositorios/missao.js';
import { RepositorioProjeto } from '../../src/core/database/repositorios/projeto.js';
import { ServicoProjeto } from '../../src/core/aplicacao/servico-projeto.js';
import { ServicoMissao } from '../../src/core/aplicacao/servico-missao.js';
import { ServicoJogador } from '../../src/core/aplicacao/servico-jogador.js';
import { ErroValidacao, ErroConflito, ErroTransicao } from '../../src/core/erros.js';

let diretorio;
let banco;
let repositorioJogador;
let repositorioMissao;
let servicoProjeto;
let servicoMissao;
let jogador;

before(() => {
  diretorio = mkdtempSync(join(tmpdir(), 'pulso-projeto-'));
  banco = new DatabaseSync(join(diretorio, 'pulso.db'));
  banco.exec('PRAGMA foreign_keys = ON');
  aplicarMigracoes(banco);
  repositorioJogador = new RepositorioJogador(banco);
  repositorioMissao = new RepositorioMissao(banco);
  servicoMissao = new ServicoMissao({ repositorio: repositorioMissao });
  servicoProjeto = new ServicoProjeto({
    repositorio: new RepositorioProjeto(banco),
    repositorioMissao,
    repositorioJogador,
  });
  const servicoJogador = new ServicoJogador({ repositorio: repositorioJogador, banco });
  jogador = servicoJogador.criar({ nome: 'Teste', codinome: 'org' });
});

after(() => {
  banco.close();
  rmSync(diretorio, { recursive: true, force: true });
});

function criarProjeto(titulo = 'Projeto Teste') {
  return servicoProjeto.criar(jogador.id, { titulo });
}

function criarMissao(titulo = 'Missão teste') {
  return servicoMissao.criar(jogador.id, { titulo });
}

test('criação: projeto planejado, 0%, sem missões', () => {
  const p = criarProjeto('OndaHub');
  assert.ok(p.id);
  assert.equal(p.estado, 'planejado');
  assert.equal(p.prioridade, 'normal');
  assert.equal(p.progresso, 0);
  assert.equal(p.totalMissoes, 0);
  assert.equal(p.atrasado, false);
});

test('criação rejeita título vazio e prioridade inválida', () => {
  assert.throws(() => servicoProjeto.criar(jogador.id, { titulo: '' }), ErroValidacao);
  assert.throws(() => servicoProjeto.criar(jogador.id, { titulo: 'X', prioridade: 'x' }), ErroValidacao);
});

test('edição: altera campos; estado não por campo livre', () => {
  const p = criarProjeto();
  const editado = servicoProjeto.atualizar(p.id, { titulo: 'Novo', prioridade: 'alta' });
  assert.equal(editado.titulo, 'Novo');
  assert.equal(editado.prioridade, 'alta');
  assert.equal(editado.estado, 'planejado');
  assert.throws(() => servicoProjeto.atualizar(p.id, { estado: 'concluido' }), ErroValidacao);
});

test('transições: planejado → em andamento → concluído', () => {
  const p = criarProjeto('Ciclo');
  const iniciado = servicoProjeto.iniciar(p.id);
  assert.equal(iniciado.estado, 'em_andamento');
  assert.ok(iniciado.iniciadaEm);
  const concluido = servicoProjeto.concluir(p.id);
  assert.equal(concluido.estado, 'concluido');
  assert.ok(concluido.concluidaEm);
});

test('transições inválidas bloqueadas', () => {
  const p = criarProjeto('Inválida');
  assert.throws(() => servicoProjeto.concluir(p.id), ErroTransicao);
  const arquivado = servicoProjeto.arquivar(p.id);
  assert.equal(arquivado.estado, 'arquivado');
  assert.throws(() => servicoProjeto.iniciar(p.id), ErroTransicao);
});

test('associação: missão entra no projeto; missão sem projeto segue sem', () => {
  const p = criarProjeto('Agrupar');
  const m1 = criarMissao('A');
  const m2 = criarMissao('B');
  servicoProjeto.associarMissao(p.id, m1.id);
  const projeto = servicoProjeto.obter(p.id);
  assert.equal(projeto.totalMissoes, 1);
  assert.equal(projeto.missoes[0].id, m1.id);
  assert.equal(servicoMissao.obter(m2.id).projetoId, null);
});

test('progresso: calculado das missões; conclusão do projeto explícita', () => {
  const p = criarProjeto('Progresso');
  const m1 = criarMissao();
  const m2 = criarMissao();
  servicoProjeto.associarMissao(p.id, m1.id);
  servicoProjeto.associarMissao(p.id, m2.id);
  assert.equal(servicoProjeto.obter(p.id).progresso, 0);

  servicoMissao.iniciar(m1.id);
  servicoMissao.concluir(m1.id);
  const meio = servicoProjeto.obter(p.id);
  assert.equal(meio.progresso, 50);
  assert.equal(meio.estado, 'planejado', 'não muda automaticamente');

  servicoMissao.iniciar(m2.id);
  servicoMissao.concluir(m2.id);
  const pronto = servicoProjeto.obter(p.id);
  assert.equal(pronto.progresso, 100);
  assert.equal(pronto.estado, 'planejado');
  assert.equal(pronto.prontaParaEncerrar, true);
  servicoProjeto.iniciar(p.id); // conclusão do projeto exige fluxo: → em andamento → concluído
  const concluido = servicoProjeto.concluir(p.id);
  assert.equal(concluido.estado, 'concluido');
});

test('bloqueios: missão em dois projetos; projeto/missão inexistentes', () => {
  const p1 = criarProjeto('P1');
  const p2 = criarProjeto('P2');
  const m = criarMissao();
  servicoProjeto.associarMissao(p1.id, m.id);
  assert.throws(() => servicoProjeto.associarMissao(p2.id, m.id), ErroConflito);
  assert.throws(() => servicoProjeto.associarMissao(99999, m.id), ErroConflito); // projeto inexistente
  assert.throws(() => servicoProjeto.associarMissao(p1.id, 99999), ErroConflito); // missão inexistente
});

test('remoção: missão sai do projeto e segue existindo sem projeto', () => {
  const p = criarProjeto('Remover');
  const m = criarMissao();
  servicoProjeto.associarMissao(p.id, m.id);
  const depois = servicoProjeto.removerMissao(p.id, m.id);
  assert.equal(depois.totalMissoes, 0);
  assert.equal(servicoMissao.obter(m.id).projetoId, null);
});

test('persistência: projetos e vínculos sobrevivem ao fechar/reabrir', () => {
  const p = criarProjeto('Persistir');
  const m = criarMissao();
  servicoProjeto.associarMissao(p.id, m.id);
  servicoProjeto.iniciar(p.id);

  banco.close();
  banco = new DatabaseSync(join(diretorio, 'pulso.db'));
  banco.exec('PRAGMA foreign_keys = ON');
  const servico2 = new ServicoProjeto({
    repositorio: new RepositorioProjeto(banco),
    repositorioMissao: new RepositorioMissao(banco),
    repositorioJogador: new RepositorioJogador(banco),
  });
  const relido = servico2.obter(p.id);
  assert.equal(relido.titulo, 'Persistir');
  assert.equal(relido.estado, 'em_andamento');
  assert.equal(relido.totalMissoes, 1);
});
