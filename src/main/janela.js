/**
 * PULSO — Criação da janela principal (Fase 01 — Fundação)
 */

import { BrowserWindow } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import registro from './registro.js';

const pastaAtual = dirname(fileURLToPath(import.meta.url));
const caminhoRenderer = join(pastaAtual, '..', 'renderer', 'index.html');

/** Níveis de console do renderer considerados erro (formatos antigo e novo do evento). */
const NIVEIS_ERRO_CONSOLE = new Set([3, 'error']);

/**
 * Extrai dados do evento 'console-message' de forma tolerante às duas
 * assinaturas existentes entre versões do Electron:
 * (event, level, message, line, sourceId) e (event, details).
 * @param {unknown[]} argumentos Argumentos do evento
 */
export function extrairConsole(...argumentos) {
  const detalhes = argumentos[1];
  if (detalhes && typeof detalhes === 'object') {
    return {
      nivel: detalhes.level,
      mensagem: detalhes.message,
      origem: detalhes.sourceId,
      linha: detalhes.lineNumber,
    };
  }
  return { nivel: detalhes, mensagem: argumentos[2], origem: argumentos[4], linha: argumentos[3] };
}

/**
 * Cria a janela principal com configurações seguras.
 * @param {object} config Configuração do ambiente (config/*.json)
 * @param {{ exibir?: boolean }} [opcoes] exibir=false mantém a janela oculta (teste de fumaça)
 * @returns {BrowserWindow}
 */
export function criarJanela(config, { exibir = true } = {}) {
  const janela = new BrowserWindow({
    width: config.janela.largura,
    height: config.janela.altura,
    minWidth: config.janela.larguraMinima ?? 800,
    minHeight: config.janela.alturaMinima ?? 520,
    show: false, // exibida apenas quando pronta (evita flash branco)
    backgroundColor: '#0B0B0D', // cor de fundo da identidade visual
    title: 'PULSO',
    autoHideMenuBar: true, // oculta a barra de menus padrão
    webPreferences: {
      preload: join(pastaAtual, 'preload.cjs'),
      contextIsolation: true, // isolamento entre renderer e preload
      nodeIntegration: false, // renderer sem acesso a APIs de Node
      sandbox: true, // preload restrito
      webSecurity: true,
      spellcheck: false,
    },
  });

  if (exibir) {
    janela.once('ready-to-show', () => janela.show());
  }

  registrarDiagnosticos(janela);

  janela.loadFile(caminhoRenderer).catch((erro) => {
    registro.erro('Falha ao carregar a interface (renderer).', erro);
    throw erro;
  });

  return janela;
}

function registrarDiagnosticos(janela) {
  janela.webContents.on('did-fail-load', (_evento, codigo, descricao, url) => {
    registro.erro(`Falha ao carregar recurso da interface (${codigo}: ${descricao}) em ${url}.`);
  });

  janela.webContents.on('render-process-gone', (_evento, detalhes) => {
    registro.erro(`Processo de renderização encerrado de forma inesperada: ${JSON.stringify(detalhes)}`);
  });

  janela.webContents.on('console-message', (...argumentos) => {
    const { nivel, mensagem, origem, linha } = extrairConsole(...argumentos);
    if (NIVEIS_ERRO_CONSOLE.has(nivel)) {
      registro.erro(`Console do renderer: ${mensagem} (${origem ?? '?'}:${linha ?? '?'}).`);
    }
  });

  janela.on('unresponsive', () => registro.aviso('A janela parou de responder.'));
  janela.on('responsive', () => registro.info('A janela voltou a responder.'));
}
