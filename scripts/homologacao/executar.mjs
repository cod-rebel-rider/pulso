#!/usr/bin/env node
/**
 * PULSO — Executor da homologação: roda os grupos e gera relatorios/.
 * Uso: node scripts/homologacao/executar.mjs --grupo=tudo|fases|integracao|criticos
 */

import { RAIZ, GRUPOS, listarArquivos, executarArquivo } from './nucleo.mjs';
import { gerarRelatorio } from './montar-relatorio.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const grupo = String(args.grupo ?? 'tudo');
const dirs = grupo === 'tudo'
  ? [...GRUPOS.fases, ...GRUPOS.integracao, ...GRUPOS.criticos]
  : (GRUPOS[grupo] ?? [...GRUPOS.fases, ...GRUPOS.integracao, ...GRUPOS.criticos]);

const arquivos = listarArquivos(dirs);
if (arquivos.length === 0) {
  console.error('Nenhum arquivo de homologação encontrado.');
  process.exitCode = 1;
} else {
  console.log(`Homologação PULSO — grupo: ${grupo} — ${arquivos.length} arquivos`);
  const resultados = arquivos.map((a) => {
    process.stdout.write(`  • ${a.replace(`${RAIZ}/`, '')} ... `);
    const r = executarArquivo(a);
    console.log(`${r.ok} ok / ${r.falha} falha`);
    return r;
  });
  const rel = gerarRelatorio(resultados, grupo);
  console.log(`\nRelatório: relatorios/${rel.nomeArquivo}`);
  console.log(`Total: ${rel.okTotal} ok / ${rel.falhaTotal} falha — ${rel.veredito}`);
  if (rel.falhaTotal > 0) process.exitCode = 1;
}
