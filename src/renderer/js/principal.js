/**
 * PULSO — Renderer (Fase 03 — Jogador)
 *
 * Sem acesso a APIs de Node.js: tudo chega via window.pulso,
 * a ponte controlada exposta pelo preload (src/main/preload.cjs).
 *
 * Fluxo:
 *   primeiro acesso   → visão de configuração (IDENTIDADE DO OPERADOR)
 *   jogador existente → boot com operador identificado + edição
 *
 * As regras de validação vivem no domínio (src/core/dominio/jogador.js);
 * a interface apenas coleta, apresenta e reage.
 */

const LINHAS_BASE = [
  { texto: 'processo principal', valor: 'ATIVO' },
  { texto: 'janela principal', valor: 'CRIADA' },
  { texto: 'interface', valor: 'CARREGADA' },
  { texto: 'comunicação segura (IPC)', valor: 'ATIVA' },
];

const ATRASO_INICIAL_MS = 420;
const ATRASO_ENTRE_LINHAS_MS = 300;

const elementos = {};
const contexto = { info: null, infoBanco: null };
let jogadorAtual = null;
let modoEdicao = false;
const STATUS_ORDEM = ['energia', 'foco', 'estresse', 'criatividade'];

function consultar(id) {
  const elemento = document.getElementById(id);
  if (!elemento) {
    throw new Error(`Elemento da interface ausente: #${id}`);
  }
  return elemento;
}

function mapearElementos() {
  elementos.visaoConfiguracao = consultar('visao-configuracao');
  elementos.visaoBoot = consultar('visao-boot');
  elementos.formulario = consultar('formulario-jogador');
  elementos.campoNome = consultar('campo-nome');
  elementos.campoCodinome = consultar('campo-codinome');
  elementos.avisoConfiguracao = consultar('aviso-configuracao');
  elementos.botaoInicializar = consultar('botao-inicializar');
  elementos.botaoCancelar = consultar('botao-cancelar');
  elementos.botaoEditar = consultar('botao-editar');
  elementos.botaoTesteStatus = consultar('botao-teste-status');
  elementos.statusPainel = consultar('status-painel');
  elementos.statusLista = consultar('status-lista');
  elementos.versao = consultar('versao');
  elementos.estado = consultar('estado');
  elementos.estadoTexto = consultar('estado-texto');
  elementos.boot = consultar('boot');
  elementos.mensagem = consultar('mensagem');
  elementos.rodapeAmbiente = consultar('rodape-ambiente');
  elementos.rodapeVersoes = consultar('rodape-versoes');
  elementos.rodapePlataforma = consultar('rodape-plataforma');
  elementos.rodapeMemoria = consultar('rodape-memoria');
}

/** Cria as linhas do terminal de inicialização (ocultas até serem reveladas). */
function montarLinhasBoot(linhas, neutro) {
  elementos.boot.replaceChildren(
    ...linhas.map((linha) => {
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

/** Monta as linhas de status (uma por vez, via DOM). */
function montarLinhasStatus() {
  elementos.statusLista.replaceChildren(
    ...STATUS_ORDEM.map((nome) => {
      const linha = document.createElement('div');
      linha.className = 'status-linha';
      linha.dataset.status = nome;

      const rotulo = document.createElement('span');
      rotulo.className = 'status-nome';
      rotulo.textContent = nome.toUpperCase();

      const barra = document.createElement('div');
      barra.className = 'status-barra';
      const preenchimento = document.createElement('span');
      preenchimento.className = 'status-preenchimento';
      preenchimento.style.transform = 'scaleX(0)';
      barra.append(preenchimento);

      const valor = document.createElement('span');
      valor.className = 'status-valor';
      valor.textContent = '—';

      linha.append(rotulo, barra, valor);
      return linha;
    }),
  );
}

/** Atualiza a UI a partir do objeto de status retornado pelo núcleo. */
function renderizarStatus(status) {
  if (!status) return;
  for (const nome of STATUS_ORDEM) {
    const linha = elementos.statusLista.querySelector(`[data-status="${nome}"]`);
    if (!linha) continue;
    const valor = status[nome];
    linha.querySelector('.status-valor').textContent = String(valor);
    linha.querySelector('.status-preenchimento').style.transform = `scaleX(${valor / 100})`;
  }
}

/** Carrega o status do jogador via IPC e renderiza. */
async function carregarStatus() {
  if (!jogadorAtual) return;
  try {
    const resultado = await window.pulso.status.obter(jogadorAtual.id);
    if (resultado.ok && resultado.status) {
      renderizarStatus(resultado.status);
      elementos.botaoTesteStatus.classList.remove('oculto');
    }
  } catch (erro) {
    console.error(`PULSO: falha ao carregar status — ${erro.message}`, erro);
  }
}

/** Altera um status via IPC (delta em pontos). */
async function alterarStatus(nome, delta) {
  if (!jogadorAtual) return;
  try {
    const resultado = await window.pulso.status.alterar(jogadorAtual.id, nome, delta);
    if (resultado.ok && resultado.status) {
      renderizarStatus(resultado.status);
    } else {
      console.warn(`PULSO: não foi possível alterar ${nome} — ${resultado.mensagem ?? 'erro'}`);
    }
  } catch (erro) {
    console.error(`PULSO: falha ao alterar status — ${erro.message}`, erro);
  }
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

function preencherRodape(info, infoBanco) {
  elementos.versao.textContent = `v${info.versao}`;
  elementos.rodapeAmbiente.textContent = `AMBIENTE: ${String(info.ambiente).toUpperCase()}`;
  elementos.rodapeVersoes.textContent = `ELECTRON ${info.electron} · NODE ${info.node} · CHROME ${info.chrome}`;
  elementos.rodapePlataforma.textContent = `PLATAFORMA: ${String(info.plataforma).toUpperCase()}`;
  elementos.rodapeMemoria.textContent = `MEMÓRIA: ${String(infoBanco.estado).toUpperCase()} · SCHEMA v${infoBanco.versaoSchema}`;
}

/** Obtém as informações reais do sistema pela ponte segura do preload. */
async function carregarInformacoesSistema() {
  if (!window.pulso || typeof window.pulso.infoSistema !== 'function') {
    throw new Error('A ponte window.pulso não está disponível (preload não executou).');
  }
  return window.pulso.infoSistema();
}

/** Lê o estado real da memória local (banco de dados) pela ponte segura. */
async function carregarInformacoesBanco() {
  if (!window.pulso || typeof window.pulso.infoBanco !== 'function') {
    throw new Error('A ponte window.pulso.infoBanco não está disponível.');
  }
  return window.pulso.infoBanco();
}

/** Lê o estado do jogador pela ponte segura (existe? quem é?). */
async function carregarEstadoJogador() {
  if (!window.pulso || typeof window.pulso.jogador?.estado !== 'function') {
    throw new Error('A ponte window.pulso.jogador não está disponível.');
  }
  return window.pulso.jogador.estado();
}

/** Alterna a visão visível (configuração ↔ boot). */
function exibirVisao(nomeVisao) {
  elementos.visaoConfiguracao.classList.toggle('oculto', nomeVisao !== 'visao-configuracao');
  elementos.visaoBoot.classList.toggle('oculto', nomeVisao !== 'visao-boot');
}

function setAviso(texto) {
  elementos.avisoConfiguracao.textContent = texto;
}

/** Mostra o formulário no modo pedido (criação no 1º acesso; edição depois). */
function exibirConfiguracao({ modo, jogador = null }) {
  modoEdicao = modo === 'edicao';
  if (jogador) jogadorAtual = jogador;
  setAviso('');
  elementos.campoNome.value = modoEdicao && jogadorAtual ? jogadorAtual.nome : '';
  elementos.campoCodinome.value = modoEdicao && jogadorAtual?.codinome ? jogadorAtual.codinome : '';
  elementos.botaoInicializar.textContent = modoEdicao ? 'SALVAR' : 'INICIALIZAR';
  elementos.botaoCancelar.classList.toggle('oculto', !modoEdicao);
  exibirVisao('visao-configuracao');
}

/** Linhas do terminal de inicialização: base + memória + operador. */
function linhasDoBoot() {
  const linhas = [
    ...LINHAS_BASE,
    { texto: 'memória local (sqlite)', valor: `SCHEMA v${contexto.infoBanco.versaoSchema}` },
  ];
  if (jogadorAtual) {
    linhas.push({
      texto: 'operador',
      valor: jogadorAtual.codinome
        ? `${jogadorAtual.nome} · ${jogadorAtual.codinome}`
        : jogadorAtual.nome,
    });
  }
  return linhas;
}

/** Executa a sequência de inicialização na visão principal. */
function executarBoot() {
  exibirVisao('visao-boot');
  elementos.botaoEditar.disabled = true;
  definirEstado('INICIANDO…');
  const linhas = linhasDoBoot();
  montarLinhasBoot(linhas, false);
  agendarLinhasBoot();
  montarLinhasStatus();

  const atrasoConclusao = ATRASO_INICIAL_MS + linhas.length * ATRASO_ENTRE_LINHAS_MS;
  setTimeout(() => {
    definirEstado('SISTEMA ONLINE');
    elementos.botaoEditar.disabled = false;
    elementos.mensagem.textContent = 'Operador identificado. Aguardando módulos…';
    carregarStatus();
  }, atrasoConclusao);
}

/** Envia a identidade ao núcleo (criação no 1º acesso; atualização na edição). */
async function submeterIdentidade(evento) {
  evento.preventDefault();
  elementos.botaoInicializar.disabled = true;
  setAviso('');
  try {
    const dados = {
      nome: elementos.campoNome.value,
      codinome: elementos.campoCodinome.value,
    };
    const resultado = modoEdicao
      ? await window.pulso.jogador.atualizar({ id: jogadorAtual.id, ...dados })
      : await window.pulso.jogador.criar(dados);

    if (!resultado.ok) {
      setAviso(resultado.mensagem ?? 'Não foi possível salvar a identidade.');
      return;
    }
    jogadorAtual = resultado.jogador;
    executarBoot(); // reexecuta o boot exibindo a identidade confirmada
  } catch (erro) {
    setAviso('Falha de comunicação com o núcleo.');
    console.error(`PULSO: falha ao salvar a identidade — ${erro.message}`, erro);
  } finally {
    elementos.botaoInicializar.disabled = false;
  }
}

async function iniciar() {
  try {
    contexto.info = await carregarInformacoesSistema();
    contexto.infoBanco = await carregarInformacoesBanco();
    preencherRodape(contexto.info, contexto.infoBanco);

    const estadoJogador = await carregarEstadoJogador();
    if (estadoJogador.existe && estadoJogador.jogador) {
      jogadorAtual = estadoJogador.jogador;
      executarBoot();
    } else {
      exibirConfiguracao({ modo: 'criacao' });
    }
  } catch (erro) {
    exibirVisao('visao-boot');
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
  elementos.formulario.addEventListener('submit', submeterIdentidade);
  elementos.botaoEditar.addEventListener('click', () =>
    exibirConfiguracao({ modo: 'edicao', jogador: jogadorAtual }));
  elementos.botaoCancelar.addEventListener('click', () => exibirVisao('visao-boot'));
  elementos.botaoTesteStatus.addEventListener('click', () => {
    // Teste rápido: aplica deltas variados para validar a infraestrura.
    // Em fases futuras, missões/eventos alterarão os status.
    alterarStatus('energia', -10);
    alterarStatus('foco', -5);
    alterarStatus('estresse', 8);
    alterarStatus('criatividade', -3);
  });
  iniciar();
});
