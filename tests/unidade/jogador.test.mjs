/**
 * Testes unitários — domínio do Jogador (Fase 03 — Jogador)
 *
 * As regras de identidade vivem no domínio (não no renderer, não no banco).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { validarIdentidade, validarNome, LIMITE_NOME, LIMITE_CODINOME } from '../../src/core/dominio/jogador.js';
import { ErroValidacao } from '../../src/core/erros.js';

test('identidade válida é normalizada (espaços aparados)', () => {
  const identidade = validarIdentidade({ nome: '  Ana Rebel  ', codinome: '  echo  ' });
  assert.equal(identidade.nome, 'Ana Rebel');
  assert.equal(identidade.codinome, 'echo');
});

test('nome vazio ou só espaços é rejeitado com erro de validação', () => {
  assert.throws(() => validarNome('   '), (erro) => erro instanceof ErroValidacao && erro.campo === 'nome');
  assert.throws(() => validarNome(undefined), ErroValidacao);
});

test('nome acima do limite é rejeitado', () => {
  assert.throws(() => validarNome('x'.repeat(LIMITE_NOME + 1)), /no máximo/);
  assert.doesNotThrow(() => validarNome('x'.repeat(LIMITE_NOME)));
});

test('codinome é opcional e vira null quando vazio', () => {
  assert.equal(validarIdentidade({ nome: 'Ana' }).codinome, null);
  assert.equal(validarIdentidade({ nome: 'Ana', codinome: '   ' }).codinome, null);
});

test('codinome acima do limite é rejeitado', () => {
  assert.throws(
    () => validarIdentidade({ nome: 'Ana', codinome: 'x'.repeat(LIMITE_CODINOME + 1) }),
    (erro) => erro instanceof ErroValidacao && erro.campo === 'codinome',
  );
});

test('caracteres especiais no nome não são bloqueados (decisão de produto)', () => {
  assert.equal(validarIdentidade({ nome: 'Ana "Rebel" <n3t>' }).nome, 'Ana "Rebel" <n3t>');
});
