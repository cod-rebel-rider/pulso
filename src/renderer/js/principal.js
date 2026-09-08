/**
 * PULSO — Renderer da tela de fundação (Fase 01)
 *
 * Sem acesso a APIs de Node.js: tudo chega via window.pulso,
 * a ponte mínima exposta pelo preload (src/main/preload.cjs).
 *
 * A tela não simula funcionalidades futuras: exibe apenas o estado real
 * da fundação (processo principal, janela, interface e IPC).
 */

const LINHAS_BOOT = [
  { texto: 'processo principal', valor: 'ATIVO' },
  { texto: 'janela principal', valor: 'CRIADA' },
  { texto: 'interface', valor: 'CARREGADA' },
  { texto: 'comunicação segura (IPC)', valor: 'ATIVA' },
];

const ATRASO_INICIAL_MS = 420;
const ATRASO_ENTRE_LINHAS_MS = 300;

const elementos = {};

function consultar(id) {
  const elemento = document.getElementById(id);
  if (!elemento) {
    throw new Error(`Elemento da interface ausente: #${id}`);
  }
  return elemento;
}

function mapearElementos() {
  elementos.versao = consultar('versao');
  elementos.estado = consultar('estado');
  elementos.estadoTexto = consultar('estado-texto');
  elementos.boot = consultar('boot');
  elementos.mensagem = consultar('mensagem');
  elementos.rodapeAmbiente = consultar('rodape-ambiente');
  elementos.rodapeVersoes = consultar('rodape-versoes');
  elementos.rodapePlataforma = consultar('rodape-plataforma');
}

/** Cria as linhas do terminal de inicialização (ocultas até serem reveladas). */
function montarLinhasBoot(neutro) {
  elementos.boot.replaceChildren(
    ...LINHAS_BOOT.map((linha) => {
      const item = document.createElement('li');
      item.className = neutro ? 'neutro' : '';

      const nome = document.createElement('span');
      nome.textContent = linha.texto;

      const traco = document.createElement('span');
      traco.className = 'traco';
      traco.setAttribute('aria-hidden', 'true');

      const valor = document.createElement('span');
      valor.className = 'valor';
      valor.textContent = neutro ? '—' : linha.valor;

      item.append(nome, traco, valor);
      return item;
    }),
  );
}

/** Revela as linhas em sequência, como um log de terminal. */
function agendarLinhasBoot() {
  [...elementos.boot.children].forEach((item, indice) => {
    setTimeout(() => item.classList.add('visivel'), ATRASO_INICIAL_MS + indice * ATRASO_ENTRE_LINHAS_MS);
  });
}

function definirEstado(texto, falha = false) {
  elementos.estadoTexto.textContent = texto;
  elementos.estado.classList.toggle('falha', falha);
}

function preencherRodape(info) {
  elementos.versao.textContent = `v${info.versao}`;
  elementos.rodapeAmbiente.textContent = `AMBIENTE: ${String(info.ambiente).toUpperCase()}`;
  elementos.rodapeVersoes.textContent = `ELECTRON ${info.electron} · NODE ${info.node} · CHROME ${info.chrome}`;
  elementos.rodapePlataforma.textContent = `PLATAFORMA: ${String(info.plataforma).toUpperCase()}`;
}

/** Obtém as informações reais do sistema pela ponte segura do preload. */
async function carregarInformacoesSistema() {
  if (!window.pulso || typeof window.pulso.infoSistema !== 'function') {
    throw new Error('A ponte window.pulso não está disponível (preload não executou).');
  }
  return window.pulso.infoSistema();
}

async function iniciar() {
  try {
    const info = await carregarInformacoesSistema();

    preencherRodape(info);
    montarLinhasBoot(false);
    agendarLinhasBoot();

    const atrasoConclusao = ATRASO_INICIAL_MS + LINHAS_BOOT.length * ATRASO_ENTRE_LINHAS_MS;
    setTimeout(() => {
      definirEstado('SISTEMA ONLINE');
      elementos.mensagem.textContent = 'Fundação carregada. Aguardando módulos…';
    }, atrasoConclusao);
  } catch (erro) {
    montarLinhasBoot(true);
    agendarLinhasBoot();
    definirEstado('FALHA DE COMUNICAÇÃO', true);
    elementos.mensagem.textContent = 'Não foi possível falar com o núcleo. Detalhes no console.';
    console.error(`PULSO: falha na comunicação com o processo principal — ${erro.message}`, erro);
  } finally {
    // sinal de prontidão usado pelo teste de fumaça (src/main/main.js)
    window.__pulso_renderer_pronto = true;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  mapearElementos();
  iniciar();
});
