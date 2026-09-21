/**
 * PULSO — Testes de integração: Progressão (Fase 06)
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { aplicarMigracoes } from '../../src/core/database/migracoes.js';
import { RepositorioJogador } from '../../src/core/database/repositorios/jogador.js';
import { RepositorioProgressao } from '../../src/core/database/repositorios/progressao.js';
import { RepositorioAtributos } from '../../src/core/database/repositorios/atributos.js';
import { ServicoProgressao } from '../../src/core/aplicacao/servico-progressao.js';
import { ServicoJogador } from '../../src/core/aplicacao/servico-jogador.js';
import { ErroValidacao, ErroConflito } from '../../src/core/erros.js';

let diretorio;
let banco;
let servicoJogador;
let servicoProgressao;
let jogador;

before(() => {
  diretorio = mkdtempSync(join(tmpdir(), 'pulso-progressao-'));
  banco = new DatabaseSync(join(diretorio, 'pulso.db'));
  banco.exec('PRAGMA foreign_keys = ON');
  aplicarMigracoes(banco);
  const repoJogador = new RepositorioJogador(banco);
  const repoProgressao = new RepositorioProgressao(banco);
  const repoAtributos = new RepositorioAtributos(banco);
  servicoProgressao = new ServicoProgressao({
    repositorioProgressao: repoProgressao,
    repositorioAtributos: repoAtributos,
    repositorioJogador: repoJogador,
    banco,
  });
  servicoJogador = new ServicoJogador({
    repositorio: repoJogador,
    banco,
    aoCriar: (j) => servicoProgressao.criarInicial(j.id),
  });
  jogador = servicoJogador.criar({ nome: 'Teste', codinome: 'prog' });
});

after(() => {
  banco.close();
  rmSync(diretorio, { recursive: true, force: true });
});

test('jogador novo começa no nível 1, 0 XP, 0 pontos, atributos em 1', () => {
  const visao = servicoProgressao.obter(jogador.id);
  assert.equal(visao.nivel, 1);
  assert.equal(visao.xpTotal, 0);
  assert.equal(visao.pontosDisponiveis, 0);
  assert.deepEqual(visao.atributos, {
    tecnologia: 1, criatividade: 1, musica: 1, social: 1, energia: 1, foco: 1, disciplina: 1,
  });
  assert.equal(visao.xpNoNivel, 0);
  assert.equal(visao.xpNecessario, 100);
});

test('adicionar XP positivo persiste e detalha progresso', () => {
  const r = servicoProgressao.adicionarXp(jogador.id, 75);
  assert.equal(r.xpTotal, 75);
  assert.equal(r.nivel, 1);
  assert.equal(r.subiuNivel, false);
  const relido = servicoProgressao.obter(jogador.id);
  assert.equal(relido.xpTotal, 75);
});

test('level up no limite concede ponto; múltiplos ganhos acumulam', () => {
  servicoProgressao.adicionarXp(jogador.id, 25);
  const aposNivel2 = servicoProgressao.obter(jogador.id);
  assert.equal(aposNivel2.nivel, 2);
  assert.equal(aposNivel2.pontosDisponiveis, 1);
});

test('rejeita XP negativo e jogador inexistente', () => {
  assert.throws(() => servicoProgressao.adicionarXp(jogador.id, -5), ErroValidacao);
  assert.throws(() => servicoProgressao.obter(99999), ErroConflito);
  assert.throws(() => servicoProgressao.adicionarXp(99999, 10), ErroConflito);
});

test('distribui pontos e persiste; excesso bloqueado', () => {
  const antes = servicoProgressao.obter(jogador.id);
  assert.ok(antes.pontosDisponiveis >= 1);
  const depois = servicoProgressao.aumentarAtributo(jogador.id, 'tecnologia', 1);
  assert.equal(depois.atributos.tecnologia, antes.atributos.tecnologia + 1);
  assert.equal(depois.pontosDisponiveis, antes.pontosDisponiveis - 1);
  assert.throws(() => servicoProgressao.aumentarAtributo(jogador.id, 'foco', 99), ErroValidacao);
  assert.throws(() => servicoProgressao.aumentarAtributo(jogador.id, 'mana', 1), ErroValidacao);
});

test('integridade: jogador sem progressão é inicializado sem duplicar', () => {
  const direto = new RepositorioJogador(banco).criar({ nome: 'Orfao', codinome: null });
  const v1 = servicoProgressao.obter(direto.id);
  servicoProgressao.obter(direto.id);
  assert.equal(v1.nivel, 1);
  assert.equal(v1.xpTotal, 0);
  const total = banco.prepare('SELECT COUNT(*) AS n FROM jogador_progressao WHERE jogador_id = ?').get(direto.id).n;
  assert.equal(total, 1);
});

// ── Teto, magnitude e reparo (auditoria da Fase 06) ──────────────────

/** Cria um jogador direto no banco (a aplicação é single-player). */
function criarJogadorDireto(nome) {
  return new RepositorioJogador(banco).criar({ nome, codinome: null });
}

test('teto de atributo: 100 é o limite e o valor fica gravado no banco', () => {
  const novo = criarJogadorDireto('Tetudo');
  const comPontos = servicoProgressao.adicionarXp(novo.id, 495_000); // nível 100 → 99 pontos
  assert.equal(comPontos.nivel, 100);
  assert.equal(comPontos.pontosDisponiveis, 99);

  const noLimite = servicoProgressao.aumentarAtributo(novo.id, 'tecnologia', 99);
  assert.equal(noLimite.atributos.tecnologia, 100);
  assert.equal(noLimite.pontosDisponiveis, 0);

  const proximo = servicoProgressao.adicionarXp(novo.id, 10_000); // nível 101 → +1 ponto
  assert.equal(proximo.nivel, 101);
  assert.equal(proximo.pontosDisponiveis, 1);

  assert.throws(() => servicoProgressao.aumentarAtributo(novo.id, 'tecnologia', 1), ErroValidacao);
  const outro = servicoProgressao.aumentarAtributo(novo.id, 'foco', 1);
  assert.equal(outro.atributos.foco, 2);
  assert.equal(outro.pontosDisponiveis, 0);

  const gravado = banco
    .prepare('SELECT tecnologia, foco FROM jogador_atributos WHERE jogador_id = ?')
    .get(novo.id);
  assert.equal(gravado.tecnologia, 100);
  assert.equal(gravado.foco, 2);
});

test('XP alto: persistido e detalhado corretamente (1.000.000 → nível 141)', () => {
  const novo = criarJogadorDireto('Vet');
  const visao = servicoProgressao.adicionarXp(novo.id, 1_000_000, 'CONQUISTA');
  assert.equal(visao.xpTotal, 1_000_000);
  assert.equal(visao.nivel, 141);
  assert.equal(visao.xpNoNivel, 13_000);
  assert.equal(visao.xpNecessario, 14_100);
  assert.equal(visao.pontosDisponiveis, 140);
  assert.equal(visao.niveisGanhos, 140);
  assert.equal(visao.subiuNivel, true);

  const relido = servicoProgressao.obter(novo.id);
  assert.equal(relido.xpTotal, 1_000_000);
  assert.equal(relido.nivel, 141);
});

test('origem do XP é validada e o contrato é uniforme no banco real', () => {
  const novo = criarJogadorDireto('Origem');
  assert.throws(() => servicoProgressao.adicionarXp(novo.id, 10, 'LOJA'), ErroValidacao);

  const visao = servicoProgressao.adicionarXp(novo.id, 10, 'MISSAO');
  const consulta = servicoProgressao.obter(novo.id);

  assert.equal(visao.xpTotal, 10);
  assert.equal(visao.subiuNivel, false);
  assert.equal(visao.niveisGanhos, 0);
  assert.equal(Object.isFrozen(visao), true);
  assert.deepEqual(Object.keys(visao).sort(), Object.keys(consulta).sort());
});

test('reparo: progressão existente sem atributos é completada sem duplicar', () => {
  const parcial = criarJogadorDireto('Parcial');
  banco
    .prepare('INSERT INTO jogador_progressao (jogador_id, xp_total, nivel, pontos_disponiveis) VALUES (?, 350, 3, 1)')
    .run(parcial.id);

  const visao = servicoProgressao.obter(parcial.id);

  assert.equal(visao.xpTotal, 350);
  assert.equal(visao.nivel, 3);
  assert.equal(visao.pontosDisponiveis, 1);
  assert.equal(visao.atributos.tecnologia, 1);
  const contagens = banco
    .prepare(
      `SELECT (SELECT COUNT(*) FROM jogador_progressao WHERE jogador_id = ?) AS progressoes,
              (SELECT COUNT(*) FROM jogador_atributos WHERE jogador_id = ?) AS atributos`,
    )
    .get(parcial.id, parcial.id);
  assert.equal(contagens.progressoes, 1);
  assert.equal(contagens.atributos, 1);
});

test('legado acima do teto: continua legível e não evolui mais', () => {
  const legado = criarJogadorDireto('Legado');
  servicoProgressao.obter(legado.id); // repara: cria progressão e atributos
  banco.prepare('UPDATE jogador_atributos SET tecnologia = 105 WHERE jogador_id = ?').run(legado.id);
  servicoProgressao.adicionarXp(legado.id, 100); // nível 2 → +1 ponto

  assert.throws(() => servicoProgressao.aumentarAtributo(legado.id, 'tecnologia', 1), ErroValidacao);
  const visao = servicoProgressao.obter(legado.id);
  assert.equal(visao.atributos.tecnologia, 105);
  assert.equal(visao.pontosDisponiveis, 1);
});

test('persistência: progressão sobrevive ao fechar e reabrir', () => {
  const estado = servicoProgressao.obter(jogador.id);
  banco.close();
  banco = new DatabaseSync(join(diretorio, 'pulso.db'));
  banco.exec('PRAGMA foreign_keys = ON');
  const repoJogador = new RepositorioJogador(banco);
  const servico2 = new ServicoProgressao({
    repositorioProgressao: new RepositorioProgressao(banco),
    repositorioAtributos: new RepositorioAtributos(banco),
    repositorioJogador: repoJogador,
    banco,
  });
  const relido = servico2.obter(jogador.id);
  assert.equal(relido.xpTotal, estado.xpTotal);
  assert.equal(relido.nivel, estado.nivel);
  assert.deepEqual(relido.atributos, estado.atributos);
});
