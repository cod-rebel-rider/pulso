/**
 * PULSO — Processo principal (Fase 01 — Fundação)
 *
 * Responsabilidades:
 * - iniciar e encerrar a aplicação;
 * - criar a janela principal (via janela.js);
 * - expor a superfície IPC mínima (canais.cjs);
 * - carregar a configuração do ambiente atual (config/*.json);
 * - tratar erros de inicialização de forma identificável.
 *
 * Modo teste de fumaça (usado pelos testes automatizados):
 *   electron . --teste-fumaca
 * Inicia, valida a fundação, imprime `PULSO_FUMACA:{...}` e encerra sozinho.
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import registro from './registro.js';
import { determinarAmbiente, carregarConfiguracao } from './configuracao.js';
import { criarJanela, extrairConsole } from './janela.js';
import canais from './canais.cjs';

const MODO_TESTE_FUMACA = process.argv.includes('--teste-fumaca');
const ambiente = MODO_TESTE_FUMACA ? 'teste' : determinarAmbiente({ isPackaged: app.isPackaged });

let janelaPrincipal = null;
let configuracao = null;

// ── Teste de fumaça ─────────────────────────────────────────────────────
const resultadosFumaca = {
  aplicacaoIniciou: false,
  janelaCriada: false,
  rendererCarregado: false,
  rendererPronto: false,
  ipcAtivo: false,
  errosConsole: [],
  versoes: null,
};
let prazoFumaca = null;

function encerrarFumaca(ok, motivo) {
  if (prazoFumaca) clearTimeout(prazoFumaca);
  resultadosFumaca.versoes = {
    aplicacao: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  };
  const relatorio = { ok: !!ok, motivo: motivo ?? null, resultados: resultadosFumaca };
  console.log(`PULSO_FUMACA:${JSON.stringify(relatorio)}`);
  app.exit(ok ? 0 : 1);
}

function executarTesteFumaca(janela) {
  prazoFumaca = setTimeout(() => encerrarFumaca(false, 'tempo esgotado (20 s)'), 20_000);

  janela.webContents.on('console-message', (...argumentos) => {
    const { nivel, mensagem } = extrairConsole(...argumentos);
    if (nivel === 3 || nivel === 'error') resultadosFumaca.errosConsole.push(String(mensagem));
  });

  janela.webContents.on('did-fail-load', (_e, codigo, descricao) =>
    encerrarFumaca(false, `did-fail-load ${codigo}: ${descricao}`));

  janela.webContents.on('render-process-gone', (_e, detalhes) =>
    encerrarFumaca(false, `render-process-gone: ${detalhes?.reason}`));

  janela.webContents.on('did-finish-load', async () => {
    try {
      resultadosFumaca.rendererCarregado = true;

      // valida a ponte IPC real (renderer → preload → main)
      const info = await janela.webContents.executeJavaScript(
        'window.pulso ? window.pulso.infoSistema() : null',
        true,
      );
      resultadosFumaca.ipcAtivo = !!(info && info.nome === 'PULSO' && info.versao === app.getVersion());

      // aguarda o renderer concluir a inicialização (flag de prontidão)
      const inicio = Date.now();
      while (Date.now() - inicio < 5000) {
        const pronto = await janela.webContents.executeJavaScript(
          'window.__pulso_renderer_pronto === true',
          true,
        );
        if (pronto) {
          resultadosFumaca.rendererPronto = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      const ok =
        resultadosFumaca.aplicacaoIniciou &&
        resultadosFumaca.janelaCriada &&
        resultadosFumaca.rendererPronto &&
        resultadosFumaca.ipcAtivo &&
        resultadosFumaca.errosConsole.length === 0;
      encerrarFumaca(
        ok,
        ok
          ? null
          : `aplicacaoIniciou=${resultadosFumaca.aplicacaoIniciou}, janelaCriada=${resultadosFumaca.janelaCriada}, rendererPronto=${resultadosFumaca.rendererPronto}, ipcAtivo=${resultadosFumaca.ipcAtivo}, errosConsole=${resultadosFumaca.errosConsole.length}`,
      );
    } catch (erro) {
      encerrarFumaca(false, `falha na verificação do renderer: ${erro.message}`);
    }
  });
}

// ── IPC (superfície mínima) ─────────────────────────────────────────────
function registrarIpc() {
  ipcMain.handle(canais.INFO_SISTEMA, () => ({
    nome: 'PULSO',
    versao: app.getVersion(),
    ambiente,
    plataforma: process.platform,
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    dataHora: new Date().toISOString(),
  }));
}

// ── Erros globais ───────────────────────────────────────────────────────
function registrarTratadoresDeErro() {
  process.on('uncaughtException', (erro) => {
    registro.erro('Exceção não capturada no processo principal.', erro);
    if (MODO_TESTE_FUMACA) {
      encerrarFumaca(false, `uncaughtException: ${erro.message}`);
      return;
    }
    dialog.showErrorBox(
      'PULSO — erro interno',
      `Ocorreu um erro inesperado e a aplicação será encerrada.\n\n${erro.stack ?? erro.message}`,
    );
    app.exit(1);
  });

  process.on('unhandledRejection', (motivo) => {
    registro.erro('Promessa rejeitada sem tratamento no processo principal.', motivo);
    if (MODO_TESTE_FUMACA) encerrarFumaca(false, `unhandledRejection: ${motivo}`);
  });
}

// ── Ciclo de vida ───────────────────────────────────────────────────────
async function aoIniciar() {
  configuracao = carregarConfiguracao(ambiente);
  registrarIpc();
  janelaPrincipal = criarJanela(configuracao, { exibir: !MODO_TESTE_FUMACA });

  if (MODO_TESTE_FUMACA) {
    resultadosFumaca.aplicacaoIniciou = true;
    resultadosFumaca.janelaCriada = true;
    executarTesteFumaca(janelaPrincipal);
  } else {
    registro.info(`PULSO iniciado (ambiente: ${ambiente}, versão ${app.getVersion()}).`);
  }
}

const lockObtido = app.requestSingleInstanceLock();

if (!lockObtido) {
  if (MODO_TESTE_FUMACA) {
    encerrarFumaca(false, 'outra instância do PULSO já está ativa');
  } else {
    registro.aviso('Outra instância do PULSO já está em execução. Encerrando esta instância.');
    app.exit(0);
  }
} else {
  registrarTratadoresDeErro();

  app.on('second-instance', () => {
    if (janelaPrincipal) {
      if (janelaPrincipal.isMinimized()) janelaPrincipal.restore();
      janelaPrincipal.focus();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (!MODO_TESTE_FUMACA && BrowserWindow.getAllWindows().length === 0 && configuracao) {
      janelaPrincipal = criarJanela(configuracao);
    }
  });

  app.whenReady().then(aoIniciar).catch((erro) => {
    registro.erro('Falha ao inicializar o PULSO.', erro);
    if (MODO_TESTE_FUMACA) {
      encerrarFumaca(false, `falha na inicialização: ${erro.message}`);
      return;
    }
    dialog.showErrorBox('PULSO — erro de inicialização', `A aplicação não pôde ser iniciada.\n\n${erro.message}`);
    app.exit(1);
  });
}
