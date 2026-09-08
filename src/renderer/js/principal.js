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
// Missões (Fase 05)
let missoesCarregadas = [];
let filtroAtual = 'todas';
let missaoAtualId = null;
let modoEdicaoMissao = false;
// Progressão (Fase 06)
let progressaoAtual = null;
const ATRIBUTOS_ORDEM = ['tecnologia', 'criatividade', 'musica', 'social', 'energia', 'foco', 'disciplina'];
const ATRIBUTOS_ROTULOS = {
  tecnologia: 'TECNOLOGIA',
  criatividade: 'CRIATIVIDADE',
  musica: 'MÚSICA',
  social: 'SOCIAL',
  energia: 'ENERGIA',
  foco: 'FOCO',
  disciplina: 'DISCIPLINA',
};

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
  // Missões (Fase 05)
  elementos.visaoMissoes = consultar('visao-missoes');
  elementos.visaoMissao = consultar('visao-missao');
  elementos.visaoFormularioMissao = consultar('visao-formulario-missao');
  elementos.listaMissoes = consultar('lista-missoes');
  elementos.avisoMissoes = consultar('aviso-missoes');
  elementos.botaoNovaMissao = consultar('botao-nova-missao');
  elementos.filtrosMissao = consultar('filtros-missao');
  elementos.formularioMissao = consultar('formulario-missao');
  elementos.formularioMissaoTituloSecao = consultar('formulario-missao-titulo-secao');
  elementos.formularioMissaoTitulo = consultar('formulario-missao-titulo');
  elementos.campoMissaoTitulo = consultar('campo-missao-titulo');
  elementos.campoMissaoDescricao = consultar('campo-missao-descricao');
  elementos.campoMissaoPrioridade = consultar('campo-missao-prioridade');
  elementos.campoMissaoPrazo = consultar('campo-missao-prazo');
  elementos.avisoFormularioMissao = consultar('aviso-formulario-missao');
  elementos.botaoSalvarMissao = consultar('botao-salvar-missao');
  elementos.botaoCancelarMissao = consultar('botao-cancelar-missao');
  elementos.missaoTitulo = consultar('missao-titulo');
  elementos.missaoDescricao = consultar('missao-descricao');
  elementos.missaoEstado = consultar('missao-estado');
  elementos.missaoPrioridade = consultar('missao-prioridade');
  elementos.missaoCriada = consultar('missao-criada');
  elementos.missaoIniciada = consultar('missao-iniciada');
  elementos.missaoConcluida = consultar('missao-concluida');
  elementos.missaoPrazo = consultar('missao-prazo');
  elementos.avisoMissao = consultar('aviso-missao');
  elementos.acoesMissao = consultar('acoes-missao');
  elementos.missaoIniciar = consultar('missao-iniciar');
  elementos.missaoConcluir = consultar('missao-concluir');
  elementos.missaoCancelar = consultar('missao-cancelar');
  elementos.missaoExcluir = consultar('missao-excluir');
  elementos.missaoVoltar = consultar('missao-voltar');
  // Progressão (Fase 06)
  ELEMENTOS_PROGRESSAO.forEach((id) => { elementos[id] = consultar(id); });
  elementos.botaoTesteXp = consultar('botao-teste-xp');
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

// ── Missões (Fase 05) ─────────────────────────────────────────────────

/** Carrega as missões do jogador via IPC e renderiza a lista. */
async function carregarMissoes() {
  if (!jogadorAtual) return;
  try {
    const resultado = await window.pulso.missao.listar();
    if (resultado.ok) {
      missoesCarregadas = resultado.missoes || [];
      renderizarMissoes();
    }
  } catch (erro) {
    console.error(`PULSO: falha ao carregar missões — ${erro.message}`, erro);
  }
}

/** Renderiza a lista de missões conforme o filtro ativo. */
function renderizarMissoes() {
  const filtradas = filtrarMissoes(missoesCarregadas, filtroAtual);
  elementos.listaMissoes.replaceChildren();

  if (filtradas.length === 0) {
    elementos.avisoMissoes.textContent = 'Nenhuma missão registrada.';
    elementos.avisoMissoes.classList.remove('oculto');
    return;
  }

  elementos.avisoMissoes.classList.add('oculto');
  for (const missao of filtradas) {
    elementos.listaMissoes.append(criarItemMissao(missao));
  }
}

/** Aplica o filtro por estado. */
function filtrarMissoes(missoes, filtro) {
  if (filtro === 'todas') return missoes;
  return missoes.filter((m) => m.estado === filtro);
}

/** Cria o elemento de uma missão na lista. */
function criarItemMissao(missao) {
  const item = document.createElement('button');
  item.className = 'missao-item';
  item.dataset.id = String(missao.id);
  item.onclick = () => visualizarMissao(missao.id);

  const titulo = document.createElement('span');
  titulo.className = 'missao-item-titulo';
  titulo.textContent = missao.titulo;

  const estado = document.createElement('span');
  estado.className = `missao-item-estado estado-${missao.estado}`;
  estado.textContent = rotuloEstado(missao.estado);

  const prioridade = document.createElement('span');
  prioridade.className = `missao-item-prioridade prioridade-${missao.prioridade}`;
  prioridade.textContent = rotuloPrioridade(missao.prioridade);

  item.append(titulo, estado, prioridade);
  return item;
}

/** Retorna o rótulo legível do estado. */
function rotuloEstado(estado) {
  const rotulos = {
    pendente: 'Pendente',
    em_andamento: 'Em andamento',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };
  return rotulos[estado] ?? estado;
}

/** Retorna o rótulo legível da prioridade. */
function rotuloPrioridade(prioridade) {
  const rotulos = {
    baixa: 'Baixa',
    normal: 'Normal',
    alta: 'Alta',
    critica: 'Crítica',
  };
  return rotulos[prioridade] ?? prioridade;
}

/** Exibe os detalhes de uma missão. */
async function visualizarMissao(id) {
  if (!jogadorAtual) return;
  try {
    const resultado = await window.pulso.missao.obter(jogadorAtual.id, id);
    if (!resultado.ok) {
      console.warn(`PULSO: missão ${id} não encontrada`);
      return;
    }
    missaoAtualId = id;
    exibirDetalhesMissao(resultado.missao);
  } catch (erro) {
    console.error(`PULSO: falha ao obter missão — ${erro.message}`, erro);
  }
}

/** Renderiza os detalhes da missão na tela. */
function exibirDetalhesMissao(missao) {
  elementos.missaoTitulo.textContent = missao.titulo;
  elementos.missaoDescricao.textContent = missao.descricao || '—';
  elementos.missaoEstado.textContent = rotuloEstado(missao.estado);
  elementos.missaoEstado.className = `missao-detalhe-valor estado-${missao.estado}`;
  elementos.missaoPrioridade.textContent = rotuloPrioridade(missao.prioridade);
  elementos.missaoPrioridade.className = `missao-detalhe-valor prioridade-${missao.prioridade}`;
  elementos.missaoCriada.textContent = formatarData(missao.criadoEm);
  elementos.missaoIniciada.textContent = missao.iniciadaEm ? formatarData(missao.iniciadaEm) : '—';
  elementos.missaoConcluida.textContent = missao.concluidaEm ? formatarData(missao.concluidaEm) : '—';
  elementos.missaoPrazo.textContent = missao.prazo ? formatarData(missao.prazo) : '—';

  const ehTerminal = missao.estado === 'concluida' || missao.estado === 'cancelada';
  elementos.missaoIniciar.classList.toggle('oculto', missao.estado !== 'pendente');
  elementos.missaoConcluir.classList.toggle('oculto', missao.estado !== 'em_andamento');
  elementos.missaoCancelar.classList.toggle('oculto', ehTerminal);
  elementos.missaoExcluir.classList.toggle('oculto', ehTerminal);

  exibirVisaoMissao('visao-missao');
}

/** Formata uma data ISO para exibição. */
function formatarData(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Alterna entre as visões de missões (lista ↔ detalhe ↔ formulário). */
function exibirVisaoMissao(nome) {
  elementos.visaoMissoes.classList.toggle('oculto', nome !== 'visao-missoes');
  elementos.visaoMissao.classList.toggle('oculto', nome !== 'visao-missao');
  elementos.visaoFormularioMissao.classList.toggle('oculto', nome !== 'visao-formulario-missao');
}

/** Exibe o formulário de criação/edição de missão. */
function exibirFormularioMissao(missao = null) {
  modoEdicaoMissao = !!missao;
  elementos.formularioMissaoTituloSecao.textContent = missao ? 'EDITAR MISSÃO' : 'NOVA MISSÃO';
  elementos.formularioMissaoTitulo.value = missao?.titulo || '';
  elementos.campoMissaoDescricao.value = missao?.descricao || '';
  elementos.campoMissaoPrioridade.value = missao?.prioridade || 'normal';
  elementos.campoMissaoPrazo.value = missao?.prazo ? missao.prazo.slice(0, 16) : '';
  elementos.avisoFormularioMissao.textContent = '';
  exibirVisaoMissao('visao-formulario-missao');
}

/** Salva uma missão (criação ou edição) via IPC. */
async function salvarMissao(evento) {
  evento.preventDefault();
  if (!jogadorAtual) return;
  const dados = {
    titulo: elementos.formularioMissaoTitulo.value,
    descricao: elementos.campoMissaoDescricao.value,
    prioridade: elementos.campoMissaoPrioridade.value,
    prazo: elementos.campoMissaoPrazo.value || null,
  };
  try {
    const resultado = modoEdicaoMissao && missaoAtualId
      ? await window.pulso.missao.atualizar({ id: missaoAtualId, ...dados })
      : await window.pulso.missao.criar(dados);
    if (!resultado.ok) {
      elementos.avisoFormularioMissao.textContent = resultado.mensagem ?? 'Não foi possível salvar a missão.';
      return;
    }
    await carregarMissoes();
    exibirVisaoMissao('visao-missoes');
  } catch (erro) {
    elementos.avisoFormularioMissao.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao salvar missão — ${erro.message}`, erro);
  }
}

/** Inicia uma missão via IPC. */
async function iniciarMissao() {
  if (!jogadorAtual || !missaoAtualId) return;
  const resultado = await window.pulso.missao.iniciar(missaoAtualId);
  if (resultado.ok) {
    await carregarMissoes();
    exibirDetalhesMissao(resultado.missao);
  }
}

/** Conclui uma missão via IPC. */
async function concluirMissao() {
  if (!jogadorAtual || !missaoAtualId) return;
  const resultado = await window.pulso.missao.concluir(missaoAtualId);
  if (resultado.ok) {
    await carregarMissoes();
    exibirDetalhesMissao(resultado.missao);
  }
}

/** Cancela uma missão via IPC. */
async function cancelarMissao() {
  if (!jogadorAtual || !missaoAtualId) return;
  const resultado = await window.pulso.missao.cancelar(missaoAtualId);
  if (resultado.ok) {
    await carregarMissoes();
    exibirDetalhesMissao(resultado.missao);
  }
}

/** Exclui uma missão via IPC. */
async function excluirMissao() {
  if (!jogadorAtual || !missaoAtualId) return;
  const resultado = await window.pulso.missao.excluir(missaoAtualId);
  if (resultado.ok) {
    missaoAtualId = null;
    await carregarMissoes();
    exibirVisaoMissao('visao-missoes');
  }
}

// ════════════════════════════════════════════════════════════════════════
// PROGRESSÃO (Fase 06)
// ════════════════════════════════════════════════════════════════════════

/** Carrega a progressão do jogador via IPC e renderiza. */
async function carregarProgressao() {
  if (!jogadorAtual) return;
  try {
    const resultado = await window.pulso.progressao.obter();
    if (resultado.ok && resultado.progressao) {
      progressaoAtual = resultado.progressao;
      renderizarProgressao(resultado.progressao);
    }
  } catch (erro) {
    console.error(`PULSO: falha ao carregar progressão — ${erro.message}`, erro);
  }
}

/** Atualiza a UI a partir do objeto de progressão retornado pelo núcleo. */
function renderizarProgressao(progressao) {
  if (!progressao) return;
  const nivel = progressao.nivel;
  const xpAtual = progressao.xpAtual;
  const xpNecessario = progressao.xpProximoNivel;
  const pontos = progressao.pontosDisponiveis;

  document.getElementById('progressao-nivel-valor').textContent = String(nivel);
  document.getElementById('progressao-xp-rotulo').textContent = `XP ${xpAtual} / ${xpNecessario}`;
  document.getElementById('progressao-xp-proximo').textContent = `Próximo nível: ${xpNecessario} XP`;

  const proporcao = xpNecessario > 0 ? Math.min(xpAtual / xpNecessario, 1) : 0;
  document.getElementById('progressao-xp-preenchimento').style.transform = `scaleX(${proporcao})`;
  document.getElementById('progressao-pontos-valor').textContent = String(pontos);

  renderizarAtributos(progressao.atributos, pontos);
}

/** Monta/atualiza as linhas de atributos. */
function renderizarAtributos(atributos, pontosDisponiveis) {
  const container = document.getElementById('progressao-atributos');
  if (!container) return;

  // Preserva elementos existentes para evitar piscar
  const existentes = new Map(
    [...container.querySelectorAll('[data-atributo]')].map((el) => [el.dataset.atributo, el]),
  );

  const fragment = document.createDocumentFragment();

  for (const nome of ATRIBUTOS_ORDEM) {
    let linha = existentes.get(nome);
    if (!linha) {
      linha = document.createElement('div');
      linha.className = 'progressao-atributo-linha';
      linha.dataset.atributo = nome;

      const rotulo = document.createElement('span');
      rotulo.className = 'progressao-atributo-rotulo';

      const valor = document.createElement('span');
      valor.className = 'progressao-atributo-valor';

      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'progressao-atributo-aumentar';
      botao.textContent = '+';
      botao.addEventListener('click', () => aumentarAtributo(nome));

      linha.append(rotulo, valor, botao);
    }

    const valorAtual = atributos?.[nome] ?? 1;
    linha.querySelector('.progressao-atributo-rotulo').textContent = ATRIBUTOS_ROTULOS[nome];
    linha.querySelector('.progressao-atributo-valor').textContent = String(valorAtual);

    const botao = linha.querySelector('.progressao-atributo-aumentar');
    botao.disabled = !pontosDisponiveis || pontosDisponiveis < 1;

    fragment.append(linha);
  }

  container.replaceChildren(fragment);
}

/** Aumenta um atributo via IPC (gasta 1 ponto). */
async function aumentarAtributo(nome) {
  if (!jogadorAtual || !progressaoAtual) return;
  if (progressaoAtual.pontosDisponiveis < 1) return;

  try {
    const resultado = await window.pulso.progressao.aumentarAtributo(nome);
    if (resultado.ok && resultado.progressao) {
      progressaoAtual = resultado.progressao;
      renderizarProgressao(resultado.progressao);
      if (resultado.subiuNivel) {
        exibirLevelUp(resultado.progressao);
      }
    } else if (resultado.mensagem) {
      console.warn(`PULSO: não foi possível aumentar ${nome} — ${resultado.mensagem}`);
    }
  } catch (erro) {
    console.error(`PULSO: falha ao aumentar atributo — ${erro.message}`, erro);
  }
}

/** Concede XP via IPC (apenas para testes nesta fase). */
async function adicionarXpTeste(quantidade) {
  if (!jogadorAtual) return;
  try {
    const resultado = await window.pulso.progressao.adicionarXp(quantidade);
    if (resultado.ok && resultado.progressao) {
      progressaoAtual = resultado.progressao;
      renderizarProgressao(resultado.progressao);
      if (resultado.subiuNivel) {
        exibirLevelUp(resultado.progressao);
      }
    }
  } catch (erro) {
    console.error(`PULSO: falha ao adicionar XP — ${erro.message}`, erro);
  }
}

/** Exibe feedback visual de level up. */
function exibirLevelUp(progressao) {
  console.log(`PULSO: LEVEL UP! Nível ${progressao.nível} — +${progressao.pontosDisponiveis} ponto(s)`);
  // Feedback visual simples via console; modal/banner em fase de polimento
}

/** Maps de elementos do DOM, populados no mapearElementos(). */
const ELEMENTOS_PROGRESSAO = [
  'progressao-nivel-valor',
  'progressao-xp-rotulo',
  'progressao-xp-proximo',
  'progressao-xp-preenchimento',
  'progressao-pontos-valor',
  'progressao-atributos',
  'botao-teste-xp',
];

/** Mostra o painel de navegação e a visão de progressão se o jogador existir. */
function elementosNavegacao() {
  return ['navegacao', 'visao-progressao'];
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
    // Revela a navegação e a visão de progressão
    for (const id of elementosNavegacao()) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('oculto');
    }
    carregarStatus();
    carregarMissoes();
    carregarProgressao();
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
  // Progressão (Fase 06) — XP de teste apenas para validar a infraestrutura
  elementos.botaoTesteXp.addEventListener('click', () => adicionarXpTeste(100));
  elementos.botaoTesteStatus.addEventListener('click', () => {
    alterarStatus('energia', -10);
    alterarStatus('foco', -5);
    alterarStatus('estresse', 8);
    alterarStatus('criatividade', -3);
  });
  // Missões (Fase 05)
  elementos.botaoNovaMissao.addEventListener('click', () => exibirFormularioMissao());
  elementos.filtrosMissao.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-filtro]');
    if (!botao) return;
    filtroAtual = botao.dataset.filtro;
    for (const b of elementos.filtrosMissao.querySelectorAll('[data-filtro]')) {
      b.classList.toggle('ativo', b === botao);
    }
    renderizarMissoes();
  });
  elementos.botaoSalvarMissao.addEventListener('click', salvarMissao);
  elementos.formularioMissao.addEventListener('submit', salvarMissao);
  elementos.botaoCancelarMissao.addEventListener('click', () => {
    if (missaoAtualId) {
      visualizarMissao(missaoAtualId);
    } else {
      exibirVisaoMissao('visao-missoes');
    }
  });
  elementos.missaoVoltar.addEventListener('click', () => exibirVisaoMissao('visao-missoes'));
  elementos.missaoIniciar.addEventListener('click', iniciarMissao);
  elementos.missaoConcluir.addEventListener('click', concluirMissao);
  elementos.missaoCancelar.addEventListener('click', cancelarMissao);
  elementos.missaoExcluir.addEventListener('click', excluirMissao);
  iniciar();
});
