/**
 * PULSO — Testes unitários: contrato IPC da Progressão (Fase 06)
 *
 * O processo principal (src/main/main.js) não é importável em teste — carregá-lo
 * executa o bootstrap do Electron. A regressão de contrato é coberta por ANÁLISE
 * ESTÁTICA da fonte (mesmo recurso já usado em tests/unidade/canais.test.mjs
 * para o preload): garante que cada canal da progressão continua registrado no
 * main e exposto no preload. O comportamento em execução é coberto pelo teste
 * de fumaça (tests/integracao/inicializacao.test.mjs) e pelos testes de
 * integração do serviço (tests/integracao/progressao.test.mjs).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import canais from '../../src/main/canais.cjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fonteMain = readFileSync(join(raiz, 'src', 'main', 'main.js'), 'utf-8');
const fontePreload = readFileSync(join(raiz, 'src', 'main', 'preload.cjs'), 'utf-8');

test('os três canais da progressão têm handler registrado no processo principal', () => {
  for (const constante of ['PROGRESSAO_OBTER', 'PROGRESSAO_ADICIONAR_XP', 'PROGRESSAO_AUMENTAR_ATRIBUTO']) {
    assert.ok(canais[constante], `canal ausente em canais.cjs: ${constante}`);
    assert.match(
      fonteMain,
      new RegExp(`ipcMain\\.handle\\(\\s*canais\\.${constante}\\b`),
      `handler não registrado em main.js: ${constante}`,
    );
  }
});

test('o preload expõe obter/adicionarXp/aumentarAtributo em window.pulso.progressao', () => {
  assert.match(fontePreload, /progressao: Object\.freeze\(\{/);
  assert.match(fontePreload, /obter: \(jogadorId\) => ipcRenderer\.invoke\(CANAL_PROGRESSAO_OBTER, \{ jogadorId \}\)/);
  assert.match(
    fontePreload,
    /adicionarXp: \(jogadorId, quantidade\) =>\s*ipcRenderer\.invoke\(CANAL_PROGRESSAO_ADICIONAR_XP, \{ jogadorId, quantidade \}\)/,
  );
  assert.match(fontePreload, /aumentarAtributo: \(jogadorId, atributo, quantidade = 1\) =>/);
});

test('os handlers da progressão usam jogadorId explícito e traduzem o resultado', () => {
  const inicio = fonteMain.indexOf('// ── Progressão (Fase 06)');
  const fim = fonteMain.indexOf('// ── Projetos (Fase 07)');
  assert.ok(inicio >= 0 && fim > inicio, 'bloco de handlers da progressão não encontrado em main.js');
  const bloco = fonteMain.slice(inicio, fim);

  assert.match(bloco, /servicoProgressao\.obter\(Number\(jogadorId \?\? 0\)\)/);
  assert.match(bloco, /servicoProgressao\.adicionarXp\(Number\(jogadorId \?\? 0\), Number\(quantidade\)\)/);
  assert.match(bloco, /servicoProgressao\.aumentarAtributo\(/);
  assert.equal((bloco.match(/traduzirResultadoOperacao/g) || []).length, 3);
});
