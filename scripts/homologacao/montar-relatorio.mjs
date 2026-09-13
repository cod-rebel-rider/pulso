#!/usr/bin/env node
/** PULSO — Homologação: montagem do Markdown (parte B). */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIR_RELATORIOS, ambienteInfo, proximoId, rotuloFase } from './relatorio.mjs';

export function gerarRelatorio(resultados, grupo) {
  const info = ambienteInfo();
  const id = proximoId();
  const agora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const data = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
  const hora = `${pad(agora.getHours())}-${pad(agora.getMinutes())}`;
  const nomeArquivo = `${id}_Pulso-${info.versaoPulso}_${info.so}_${data}_${hora}.md`;

  const total = resultados.reduce((a, r) => a + r.total, 0);
  const okTotal = resultados.reduce((a, r) => a + r.ok, 0);
  const falhaTotal = resultados.reduce((a, r) => a + r.falha, 0);
  const pct = (n) => (total === 0 ? '0.0' : ((n / total) * 100).toFixed(1));

  const porFase = new Map();
  for (const r of resultados) {
    const rotulo = rotuloFase(r.rel);
    if (!porFase.has(rotulo)) porFase.set(rotulo, { arquivos: [], ok: 0, falha: 0 });
    const e = porFase.get(rotulo);
    e.arquivos.push(r);
    e.ok += r.ok;
    e.falha += r.falha;
  }
  const criticos = resultados.filter((r) => r.rel.startsWith('tests/criticos/'));
  const critFalha = criticos.reduce((a, r) => a + r.falha, 0);
  const critTotal = criticos.reduce((a, r) => a + r.total, 0);
  const critOk = critTotal - critFalha;
  const problemasCriticos = criticos.filter((r) => r.falha > 0);
  const veredito = falhaTotal === 0 ? '🟢 APTO' : critFalha > 0 ? '🔴 NÃO APTO' : '🟡 APTO COM RESSALVAS';
  const resultadoGeral = falhaTotal === 0 ? '✅ APROVADO' : '❌ REPROVADO';

  const L = [];
  L.push(`# Relatório de Homologação — PULSO`);
  L.push(``);
  L.push(`## Introdução`);
  L.push(``);
  L.push(`| Campo | Valor |`);
  L.push(`| --- | --- |`);
  L.push(`| ID da execução | ${id} |`);
  L.push(`| Versão do Pulso | ${info.versaoPulso} |`);
  L.push(`| Branch | ${info.branch} |`);
  L.push(`| Commit analisado | ${info.commit} |`);
  L.push(`| Sistema operacional | ${info.so} |`);
  L.push(`| Versão do Node.js | ${info.node} |`);
  L.push(`| Versão do npm | ${info.npm} |`);
  L.push(`| Data e hora | ${data} ${hora.replace('-', ':')} |`);
  L.push(`| Ambiente | SQLite temporário isolado; banco real nunca tocado |`);
  L.push(`| Grupo executado | ${grupo} |`);
  L.push(`| Quantidade total de testes | ${total} |`);
  L.push(`| Resultado geral | ${resultadoGeral} (${okTotal}/${total} — ${pct(okTotal)}%) |`);
  L.push(``);
  L.push(`## Fases`);
  L.push(``);
  for (const [rotulo, e] of porFase) {
    const tot = e.ok + e.falha;
    L.push(`### ${rotulo} — ${e.falha === 0 ? '✅ APROVADO' : '❌ REPROVADO'}`);
    L.push(``);
    L.push(`- Testes executados: ${tot} · aprovados: ${e.ok} · reprovados: ${e.falha} · ignorados: 0`);
    for (const a of e.arquivos) {
      L.push(`- \`${a.rel}\`: ${a.ok} ok / ${a.falha} falha`);
      for (const f of a.falhasDetalhe) L.push(`  - falha: \`${f}\``);
    }
    L.push(`- Erros encontrados: ${e.falha}`);
    L.push(`- Observações: ${e.falha === 0 ? 'conforme o código atual.' : 'investigar antes de corrigir.'}`);
    L.push(``);
  }
  L.push(`## Fases Críticas`);
  L.push(``);
  L.push(`Testes críticos: ${critTotal} (${critOk} ok / ${critFalha} falha).`);
  L.push(``);
  if (problemasCriticos.length === 0) {
    L.push(`- Nenhum problema crítico detectado.`);
    L.push(`- Persistência fecha→reabre, integridade (FK/CASCADE) e saldo derivado: íntegros.`);
  } else {
    for (const p of problemasCriticos) {
      L.push(`### CRÍTICO — \`${p.rel}\``);
      L.push(`- O que foi testado: ${p.rel}`);
      L.push(`- Resultado esperado: todos aprovados`);
      L.push(`- Resultado obtido: ${p.ok} ok / ${p.falha} falha`);
      L.push(`- Impacto: risco à persistência, ao dinheiro ou à progressão`);
      L.push(`- Severidade: CRÍTICO`);
      L.push(`- Possível causa: ver saída TAP do arquivo`);
      L.push(`- Bloqueia a continuidade: SIM`);
    }
  }
  L.push(``);
  L.push(`## Sugestões`);
  L.push(``);
  L.push(`- Recompensas missão→XP/dinheiro (P-022/P-024) ausentes por decisão: comportamento real documentado.`);
  L.push(`- Fase 09 (Loja) pendente: compras devem consumir saldo via despesa.`);
  L.push(`- Dívidas: auditoria financeira (P-026), múltiplas carteiras (P-028), backup automático (P-017).`);
  L.push(`- Fumaça do Electron exige xvfb; fora da homologação headless.`);
  L.push(`- Fase 17: e2e dedicado (P-006) + cobertura formal.`);
  L.push(``);
  L.push(`## Conclusão`);
  L.push(``);
  L.push(`- Situação geral: ${resultadoGeral}`);
  L.push(`- Aprovados: ${pct(okTotal)}% (${okTotal}/${total}) · Reprovados: ${pct(falhaTotal)}%`);
  L.push(`- Problemas críticos: ${problemasCriticos.length} arquivo(s) (${critFalha} teste(s))`);
  L.push(`- Problemas não críticos: ${Math.max(0, falhaTotal - critFalha)} teste(s)`);
  L.push(`- Estáveis: ${[...porFase].filter(([, e]) => e.falha === 0).map(([r]) => r).join('; ') || 'nenhuma'}`);
  L.push(`- Correção necessária: ${[...porFase].filter(([, e]) => e.falha > 0).map(([r]) => r).join('; ') || 'nenhuma'}`);
  L.push(`- Classificação final: ${veredito}`);
  L.push(``);
  L.push(`> **O Pulso está em condições de avançar para a próxima etapa de desenvolvimento?**`);
  L.push(`>`);
  L.push(`> ${veredito}${falhaTotal === 0 ? ' — sem falhas; apto à Fase 09.' : ' — investigar falhas antes da Fase 09.'}`);
  L.push(``);

  mkdirSync(DIR_RELATORIOS, { recursive: true });
  writeFileSync(join(DIR_RELATORIOS, nomeArquivo), L.join('\n'), 'utf-8');
  return { nomeArquivo, total, okTotal, falhaTotal, veredito };
}
