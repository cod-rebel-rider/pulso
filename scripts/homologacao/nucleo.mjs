#!/usr/bin/env node
/**
 * PULSO — Executor da homologação (parte 1: descoberta + execução).
 * Complementado por ./relatorio.mjs (parte 2: relatório Markdown).
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const RAIZ = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

export const GRUPOS = {
  fases: ['tests/fases'],
  integracao: ['tests/integracao/homologacao'],
  criticos: ['tests/criticos'],
};

export function listarArquivos(dirs) {
  const arquivos = [];
  function visitar(dir) {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) visitar(caminho);
      else if (entrada.isFile() && entrada.name.endsWith('.test.mjs')) arquivos.push(caminho);
    }
  }
  for (const dir of dirs) {
    const absoluto = join(RAIZ, dir);
    if (existsSync(absoluto)) visitar(absoluto);
  }
  return arquivos.sort();
}

export function executarArquivo(arquivo) {
  const inicio = Date.now();
  const electron = join(RAIZ, 'node_modules', '.bin', 'electron');
  const r = spawnSync(electron, ['--test', arquivo], {
    cwd: RAIZ,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf-8',
  });
  const saida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  const ok = (saida.match(/^ok \d+/gm) || []).length;
  const falha = (saida.match(/^not ok \d+/gm) || []).length;
  const falhasDetalhe = [];
  for (const linha of saida.split('\n')) {
    if (linha.startsWith('not ok')) falhasDetalhe.push(linha.trim().slice(0, 220));
    if (falhasDetalhe.length >= 10) break;
  }
  return { arquivo, rel: arquivo.replace(`${RAIZ}/`, ''), ok, falha, total: ok + falha, codigo: r.status ?? 0, falhasDetalhe, duracaoMs: Date.now() - inicio };
}
