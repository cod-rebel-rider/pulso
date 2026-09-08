#!/usr/bin/env node
/**
 * PULSO — Verificação de ambiente (Fase 00 — Preparação)
 *
 * Informa as versões das ferramentas necessárias ao desenvolvimento e
 * valida a estrutura de diretórios criada nesta fase.
 *
 * Na Fase 01 (Fundação), o comando `npm start` passará a iniciar a
 * aplicação de verdade; este script permanecerá como ferramenta de
 * diagnóstico via `npm run verificar-ambiente`.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const DIRETORIOS_ESPERADOS = [
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

function executar(comando) {
  try {
    return execSync(comando, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function lerDistribuicaoLinux() {
  const caminho = '/etc/os-release';
  if (!existsSync(caminho)) return null;
  const linhas = readFileSync(caminho, 'utf-8').split('\n');
  const campo = (chave) => {
    const linha = linhas.find((l) => l.startsWith(`${chave}=`));
    return linha ? linha.split('=').slice(1).join('=').replace(/^"|"$/g, '') : null;
  };
  return { nome: campo('NAME'), versao: campo('VERSION_ID'), codinome: campo('VERSION_CODENAME') };
}

const separador = '─'.repeat(64);
console.log(separador);
console.log('PULSO — verificação do ambiente de desenvolvimento (Fase 00)');
console.log(separador);

const distribuicao = lerDistribuicaoLinux();
if (distribuicao && distribuicao.nome) {
  console.log(
    `Distribuição   : ${distribuicao.nome} ${distribuicao.versao ?? ''} (${distribuicao.codinome ?? '—'})`,
  );
} else {
  console.log('Distribuição   : não identificada (sistema não-Linux?)');
}
console.log(`Arquitetura    : ${process.arch}`);
console.log(`Node.js        : ${process.versions.node}`);

const npm = executar('npm --version');
console.log(`npm            : ${npm ?? 'ausente'}`);

const git = executar('git --version');
console.log(`Git            : ${git ?? 'ausente'}`);

const python = executar('python3 --version');
console.log(`Python         : ${python ?? 'ausente (opcional nesta fase)'}`);

const sqlite = executar('sqlite3 --version');
console.log(
  `SQLite (CLI)   : ${
    sqlite ? sqlite.split(' ')[0] : 'ausente (opcional — driver será definido na Fase 02)'
  }`,
);

const versaoElectron = (() => {
  try {
    const pacote = JSON.parse(readFileSync(join(raiz, 'node_modules', 'electron', 'package.json'), 'utf-8'));
    return pacote.version;
  } catch {
    return null;
  }
})();
console.log(`Electron       : ${versaoElectron ?? 'não instalado (npm install adiciona a devDependency)'}`);

console.log(separador);
console.log('Estrutura de diretórios da Fase 00:');

let estruturaOk = true;
for (const diretorio of DIRETORIOS_ESPERADOS) {
  const existe = existsSync(join(raiz, diretorio));
  if (!existe) estruturaOk = false;
  console.log(`  ${existe ? '✔' : '✖'} ${diretorio}/`);
}

console.log(separador);

if (!estruturaOk) {
  console.error('✖ Estrutura da Fase 00 incompleta. Consulte docs/arquitetura.md.');
  process.exitCode = 1;
} else {
  console.log('✔ Ambiente verificado. A aplicação gráfica será implementada na Fase 01 — Fundação.');
}
