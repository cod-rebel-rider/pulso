/**
 * PULSO — Testes unitários: domínio de Projeto (Fase 07)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS_PROJETO,
  ESTADOS_PROJETO_ORDEM,
  ESTADO_PROJETO_INICIAL,
  validarEstadoProjeto,
  validarTituloProjeto,
  validarDescricaoProjeto,
  validarPrioridadeProjeto,
  validarPrazoProjeto,
  validarProjetoCriacao,
  validarProjetoEdicao,
  transicaoProjetoPermitida,
  exigirTransicaoProjeto,
  projetoAtivo,
  projetoAtrasado,
  calcularProgressoProjeto,
} from '../../src/core/dominio/projeto.js';
import { ErroValidacao, ErroTransicao } from '../../src/core/erros.js';

test('estados: 5 estados na ordem, inicial planejado', () => {
  assert.deepEqual(ESTADOS_PROJETO_ORDEM, [
    'planejado', 'em_andamento', 'concluido', 'cancelado', 'arquivado',
  ]);
  assert.equal(ESTADO_PROJETO_INICIAL, 'planejado');
  for (const nome of ESTADOS_PROJETO_ORDEM) {
    assert.equal(validarEstadoProjeto(nome), nome);
  }
  assert.throws(() => validarEstadoProjeto('finalizado'), ErroValidacao);
});

test('transições permitidas', () => {
  assert.equal(transicaoProjetoPermitida('planejado', 'em_andamento'), true);
  assert.equal(transicaoProjetoPermitida('planejado', 'cancelado'), true);
  assert.equal(transicaoProjetoPermitida('planejado', 'arquivado'), true);
  assert.equal(transicaoProjetoPermitida('em_andamento', 'concluido'), true);
  assert.equal(transicaoProjetoPermitida('em_andamento', 'cancelado'), true);
  assert.equal(transicaoProjetoPermitida('em_andamento', 'arquivado'), true);
  assert.equal(transicaoProjetoPermitida('concluido', 'arquivado'), true);
  assert.equal(transicaoProjetoPermitida('cancelado', 'arquivado'), true);
});

test('transições inválidas rejeitadas', () => {
  assert.throws(() => exigirTransicaoProjeto('planejado', 'concluido'), ErroTransicao);
  assert.throws(() => exigirTransicaoProjeto('em_andamento', 'em_andamento'), ErroTransicao);
  assert.throws(() => exigirTransicaoProjeto('concluido', 'planejado'), ErroTransicao);
  assert.throws(() => exigirTransicaoProjeto('arquivado', 'em_andamento'), ErroTransicao);
  assert.throws(() => exigirTransicaoProjeto('arquivado', 'planejado'), ErroTransicao);
});

test('validação: título obrigatório e limites', () => {
  assert.equal(validarTituloProjeto('  Setup DJ  '), 'Setup DJ');
  assert.throws(() => validarTituloProjeto(''), ErroValidacao);
  assert.throws(() => validarTituloProjeto('   '), ErroValidacao);
  assert.throws(() => validarTituloProjeto('a'.repeat(121)), ErroValidacao);
});

test('validação: descrição opcional', () => {
  assert.equal(validarDescricaoProjeto('Detalhes'), 'Detalhes');
  assert.equal(validarDescricaoProjeto(null), null);
  assert.equal(validarDescricaoProjeto(''), null);
});

test('validação: prioridade (mesmos valores das missões)', () => {
  assert.equal(validarPrioridadeProjeto('baixa'), 'baixa');
  assert.equal(validarPrioridadeProjeto('normal'), 'normal');
  assert.equal(validarPrioridadeProjeto('alta'), 'alta');
  assert.equal(validarPrioridadeProjeto('critica'), 'critica');
  assert.throws(() => validarPrioridadeProjeto('urgente'), ErroValidacao);
});

test('validação: prazo opcional (ISO ou null)', () => {
  assert.equal(validarPrazoProjeto(null), null);
  assert.equal(validarPrazoProjeto(''), null);
  assert.match(validarPrazoProjeto('2025-12-31T23:59:59Z'), /^2025-12-31/);
  assert.throws(() => validarPrazoProjeto('amanhã'), ErroValidacao);
});

test('criação: status inicial sempre planejado; prioridade padrão normal', () => {
  const p = validarProjetoCriacao({ titulo: 'OndaHub' });
  assert.equal(p.titulo, 'OndaHub');
  assert.equal(p.prioridade, 'normal');
  assert.equal(p.descricao, null);
  assert.equal(p.prazo, null);
  const comPrazo = validarProjetoCriacao({ titulo: 'X', prioridade: 'alta', prazo: '2025-12-31T23:59:59Z' });
  assert.equal(comPrazo.prioridade, 'alta');
  assert.ok(comPrazo.prazo);
});

test('edição: campos parciais; estado nunca vem por campo livre', () => {
  const e = validarProjetoEdicao({ titulo: 'Novo' });
  assert.equal(e.titulo, 'Novo');
  assert.equal('estado' in e, false);
});

test('projetoAtivo discrimina fluxo ativo', () => {
  assert.equal(projetoAtivo('planejado'), true);
  assert.equal(projetoAtivo('em_andamento'), true);
  assert.equal(projetoAtivo('concluido'), false);
  assert.equal(projetoAtivo('arquivado'), false);
});

test('projetoAtrasado: prazo passado indica, mas não muda estado', () => {
  const passado = new Date(Date.now() - 86400000).toISOString();
  const futuro = new Date(Date.now() + 86400000).toISOString();
  assert.equal(projetoAtrasado('em_andamento', passado), true);
  assert.equal(projetoAtrasado('planejado', passado), true);
  assert.equal(projetoAtrasado('em_andamento', futuro), false);
  assert.equal(projetoAtrasado('em_andamento', null), false);
  assert.equal(projetoAtrasado('concluido', passado), false);
  assert.equal(projetoAtrasado('arquivado', passado), false);
});

test('progresso: sem missões → 0%, conforme missões concluídas', () => {
  assert.equal(calcularProgressoProjeto([]), 0);
  assert.equal(calcularProgressoProjeto([{ estado: 'concluida' }]), 100);
  assert.equal(calcularProgressoProjeto([{ estado: 'concluida' }, { estado: 'pendente' }]), 50);
  assert.equal(
    calcularProgressoProjeto([
      { estado: 'concluida' }, { estado: 'concluida' }, { estado: 'pendente' },
    ]),
    66.67,
  );
});
