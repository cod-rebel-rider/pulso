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
// Progressão (Fase 06)
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
let progressaoAtual = null;
// Missões (Fase 05)
let missoesCarregadas = [];
let filtroAtual = 'todas';
let missaoAtualId = null;
let modoEdicaoMissao = false;
// Projetos (Fase 07)
let projetosCarregados = [];
let filtroProjetoAtual = 'todos';
let projetoAtualId = null;
let modoEdicaoProjeto = false;
// Finanças (Fase 08)
let financaConfig = null;
let transacoesCarregadas = [];
let filtroFinancaAtual = 'todas';
let categoriaFiltroFinanca = '';
let transacaoAtualId = null;
let modoEdicaoTransacao = false;
let exclusaoTransacaoArmada = false;
let orcamentoAtualId = null;
let modoEdicaoOrcamento = false;
let exclusaoOrcamentoArmada = false;
let orcamentosCarregadosParaEdicao = [];

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
  elementos.visaoMissao = consultar('visao-missao');
  elementos.visaoMissoes = consultar('visao-missoes');
  elementos.visaoFormularioMissao = consultar('visao-formulario-missao');
  elementos.missaoTitulo = consultar('missao-título');
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
  elementos.missaoPainel = consultar('missao-painel');
  elementos.missoesPainel = consultar('missoes-painel');
  elementos.filtrosMissao = consultar('filtros-missao');
  elementos.botaoNovaMissao = consultar('botao-nova-missao');
  elementos.avisoMissoes = consultar('aviso-missoes');
  elementos.listaMissoes = consultar('lista-missoes');
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
  elementos.progressaoPainel = consultar('progressao-painel');
  elementos.progressaoNivel = consultar('progressao-nivel');
  elementos.progressaoXpTexto = consultar('progressao-xp-texto');
  elementos.progressaoPreenchimento = consultar('progressao-preenchimento');
  elementos.progressaoProximo = consultar('progressao-proximo');
  elementos.progressaoPontos = consultar('progressao-pontos');
  elementos.atributosLista = consultar('atributos-lista');
  elementos.botaoTesteXp = consultar('botao-teste-xp');
  elementos.avisoProgressao = consultar('aviso-progressao');
  elementos.botaoVerMissoes = consultar('botao-ver-missoes');
  // Projetos (Fase 07)
  elementos.visaoProjetos = consultar('visao-projetos');
  elementos.visaoProjeto = consultar('visao-projeto');
  elementos.visaoFormularioProjeto = consultar('visao-formulario-projeto');
  elementos.filtrosProjeto = consultar('filtros-projeto');
  elementos.botaoNovoProjeto = consultar('botao-novo-projeto');
  elementos.avisoProjetos = consultar('aviso-projetos');
  elementos.listaProjetos = consultar('lista-projetos');
  elementos.projetosPainel = consultar('projetos-painel');
  elementos.botaoVerProjetos = consultar('botao-ver-projetos');
  elementos.projetoTitulo = consultar('projeto-titulo');
  elementos.projetoDescricao = consultar('projeto-descricao');
  elementos.projetoEstado = consultar('projeto-estado');
  elementos.projetoPrioridade = consultar('projeto-prioridade');
  elementos.projetoPrazo = consultar('projeto-prazo');
  elementos.projetoProgresso = consultar('projeto-progresso');
  elementos.avisoProjeto = consultar('aviso-projeto');
  elementos.projetoPronta = consultar('projeto-pronta');
  elementos.projetoMissoes = consultar('projeto-missoes');
  elementos.acoesProjeto = consultar('acoes-projeto');
  elementos.projetoAssociar = consultar('projeto-associar-missao');
  elementos.projetoEditar = consultar('projeto-editar');
  elementos.projetoIniciar = consultar('projeto-iniciar');
  elementos.projetoConcluir = consultar('projeto-concluir');
  elementos.projetoCancelar = consultar('projeto-cancelar');
  elementos.projetoArquivar = consultar('projeto-arquivar');
  elementos.projetoVoltar = consultar('projeto-voltar');
  elementos.projetoPicker = consultar('projeto-missao-picker');
  elementos.projetoPickerOpcoes = consultar('projeto-missao-opcoes');
  elementos.projetoFecharPicker = consultar('projeto-fechar-picker');
  elementos.formularioProjeto = consultar('formulario-projeto');
  elementos.formularioProjetoTitulo = consultar('formulario-projeto-titulo');
  elementos.campoProjetoTitulo = consultar('campo-projeto-titulo');
  elementos.campoProjetoDescricao = consultar('campo-projeto-descricao');
  elementos.campoProjetoPrioridade = consultar('campo-projeto-prioridade');
  elementos.campoProjetoPrazo = consultar('campo-projeto-prazo');
  elementos.avisoFormularioProjeto = consultar('aviso-formulario-projeto');
  elementos.botaoSalvarProjeto = consultar('botao-salvar-projeto');
  elementos.botaoCancelarProjeto = consultar('botao-cancelar-projeto');
  // Finanças (Fase 08)
  elementos.botaoVerFinancas = consultar('botao-ver-financas');
  elementos.visaoFinancas = consultar('visao-financas');
  elementos.visaoFormularioTransacao = consultar('visao-formulario-transacao');
  elementos.visaoFormularioOrcamento = consultar('visao-formulario-orcamento');
  elementos.financaCarteiraNome = consultar('financa-carteira-nome');
  elementos.financaSaldo = consultar('financa-saldo');
  elementos.financaReceitas = consultar('financa-receitas');
  elementos.financaDespesas = consultar('financa-despesas');
  elementos.avisoFinancas = consultar('aviso-financas');
  elementos.listaOrcamentos = consultar('lista-orcamentos');
  elementos.filtrosFinanca = consultar('filtros-financa');
  elementos.filtroCategoriaFinanca = consultar('filtro-categoria-financa');
  elementos.listaTransacoes = consultar('lista-transacoes');
  elementos.botaoNovaTransacao = consultar('botao-nova-transacao');
  elementos.botaoNovoOrcamento = consultar('botao-novo-orcamento');
  elementos.financasPainel = consultar('financas-painel');
  elementos.formularioTransacaoTituloSecao = consultar('formulario-transacao-titulo-secao');
  elementos.formularioTransacaoTitulo = consultar('formulario-transacao-titulo');
  elementos.campoTransacaoTipo = consultar('campo-transacao-tipo');
  elementos.campoTransacaoValor = consultar('campo-transacao-valor');
  elementos.campoTransacaoCategoria = consultar('campo-transacao-categoria');
  elementos.campoTransacaoDescricao = consultar('campo-transacao-descricao');
  elementos.campoTransacaoData = consultar('campo-transacao-data');
  elementos.avisoFormularioTransacao = consultar('aviso-formulario-transacao');
  elementos.formularioTransacao = consultar('formulario-transacao');
  elementos.botaoSalvarTransacao = consultar('botao-salvar-transacao');
  elementos.botaoExcluirTransacao = consultar('botao-excluir-transacao');
  elementos.botaoCancelarTransacao = consultar('botao-cancelar-transacao');
  elementos.formularioOrcamentoTituloSecao = consultar('formulario-orcamento-titulo-secao');
  elementos.formularioOrcamentoTitulo = consultar('formulario-orcamento-titulo');
  elementos.campoOrcamentoCategoria = consultar('campo-orcamento-categoria');
  elementos.campoOrcamentoNome = consultar('campo-orcamento-nome');
  elementos.campoOrcamentoValor = consultar('campo-orcamento-valor');
  elementos.campoOrcamentoInicio = consultar('campo-orcamento-inicio');
  elementos.campoOrcamentoFim = consultar('campo-orcamento-fim');
  elementos.avisoFormularioOrcamento = consultar('aviso-formulario-orcamento');
  elementos.formularioOrcamento = consultar('formulario-orcamento');
  elementos.botaoSalvarOrcamento = consultar('botao-salvar-orcamento');
  elementos.botaoExcluirOrcamento = consultar('botao-excluir-orcamento');
  elementos.botaoCancelarOrcamento = consultar('botao-cancelar-orcamento');
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

// ── Progressão (Fase 06) ────────────────────────────────────────────

async function carregarProgressao() {
  if (!jogadorAtual) return;
  try {
    const resultado = await window.pulso.progressao.obter(jogadorAtual.id);
    if (resultado.ok && resultado.progressao) {
      progressaoAtual = resultado.progressao;
      renderizarProgressao(progressaoAtual);
    }
  } catch (erro) {
    console.error(`PULSO: falha ao carregar progressão — ${erro.message}`, erro);
  }
}

function renderizarProgressao(progressao) {
  elementos.progressaoNivel.textContent = `NÍVEL ${progressao.nivel}`;
  elementos.progressaoXpTexto.textContent = `${progressao.xpNoNivel} / ${progressao.xpNecessario} XP`;
  elementos.progressaoPreenchimento.style.width = `${Math.round(progressao.progresso * 100)}%`;
  elementos.progressaoProximo.textContent = `Próximo nível: ${progressao.xpNecessario - progressao.xpNoNivel} XP`;
  elementos.progressaoPontos.textContent = `Pontos de atributo disponíveis: ${progressao.pontosDisponiveis}`;
  elementos.atributosLista.replaceChildren();
  for (const nome of ATRIBUTOS_ORDEM) {
    elementos.atributosLista.append(criarLinhaAtributo(nome, progressao));
  }
}

function criarLinhaAtributo(nome, progressao) {
  const linha = document.createElement('div');
  linha.className = 'atributo-linha';
  const rotulo = document.createElement('span');
  rotulo.className = 'atributo-nome';
  rotulo.textContent = ATRIBUTOS_ROTULOS[nome] ?? nome;
  const valor = document.createElement('span');
  valor.className = 'atributo-valor';
  valor.textContent = String(progressao.atributos[nome]);
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'botao-atributo';
  botao.textContent = '+1';
  botao.disabled = progressao.pontosDisponiveis <= 0;
  botao.setAttribute('aria-label', `Aumentar ${ATRIBUTOS_ROTULOS[nome] ?? nome}`);
  botao.addEventListener('click', () => aumentarAtributo(nome));
  linha.append(rotulo, valor, botao);
  return linha;
}

async function simularXp() {
  if (!jogadorAtual) return;
  elementos.avisoProgressao.textContent = '';
  try {
    const resultado = await window.pulso.progressao.adicionarXp(jogadorAtual.id, 50);
    if (!resultado.ok) {
      elementos.avisoProgressao.textContent = resultado.mensagem ?? 'Não foi possível adicionar XP.';
      return;
    }
    progressaoAtual = resultado.progressao;
    renderizarProgressao(progressaoAtual);
    if (resultado.progressao.subiuNivel) {
      exibirLevelUp(resultado.progressao);
    }
  } catch (erro) {
    elementos.avisoProgressao.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao simular XP — ${erro.message}`, erro);
  }
}

async function aumentarAtributo(nome) {
  if (!jogadorAtual) return;
  elementos.avisoProgressao.textContent = '';
  try {
    const resultado = await window.pulso.progressao.aumentarAtributo(jogadorAtual.id, nome, 1);
    if (!resultado.ok) {
      elementos.avisoProgressao.textContent = resultado.mensagem ?? 'Não foi possível aumentar o atributo.';
      return;
    }
    progressaoAtual = resultado.progressao;
    renderizarProgressao(progressaoAtual);
  } catch (erro) {
    elementos.avisoProgressao.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao aumentar atributo — ${erro.message}`, erro);
  }
}

function exibirLevelUp(progressao) {
  const fundo = document.createElement('div');
  fundo.className = 'levelup-fundo';
  fundo.setAttribute('role', 'alertdialog');
  const painel = document.createElement('div');
  painel.className = 'levelup-painel';
  const titulo = document.createElement('p');
  titulo.className = 'levelup-titulo';
  titulo.textContent = 'LEVEL UP';
  const nivel = document.createElement('p');
  nivel.className = 'levelup-nivel';
  nivel.textContent = `NÍVEL ${progressao.nivel}`;
  const pontos = document.createElement('p');
  pontos.className = 'levelup-pontos';
  pontos.textContent = `+${progressao.niveisGanhos} PONTO(S) DE ATRIBUTO`;
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.textContent = 'CONTINUAR';
  botao.addEventListener('click', () => fundo.remove());
  painel.append(titulo, nivel, pontos, botao);
  fundo.append(painel);
  document.body.append(fundo);
  botao.focus();
}

// ── Projetos (Fase 07) ───────────────────────────────────────────────

/** Carrega os projetos do jogador via IPC e renderiza a lista. */
async function carregarProjetos() {
  if (!jogadorAtual) return;
  try {
    const resultado = await window.pulso.projeto.listar(jogadorAtual.id);
    if (resultado.ok) {
      projetosCarregados = resultado.projetos || [];
      renderizarProjetos();
    }
  } catch (erro) {
    console.error(`PULSO: falha ao carregar projetos — ${erro.message}`, erro);
  }
}

/** Renderiza a lista de projetos conforme o filtro ativo. */
function renderizarProjetos() {
  const filtrados = filtrarProjetos(projetosCarregados, filtroProjetoAtual);
  elementos.listaProjetos.replaceChildren();

  if (filtrados.length === 0) {
    elementos.avisoProjetos.textContent = 'Nenhum projeto encontrado.';
    elementos.avisoProjetos.classList.remove('oculto');
    return;
  }

  elementos.avisoProjetos.classList.add('oculto');
  for (const projeto of filtrados) {
    elementos.listaProjetos.append(criarItemProjeto(projeto));
  }
}

function filtrarProjetos(projetos, filtro) {
  if (filtro === 'todos') return projetos;
  return projetos.filter((p) => p.estado === filtro);
}

/** Cria o cartão de projeto na lista. */
function criarItemProjeto(projeto) {
  const card = document.createElement('button');
  card.className = 'missao-card';
  card.dataset.id = String(projeto.id);
  card.onclick = () => visualizarProjeto(projeto.id);

  const info = document.createElement('div');
  info.className = 'missao-info';

  const titulo = document.createElement('span');
  titulo.className = 'missao-card-titulo';
  titulo.textContent = projeto.titulo;

  const barra = document.createElement('div');
  barra.className = 'progressao-barra projeto-barra';
  const preenchimento = document.createElement('span');
  preenchimento.className = 'progressao-preenchimento';
  preenchimento.style.width = `${projeto.progresso}%`;
  barra.append(preenchimento);

  const detalhes = document.createElement('div');
  detalhes.className = 'missao-card-detalhes';

  const estado = document.createElement('span');
  estado.className = `missao-estado projeto-estado-${projeto.estado}`;
  estado.textContent = rotuloEstadoProjeto(projeto.estado);

  const prioridade = document.createElement('span');
  prioridade.className = `missao-prioridade prioridade-${projeto.prioridade}`;
  prioridade.textContent = rotuloPrioridade(projeto.prioridade);

  const progressoTexto = document.createElement('span');
  progressoTexto.className = 'projeto-progresso-texto';
  progressoTexto.textContent = `${projeto.progresso}%`;

  detalhes.append(estado, prioridade, progressoTexto);
  info.append(titulo, barra, detalhes);
  card.append(info);
  return card;
}

function rotuloEstadoProjeto(estado) {
  const rotulos = {
    planejado: 'Planejado',
    em_andamento: 'Em andamento',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
    arquivado: 'Arquivado',
  };
  return rotulos[estado] ?? estado;
}

/** Abre os detalhes de um projeto. */
async function visualizarProjeto(id) {
  try {
    const resultado = await window.pulso.projeto.obter(id);
    if (!resultado.ok || !resultado.projeto) {
      console.warn(`PULSO: projeto ${id} não encontrado`);
      return;
    }
    projetoAtualId = id;
    exibirDetalhesProjeto(resultado.projeto);
  } catch (erro) {
    console.error(`PULSO: falha ao obter projeto — ${erro.message}`, erro);
  }
}

/** Renderiza os detalhes de um projeto. */
function exibirDetalhesProjeto(projeto) {
  elementos.projetoTitulo.textContent = projeto.titulo;
  elementos.projetoDescricao.textContent = projeto.descricao || '—';
  elementos.projetoEstado.textContent = rotuloEstadoProjeto(projeto.estado);
  if (projeto.atrasado) {
    elementos.projetoPrazo.textContent = `${projeto.prazo ? formatarData(projeto.prazo) : '—'} — ATRASADO`;
    elementos.projetoEstado.classList.add('atrasado');
  } else {
    elementos.projetoPrazo.textContent = projeto.prazo ? formatarData(projeto.prazo) : 'Sem prazo';
    elementos.projetoEstado.classList.remove('atrasado');
  }
  elementos.projetoPrioridade.textContent = rotuloPrioridade(projeto.prioridade);
  elementos.projetoProgresso.textContent = `${projeto.progresso}%`;

  elementos.projetoPronta.classList.toggle('oculto', !projeto.prontaParaEncerrar);

  elementos.projetoMissoes.replaceChildren();
  if (projeto.missoes.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'missoes-vazio';
    vazio.textContent = 'Nenhuma missão associada.';
    elementos.projetoMissoes.append(vazio);
  } else {
    for (const missao of projeto.missoes) {
      elementos.projetoMissoes.append(criarItemMissaoProjeto(missao));
    }
  }

  atualizarAcoesProjeto(projeto.estado);
  exibirVisaoProjeto('visao-projeto');
}

/** Cria o item de missão dentro do projeto. */
function criarItemMissaoProjeto(missao) {
  const item = document.createElement('button');
  item.className = `missao-item missao-item-projeto estado-${missao.estado}`;
  item.onclick = () => abrirMissaoNoProjeto(missao.id);

  const marcador = document.createElement('span');
  marcador.className = 'projeto-missao-marcador';
  marcador.textContent = missao.estado === 'concluida' ? '[✓]' : '[ ]';

  const titulo = document.createElement('span');
  titulo.className = 'missao-item-titulo';
  titulo.textContent = missao.titulo;

  const estado = document.createElement('span');
  estado.className = 'missao-item-estado';
  estado.textContent = rotuloEstado(missao.estado);

  item.append(marcador, titulo, estado);
  return item;
}

/** Exibe a missão (reutiliza a visão de detalhes da FASE 05). */
function abrirMissaoNoProjeto(id) {
  visualizarMissao(id);
}

/** Configura os botões de ação conforme o estado. */
function atualizarAcoesProjeto(estado) {
  const ativo = ['planejado', 'em_andamento'].includes(estado);
  elementos.projetoAssociar.disabled = !ativo;
  elementos.projetoEditar.disabled = !ativo;
  elementos.projetoIniciar.classList.toggle('oculto', estado !== 'planejado');
  elementos.projetoConcluir.classList.toggle('oculto', estado !== 'em_andamento');
  elementos.projetoCancelar.classList.toggle('oculto', !ativo);
  elementos.projetoArquivar.classList.toggle('oculto', estado === 'arquivado');
}

/** Exibe o formulário de projeto (criação ou edição). */
function exibirFormularioProjeto({ modo, projeto = null } = {}) {
  modoEdicaoProjeto = modo === 'edicao';
  elementos.formularioProjetoTitulo.textContent = modoEdicaoProjeto ? 'EDITAR PROJETO' : 'NOVO PROJETO';
  elementos.campoProjetoTitulo.value = modoEdicaoProjeto ? projeto.titulo : '';
  elementos.campoProjetoDescricao.value = modoEdicaoProjeto ? (projeto.descricao || '') : '';
  elementos.campoProjetoPrioridade.value = modoEdicaoProjeto ? projeto.prioridade : 'normal';
  elementos.campoProjetoPrazo.value = modoEdicaoProjeto && projeto.prazo ? projeto.prazo.slice(0, 16) : '';
  elementos.avisoFormularioProjeto.textContent = '';
  exibirVisaoProjeto('visao-formulario-projeto');
}

/** Alterna entre as visões de projetos (lista ↔ detalhe ↔ formulário). */
function exibirVisaoProjeto(nome) {
  exibirVisao(nome);
  elementos.visaoProjetos.classList.toggle('oculto', nome !== 'visao-projetos');
  elementos.visaoProjeto.classList.toggle('oculto', nome !== 'visao-projeto');
  elementos.visaoFormularioProjeto.classList.toggle('oculto', nome !== 'visao-formulario-projeto');
}

/** Exibe o seletor de missões (apenas missões sem projeto). */
async function abrirPickerMissao() {
  if (!projetoAtualId) return;
  elementos.projetoPickerOpcoes.replaceChildren();
  const resultado = await window.pulso.missao.listar(jogadorAtual.id);
  if (!resultado.ok) return;
  const disponiveis = (resultado.missoes || []).filter((m) => !m.projetoId);
  if (disponiveis.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'missoes-vazio';
    vazio.textContent = 'Nenhuma missão disponível (sem projeto).';
    elementos.projetoPickerOpcoes.append(vazio);
  } else {
    for (const missao of disponiveis) {
      const opcao = document.createElement('button');
      opcao.className = 'missao-item';
      opcao.textContent = missao.titulo;
      opcao.onclick = () => associarMissao(projetoAtualId, missao.id);
      elementos.projetoPickerOpcoes.append(opcao);
    }
  }
  elementos.projetoPicker.classList.remove('oculto');
}

function fecharPickerMissao() {
  elementos.projetoPicker.classList.add('oculto');
}

async function associarMissao(projetoId, missaoId) {
  elementos.avisoProjeto.textContent = '';
  try {
    const res = await window.pulso.projeto.associarMissao(projetoId, missaoId);
    if (!res.ok || !res.projeto) {
      elementos.avisoProjeto.textContent = res.mensagem ?? 'Não foi possível associar a missão.';
      return;
    }
    fecharPickerMissao();
    exibirDetalhesProjeto(res.projeto);
  } catch (erro) {
    elementos.avisoProjeto.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao associar missão — ${erro.message}`, erro);
  }
}

/** Executa uma ação de estado do projeto. */
async function acaoProjeto(acao) {
  if (!projetoAtualId) return;
  elementos.avisoProjeto.textContent = '';
  const chamadas = {
    iniciar: () => window.pulso.projeto.iniciar(projetoAtualId),
    concluir: () => window.pulso.projeto.concluir(projetoAtualId),
    cancelar: () => window.pulso.projeto.cancelar(projetoAtualId),
    arquivar: () => window.pulso.projeto.arquivar(projetoAtualId),
  };
  try {
    const resultado = await chamadas[acao]();
    if (!resultado.ok) {
      elementos.avisoProjeto.textContent = resultado.mensagem ?? 'Operação não permitida.';
      return;
    }
    exibirDetalhesProjeto(resultado.projeto);
    await carregarProjetos();
  } catch (erro) {
    elementos.avisoProjeto.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha em ação de projeto — ${erro.message}`, erro);
  }
}

/** Salva (cria ou edita) o projeto. */
async function salvarProjeto() {
  const dados = {
    titulo: elementos.campoProjetoTitulo.value,
    descricao: elementos.campoProjetoDescricao.value,
    prioridade: elementos.campoProjetoPrioridade.value,
    prazo: converterPrazoLocal(elementos.campoProjetoPrazo.value),
  };
  elementos.avisoFormularioProjeto.textContent = '';
  try {
    const resultado = modoEdicaoProjeto
      ? await window.pulso.projeto.atualizar({ id: projetoAtualId, ...dados })
      : await window.pulso.projeto.criar({ jogadorId: jogadorAtual.id, ...dados });
    if (!resultado.ok) {
      elementos.avisoFormularioProjeto.textContent = resultado.mensagem ?? 'Não foi possível salvar o projeto.';
      return;
    }
    projetoAtualId = resultado.projeto.id;
    await carregarProjetos();
    exibirDetalhesProjeto(resultado.projeto);
  } catch (erro) {
    elementos.avisoFormularioProjeto.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao salvar projeto — ${erro.message}`, erro);
  }
}

/** Converte valor datetime-local para ISO ou null. */
function converterPrazoLocal(valor) {
  if (!valor) return null;
  return new Date(valor).toISOString();
}

// ── Finanças (Fase 08) ─────────────────────────────────────────────────

/** Garante o acesso à ponte financeira (a UI nunca fala com o SQL). */
function ponteFinanca() {
  if (!window.pulso || typeof window.pulso.financa?.resumo !== 'function') {
    throw new Error('A ponte window.pulso.financa não está disponível.');
  }
  return window.pulso.financa;
}

/** Formata centavos como moeda brasileira: 123456 → "R$ 1.234,56". */
function formatarCentavos(centavos) {
  return (Number(centavos ?? 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Formata uma data 'YYYY-MM-DD' (ou ISO) como dd/mm/aaaa. */
function formatarDataSimples(data) {
  if (!data) return '—';
  const dia = String(data).slice(0, 10);
  const [ano, mes, diaDoMes] = dia.split('-');
  if (!ano || !mes || !diaDoMes) return dia;
  return `${diaDoMes}/${mes}/${ano}`;
}

/** Data local de hoje no formato 'YYYY-MM-DD' (sem deslocamento de fuso). */
function dataHojeIso() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/** Primeiro/último dia do mês corrente em 'YYYY-MM-DD' (resumo do mês). */
function limitesDoMesCorrente() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const ultimoDia = new Date(ano, agora.getMonth() + 1, 0).getDate();
  return {
    inicio: `${ano}-${mes}-01`,
    fim: `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

/** Lê o campo de valor digitado ("1.250,75" / "1250.75") → centavos (inteiros). */
function lerCentavos(texto) {
  const limpo = String(texto ?? '').trim();
  if (!limpo) return null;
  const normalizado = limpo.includes(',') && limpo.includes('.')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  const [reais, centavos = ''] = normalizado.split('.');
  return Number(reais) * 100 + Number((centavos + '00').slice(0, 2));
}

/** Rótulo da categoria via config carregada do núcleo (fonte única). */
function rotuloCategoria(codigo) {
  const todas = [
    ...(financaConfig?.categoriasReceita ?? []),
    ...(financaConfig?.categoriasDespesa ?? []),
  ];
  return todas.find((c) => c.valor === codigo)?.rotulo ?? codigo;
}

/** Alterna entre as visões de finanças (lista ↔ transação ↔ orçamento). */
function exibirVisaoFinanca(nome) {
  exibirVisao(nome);
  elementos.visaoFinancas.classList.toggle('oculto', nome !== 'visao-financas');
  elementos.visaoFormularioTransacao.classList.toggle('oculto', nome !== 'visao-formulario-transacao');
  elementos.visaoFormularioOrcamento.classList.toggle('oculto', nome !== 'visao-formulario-orcamento');
}

/** Vai para a tela financeira (carrega resumo, orçamentos e histórico). */
function irParaFinancas() {
  exibirVisaoFinanca('visao-financas');
  carregarFinancas();
}

/** Volta ao painel principal. */
function voltarAoPainelFinancas() {
  exibirVisao('visao-boot');
}

/** Popula um <select> de categorias de um tipo (fonte: config do núcleo). */
function preencherCategorias(select, tipo, selecionada = '') {
  const lista = tipo === 'receita'
    ? (financaConfig?.categoriasReceita ?? [])
    : (financaConfig?.categoriasDespesa ?? []);
  select.replaceChildren(...lista.map((c) => {
    const opcao = document.createElement('option');
    opcao.value = c.valor;
    opcao.textContent = c.rotulo;
    return opcao;
  }));
  if (selecionada) select.value = selecionada;
}

/** Popula o filtro de categorias do histórico com TODAS as categorias. */
function preencherFiltroCategoria() {
  const todas = [
    ...(financaConfig?.categoriasDespesa ?? []),
    ...(financaConfig?.categoriasReceita ?? []),
  ];
  elementos.filtroCategoriaFinanca.replaceChildren(
    ...[...todas].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')).map((c) => {
      const opcao = document.createElement('option');
      opcao.value = c.valor;
      opcao.textContent = c.rotulo;
      return opcao;
    }),
  );
  elementos.filtroCategoriaFinanca.insertBefore(new Option('TODAS AS CATEGORIAS', ''), 0);
  elementos.filtroCategoriaFinanca.value = categoriaFiltroFinanca;
}

/** Carrega resumo + orçamentos + histórico do jogador. */
async function carregarFinancas() {
  if (!jogadorAtual) return;
  elementos.avisoFinancas.textContent = '';
  try {
    const ponte = ponteFinanca();
    const limites = limitesDoMesCorrente();
    const resumo = await ponte.resumo(jogadorAtual.id, limites);
    if (!resumo.ok) {
      elementos.avisoFinancas.textContent = resumo.mensagem ?? 'Não foi possível carregar as finanças.';
      return;
    }
    financaConfig = resumo.config;
    elementos.financaCarteiraNome.textContent = (resumo.carteira?.nome ?? 'CARTEIRA').toUpperCase();
    const saldo = resumo.saldo ?? 0;
    elementos.financaSaldo.textContent = formatarCentavos(saldo);
    elementos.financaSaldo.classList.toggle('financa-negativo', saldo < 0);
    elementos.financaReceitas.textContent = formatarCentavos(resumo.receitas ?? 0);
    elementos.financaDespesas.textContent = formatarCentavos(resumo.despesas ?? 0);

    orcamentosCarregadosParaEdicao = resumo.orcamentos ?? [];
    renderizarOrcamentos(orcamentosCarregadosParaEdicao);
    preencherFiltroCategoria();
    await carregarTransacoes();
  } catch (erro) {
    elementos.avisoFinancas.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao carregar finanças — ${erro.message}`, erro);
  }
}

/** Renderiza a lista de orçamentos com a situação calculada pelo núcleo. */
function renderizarOrcamentos(orcamentos) {
  elementos.listaOrcamentos.replaceChildren();
  if (orcamentos.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'missoes-vazio';
    vazio.textContent = 'Nenhum orçamento definido.';
    elementos.listaOrcamentos.append(vazio);
    return;
  }
  for (const orcamento of orcamentos) {
    elementos.listaOrcamentos.append(criarItemOrcamento(orcamento));
  }
}

/** Cria o cartão de um orçamento (limite, gasto, disponível, estado). */
function criarItemOrcamento(orcamento) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'orcamento-item';
  item.onclick = () => editarOrcamento(orcamento.id);

  const cabecalho = document.createElement('span');
  cabecalho.className = 'orcamento-categoria';
  cabecalho.textContent = rotuloCategoria(orcamento.categoria);

  const valores = document.createElement('span');
  valores.className = 'orcamento-valores';
  valores.textContent = `${formatarCentavos(orcamento.situacao.gasto)} / ${formatarCentavos(orcamento.valorCentavos)}`;

  const situacao = document.createElement('span');
  situacao.className = `orcamento-situacao ${orcamento.situacao.estourado ? 'estourado' : 'ok'}`;
  situacao.textContent = orcamento.situacao.estourado
    ? `ESTOURADO ${formatarCentavos(orcamento.situacao.disponivel)}`
    : `DISPONÍVEL ${formatarCentavos(orcamento.situacao.disponivel)}`;

  const barra = document.createElement('span');
  barra.className = 'orcamento-barra';
  const preenchimento = document.createElement('span');
  preenchimento.className = 'orcamento-barra-preenchimento';
  if (orcamento.situacao.estourado) preenchimento.classList.add('estourado');
  preenchimento.style.width = `${Math.min(100, Math.round(orcamento.situacao.percentual * 100))}%`;
  barra.append(preenchimento);

  const periodo = document.createElement('span');
  periodo.className = 'missao-prazo';
  periodo.textContent = `${formatarDataSimples(orcamento.inicio)} → ${formatarDataSimples(orcamento.fim)}`;

  item.append(cabecalho, valores, situacao, barra, periodo);
  return item;
}

/** Carrega o histórico conforme os filtros ativos (consulta no núcleo). */
async function carregarTransacoes() {
  if (!jogadorAtual) return;
  try {
    const ponte = ponteFinanca();
    const resultado = await ponte.listarTransacoes(jogadorAtual.id, {
      tipo: filtroFinancaAtual === 'todas' ? null : filtroFinancaAtual,
      categoria: categoriaFiltroFinanca || null,
    });
    if (!resultado.ok) {
      elementos.avisoFinancas.textContent = resultado.mensagem ?? 'Não foi possível carregar o histórico.';
      return;
    }
    transacoesCarregadas = resultado.transacoes ?? [];
    renderizarTransacoes();
  } catch (erro) {
    console.error(`PULSO: falha ao carregar transações — ${erro.message}`, erro);
  }
}

/** Renderiza o histórico (mais recente primeiro — ordenado pelo núcleo). */
function renderizarTransacoes() {
  elementos.listaTransacoes.replaceChildren();
  if (transacoesCarregadas.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'missoes-vazio';
    vazio.textContent = 'Nenhuma movimentação registrada.';
    elementos.listaTransacoes.append(vazio);
    return;
  }
  for (const transacao of transacoesCarregadas) {
    elementos.listaTransacoes.append(criarItemTransacao(transacao));
  }
}

/** Cria o item do histórico (data, valor com sinal, descrição, categoria). */
function criarItemTransacao(transacao) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'missao-item transacao-item';
  item.dataset.id = String(transacao.id);
  item.onclick = () => abrirEdicaoTransacao(transacao.id);

  const data = document.createElement('span');
  data.className = 'missao-prazo';
  data.textContent = formatarDataSimples(transacao.ocorridaEm);

  const valor = document.createElement('span');
  valor.className = `transacao-valor ${transacao.tipo}`;
  valor.textContent = `${transacao.tipo === 'receita' ? '+' : '-'} ${formatarCentavos(transacao.valorCentavos)}`;

  const descricao = document.createElement('span');
  descricao.className = 'missao-item-titulo';
  descricao.textContent = transacao.descricao || '—';

  const categoria = document.createElement('span');
  categoria.className = 'missao-item-estado';
  categoria.textContent = rotuloCategoria(transacao.categoria);

  item.append(data, valor, descricao, categoria);
  return item;
}

/** Aplica o filtro de tipo do histórico e recarrega a consulta. */
function aplicarFiltroTipoFinanca(botao) {
  filtroFinancaAtual = botao.dataset.filtro;
  for (const b of elementos.filtrosFinanca.querySelectorAll('[data-filtro]')) {
    b.classList.toggle('ativo', b === botao);
  }
  carregarTransacoes();
}

/** Exibe o formulário de transação (criação ou edição). */
function exibirFormularioTransacao(transacao = null) {
  modoEdicaoTransacao = !!transacao;
  transacaoAtualId = transacao?.id ?? null;
  exclusaoTransacaoArmada = false;
  elementos.formularioTransacaoTituloSecao.textContent = modoEdicaoTransacao ? 'EDITAR TRANSAÇÃO' : 'NOVA TRANSAÇÃO';
  elementos.formularioTransacaoTitulo.textContent = modoEdicaoTransacao ? 'MOVER DINHEIRO' : 'REGISTRAR MOVIMENTAÇÃO';
  elementos.campoTransacaoTipo.value = modoEdicaoTransacao ? transacao.tipo : 'receita';
  elementos.campoTransacaoValor.value = modoEdicaoTransacao
    ? (transacao.valorCentavos / 100).toFixed(2).replace('.', ',')
    : '';
  preencherCategorias(
    elementos.campoTransacaoCategoria,
    elementos.campoTransacaoTipo.value,
    modoEdicaoTransacao ? transacao.categoria : '',
  );
  elementos.campoTransacaoDescricao.value = modoEdicaoTransacao ? (transacao.descricao || '') : '';
  elementos.campoTransacaoData.value = modoEdicaoTransacao ? transacao.ocorridaEm.slice(0, 10) : dataHojeIso();
  elementos.botaoExcluirTransacao.classList.toggle('oculto', !modoEdicaoTransacao);
  elementos.botaoExcluirTransacao.textContent = 'EXCLUIR';
  elementos.avisoFormularioTransacao.textContent = '';
  exibirVisaoFinanca('visao-formulario-transacao');
}

/** Troca a lista de categorias quando o tipo muda (receita ≠ despesa). */
function trocarTipoTransacao() {
  preencherCategorias(elementos.campoTransacaoCategoria, elementos.campoTransacaoTipo.value);
}

/** Salva (cria ou edita) a transação; o núcleo valida e recalcula o saldo. */
async function salvarTransacao() {
  elementos.avisoFormularioTransacao.textContent = '';
  const centavos = lerCentavos(elementos.campoTransacaoValor.value);
  if (centavos === null || centavos <= 0) {
    elementos.avisoFormularioTransacao.textContent = 'Informe um valor maior que zero (ex.: 1.250,75).';
    return;
  }
  if (!elementos.campoTransacaoData.value) {
    elementos.avisoFormularioTransacao.textContent = 'Informe a data da movimentação.';
    return;
  }
  const dados = {
    tipo: elementos.campoTransacaoTipo.value,
    valorCentavos: centavos,
    categoria: elementos.campoTransacaoCategoria.value,
    descricao: elementos.campoTransacaoDescricao.value.trim() || null,
    data: elementos.campoTransacaoData.value,
  };
  try {
    const resultado = modoEdicaoTransacao
      ? await ponteFinanca().atualizarTransacao({ id: transacaoAtualId, ...dados })
      : await ponteFinanca().criarTransacao({ jogadorId: jogadorAtual.id, ...dados });
    if (!resultado.ok) {
      elementos.avisoFormularioTransacao.textContent = resultado.mensagem ?? 'Não foi possível salvar a transação.';
      return;
    }
    transacaoAtualId = resultado.transacao?.id ?? transacaoAtualId;
    await carregarFinancas();
    exibirVisaoFinanca('visao-financas');
  } catch (erro) {
    elementos.avisoFormularioTransacao.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao salvar transação — ${erro.message}`, erro);
  }
}

/** Abre a edição a partir do id (histórico → formulário). */
function abrirEdicaoTransacao(id) {
  const atual = transacoesCarregadas.find((t) => t.id === id);
  if (atual) exibirFormularioTransacao(atual);
}

/** Exclusão controlada: primeiro clique arma, segundo confirma. */
async function excluirTransacao() {
  if (!transacaoAtualId) return;
  elementos.avisoFormularioTransacao.textContent = '';
  if (!exclusaoTransacaoArmada) {
    exclusaoTransacaoArmada = true;
    elementos.botaoExcluirTransacao.textContent = 'CONFIRMAR EXCLUSÃO';
    elementos.avisoFormularioTransacao.textContent =
      'Excluir esta transação? Ela deixará de participar do saldo. Clique novamente para confirmar.';
    return;
  }
  try {
    const resultado = await ponteFinanca().excluirTransacao(transacaoAtualId);
    if (!resultado.ok) {
      armarExclusaoTransacao(false);
      elementos.avisoFormularioTransacao.textContent = resultado.mensagem ?? 'Não foi possível excluir.';
      return;
    }
    transacaoAtualId = null;
    await carregarFinancas();
    exibirVisaoFinanca('visao-financas');
  } catch (erro) {
    armarExclusaoTransacao(false);
    elementos.avisoFormularioTransacao.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao excluir transação — ${erro.message}`, erro);
  }
}

/** Liga/desliga o estado armado do botão de exclusão de transação. */
function armarExclusaoTransacao(armado) {
  exclusaoTransacaoArmada = armado;
  elementos.botaoExcluirTransacao.textContent = armado ? 'CONFIRMAR EXCLUSÃO' : 'EXCLUIR';
}

/** Exibe o formulário de orçamento (criação ou edição). */
function exibirFormularioOrcamento(orcamento = null) {
  modoEdicaoOrcamento = !!orcamento;
  orcamentoAtualId = orcamento?.id ?? null;
  exclusaoOrcamentoArmada = false;
  elementos.formularioOrcamentoTituloSecao.textContent = modoEdicaoOrcamento ? 'EDITAR ORÇAMENTO' : 'NOVO ORÇAMENTO';
  elementos.formularioOrcamentoTitulo.textContent = modoEdicaoOrcamento ? 'REPLANEJAR GASTOS' : 'PLANEJAR GASTOS';
  preencherCategorias(
    elementos.campoOrcamentoCategoria,
    'despesa',
    modoEdicaoOrcamento ? orcamento.categoria : '',
  );
  elementos.campoOrcamentoNome.value = modoEdicaoOrcamento ? (orcamento.nome || '') : '';
  elementos.campoOrcamentoValor.value = modoEdicaoOrcamento
    ? (orcamento.valorCentavos / 100).toFixed(2).replace('.', ',')
    : '';
  elementos.campoOrcamentoInicio.value = modoEdicaoOrcamento ? orcamento.inicio.slice(0, 10) : dataHojeIso();
  elementos.campoOrcamentoFim.value = modoEdicaoOrcamento ? orcamento.fim.slice(0, 10) : '';
  elementos.botaoExcluirOrcamento.classList.toggle('oculto', !modoEdicaoOrcamento);
  elementos.botaoExcluirOrcamento.textContent = 'EXCLUIR';
  elementos.avisoFormularioOrcamento.textContent = '';
  exibirVisaoFinanca('visao-formulario-orcamento');
}

/** Abre a edição a partir do id (lista de orçamentos → formulário). */
function editarOrcamento(id) {
  const atual = (orcamentosCarregadosParaEdicao ?? []).find((o) => o.id === id)
    ?? null;
  if (atual) {
    exibirFormularioOrcamento(atual);
    return;
  }
  ponteFinanca().situacaoOrcamento(id)
    .then((resultado) => {
      if (resultado.ok) exibirFormularioOrcamento(resultado.orcamento);
    })
    .catch((erro) => {
      console.error(`PULSO: falha ao obter orçamento — ${erro.message}`, erro);
    });
}

/** Salva (cria ou edita) o orçamento; o núcleo valida categoria e período. */
async function salvarOrcamento() {
  elementos.avisoFormularioOrcamento.textContent = '';
  const centavos = lerCentavos(elementos.campoOrcamentoValor.value);
  if (centavos === null || centavos <= 0) {
    elementos.avisoFormularioOrcamento.textContent = 'Informe um limite maior que zero (ex.: 600,00).';
    return;
  }
  const inicio = elementos.campoOrcamentoInicio.value;
  const fim = elementos.campoOrcamentoFim.value;
  if (!inicio || !fim) {
    elementos.avisoFormularioOrcamento.textContent = 'Informe o período do orçamento (início e fim).';
    return;
  }
  if (fim < inicio) {
    elementos.avisoFormularioOrcamento.textContent = 'O fim do período deve ser igual ou posterior ao início.';
    return;
  }
  const dados = {
    categoria: elementos.campoOrcamentoCategoria.value,
    nome: elementos.campoOrcamentoNome.value.trim() || null,
    valorCentavos: centavos,
    inicio,
    fim,
  };
  try {
    const resultado = modoEdicaoOrcamento
      ? await ponteFinanca().atualizarOrcamento({ id: orcamentoAtualId, ...dados })
      : await ponteFinanca().criarOrcamento({ jogadorId: jogadorAtual.id, ...dados });
    if (!resultado.ok) {
      elementos.avisoFormularioOrcamento.textContent = resultado.mensagem ?? 'Não foi possível salvar o orçamento.';
      return;
    }
    orcamentoAtualId = resultado.orcamento?.id ?? orcamentoAtualId;
    await carregarFinancas();
    exibirVisaoFinanca('visao-financas');
  } catch (erro) {
    elementos.avisoFormularioOrcamento.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao salvar orçamento — ${erro.message}`, erro);
  }
}

/** Exclusão controlada de orçamento: armar → confirmar. */
async function excluirOrcamento() {
  if (!orcamentoAtualId) return;
  elementos.avisoFormularioOrcamento.textContent = '';
  if (!exclusaoOrcamentoArmada) {
    exclusaoOrcamentoArmada = true;
    elementos.botaoExcluirOrcamento.textContent = 'CONFIRMAR EXCLUSÃO';
    elementos.avisoFormularioOrcamento.textContent =
      'Excluir este orçamento? O planejamento deixará de ser acompanhado. Clique novamente para confirmar.';
    return;
  }
  try {
    const resultado = await ponteFinanca().excluirOrcamento(orcamentoAtualId);
    if (!resultado.ok) {
      armarExclusaoOrcamento(false);
      elementos.avisoFormularioOrcamento.textContent = resultado.mensagem ?? 'Não foi possível excluir.';
      return;
    }
    orcamentoAtualId = null;
    await carregarFinancas();
    exibirVisaoFinanca('visao-financas');
  } catch (erro) {
    armarExclusaoOrcamento(false);
    elementos.avisoFormularioOrcamento.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao excluir orçamento — ${erro.message}`, erro);
  }
}

/** Liga/desliga o estado armado do botão de exclusão de orçamento. */
function armarExclusaoOrcamento(armado) {
  exclusaoOrcamentoArmada = armado;
  elementos.botaoExcluirOrcamento.textContent = armado ? 'CONFIRMAR EXCLUSÃO' : 'EXCLUIR';
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
  exibirVisao(nome);
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

/** Alterna a visão visível (configuração ↔ boot ↔ missões ↔ projetos ↔ finanças). */
function exibirVisao(nomeVisao) {
  elementos.visaoConfiguracao.classList.toggle('oculto', nomeVisao !== 'visao-configuracao');
  elementos.visaoBoot.classList.toggle('oculto', nomeVisao !== 'visao-boot');

  const emMissoes = nomeVisao === 'visao-missoes'
    || nomeVisao === 'visao-missao'
    || nomeVisao === 'visao-formulario-missao';
  if (emMissoes) {
    elementos.visaoConfiguracao.classList.add('oculto');
    elementos.visaoBoot.classList.add('oculto');
  } else {
    elementos.visaoMissoes.classList.add('oculto');
    elementos.visaoMissao.classList.add('oculto');
    elementos.visaoFormularioMissao.classList.add('oculto');
  }

  const emProjetos = nomeVisao === 'visao-projetos'
    || nomeVisao === 'visao-projeto'
    || nomeVisao === 'visao-formulario-projeto';
  if (emProjetos) {
    elementos.visaoConfiguracao.classList.add('oculto');
    elementos.visaoBoot.classList.add('oculto');
  } else {
    elementos.visaoProjetos.classList.add('oculto');
    elementos.visaoProjeto.classList.add('oculto');
    elementos.visaoFormularioProjeto.classList.add('oculto');
  }

  const emFinancas = nomeVisao === 'visao-financas'
    || nomeVisao === 'visao-formulario-transacao'
    || nomeVisao === 'visao-formulario-orcamento';
  if (emFinancas) {
    elementos.visaoConfiguracao.classList.add('oculto');
    elementos.visaoBoot.classList.add('oculto');
  } else {
    elementos.visaoFinancas.classList.add('oculto');
    elementos.visaoFormularioTransacao.classList.add('oculto');
    elementos.visaoFormularioOrcamento.classList.add('oculto');
  }
}

/** Vai para a lista de projetos (esconde o painel principal). */
function irParaProjetos() {
  exibirVisaoProjeto('visao-projetos');
  carregarProjetos();
}

/** Vai para a lista de missões (esconde o painel principal). */
function irParaMissoes() {
  exibirVisaoMissao('visao-missoes');
  carregarMissoes();
}

/** Volta ao painel principal (boot com status + progressão). */
function voltarAoPainel() {
  exibirVisao('visao-boot');
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
  elementos.botaoVerMissoes.disabled = true;
  elementos.botaoVerProjetos.disabled = true;
  elementos.botaoVerFinancas.disabled = true;
  definirEstado('INICIANDO…');
  const linhas = linhasDoBoot();
  montarLinhasBoot(linhas, false);
  agendarLinhasBoot();
  montarLinhasStatus();

  const atrasoConclusao = ATRASO_INICIAL_MS + linhas.length * ATRASO_ENTRE_LINHAS_MS;
  setTimeout(() => {
    definirEstado('SISTEMA ONLINE');
    elementos.botaoEditar.disabled = false;
    elementos.botaoVerMissoes.disabled = false;
    elementos.botaoVerProjetos.disabled = false;
    elementos.botaoVerFinancas.disabled = false;
    elementos.mensagem.textContent = 'Operador identificado. Aguardando módulos…';
    carregarStatus();
    carregarProgressao();
    carregarMissoes();
    carregarProjetos();
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
    alterarStatus('energia', -10);
    alterarStatus('foco', -5);
    alterarStatus('estresse', 8);
    alterarStatus('criatividade', -3);
  });
  elementos.botaoTesteXp.classList.remove('oculto');
  elementos.botaoTesteXp.addEventListener('click', simularXp);
  elementos.botaoVerMissoes.addEventListener('click', irParaMissoes);
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
  elementos.missaoPainel.addEventListener('click', voltarAoPainel);
  elementos.missoesPainel.addEventListener('click', voltarAoPainel);
  elementos.missaoIniciar.addEventListener('click', iniciarMissao);
  elementos.missaoConcluir.addEventListener('click', concluirMissao);
  elementos.missaoCancelar.addEventListener('click', cancelarMissao);
  elementos.missaoExcluir.addEventListener('click', excluirMissao);
  // Projetos (Fase 07)
  elementos.botaoVerProjetos.addEventListener('click', irParaProjetos);
  elementos.botaoNovoProjeto.addEventListener('click', () => exibirFormularioProjeto());
  elementos.projetosPainel.addEventListener('click', voltarAoPainel);
  elementos.filtrosProjeto.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-filtro]');
    if (!botao) return;
    filtroProjetoAtual = botao.dataset.filtro;
    for (const b of elementos.filtrosProjeto.querySelectorAll('[data-filtro]')) {
      b.classList.toggle('ativo', b === botao);
    }
    renderizarProjetos();
  });
  elementos.projetoVoltar.addEventListener('click', () => {
    if (projetoAtualId) {
      exibirVisaoProjeto('visao-projetos');
      carregarProjetos();
    } else {
      voltarAoPainel();
    }
  });
  elementos.projetoAssociar.addEventListener('click', abrirPickerMissao);
  elementos.projetoFecharPicker.addEventListener('click', fecharPickerMissao);
  elementos.projetoEditar.addEventListener('click', () => {
    const projeto = projetosCarregados.find((p) => p.id === projetoAtualId);
    if (projeto) exibirFormularioProjeto({ modo: 'edicao', projeto });
  });
  elementos.projetoIniciar.addEventListener('click', () => acaoProjeto('iniciar'));
  elementos.projetoConcluir.addEventListener('click', () => acaoProjeto('concluir'));
  elementos.projetoCancelar.addEventListener('click', () => acaoProjeto('cancelar'));
  elementos.projetoArquivar.addEventListener('click', () => acaoProjeto('arquivar'));
  elementos.formularioProjeto.addEventListener('submit', (e) => {
    e.preventDefault();
    salvarProjeto();
  });
  elementos.botaoSalvarProjeto.addEventListener('click', (e) => {
    e.preventDefault();
    salvarProjeto();
  });
  elementos.botaoCancelarProjeto.addEventListener('click', () => {
    if (projetoAtualId) {
      visualizarProjeto(projetoAtualId);
    } else {
      exibirVisaoProjeto('visao-projetos');
    }
  });
  // Finanças (Fase 08)
  elementos.botaoVerFinancas.addEventListener('click', irParaFinancas);
  elementos.financasPainel.addEventListener('click', voltarAoPainelFinancas);
  elementos.filtrosFinanca.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-filtro]');
    if (!botao) return;
    aplicarFiltroTipoFinanca(botao);
  });
  elementos.filtroCategoriaFinanca.addEventListener('change', () => {
    categoriaFiltroFinanca = elementos.filtroCategoriaFinanca.value;
    carregarTransacoes();
  });
  elementos.botaoNovaTransacao.addEventListener('click', () => exibirFormularioTransacao());
  elementos.botaoNovoOrcamento.addEventListener('click', () => exibirFormularioOrcamento());
  elementos.campoTransacaoTipo.addEventListener('change', trocarTipoTransacao);
  elementos.botaoSalvarTransacao.addEventListener('click', (e) => {
    e.preventDefault();
    salvarTransacao();
  });
  elementos.formularioTransacao.addEventListener('submit', (e) => {
  // Lista de desejos / compras (Fase 09)
  elementos.botaoVerDesejos.addEventListener('click', irParaDesejos);
  elementos.desejosPainel.addEventListener('click', voltarAoPainelDesejos);
  elementos.filtrosDesejos.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-filtro]');
    if (!botao) return;
    aplicarFiltroEstadoDesejo(botao);
  });
  elementos.filtroCategoriaDesejo.addEventListener('change', () => {
    categoriaFiltroDesejo = elementos.filtroCategoriaDesejo.value;
    carregarDesejos();
  });
  elementos.botaoNovoDesejo.addEventListener('click', () => exibirFormularioDesejo());
  elementos.desejoVoltar.addEventListener('click', () => exibirVisaoDesejo('visao-desejos'));
  elementos.desejoPainel.addEventListener('click', voltarAoPainelDesejos);
  elementos.desejoEditar.addEventListener('click', () => {
    const item = itensDesejosCarregados.find((i) => i.id === desejoAtualId);
    if (item) exibirFormularioDesejo({ modo: 'edicao', item });
  });
  elementos.botaoSalvarDesejo.addEventListener('click', (e) => {
    e.preventDefault();
    salvarDesejo();
  });
  elementos.formularioDesejo.addEventListener('submit', (e) => {
    e.preventDefault();
    salvarDesejo();
  });
  elementos.botaoCancelarDesejo.addEventListener('click', () => {
    if (desejoAtualId) exibirVisaoDesejo('visao-desejos');
    else exibirVisaoDesejo('visao-desejos');
  });
  elementos.botaoCancelarOrcamento.addEventListener('click', () => {
    if (orcamentoAtualId) exibirVisaoFinanca('visao-financas');
    else exibirVisaoFinanca('visao-financas');
  });
  iniciar();
    e.preventDefault();
    salvarTransacao();
  });
  elementos.botaoExcluirTransacao.addEventListener('click', excluirTransacao);
  elementos.botaoCancelarTransacao.addEventListener('click', () => exibirVisaoFinanca('visao-financas'));
  elementos.botaoSalvarOrcamento.addEventListener('click', (e) => {
    e.preventDefault();
    salvarOrcamento();
  });
  elementos.formularioOrcamento.addEventListener('submit', (e) => {
    e.preventDefault();
    salvarOrcamento();
  });
  elementos.botaoExcluirOrcamento.addEventListener('click', excluirOrcamento);
  elementos.botaoCancelarOrcamento.addEventListener('click', () => exibirVisaoFinanca('visao-financas'));
  iniciar();
});
