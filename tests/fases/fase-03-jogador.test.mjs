import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { validarNome, validarCodinome, validarIdentidade } from '../../src/core/dominio/jogador.js';
import { ErroValidacao, ErroConflito } from '../../src/core/erros.js';
import { criarBancoTemporario, destruirBancoTemporario, criarServicos } from '../utils/ambiente-homologacao.mjs';
function mundo() {
  const ambiente = criarBancoTemporario('homolog-f03-');
  return { ...ambiente, ...criarServicos(ambiente.banco) };
}
test('F03 jogador | domínio | nome válido normalizado', () => {
  assert.equal(validarNome('  Ana  '), 'Ana');
});
test('F03 jogador | domínio | codinome opcional vira null quando vazio', () => {
  assert.equal(validarCodinome(''), null);
  assert.equal(validarCodinome(null), null);
  assert.equal(validarCodinome('  netrunner  '), 'netrunner');
});
test('F03 jogador | domínio | identidade congela nome + codinome', () => {
  assert.deepEqual(validarIdentidade({ nome: 'Rex', codinome: 'flux' }), { nome: 'Rex', codinome: 'flux' });
});
test('F03 jogador | validação | nome vazio/nulo/tipo errado rejeitado', () => {
  for (const valor of ['', '   ', null, undefined, 123, {}, []]) {
    assert.throws(() => validarNome(valor), ErroValidacao, JSON.stringify(valor));
  }
});
test('F03 jogador | validação | nome acima de 60 rejeitado; limite exato aceito', () => {
  assert.throws(() => validarNome('a'.repeat(61)), ErroValidacao);
  assert.equal(validarNome('a'.repeat(60)).length, 60);
});
test('F03 jogador | validação | codinome acima de 40 rejeitado; limite exato aceito', () => {
  assert.throws(() => validarCodinome('c'.repeat(41)), ErroValidacao);
  assert.equal(validarCodinome('c'.repeat(40)).length, 40);
});
test('F03 jogador | validação | caracteres especiais permitidos (decisão de produto)', () => {
  assert.equal(validarNome('Zé @#_!-01 çã'), 'Zé @#_!-01 çã');
});
test('F03 jogador | serviço | criar retorna jogador persistido', () => {
  const m = mundo();
  try {
    const jogador = m.servicoJogador.criar({ nome: 'Nova', codinome: 'prime' });
    assert.ok(jogador.id);
    assert.equal(jogador.nome, 'Nova');
    assert.equal(m.servicoJogador.existe(), true);
    assert.equal(m.servicoJogador.obter().id, jogador.id);
  } finally {
    destruirBancoTemporario(m);
  }
});
test('F03 jogador | serviço | segundo jogador bloqueado (single-player)', () => {
  const m = mundo();
  try {
    m.servicoJogador.criar({ nome: 'Um' });
    assert.throws(() => m.servicoJogador.criar({ nome: 'Dois' }), ErroConflito);
    assert.equal(m.repositorioJogador.buscarPrimeiro().nome, 'Um');
  } finally {
    destruirBancoTemporario(m);
  }
});
test('F03 jogador | serviço | atualizar identidade válida; inexistente rejeitado', () => {
  const m = mundo();
  try {
    const jogador = m.servicoJogador.criar({ nome: 'Antes' });
    const atualizado = m.servicoJogador.atualizar(jogador.id, { nome: 'Depois', codinome: 'd2' });
    assert.equal(atualizado.nome, 'Depois');
    assert.throws(() => m.servicoJogador.atualizar(99999, { nome: 'X' }), ErroConflito);
  } finally {
    destruirBancoTemporario(m);
  }
});
test('F03 jogador | serviço | criação inválida não persiste nada', () => {
  const m = mundo();
  try {
    assert.throws(() => m.servicoJogador.criar({ nome: '' }), ErroValidacao);
    assert.equal(m.servicoJogador.existe(), false);
  } finally {
    destruirBancoTemporario(m);
  }
});
test('F03 jogador | serviço | nascimento cria status + progressão + carteira', () => {
  const m = mundo();
  try {
    const jogador = m.servicoJogador.criar({ nome: 'Completo' });
    const status = m.servicoStatus.obter(jogador.id);
    assert.deepEqual([status.energia, status.foco, status.estresse, status.criatividade], [100, 100, 0, 100]);
    assert.equal(m.servicoProgressao.obter(jogador.id).nivel, 1);
    assert.equal(m.servicoFinanca.obterCarteira(jogador.id).saldo, 0);
  } finally {
    destruirBancoTemporario(m);
  }
});
test('F03 jogador | persistência | jogador sobrevive a fechar-reabrir', () => {
  const m = mundo();
  try {
    const jogador = m.servicoJogador.criar({ nome: 'Persistente', codinome: 'keep' });
    const caminho = join(m.diretorio, 'pulso.db');
    m.banco.close();
    const reaberto = new DatabaseSync(caminho);
    try {
      const linha = reaberto.prepare('SELECT nome, codinome FROM jogador WHERE id = ?').get(jogador.id);
      assert.equal(linha.nome, 'Persistente');
      assert.equal(linha.codinome, 'keep');
    } finally {
      reaberto.close();
    }
    m.banco = new DatabaseSync(caminho);
  } finally {
    destruirBancoTemporario(m);
  }
});
