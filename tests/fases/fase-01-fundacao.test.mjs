/**
 * PULSO — Homologação FASE 01 — Fundação.
 *
 * Escopo real da Fase 01: janela segura, ciclo de vida, ponte IPC mínima,
 * configuração por ambiente e registro. Sem banco (Fase 02) e sem display
 * aqui: valida as partes puras/testáveis sem sessão gráfica.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { determinarAmbiente, carregarConfiguracao } from '../../src/main/configuracao.js';
import { formatarLinha, NIVEIS } from '../../src/main/registro.js';
import canais from '../../src/main/canais.cjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const preload = readFileSync(join(raiz, 'src', 'main', 'preload.cjs'), 'utf-8');

test('F01 fundação | configuração | carrega config de teste', () => {
  const config = carregarConfiguracao('teste');
  assert.equal(config.ambiente, 'teste');
  assert.equal(config.idioma, 'pt-BR');
  assert.ok(config.janela.largura > 0 && config.janela.altura > 0);
});

test('F01 fundação | configuração | ambiente desconhecido rejeitado', () => {
  assert.throws(() => carregarConfiguracao('inexistente'), /ambiente/i);
});

test('F01 fundação | configuração | determinarAmbiente respeita PULSO_AMBIENTE', () => {
  const original = process.env.PULSO_AMBIENTE;
  try {
    delete process.env.PULSO_AMBIENTE;
    assert.equal(determinarAmbiente({ isPackaged: false }), 'desenvolvimento');
    process.env.PULSO_AMBIENTE = 'teste';
    assert.equal(determinarAmbiente({ isPackaged: false }), 'teste');
  } finally {
    if (original === undefined) delete process.env.PULSO_AMBIENTE;
    else process.env.PULSO_AMBIENTE = original;
  }
});

test('F01 fundação | configuração | arquivos config existem (dev/teste/produção)', () => {
  for (const ambiente of ['desenvolvimento', 'teste', 'producao']) {
    assert.equal(existsSync(join(raiz, 'config', `${ambiente}.json`)), true, `config/${ambiente}.json`);
  }
});

test('F01 fundação | registro | linha possui formato [PULSO][ISO][NÍVEL]', () => {
  const linha = formatarLinha(NIVEIS.INFO, 'Homologação ativa');
  assert.match(linha, /^\[PULSO\]\[.+\]\[INFO\] Homologação ativa$/);
});

test('F01 fundação | registro | nível inválido cai para INFO', () => {
  assert.match(formatarLinha('INVENTADO', 'x'), /\[INFO\] x$/);
});

test('F01 fundação | IPC | canal info:sistema definido', () => {
  assert.equal(canais.INFO_SISTEMA, 'info:sistema');
});

test('F01 fundação | IPC | preload expõe ponte controlada (contextBridge + canais em sincronia)', () => {
  assert.match(preload, /contextBridge/);
  assert.match(preload, /nodeIntegration: false/);
  assert.ok(!preload.includes("require('node:"), 'preload não deve expor Node ao renderer');
  const declarados = [...preload.matchAll(/const CANAL_[A-Z_]+ = '([^']+)'/g)].map((m) => m[1]);
  for (const canal of Object.values(canais)) {
    assert.ok(declarados.includes(canal), `preload deve conhecer canal ${canal}`);
  }
});

test('F01 fundação | estrutura | arquivos do processo principal existem', () => {
  for (const arquivo of ['src/main/main.js', 'src/main/janela.js', 'src/main/preload.cjs', 'src/main/canais.cjs', 'src/main/registro.js', 'src/main/configuracao.js']) {
    assert.equal(existsSync(join(raiz, arquivo)), true, arquivo);
  }
});

test('F01 fundação | estrutura | renderer isolado (CSP + sem acesso a Node)', () => {
  const html = readFileSync(join(raiz, 'src', 'renderer', 'index.html'), 'utf-8');
  assert.match(html, /Content-Security-Policy/);
  const principal = readFileSync(join(raiz, 'src', 'renderer', 'js', 'principal.js'), 'utf-8');
  assert.ok(!principal.includes("require('node:"), 'renderer não deve usar require de Node');
});
