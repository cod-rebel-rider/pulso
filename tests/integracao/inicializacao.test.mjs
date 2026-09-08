/**
 * Testes de integração — inicialização da aplicação (Fase 01 — Fundação)
 *
 * Executam o "teste de fumaça" embutido no Electron:
 *   electron . --teste-fumaca
 * que abre a janela, carrega o renderer, valida a IPC, verifica erros de
 * console e encerra sozinho, imprimindo `PULSO_FUMACA:{...}` no stdout.
 *
 * Requer ambiente gráfico ativo (sessão X11/Wayland) ou xvfb-run.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRAZO_MS = 90_000;

/**
 * Caminho do binário do Electron lido do pacote npm (node_modules/electron/path.txt).
 * Importar o módulo 'electron' aqui NÃO funciona: dentro do Node embutido do
 * Electron ele resolve para o módulo embutido da API, não para o caminho.
 */
function resolverBinarioElectron() {
  const pacoteElectron = join(raiz, 'node_modules', 'electron');
  const relativo = readFileSync(join(pacoteElectron, 'path.txt'), 'utf-8').trim();
  // formatos do path.txt: "dist/electron" (antigos) ou "electron" (novos,
  // em que o index.js do pacote junta com dist/)
  const candidatos = [join(pacoteElectron, 'dist', relativo), join(pacoteElectron, relativo)];
  const binario = candidatos.find((caminho) => existsSync(caminho));
  if (!binario) {
    throw new Error(`Binário do Electron não encontrado em ${candidatos.join(' ou ')}. Execute "npm install".`);
  }
  return binario;
}

function resolverComandoGrafico() {
  if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) {
    return { disponivel: true, prefixo: [] };
  }
  if (existsSync('/usr/bin/xvfb-run')) {
    return { disponivel: true, prefixo: ['/usr/bin/xvfb-run', '-a'] };
  }
  return { disponivel: false, prefixo: [] };
}

function executarTesteFumaca() {
  return new Promise((resolver, rejeitar) => {
    const grafico = resolverComandoGrafico();
    if (!grafico.disponivel) {
      rejeitar(
        new Error(
          'Sem ambiente gráfico (DISPLAY) e sem xvfb-run. Instale com: sudo apt install xvfb.',
        ),
      );
      return;
    }

    const argv = [...grafico.prefixo, resolverBinarioElectron(), raiz, '--teste-fumaca'];
    // O processo de teste roda com ELECTRON_RUN_AS_NODE=1 (Node embutido do
    // Electron, necessário para node:sqlite). O filho precisa voltar ao modo
    // gráfico normal, então a variável é removida do ambiente herdado.
    const ambienteFilho = { ...process.env, PULSO_AMBIENTE: 'teste' };
    delete ambienteFilho.ELECTRON_RUN_AS_NODE;
    const filho = spawn(argv[0], argv.slice(1), {
      cwd: raiz,
      env: ambienteFilho,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let saida = '';
    let erroPadrao = '';
    filho.stdout.on('data', (pedaco) => (saida += pedaco));
    filho.stderr.on('data', (pedaco) => (erroPadrao += pedaco));

    const prazo = setTimeout(() => {
      filho.kill('SIGKILL');
      rejeitar(new Error(`Teste de fumaça excedeu ${PRAZO_MS / 1000} s.\nSaída parcial:\n${saida}${erroPadrao}`));
    }, PRAZO_MS);

    filho.on('error', (erro) => {
      clearTimeout(prazo);
      rejeitar(erro);
    });

    filho.on('close', (codigo) => {
      clearTimeout(prazo);
      resolver({ codigo, saida, erroPadrao });
    });
  });
}

function extrairRelatorio(saida) {
  const linha = saida.split('\n').find((l) => l.startsWith('PULSO_FUMACA:'));
  if (!linha) {
    throw new Error(`Saída sem relatório PULSO_FUMACA.\n--- stdout ---\n${saida}\n--- stderr ---\n${erroPadrao}`);
  }
  return JSON.parse(linha.slice('PULSO_FUMACA:'.length));
}

async function validarCicloCompleto({ tentativa = 1 } = {}) {
  const { codigo, saida, erroPadrao } = await executarTesteFumaca();
  let relatorio = extrairRelatorio(saida);

  // ao encerrar, o sistema operacional pode demorar alguns instantes para
  // liberar o lock de instância única — nesses casos, aguarde e tente de novo
  if (!relatorio.ok && /outra instância/.test(relatorio.motivo ?? '') && tentativa < 3) {
    await new Promise((r) => setTimeout(r, 1200));
    return validarCicloCompleto({ tentativa: tentativa + 1 });
  }

  assert.equal(
    codigo,
    0,
    `processo terminou com código ${codigo}. Motivo: ${relatorio.motivo ?? '?'}\nstderr: ${erroPadrao.slice(0, 1500)}`,
  );
  assert.equal(relatorio.ok, true, `teste de fumaça falhou: ${JSON.stringify(relatorio)}`);

  const r = relatorio.resultados;
  assert.equal(r.aplicacaoIniciou, true, 'a aplicação não iniciou');
  assert.equal(r.janelaCriada, true, 'a janela principal não foi criada');
  assert.equal(r.rendererCarregado, true, 'o renderer não carregou');
  assert.equal(r.rendererPronto, true, 'o renderer não sinalizou prontidão');
  assert.equal(r.ipcAtivo, true, 'a ponte IPC não respondeu');
  assert.deepEqual(r.errosConsole, [], `erros inesperados no console: ${JSON.stringify(r.errosConsole)}`);

  assert.ok(r.versoes.electron, 'versão do Electron ausente no relatório');
  assert.ok(r.versoes.aplicacao, 'versão da aplicação ausente no relatório');

  assert.equal(r.banco.inicializado, true, 'banco de dados não inicializou');
  assert.equal(r.banco.criado, true, 'banco do teste de fumaça deveria ser novo (diretório temporário)');
  assert.ok(r.banco.versaoSchema >= 1, 'versão do schema não identificada');

  // fluxo IPC do jogador valida a cadeia renderer → preload → main → serviço → SQLite
  assert.equal(r.jogador.preparado, true, 'banco de fumaça deveria começar sem jogador');
  assert.equal(r.jogador.criado, true, 'criação do jogador via IPC falhou');
  assert.equal(r.jogador.carregado, true, 're-consulta do jogador via IPC falhou');
  return r;
}

test('a aplicação inicia, cria a janela, carrega o renderer com IPC ativa e encerra sem erros', async () => {
  const resultados = await validarCicloCompleto();
  assert.ok(resultados.versoes.electron, `electron não informado: ${JSON.stringify(resultados.versoes)}`);
});

test('a aplicação pode ser iniciada novamente após o encerramento', async () => {
  await validarCicloCompleto();
});
