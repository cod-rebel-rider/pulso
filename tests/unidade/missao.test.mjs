/**
 * PULSO — Testes unitários: domínio de Missão (Fase 05)
 *
 * Validam as regras puras (validação, estados, transições, prioridade, prazo)
 * sem depender do banco de dados ou do Electron.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS,
  ESTADOS_ORDEM,
  PRIORIDADES,
  PRIORIDADES_ORDEM,
  ESTADO_INICIAL,
  PRIORIDADE_PADRAO,
  validarTitulo,
  validarDescricao,
  validarPrioridade,
  validarPrazo,
  validarMissaoCriacao,
  validarTransicao,
  estaAtrasada,
  criarMissao,
} from '../../src/core/dominio/missao.js';
import { ErroValidacao, ErroTransicao } from '../../src/core/erros.js';

test('constantes: 4 estados e 4 prioridades', () => {
  assert.deepEqual(ESTADOS_ORDEM, ['pendente', 'em_andamento', 'concluida', 'cancelada']);
  assert.deepEqual(PRIORIDADES_ORDEM, ['baixa', 'normal', 'alta', 'critica']);
  assert.equal(ESTADO_INICIAL, 'pendente');
  assert.equal(PRIORIDADE_PADRAO, 'normal');
});

test('validarTitulo aceita título válido', () => {
  assert.equal(validarTitulo('Configurar PULSO'), 'Configurar PULSO');
  assert.equal(validarTitulo('  Organizar docs  '), 'Organizar docs'); // trim
});

test('validarTitulo rejeita título vazio ou inválido', () => {
  assert.throws(() => validarTitulo(''), ErroValidacao);
  assert.throws(() => validarTitulo('   '), ErroValidacao);
  assert.throws(() => validarTitulo(null), ErroValidacao);
  assert.throws(() => validarTitulo(123), ErroValidacao);
  assert.throws(() => validarTitulo('a'.repeat(201)), ErroValidacao); // > 200
});

test('validarDescricao aceita descrição válida ou null', () => {
  assert.equal(validarDescricao('Detalhes da missão'), 'Detalhes da missão');
  assert.equal(validarDescricao(''), null);
  assert.equal(validarDescricao(null), null);
  assert.equal(validarDescricao(undefined), null);
});

test('validarDescricao rejeita descrição muito longa', () => {
  assert.throws(() => validarDescricao('a'.repeat(2001)), ErroValidacao);
});

test('validarPrioridade aceita prioridades válidas', () => {
  assert.equal(validarPrioridade('baixa'), 'baixa');
  assert.equal(validarPrioridade('normal'), 'normal');
  assert.equal(validarPrioridade('alta'), 'alta');
  assert.equal(validarPrioridade('critica'), 'critica');
});

test('validarPrioridade rejeita prioridade desconhecida', () => {
  assert.throws(() => validarPrioridade('urgente'), ErroValidacao);
  assert.throws(() => validarPrioridade(null), ErroValidacao);
  assert.throws(() => validarPrioridade(undefined), ErroValidacao);
});

test('validarMissaoCriacao usa prioridade padrão quando null/undefined', () => {
  const m1 = validarMissaoCriacao({ titulo: 'Test', prioridade: null });
  assert.equal(m1.prioridade, 'normal');
  const m2 = validarMissaoCriacao({ titulo: 'Test' });
  assert.equal(m2.prioridade, 'normal');
});

test('validarPrazo aceita ISO válido ou null', () => {
  assert.match(validarPrazo('2025-12-31T23:59:59Z'), /^2025-12-31T23:59:59/);
  assert.equal(validarPrazo(null), null);
  assert.equal(validarPrazo(''), null);
});

test('validarPrazo rejeita formato inválido', () => {
  assert.throws(() => validarPrazo('31/12/2025'), ErroValidacao);
  assert.throws(() => validarPrazo('amanhã'), ErroValidacao);
});

test('validarTransicao permite transições válidas', () => {
  assert.equal(validarTransicao('pendente', 'em_andamento'), 'em_andamento');
  assert.equal(validarTransicao('pendente', 'cancelada'), 'cancelada');
  assert.equal(validarTransicao('em_andamento', 'concluida'), 'concluida');
  assert.equal(validarTransicao('em_andamento', 'cancelada'), 'cancelada');
});

test('validarTransicao rejeita transições inválidas', () => {
  assert.throws(() => validarTransicao('pendente', 'concluida'), ErroTransicao); // precisa iniciar
  assert.throws(() => validarTransicao('concluida', 'em_andamento'), ErroTransicao); // não reabre
  assert.throws(() => validarTransicao('cancelada', 'concluida'), ErroTransicao); // não reabre
  assert.throws(() => validarTransicao('concluida', 'pendente'), ErroTransicao);
});

test('validarTransicao rejeita estado desconhecido', () => {
  assert.throws(() => validarTransicao('pendente', 'finalizada'), ErroValidacao);
  assert.throws(() => validarTransicao('iniciada', 'concluida'), ErroValidacao);
});

test('estaAtrasada identifica missão atrasada', () => {
  const ontem = new Date(Date.now() - 86400000).toISOString();
  assert.equal(estaAtrasada('pendente', ontem), true);
  assert.equal(estaAtrasada('em_andamento', ontem), true);
});

test('estaAtrasada retorna false para estados finais ou sem prazo', () => {
  const ontem = new Date(Date.now() - 86400000).toISOString();
  assert.equal(estaAtrasada('concluida', ontem), false);
  assert.equal(estaAtrasada('cancelada', ontem), false);
  assert.equal(estaAtrasada('pendente', null), false);
});

test('estaAtrasada retorna false para prazo futuro', () => {
  const amanha = new Date(Date.now() + 86400000).toISOString();
  assert.equal(estaAtrasada('pendente', amanha), false);
});

test('criarMissao cria missão com valores padrão', () => {
  const missao = criarMissao({ titulo: 'Nova missão' });
  assert.equal(missao.titulo, 'Nova missão');
  assert.equal(missao.descricao, null);
  assert.equal(missao.estado, 'pendente');
  assert.equal(missao.prioridade, 'normal');
  assert.equal(missao.prazo, null);
});

test('criarMissao cria missão com todos os campos', () => {
  const missao = criarMissao({
    titulo: 'Missão completa',
    descricao: 'Descrição detalhada',
    prioridade: 'alta',
    prazo: '2025-12-31T23:59:59Z',
  });
  assert.equal(missao.titulo, 'Missão completa');
  assert.equal(missao.descricao, 'Descrição detalhada');
  assert.equal(missao.estado, 'pendente');
  assert.equal(missao.prioridade, 'alta');
  assert.match(missao.prazo, /^2025-12-31T23:59:59/);
});

test('criarMissao rejeita título inválido', () => {
  assert.throws(() => criarMissao({ titulo: '' }), ErroValidacao);
});
