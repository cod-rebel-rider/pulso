/**
 * Testes unitários — canais IPC (Fase 01 — Fundação)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import canais from '../../src/main/canais.cjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('canais IPC têm formato válido e estão congelados', () => {
  assert.equal(Object.isFrozen(canais), true, 'canais devem ser imutáveis');
  for (const nome of Object.values(canais)) {
    assert.match(nome, /^[a-z]+(:[a-z-]+)+$/, `canal com formato inválido: ${nome}`);
  }
});

test('canais replicados no preload estão em sincronia com canais.cjs', () => {
  const preload = readFileSync(join(raiz, 'src', 'main', 'preload.cjs'), 'utf-8');
  const declarados = [...preload.matchAll(/const CANAL_[A-Z_]+ = '([^']+)'/g)].map((m) => m[1]);
  const oficiais = Object.values(canais);

  assert.ok(declarados.length > 0, 'nenhum canal declarado no preload');
  for (const oficial of oficiais) {
    assert.ok(declarados.includes(oficial), `canal "${oficial}" não replicado no preload`);
  }
  for (const declarado of declarados) {
    assert.ok(oficiais.includes(declarado), `canal "${declarado}" do preload não existe em canais.cjs`);
  }
});
