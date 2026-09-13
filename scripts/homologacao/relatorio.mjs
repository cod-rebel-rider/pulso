#!/usr/bin/env node
/** PULSO — Homologação: relatório Markdown (parte A: contexto + ID). */

import { readdirSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { RAIZ } from './nucleo.mjs';

export const DIR_RELATORIOS = join(RAIZ, 'relatorios');

export const ROTULOS_FASE = [
  ['fase-01', 'Fase 01 — Fundação'],
  ['fase-02', 'Fase 02 — Banco de Dados'],
  ['fase-03', 'Fase 03 — Jogador'],
  ['fase-04', 'Fase 04 — Sistema de Status'],
  ['fase-05', 'Fase 05 — Missões'],
  ['fase-06', 'Fase 06 — Progressão'],
  ['fase-07', 'Fase 07 — Projetos'],
  ['fase-08', 'Fase 08 — Finanças'],
  ['fase-09', 'Fase 09 — Loja / Lista de Desejos (pendente)'],
];

function comando(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'indisponível';
  }
}

export function ambienteInfo() {
  let so = 'SO-desconhecido';
  try {
    const osRelease = readFileSync('/etc/os-release', 'utf-8');
    const campo = (chave) => {
      const linha = osRelease.split('\n').find((l) => l.startsWith(`${chave}=`));
      return linha ? linha.split('=').slice(1).join('=').replace(/^"|"$/g, '') : '';
    };
    so = `${campo('NAME')} ${campo('VERSION_ID')}`.trim() || so;
  } catch {
    so = `${process.platform}-${process.arch}`;
  }
  so = so.replace(/\s+/g, '-').replace(/[^A-Za-z0-9_.\-]/g, '');
  const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf-8'));
  return {
    so,
    versaoPulso: pacote.version ?? '0.0.0',
    node: process.versions.node,
    npm: comando('npm --version'),
    branch: comando('git rev-parse --abbrev-ref HEAD'),
    commit: comando('git rev-parse --short HEAD'),
  };
}

export function proximoId() {
  mkdirSync(DIR_RELATORIOS, { recursive: true });
  const existentes = existsSync(DIR_RELATORIOS) ? readdirSync(DIR_RELATORIOS) : [];
  let max = 0;
  for (const nome of existentes) {
    const m = nome.match(/^REL-(\d{4})_/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `REL-${String(max + 1).padStart(4, '0')}`;
}

export function rotuloFase(rel) {
  const base = basename(rel);
  for (const [slug, rotulo] of ROTULOS_FASE) {
    if (base.startsWith(slug)) return rotulo;
  }
  if (rel.includes('fluxos-completos')) return 'Integração — fluxo completo';
  if (rel.includes('criticos')) return 'Críticos';
  return 'Integração entre fases';
}
