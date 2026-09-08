/**
 * Testes unitários — registro de eventos (Fase 01 — Fundação)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { formatarLinha, NIVEIS } from '../../src/main/registro.js';

test('formatarLinha produz linha identificável do PULSO', () => {
  const linha = formatarLinha(NIVEIS.ERRO, 'Falha de teste', new Date('2026-01-01T00:00:00Z'));
  assert.match(linha, /^\[PULSO\]\[2026-01-01T00:00:00\.000Z\]\[ERRO\] Falha de teste$/);
});

test('formatarLinha recusa nível inválido e cai em INFO', () => {
  const linha = formatarLinha('QUALQUER', 'mensagem', new Date('2026-01-01T00:00:00Z'));
  assert.match(linha, /\[INFO\] mensagem$/);
});
