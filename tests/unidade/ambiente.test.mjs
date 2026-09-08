/**
 * Teste de sanidade da Fase 00 — Preparação.
 *
 * Não testa funcionalidades do PULSO (ainda não existem): valida apenas
 * o ambiente e a estrutura criada nesta fase.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('Node.js atende à versão mínima (>= 20)', () => {
  const maior = Number.parseInt(process.versions.node.split('.')[0], 10);
  assert.ok(maior >= 20, `Node.js ${process.versions.node} é anterior ao mínimo exigido (20.x)`);
});

test('estrutura de diretórios da Fase 00 está completa', () => {
  const diretorios = [
    'src/main',
    'src/renderer',
    'src/core',
    'src/modules',
    'database',
    'assets',
    'config',
    'scripts',
    'tests',
    'docs',
  ];
  for (const diretorio of diretorios) {
    assert.ok(existsSync(join(raiz, diretorio)), `diretório ausente: ${diretorio}/`);
  }
});

test('configurações por ambiente são JSON válidos e coerentes', () => {
  const esperados = {
    'desenvolvimento.json': 'desenvolvimento',
    'teste.json': 'teste',
    'producao.json': 'producao',
  };
  for (const [arquivo, ambiente] of Object.entries(esperados)) {
    const config = JSON.parse(readFileSync(join(raiz, 'config', arquivo), 'utf-8'));
    assert.equal(config.ambiente, ambiente, `${arquivo} declara ambiente incorreto`);
    assert.equal(config.idioma, 'pt-BR', `${arquivo} deve declarar o idioma pt-BR`);
  }
});

test('package.json declara o projeto PULSO e os scripts básicos', () => {
  const pacote = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf-8'));
  assert.equal(pacote.name, 'pulso');
  assert.equal(pacote.private, true);
  assert.ok(pacote.scripts.test, 'script "test" ausente');
  assert.ok(pacote.scripts.start, 'script "start" ausente');
});
