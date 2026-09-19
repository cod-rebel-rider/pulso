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
import { RepositorioStatus } from '../core/database/repositorios/status.js';
import { RepositorioMissao } from '../core/database/repositorios/missao.js';
import { RepositorioProjeto } from '../core/database/repositorios/projeto.js';
import { RepositorioProgressao } from '../core/database/repositorios/progressao.js';
import { RepositorioAtributos } from '../core/database/repositorios/atributos.js';
import { RepositorioCarteira } from '../core/database/repositorios/carteira.js';
import { RepositorioTransacao } from '../core/database/repositorios/transacao.js';
import { RepositorioOrcamento } from '../core/database/repositorios/orcamento.js';
import { RepositorioDesejo } from '../core/database/repositorios/desejo.js';
import { RepositorioServico } from '../core/database/repositorios/servico.js';
import { RepositorioConta } from '../core/database/repositorios/conta.js';
import { RepositorioRecorrencia } from '../core/database/repositorios/recorrencia.js';
import { ServicoJogador } from '../core/aplicacao/servico-jogador.js';
import { ServicoStatus } from '../core/aplicacao/servico-status.js';
import { ServicoMissao } from '../core/aplicacao/servico-missao.js';
import { ServicoProjeto } from '../core/aplicacao/servico-projeto.js';
import { ServicoProgressao } from '../core/aplicacao/servico-progressao.js';
import { ServicoFinanca } from '../core/aplicacao/servico-financa.js';
import { ServicoLoja } from '../core/aplicacao/servico-loja.js';
import { ServicoServicos } from '../core/aplicacao/servico-servicos.js';
import { ServicoContas } from '../core/aplicacao/servico-contas.js';
import { ServicoRecorrencias } from '../core/aplicacao/servico-recorrencias.js';
import { ServicoGeracaoOcorrencias } from '../core/aplicacao/servico-geracao-ocorrencias.js';
import { ServicoPagamentos } from '../core/aplicacao/servico-pagamentos.js';
import {
  CATEGORIAS_DESEJO,
  PRIORIDADES_DESEJO_ORDEM,
  PRIORIDADES_DESEJO_ROTULOS,
  ESTADOS_DESEJO_ORDEM,
  ESTADOS_DESEJO_ROTULOS,
} from '../core/dominio/loja.js';
import {
  CATEGORIAS_SERVICO,
  ESTADOS_SERVICO_ORDEM,
  ESTADOS_SERVICO_ROTULOS,
} from '../core/dominio/servico.js';
import {
  ESTADOS_CONTA_ORDEM,
  ESTADOS_CONTA_ROTULOS,
  FORMATO_REFERENCIA,
  SITUACOES_CONTA_ORDEM,
  SITUACOES_CONTA_ROTULOS,
} from '../core/dominio/conta.js';
import {
  ESTADOS_RECORRENCIA_ORDEM,
  ESTADOS_RECORRENCIA_ROTULOS,
  FREQUENCIAS_RECORRENCIA,
} from '../core/dominio/recorrencia.js';

const CATEGORIAS_DESEJO_LOJA = CATEGORIAS_DESEJO;
const PRIORIDADES_DESEJO_LOJA = PRIORIDADES_DESEJO_ORDEM;
const ROTULOS_PRIORIDADES_LOJA = PRIORIDADES_DESEJO_ROTULOS;
const ESTADOS_DESEJO_LOJA = ESTADOS_DESEJO_ORDEM;
const ROTULOS_ESTADOS_LOJA = ESTADOS_DESEJO_ROTULOS;
import { ErroValidacao, ErroConflito, ErroTransicao } from '../core/erros.js';
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
let servicoStatus = null;
let servicoMissao = null;
let servicoProjeto = null;
let servicoProgressao = null;
let servicoFinanca = null;
let servicoLoja = null;
let servicoServicos = null;
let servicoContas = null;
let servicoRecorrencias = null;
let servicoGeracaoOcorrencias = null;
let servicoPagamentos = null;

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
function configLoja() {
  return Object.freeze({
    categorias: CATEGORIAS_DESEJO_LOJA,
    prioridades: PRIORIDADES_DESEJO_LOJA,
    rotulosPrioridades: ROTULOS_PRIORIDADES_LOJA,
    estados: ESTADOS_DESEJO_LOJA,
    rotulosEstados: ROTULOS_ESTADOS_LOJA,
  });
}

/** Configuração somente leitura dos serviços para a interface (Fase 10.1). */
function configServico() {
  return Object.freeze({
    categorias: CATEGORIAS_SERVICO,
    estados: ESTADOS_SERVICO_ORDEM,
    rotulosEstados: ESTADOS_SERVICO_ROTULOS,
  });
}

/** Configuração somente leitura das contas/despesas para a interface (Fase 10.2). */
function configConta() {
  return Object.freeze({
    estados: ESTADOS_CONTA_ORDEM,
    rotulosEstados: ESTADOS_CONTA_ROTULOS,
    situacoes: SITUACOES_CONTA_ORDEM,
    rotulosSituacoes: SITUACOES_CONTA_ROTULOS,
    formatoReferencia: FORMATO_REFERENCIA,
  });
}

/** Configuração somente leitura das recorrências para a interface (Fase 10.3). */
function configRecorrencia() {
  return Object.freeze({
    frequencias: FREQUENCIAS_RECORRENCIA.map((f) => Object.freeze({ valor: f.valor, rotulo: f.rotulo })),
    estados: ESTADOS_RECORRENCIA_ORDEM,
    rotulosEstados: ESTADOS_RECORRENCIA_ROTULOS,
  });
}

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

  ipcMain.handle(canais.STATUS_OBTER, (_evento, { jogadorId } = {}) =>
    traduzirResultadoOperacao(() => {
      const status = servicoStatus.obter(Number(jogadorId ?? 0));
      return { ok: true, status };
    }));

  ipcMain.handle(canais.STATUS_ALTERAR, (_evento, { jogadorId, status: nomeStatus, delta } = {}) =>
    traduzirResultadoOperacao(() => {
      const status = servicoStatus.alterar(Number(jogadorId ?? 0), nomeStatus, Number(delta));
      registro.info(
        `Status alterado: ${nomeStatus} ${delta > 0 ? '+' : ''}${delta} → ${status[nomeStatus]}`,
      );
      return { ok: true, status };
    }));

  // ── Missões ─────────────────────────────────────────────────────────
  ipcMain.handle(canais.MISSAO_CRIAR, (_evento, dados) =>
    traduzirResultadoOperacao(() => {
      const jogador = servicoJogador.obter();
      const missao = servicoMissao.criar(jogador.id, dados ?? {});
      registro.info(`Missão criada: ${missao.titulo} (${missao.estado})`);
      return { ok: true, missao };
    }));

  ipcMain.handle(canais.MISSAO_LISTAR, () =>
    traduzirResultadoOperacao(() => {
      const jogador = servicoJogador.obter();
      const missoes = servicoMissao.listar(jogador.id);
      return { ok: true, missoes };
    }));

  ipcMain.handle(canais.MISSAO_OBTER, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => {
      const missao = servicoMissao.obter(Number(id ?? 0));
      return { ok: true, missao };
    }));

  ipcMain.handle(canais.MISSAO_ATUALIZAR, (_evento, dados) =>
    traduzirResultadoOperacao(() => {
      const missao = servicoMissao.atualizar(Number(dados?.id ?? 0), {
        titulo: dados?.titulo,
        descricao: dados?.descricao,
        prioridade: dados?.prioridade,
        prazo: dados?.prazo,
      });
      registro.info(`Missão atualizada: ${missao.titulo}`);
      return { ok: true, missao };
    }));

  ipcMain.handle(canais.MISSAO_INICIAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => {
      const missao = servicoMissao.iniciar(Number(id ?? 0));
      registro.info(`Missão iniciada: ${missao.titulo}`);
      return { ok: true, missao };
    }));

  ipcMain.handle(canais.MISSAO_CONCLUIR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => {
      const missao = servicoMissao.concluir(Number(id ?? 0));
      registro.info(`Missão concluída: ${missao.titulo}`);
      return { ok: true, missao };
    }));

  ipcMain.handle(canais.MISSAO_CANCELAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => {
      const missao = servicoMissao.cancelar(Number(id ?? 0));
      registro.info(`Missão cancelada: ${missao.titulo}`);
      return { ok: true, missao };
    }));

  ipcMain.handle(canais.MISSAO_EXCLUIR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => {
      servicoMissao.excluir(Number(id ?? 0));
      registro.info(`Missão excluída: id=${id}`);
      return { ok: true };
    }));

  // ── Progressão (Fase 06) ────────────────────────────────────────────
  ipcMain.handle(canais.PROGRESSAO_OBTER, (_evento, { jogadorId } = {}) =>
    traduzirResultadoOperacao(() => {
      const progressao = servicoProgressao.obter(Number(jogadorId ?? 0));
      return { ok: true, progressao };
    }));

  ipcMain.handle(canais.PROGRESSAO_ADICIONAR_XP, (_evento, { jogadorId, quantidade } = {}) =>
    traduzirResultadoOperacao(() => {
      const progressao = servicoProgressao.adicionarXp(Number(jogadorId ?? 0), Number(quantidade));
      if (progressao.subiuNivel) {
        registro.info(`Level up: nível ${progressao.nivel} (+${progressao.niveisGanhos} ponto(s)).`);
      }
      return { ok: true, progressao };
    }));

  ipcMain.handle(canais.PROGRESSAO_AUMENTAR_ATRIBUTO, (_evento, { jogadorId, atributo, quantidade } = {}) =>
    traduzirResultadoOperacao(() => {
      const progressao = servicoProgressao.aumentarAtributo(
        Number(jogadorId ?? 0),
        atributo,
        Number(quantidade ?? 1),
      );
      registro.info(`Atributo aumentado: ${atributo} +${quantidade ?? 1}.`);
      return { ok: true, progressao };
    }));

  // ── Projetos (Fase 07) ─────────────────────────────────────────────
  ipcMain.handle(canais.PROJETO_CRIAR, (_evento, { jogadorId, ...dados } = {}) =>
    traduzirResultadoOperacao(() => {
      const projeto = servicoProjeto.criar(Number(jogadorId ?? 0), dados ?? {});
      registro.info(`Projeto criado: "${projeto.titulo}" (id=${projeto.id}).`);
      return { ok: true, projeto };
    }));

  ipcMain.handle(canais.PROJETO_LISTAR, (_evento, { jogadorId } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      projetos: servicoProjeto.listar(Number(jogadorId ?? 0)),
    })));

  ipcMain.handle(canais.PROJETO_OBTER, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      projeto: servicoProjeto.obter(Number(id ?? 0)),
    })));

  ipcMain.handle(canais.PROJETO_ATUALIZAR, (_evento, { id, ...dados } = {}) =>
    traduzirResultadoOperacao(() => {
      const projeto = servicoProjeto.atualizar(Number(id ?? 0), dados ?? {});
      registro.info(`Projeto atualizado: id=${projeto.id}.`);
      return { ok: true, projeto };
    }));

  ipcMain.handle(canais.PROJETO_INICIAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      projeto: servicoProjeto.iniciar(Number(id ?? 0)),
    })));

  ipcMain.handle(canais.PROJETO_CONCLUIR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      projeto: servicoProjeto.concluir(Number(id ?? 0)),
    })));

  ipcMain.handle(canais.PROJETO_CANCELAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      projeto: servicoProjeto.cancelar(Number(id ?? 0)),
    })));

  ipcMain.handle(canais.PROJETO_ARQUIVAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      projeto: servicoProjeto.arquivar(Number(id ?? 0)),
    })));

  ipcMain.handle(canais.PROJETO_ASSOCIAR_MISSAO, (_evento, { projetoId, missaoId } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      projeto: servicoProjeto.associarMissao(Number(projetoId ?? 0), Number(missaoId ?? 0)),
    })));

  ipcMain.handle(canais.PROJETO_REMOVER_MISSAO, (_evento, { projetoId, missaoId } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      projeto: servicoProjeto.removerMissao(Number(projetoId ?? 0), Number(missaoId ?? 0)),
    })));

  // ── Finanças (Fase 08) ────────────────────────────────────────────────
  ipcMain.handle(canais.FINANCA_CARTEIRA, (_evento, { jogadorId } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      carteira: servicoFinanca.obterCarteira(Number(jogadorId ?? 0)),
    })));

  ipcMain.handle(canais.FINANCA_SALDO, (_evento, { jogadorId, inicio = null, fim = null } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      saldo: servicoFinanca.obterSaldo(Number(jogadorId ?? 0), { inicio, fim }),
    })));

  ipcMain.handle(canais.FINANCA_RESUMO, (_evento, { jogadorId, inicio = null, fim = null } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      ...servicoFinanca.obterResumo(Number(jogadorId ?? 0), { inicio, fim }),
    })));

  ipcMain.handle(canais.FINANCA_LISTAR_TRANSACOES, (_evento, { jogadorId, tipo = null, categoria = null, inicio = null, fim = null } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      transacoes: servicoFinanca.listarTransacoes(Number(jogadorId ?? 0), { tipo, categoria, inicio, fim }),
    })));

  ipcMain.handle(canais.FINANCA_CRIAR_TRANSACAO, (_evento, { jogadorId, ...dados } = {}) =>
    traduzirResultadoOperacao(() => {
      const transacao = servicoFinanca.criarTransacao(Number(jogadorId ?? 0), dados ?? {});
      registro.info(
        `Transação criada: ${transacao.tipo} R$ ${(transacao.valorCentavos / 100).toFixed(2)} (${transacao.categoria}).`,
      );
      return { ok: true, transacao };
    }));

  ipcMain.handle(canais.FINANCA_ATUALIZAR_TRANSACAO, (_evento, { id, ...dados } = {}) =>
    traduzirResultadoOperacao(() => {
      const transacao = servicoFinanca.atualizarTransacao(Number(id ?? 0), dados ?? {});
      registro.info(`Transação atualizada: id=${transacao.id}.`);
      return { ok: true, transacao };
    }));

  ipcMain.handle(canais.FINANCA_EXCLUIR_TRANSACAO, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => {
      servicoFinanca.excluirTransacao(Number(id ?? 0));
      registro.info(`Transação excluída: id=${id}.`);
      return { ok: true };
    }));

  ipcMain.handle(canais.FINANCA_LISTAR_ORCAMENTOS, (_evento, { jogadorId } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      orcamentos: servicoFinanca.listarOrcamentos(Number(jogadorId ?? 0)),
    })));

  ipcMain.handle(canais.FINANCA_CRIAR_ORCAMENTO, (_evento, { jogadorId, ...dados } = {}) =>
    traduzirResultadoOperacao(() => {
      const orcamento = servicoFinanca.criarOrcamento(Number(jogadorId ?? 0), dados ?? {});
      registro.info(
        `Orçamento criado: ${orcamento.categoria} R$ ${(orcamento.valorCentavos / 100).toFixed(2)} (${orcamento.inicio} → ${orcamento.fim}).`,
      );
      return { ok: true, orcamento };
    }));

  ipcMain.handle(canais.FINANCA_ATUALIZAR_ORCAMENTO, (_evento, { id, ...dados } = {}) =>
    traduzirResultadoOperacao(() => {
      const orcamento = servicoFinanca.atualizarOrcamento(Number(id ?? 0), dados ?? {});
      registro.info(`Orçamento atualizado: id=${orcamento.id}.`);
      return { ok: true, orcamento };
    }));

  ipcMain.handle(canais.FINANCA_EXCLUIR_ORCAMENTO, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => {
      servicoFinanca.excluirOrcamento(Number(id ?? 0));
      registro.info(`Orçamento excluído: id=${id}.`);
      return { ok: true };
    }));

  ipcMain.handle(canais.FINANCA_SITUACAO_ORCAMENTO, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => {
      const situacao = servicoFinanca.situacaoOrcamento(Number(id ?? 0));
      return { ok: true, orcamento: situacao.orcamento, situacao: situacao.situacao };
    }));

  // ── Loja / Lista de Desejos (Fase 09) ──────────────────────────────────
  ipcMain.handle(canais.LOJA_CONFIG, () =>
    traduzirResultadoOperacao(() => ({ ok: true, config: configLoja() })));
  ipcMain.handle(canais.LOJA_LISTAR, (_evento, { jogadorId, estado = null, categoria = null, prioridade = null } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      desejos: servicoLoja.listar(Number(jogadorId ?? 0), { estado, categoria, prioridade }),
    })));
  ipcMain.handle(canais.LOJA_OBTER, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, desejo: servicoLoja.obter(Number(id ?? 0)) })));
  ipcMain.handle(canais.LOJA_CRIAR, (_evento, dados = {}) =>
    traduzirResultadoOperacao(() => {
      const desejo = servicoLoja.criar(Number(dados.jogadorId ?? 0), dados);
      return { ok: true, desejo };
    }));
  ipcMain.handle(canais.LOJA_ATUALIZAR, (_evento, dados = {}) =>
    traduzirResultadoOperacao(() => {
      const desejo = servicoLoja.atualizar(Number(dados.id ?? 0), dados);
      return { ok: true, desejo };
    }));
  ipcMain.handle(canais.LOJA_ANALISAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, desejo: servicoLoja.analisar(Number(id ?? 0)) })));
  ipcMain.handle(canais.LOJA_PLANEJAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, desejo: servicoLoja.planejar(Number(id ?? 0)) })));
  ipcMain.handle(canais.LOJA_COMPRAR, (_evento, { id, precoFinal, valorPagoCentavos, data, observacao } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      desejo: servicoLoja.comprar(Number(id ?? 0), {
        precoFinal: precoFinal ?? valorPagoCentavos,
        data,
        observacao,
      }),
    })));
  ipcMain.handle(canais.LOJA_CANCELAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, desejo: servicoLoja.cancelar(Number(id ?? 0)) })));
  ipcMain.handle(canais.LOJA_HISTORICO, (_evento, { jogadorId } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      compras: servicoLoja.listarComprados(Number(jogadorId ?? 0)),
    })));
  ipcMain.handle(canais.LOJA_RESUMO, (_evento, { jogadorId } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      resumo: servicoLoja.resumo(Number(jogadorId ?? 0)),
    })));

  // ── Serviços (Fase 10.1) — sem integração financeira ──────────────────
  ipcMain.handle(canais.SERVICO_CONFIG, () =>
    traduzirResultadoOperacao(() => ({ ok: true, config: configServico() })));
  ipcMain.handle(canais.SERVICO_LISTAR, (_evento, { jogadorId, estado = null, categoria = null } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      servicos: servicoServicos.listar(Number(jogadorId ?? 0), { estado, categoria }),
    })));
  ipcMain.handle(canais.SERVICO_OBTER, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, servico: servicoServicos.obter(Number(id ?? 0)) })));
  ipcMain.handle(canais.SERVICO_CRIAR, (_evento, dados = {}) =>
    traduzirResultadoOperacao(() => {
      const servico = servicoServicos.criar(Number(dados.jogadorId ?? 0), dados);
      return { ok: true, servico };
    }));
  ipcMain.handle(canais.SERVICO_ATUALIZAR, (_evento, dados = {}) =>
    traduzirResultadoOperacao(() => {
      const servico = servicoServicos.atualizar(Number(dados.id ?? 0), dados);
      return { ok: true, servico };
    }));
  ipcMain.handle(canais.SERVICO_ATIVAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, servico: servicoServicos.ativar(Number(id ?? 0)) })));
  ipcMain.handle(canais.SERVICO_DESATIVAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, servico: servicoServicos.desativar(Number(id ?? 0)) })));
  ipcMain.handle(canais.SERVICO_ARQUIVAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, servico: servicoServicos.arquivar(Number(id ?? 0)) })));

  // ── Contas / Despesas (Fase 10.2) — sem integração financeira ─────────
  // Criar/editar/cancelar uma conta NÃO cria transação e NÃO altera saldo.
  ipcMain.handle(canais.CONTA_CONFIG, () =>
    traduzirResultadoOperacao(() => ({ ok: true, config: configConta() })));
  ipcMain.handle(canais.CONTA_LISTAR, (_evento, { jogadorId, servicoId = null, situacao = null } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      contas: servicoContas.listar(Number(jogadorId ?? 0), { servicoId, situacao }),
    })));
  ipcMain.handle(canais.CONTA_OBTER, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, conta: servicoContas.obter(Number(id ?? 0)) })));
  ipcMain.handle(canais.CONTA_CRIAR, (_evento, dados = {}) =>
    traduzirResultadoOperacao(() => {
      const conta = servicoContas.criar(Number(dados.jogadorId ?? 0), dados);
      return { ok: true, conta };
    }));
  ipcMain.handle(canais.CONTA_ATUALIZAR, (_evento, dados = {}) =>
    traduzirResultadoOperacao(() => {
      const conta = servicoContas.atualizar(Number(dados.id ?? 0), dados);
      return { ok: true, conta };
    }));
  ipcMain.handle(canais.CONTA_CANCELAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, conta: servicoContas.cancelar(Number(id ?? 0)) })));

  // Pagamento de conta (Fase 10.5) — transforma obrigação em DESPESA financeira.
  // Cria transação DESPESA + marca conta como PAGA + atualiza carteira, tudo em
  // uma transação SQLite atômica. Valor pago pode diferir do esperado.
  ipcMain.handle(canais.CONTA_PAGAR, (_evento, { id, jogadorId, valorPagoCentavos, paidAt, paymentDescription } = {}) =>
    traduzirResultadoOperacao(() => {
      const contaId = Number(id ?? 0);
      const dados = {
        valorPagoCentavos,
        paidAt,
        paymentDescription: paymentDescription ?? null,
      };
      const resultado = servicoPagamentos.registrarPagamento(Number(jogadorId ?? 0), contaId, dados);
      return {
        ok: true,
        conta: resultado.conta,
        transacao: resultado.transacao,
        resumo: resultado.resumo,
      };
    }));

  // Consulta pagamento de conta (Fase 10.5) — enriquecimento do objeto conta.
  ipcMain.handle(canais.CONTA_OBTER_PAGAMENTO, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, conta: servicoPagamentos.obterPagamento(Number(id ?? 0)) })));

  // ── Recorrências (Fase 10.3) — sem integração financeira ───────────────
  // Criar/editar/ativar/desativar/arquivar uma recorrência NÃO gera conta,
  // NÃO cria transação e NÃO altera saldo (geração de contas é a Fase 10.4).
  ipcMain.handle(canais.RECURRENCIA_CONFIG, () =>
    traduzirResultadoOperacao(() => ({ ok: true, config: configRecorrencia() })));
  ipcMain.handle(canais.RECURRENCIA_LISTAR, (_evento, { jogadorId, servicoId = null, estado = null } = {}) =>
    traduzirResultadoOperacao(() => ({
      ok: true,
      recorrencias: servicoRecorrencias.listar(Number(jogadorId ?? 0), { servicoId, estado }),
    })));
  ipcMain.handle(canais.RECURRENCIA_OBTER, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, recorrencia: servicoRecorrencias.obter(Number(id ?? 0)) })));
  ipcMain.handle(canais.RECURRENCIA_CRIAR, (_evento, dados = {}) =>
    traduzirResultadoOperacao(() => {
      const recorrencia = servicoRecorrencias.criar(Number(dados.jogadorId ?? 0), dados);
      return { ok: true, recorrencia };
    }));
  ipcMain.handle(canais.RECURRENCIA_ATUALIZAR, (_evento, dados = {}) =>
    traduzirResultadoOperacao(() => {
      const recorrencia = servicoRecorrencias.atualizar(Number(dados.id ?? 0), dados);
      return { ok: true, recorrencia };
    }));
  ipcMain.handle(canais.RECURRENCIA_ATIVAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, recorrencia: servicoRecorrencias.ativar(Number(id ?? 0)) })));
  ipcMain.handle(canais.RECURRENCIA_DESATIVAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, recorrencia: servicoRecorrencias.desativar(Number(id ?? 0)) })));
  ipcMain.handle(canais.RECURRENCIA_ARQUIVAR, (_evento, { id } = {}) =>
    traduzirResultadoOperacao(() => ({ ok: true, recorrencia: servicoRecorrencias.arquivar(Number(id ?? 0)) })));

  // ── Geração de ocorrências (Fase 10.4) ────────────────────────────────
  // Transforma a regra em contas PENDENTES num período (idempotente).
  // NÃO paga, NÃO cria transação e NÃO altera saldo/carteira/orçamento.
  ipcMain.handle(canais.RECURRENCIA_GERAR, (_evento, { id, periodoInicio = null, periodoFim = null } = {}) =>
    traduzirResultadoOperacao(() => {
      const geracao = servicoGeracaoOcorrencias.gerar(Number(id ?? 0), { periodoInicio, periodoFim });
      registro.info(
        `Geração de ocorrências: encontradas=${geracao.encontradas}, criadas=${geracao.criadas}, existentes=${geracao.existentes}.`,
      );
      return { ok: true, geracao };
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
    if (erro instanceof ErroTransicao) {
      return { ok: false, erro: 'transicao', mensagem: erro.message };
    }
    registro.erro('Falha interna em operação do núcleo.', erro);
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

  // Camada de aplicação: serviços sobre os repositórios do banco.
  const repositorioJogador = new RepositorioJogador(estadoBanco.banco);
  const repositorioStatus = new RepositorioStatus(estadoBanco.banco);
  const repositorioMissao = new RepositorioMissao(estadoBanco.banco);
  const repositorioProgressao = new RepositorioProgressao(estadoBanco.banco);
  const repositorioAtributos = new RepositorioAtributos(estadoBanco.banco);
  const repositorioProjeto = new RepositorioProjeto(estadoBanco.banco);
  const repositorioCarteira = new RepositorioCarteira(estadoBanco.banco);
  const repositorioTransacao = new RepositorioTransacao(estadoBanco.banco);
  const repositorioOrcamento = new RepositorioOrcamento(estadoBanco.banco);
  const repositorioDesejo = new RepositorioDesejo(estadoBanco.banco);
  const repositorioServico = new RepositorioServico(estadoBanco.banco);
  const repositorioConta = new RepositorioConta(estadoBanco.banco);
  const repositorioRecorrencia = new RepositorioRecorrencia(estadoBanco.banco);

  // Criação atômica: jogador + status + progressão + carteira em uma transação.
  servicoStatus = new ServicoStatus({ repositorio: repositorioStatus, repositorioJogador });
  servicoProgressao = new ServicoProgressao({
    repositorioProgressao,
    repositorioAtributos,
    repositorioJogador,
    banco: estadoBanco.banco,
  });
  servicoFinanca = new ServicoFinanca({
    repositorioCarteira,
    repositorioTransacao,
    repositorioOrcamento,
    repositorioJogador,
  });
  servicoJogador = new ServicoJogador({
    repositorio: repositorioJogador,
    banco: estadoBanco.banco,
    aoCriar: (jogador) => {
      const status = servicoStatus.criarInicial(jogador.id);
      registro.info(
        `Status inicial criado: energia=${status.energia}, foco=${status.foco}, estresse=${status.estresse}, criatividade=${status.criatividade}`,
      );
      servicoProgressao.criarInicial(jogador.id);
      registro.info('Progressão inicial criada: nível 1, 0 XP, atributos em 1.');
      const carteira = servicoFinanca.criarCarteiraInicial(jogador.id);
      registro.info(
        `Carteira inicial criada: ${carteira.nome} (${carteira.moeda}), saldo R$ 0,00.`,
      );
    },
  });
  servicoMissao = new ServicoMissao({ repositorio: repositorioMissao });
  servicoLoja = new ServicoLoja({
    repositorio: repositorioDesejo,
    repositorioJogador,
    servicoFinanca,
    banco: estadoBanco.banco,
  });
  servicoServicos = new ServicoServicos({
    repositorio: repositorioServico,
    repositorioJogador,
  });
  servicoContas = new ServicoContas({
    repositorio: repositorioConta,
    repositorioServico,
    repositorioJogador,
  });
  servicoRecorrencias = new ServicoRecorrencias({
    repositorio: repositorioRecorrencia,
    repositorioServico,
    repositorioJogador,
  });
  servicoGeracaoOcorrencias = new ServicoGeracaoOcorrencias({
    repositorioRecorrencia,
    repositorioContas: repositorioConta,
    banco: estadoBanco.banco,
  });
  servicoPagamentos = new ServicoPagamentos({
    repositorioConta,
    financa: {
      repositorioCarteira,
      repositorioTransacao,
      repositorioOrcamento,
      repositorioJogador,
    },
    banco: estadoBanco.banco,
  });
  servicoProjeto = new ServicoProjeto({
    repositorio: repositorioProjeto,
    repositorioMissao,
    repositorioJogador,
  });

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
