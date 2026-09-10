/**
 * PULSO — Testes unitários: domínio de Progressão (Fase 06)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NIVEL_INICIAL,
  XP_INICIAL,
  PONTOS_INICIAIS,
  PONTOS_POR_NIVEL,
  ATRIBUTOS_DISPONIVEIS,
  ATRIBUTOS_ROTULOS,
  xpNecessarioParaProximoNivel,
  calcularNivel,
  calcularProgresso,
  validarXpTotal,
  validarQuantidadeXp,
  adicionarXp,
  validarNomeAtributo,
  aumentarAtributo,
  atributosIniciais,
} from '../../src/core/dominio/progressao.js';
import { ErroValidacao } from '../../src/core/erros.js';

test('constantes iniciais: nível 1, 0 XP, 0 pontos, atributos em 1', () => {
  assert.equal(NIVEL_INICIAL, 1);
  assert.equal(XP_INICIAL, 0);
  assert.equal(PONTOS_INICIAIS, 0);
  assert.equal(PONTOS_POR_NIVEL, 1);
  assert.deepEqual(ATRIBUTOS_DISPONIVEIS, [
    'tecnologia', 'criatividade', 'musica', 'social', 'energia', 'foco', 'disciplina',
  ]);
  assert.equal(Object.keys(ATRIBUTOS_ROTULOS).length, 7);
  assert.deepEqual(atributosIniciais(), {
    tecnologia: 1, criatividade: 1, musica: 1, social: 1, energia: 1, foco: 1, disciplina: 1,
  });
});

test('curva de XP: 100 x nível atual', () => {
  assert.equal(xpNecessarioParaProximoNivel(1), 100);
  assert.equal(xpNecessarioParaProximoNivel(2), 200);
  assert.equal(xpNecessarioParaProximoNivel(3), 300);
  assert.equal(xpNecessarioParaProximoNivel(10), 1000);
});

test('curva rejeita nível inválido (nunca nível 0)', () => {
  assert.throws(() => xpNecessarioParaProximoNivel(0), ErroValidacao);
  assert.throws(() => xpNecessarioParaProximoNivel(-2), ErroValidacao);
  assert.throws(() => xpNecessarioParaProximoNivel(1.5), ErroValidacao);
});

test('nível: abaixo do limite não sobe; no limite sobe', () => {
  assert.equal(calcularNivel(0), 1);
  assert.equal(calcularNivel(99), 1);
  assert.equal(calcularNivel(100), 2);
  assert.equal(calcularNivel(300), 3);
});

test('nível: múltiplos níveis de uma vez', () => {
  assert.equal(calcularNivel(150), 2);
  assert.equal(calcularNivel(350), 3);
  assert.equal(calcularNivel(600), 4);
});

test('XP total rejeita negativo e não inteiro', () => {
  assert.throws(() => calcularNivel(-1), ErroValidacao);
  assert.throws(() => validarXpTotal(-100), ErroValidacao);
  assert.throws(() => validarXpTotal(1.5), ErroValidacao);
  assert.throws(() => validarXpTotal('100'), ErroValidacao);
});

test('progresso detalha nível, sobra e percentual', () => {
  const base = calcularProgresso(0);
  assert.equal(base.nivel, 1);
  assert.equal(base.xpNoNivel, 0);
  assert.equal(base.xpNecessario, 100);
  const parcial = calcularProgresso(75);
  assert.equal(parcial.nivel, 1);
  assert.equal(parcial.xpNoNivel, 75);
  assert.equal(parcial.progresso, 0.75);
  const nivel2 = calcularProgresso(100);
  assert.equal(nivel2.nivel, 2);
  assert.equal(nivel2.xpNoNivel, 0);
  assert.equal(nivel2.xpNecessario, 200);
});

test('quantidade de XP: zero aceito, negativo rejeitado', () => {
  assert.equal(validarQuantidadeXp(0), 0);
  assert.equal(validarQuantidadeXp(50), 50);
  assert.throws(() => validarQuantidadeXp(-10), ErroValidacao);
  assert.throws(() => validarQuantidadeXp(1.5), ErroValidacao);
});

test('adicionarXp: parcial sem level up; zero sem alteração', () => {
  const parcial = adicionarXp({ xpTotal: 0, nivel: 1, pontosDisponiveis: 0 }, 75);
  assert.equal(parcial.xpTotal, 75);
  assert.equal(parcial.subiuNivel, false);
  assert.equal(parcial.pontosDisponiveis, 0);
  const zero = adicionarXp({ xpTotal: 90, nivel: 1, pontosDisponiveis: 0 }, 0);
  assert.equal(zero.xpTotal, 90);
  assert.equal(zero.subiuNivel, false);
});

test('adicionarXp: level up concede +1 ponto', () => {
  const r = adicionarXp({ xpTotal: 90, nivel: 1, pontosDisponiveis: 0 }, 20);
  assert.equal(r.nivel, 2);
  assert.equal(r.subiuNivel, true);
  assert.equal(r.niveisGanhos, 1);
  assert.equal(r.pontosDisponiveis, 1);
});

test('adicionarXp: múltiplos níveis concedem pontos corretos', () => {
  const r = adicionarXp({ xpTotal: 90, nivel: 1, pontosDisponiveis: 0 }, 250);
  assert.equal(r.xpTotal, 340);
  assert.equal(r.nivel, 3);
  assert.equal(r.niveisGanhos, 2);
  assert.equal(r.pontosDisponiveis, 2);
  assert.throws(() => adicionarXp({ xpTotal: 0, nivel: 1, pontosDisponiveis: 0 }, -5), ErroValidacao);
});

test('atributos: 7 válidos; desconhecido rejeitado', () => {
  for (const nome of ATRIBUTOS_DISPONIVEIS) {
    assert.equal(validarNomeAtributo(nome), nome);
  }
  assert.throws(() => validarNomeAtributo('mana'), ErroValidacao);
});

test('aumentarAtributo consome pontos; excesso e inválidos rejeitados', () => {
  const atual = { atributos: atributosIniciais(), pontosDisponiveis: 3 };
  const p1 = aumentarAtributo(atual, 'tecnologia', 1);
  assert.equal(p1.atributos.tecnologia, 2);
  assert.equal(p1.pontosDisponiveis, 2);
  const p2 = aumentarAtributo({ atributos: p1.atributos, pontosDisponiveis: p1.pontosDisponiveis }, 'disciplina', 2);
  assert.equal(p2.atributos.disciplina, 3);
  assert.equal(p2.pontosDisponiveis, 0);
  const curto = { atributos: atributosIniciais(), pontosDisponiveis: 1 };
  assert.throws(() => aumentarAtributo(curto, 'mana', 1), ErroValidacao);
  assert.throws(() => aumentarAtributo(curto, 'tecnologia', 0), ErroValidacao);
  assert.throws(() => aumentarAtributo(curto, 'tecnologia', -1), ErroValidacao);
  assert.throws(() => aumentarAtributo(curto, 'tecnologia', 2), ErroValidacao);
});

