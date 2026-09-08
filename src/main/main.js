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
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import registro from './registro.js';
import { determinarAmbiente, carregarConfiguracao } from './configuracao.js';
import { criarJanela, extrairConsole } from './janela.js';
import { inicializarBanco } from '../core/database/inicializar.js';
import { RepositorioJogador } from '../core/database/repositorios/jogador.js';
import { ServicoJogador } from '../core/aplicacao/servico-jogador.js';
import { ErroValidacao, ErroConflito } from '../core/erros.js';
import canais from './canais.cjs';

const MODO_TESTE_FUMACA = process.argv.includes('--teste-fumaca');
const ambiente = MODO_TESTE_FUMACA ? 'teste' : determinarAmbiente({ isPackaged: app.isPackaged });

// Diretório de dados do usuário: resolvido dinamicamente pelo sistema
// operacional (appData/pulso), fora do repositório. No teste de fumaça,
// um diretório temporário isolado é usado para não tocar no banco real.
// PULSO_DIRETORIO_DADOS permite testes manuais com banco próprio.
if (MODO_TESTE_FUMACA) {
  app.setPath('userData', mkdtempSync(join(tmpdir(), 'pulso-fumaca-')));
} else if (process.env.PULSO_DIRETORIO_DADOS) {
  app.setPath('userData', process.env.PULSO_DIRETORIO_DADOS);
} else {
  app.setPath('userData', join(app.getPath('appData'), 'pulso'));
}

let janelaPrincipal = null;
let configuracao = null;
let estadoBanco = null;
let servicoJogador = null;

// ── Teste de fumaça ─────────────────────────────────────────────────────
const resultadosFumaca = {
  aplicacaoIniciou: false,
  janelaCriada: false,
  rendererCarregado: false,
  rendererPronto: false,
  ipcAtivo: false,
  banco: null,
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

      // valida o fluxo IPC do jogador (estado → criar → re-consultar), com o
      // banco temporário do teste — exercita a cadeia renderer → preload → main
      // → serviço → repositório → SQLite
      const jogadorInicial = await janela.webContents.executeJavaScript(
        'window.pulso?.jogador ? window.pulso.jogador.estado() : Promise.resolve(null)',
        true,
      );
      const criacao = await janela.webContents.executeJavaScript(
        'window.pulso?.jogador ? window.pulso.jogador.criar({ nome: "Operador Teste", codinome: "teste" }) : Promise.resolve(null)',
        true,
      );
      const jogadorFinal = await janela.webContents.executeJavaScript(
        'window.pulso?.jogador ? window.pulso.jogador.estado() : Promise.resolve(null)',
        true,
      );
      resultadosFumaca.jogador = {
        preparado: !!jogadorInicial && jogadorInicial.existe === false && jogadorInicial.jogador === null,
        criado: !!criacao && criacao.ok && criacao.jogador?.nome === 'Operador Teste',
        carregado: !!jogadorFinal && jogadorFinal.existe === true && jogadorFinal.jogador?.codinome === 'teste',
      };

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

      const bancoOk =
        resultadosFumaca.banco?.inicializado === true && resultadosFumaca.banco.versaoSchema >= 1;
      const jogadorOk =
        resultadosFumaca.jogador?.preparado === true &&
        resultadosFumaca.jogador?.criado === true &&
        resultadosFumaca.jogador?.carregado === true;
      const ok =
        resultadosFumaca.aplicacaoIniciou &&
        resultadosFumaca.janelaCriada &&
        bancoOk &&
        jogadorOk &&
        resultadosFumaca.rendererPronto &&
        resultadosFumaca.ipcAtivo &&
        resultadosFumaca.errosConsole.length === 0;
      encerrarFumaca(
        ok,
        ok
          ? null
          : `aplicacaoIniciou=${resultadosFumaca.aplicacaoIniciou}, janelaCriada=${resultadosFumaca.janelaCriada}, bancoOk=${bancoOk}, jogadorOk=${JSON.stringify(resultadosFumaca.jogador)}, rendererPronto=${resultadosFumaca.rendererPronto}, ipcAtivo=${resultadosFumaca.ipcAtivo}, errosConsole=${resultadosFumaca.errosConsole.length}`,
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

  // Superfície IPC específica e controlada — jamais um "executeSQL" genérico.
  ipcMain.handle(canais.BANCO_INFO, () => ({
    nome: 'PULSO',
    estado: 'online',
    versaoSchema: estadoBanco ? estadoBanco.versaoSchema : null,
  }));

  ipcMain.handle(canais.JOGADOR_ESTADO, () => {
    try {
      const jogador = servicoJogador.obter();
      if (jogador) {
        registro.info(
          `Jogador carregado: ${jogador.nome}${jogador.codinome ? ` (${jogador.codinome})` : ''}`,
        );
      } else {
        registro.info('Nenhum jogador configurado — aguardando configuração inicial.');
      }
      return { existe: !!jogador, jogador };
    } catch (erro) {
      registro.erro('Falha ao consultar o jogador.', erro);
      return { existe: false, jogador: null, falha: true };
    }
  });

  ipcMain.handle(canais.JOGADOR_CRIAR, (_evento, dados) =>
    traduzirResultadoOperacao(() => {
      const jogador = servicoJogador.criar(dados ?? {});
      registro.info(`Jogador criado: ${jogador.nome}`);
      return { ok: true, jogador };
    }));

  ipcMain.handle(canais.JOGADOR_ATUALIZAR, (_evento, dados) =>
    traduzirResultadoOperacao(() => {
      const jogador = servicoJogador.atualizar(Number(dados?.id ?? 0), {
        nome: dados?.nome,
        codinome: dados?.codinome,
      });
      registro.info(`Identidade do jogador atualizada: ${jogador.nome}`);
      return { ok: true, jogador };
    }));
}

/**
 * Executa a operação e traduz erros do núcleo para respostas seguras da
 * IPC: mensagens de validação/conflito são seguras para a interface;
 * falhas internas são registradas e mascaradas.
 */
function traduzirResultadoOperacao(executar) {
  try {
    return executar();
  } catch (erro) {
    if (erro instanceof ErroValidacao) {
      return { ok: false, erro: 'validacao', campo: erro.campo, mensagem: erro.message };
    }
    if (erro instanceof ErroConflito) {
      return { ok: false, erro: 'conflito', mensagem: erro.message };
    }
    registro.erro('Falha interna em operação do jogador.', erro);
    return { ok: false, erro: 'interno', mensagem: 'Falha interna ao processar a operação.' };
  }
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

  // Banco antes da janela: sem memória confiável, a aplicação não inicia.
  try {
    estadoBanco = inicializarBanco({ diretorioDados: app.getPath('userData') });
    registro.info(
      `Banco de dados ${estadoBanco.criado ? 'criado' : 'reutilizado'} (schema v${estadoBanco.versaoSchema}, ${estadoBanco.migracoesAplicadas.length} migração(ões) nesta execução).`,
    );
  } catch (erro) {
    registro.erro('Falha ao inicializar o banco de dados.', erro);
    if (MODO_TESTE_FUMACA) {
      encerrarFumaca(false, `banco de dados: ${erro.message}`);
      return;
    }
    dialog.showErrorBox(
      'PULSO — banco de dados',
      `A aplicação não pôde iniciar porque a memória local (SQLite) falhou.\n\n${erro.message}`,
    );
    app.exit(1);
    return;
  }

  // Camada de aplicação: serviço do jogador sobre o repositório do banco.
  servicoJogador = new ServicoJogador({ repositorio: new RepositorioJogador(estadoBanco.banco) });

  registrarIpc();
  janelaPrincipal = criarJanela(configuracao, { exibir: !MODO_TESTE_FUMACA });

  if (MODO_TESTE_FUMACA) {
    resultadosFumaca.aplicacaoIniciou = true;
    resultadosFumaca.janelaCriada = true;
    resultadosFumaca.banco = {
      inicializado: true,
      criado: estadoBanco.criado,
      versaoSchema: estadoBanco.versaoSchema,
    };
    resultadosFumaca.jogador = null;
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

  app.on('will-quit', () => {
    if (!estadoBanco) return;
    try {
      estadoBanco.fechar();
      registro.info('Banco de dados fechado com segurança.');
    } catch (erro) {
      registro.aviso('Falha ao fechar o banco de dados.', erro);
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
