/**
 * Testes unitários — configuração por ambiente (Fase 01 — Fundação)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarConfiguracao, determinarAmbiente } from '../../src/main/configuracao.js';

test('carrega a configuração dos três ambientes', () => {
  for (const ambiente of ['desenvolvimento', 'teste', 'producao']) {
    const config = carregarConfiguracao(ambiente);
    assert.equal(config.ambiente, ambiente, `${ambiente}.json com ambiente incorreto`);
    assert.equal(config.idioma, 'pt-BR', `${ambiente}.json deve declarar pt-BR`);
    assert.equal(typeof config.depuracao, 'boolean', `${ambiente}.json deve declarar depuracao`);
    assert.ok(config.janela.largura > 0 && config.janela.altura > 0, `${ambiente}.json com janela inválida`);
  }
});

test('rejeita ambiente desconhecido', () => {
  assert.throws(() => carregarConfiguracao('inexistente'), /Ambiente desconhecido/);
});

test('determinarAmbiente respeita PULSO_AMBIENTE e o empacotamento', () => {
  const original = process.env.PULSO_AMBIENTE;
  try {
    delete process.env.PULSO_AMBIENTE;
    assert.equal(determinarAmbiente({ isPackaged: false }), 'desenvolvimento');
    assert.equal(determinarAmbiente({ isPackaged: true }), 'producao');

    process.env.PULSO_AMBIENTE = 'teste';
    assert.equal(determinarAmbiente({ isPackaged: false }), 'teste');

    process.env.PULSO_AMBIENTE = 'bizarro';
    assert.throws(() => determinarAmbiente({ isPackaged: false }), /PULSO_AMBIENTE inválido/);
  } finally {
    if (original === undefined) {
      delete process.env.PULSO_AMBIENTE;
    } else {
      process.env.PULSO_AMBIENTE = original;
    }
  }
});
