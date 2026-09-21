/**
 * PULSO — Renderer: Recorrências (Fase 10.3) e Geração de Ocorrências (Fase 10.4)
 *
 * Interface das REGRAS DE REPETIÇÃO dos serviços. Nenhuma regra de negócio
 * aqui: validações, máquina de estados, cálculo de datas e idempotência
 * vivem no núcleo (dominio/recorrencia.js, dominio/geracao.js e
 * aplicacao/servico-geracao-ocorrencias.js).
 *
 * A geração (Fase 10.4) transforma a regra em CONTAS PENDENTES dentro de um
 * período — e não paga nada: não cria transação e não altera a carteira
 * (o pagamento é a Fase 10.5).
 */

const elementosRecorrencia = {};
const estadoRecorrencia = {
  config: null,
  recorrencias: [],
  servicos: [],
  servicoPorId: new Map(),
  filtroEstado: "",
  filtroServico: "",
  recorrenciaAtualId: null,
  modoEdicaoRecorrencia: false,
};

function consultarElementoRecorrencia(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento da interface ausente: #${id}`);
  return el;
}

function jogadorAtualRecorrencia() {
  return window.__pulsoJogadorAtual ?? null;
}

function ponteRecorrencia() {
  if (!window.pulso || typeof window.pulso.recorrencia?.listar !== "function") {
    throw new Error("A ponte window.pulso.recorrencia não está disponível.");
  }
  return window.pulso.recorrencia;
}

function ponteServicoRecorrencia() {
  if (!window.pulso || typeof window.pulso.servico?.listar !== "function") {
    throw new Error("A ponte window.pulso.servico não está disponível.");
  }
  return window.pulso.servico;
}

function formatarCentavosRecorrencia(centavos) {
  if (!Number.isFinite(centavos)) return "R$ 0,00";
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const inteiro = String(Math.trunc(absoluto / 100));
  const centavosStr = String(Math.trunc(absoluto % 100)).padStart(2, "0");
  const separado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-R$ " : "R$ "}${separado},${centavosStr}`;
}

function formatarCentavosParaEntradaRecorrencia(centavos) {
  return `${String(Math.trunc(centavos / 100))},${String(Math.trunc(centavos % 100)).padStart(2, "0")}`;
}

function lerCentavosRecorrencia(texto) {
  if (typeof texto !== "string") return null;
  const limpo = texto
    .replace(/\s+/g, "")
    .replace(/R\$/i, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(parseFloat(limpo) * 100);
}

function formatarDataSimplesRecorrencia(dataIso) {
  if (!dataIso) return "—";
  const partes = String(dataIso.slice(0, 10)).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(dataIso);
}

function rotuloFrequenciaRecorrencia(valor) {
  const frequencia = estadoRecorrencia.config?.frequencias?.find((f) => f.valor === valor);
  return frequencia ? frequencia.rotulo : String(valor ?? "—").toUpperCase();
}

function rotuloEstadoRecorrencia(valor) {
  const rotulos = estadoRecorrencia.config?.rotulosEstados ?? {};
  return rotulos[valor] ?? String(valor ?? "—").toUpperCase();
}

function nomeServicoRecorrencia(servicoId) {
  return estadoRecorrencia.servicoPorId.get(servicoId)?.nome ?? `Serviço ${servicoId}`;
}

// ── Navegação entre as visões de recorrência ──────────────────────────────
function exibirVisaoRecorrencia(nome) {
  for (const visao of ["visao-recorrencias", "visao-recorrencia-detalhe", "visao-formulario-recorrencia"]) {
    consultarElementoRecorrencia(visao).classList.toggle("oculto", visao !== nome);
  }
  consultarElementoRecorrencia("visao-configuracao").classList.add("oculto");
  consultarElementoRecorrencia("visao-boot").classList.add("oculto");
}

async function irParaRecorrencias() {
  exibirVisaoRecorrencia("visao-recorrencias");
  await carregarServicosDisponiveisRecorrencia();
  carregarResumoRecorrencias();
  carregarRecorrencias();
}

function voltarAoPainelRecorrencia() {
  exibirVisaoRecorrencia("visao-boot");
  consultarElementoRecorrencia("visao-boot").classList.remove("oculto");
}

// ── Mapeamento de elementos ───────────────────────────────────────────────
function mapearRecorrencias() {
  elementosRecorrencia.botaoVerRecorrencias = consultarElementoRecorrencia("botao-ver-recorrencias");
  // lista
  elementosRecorrencia.avisoRecorrencias = consultarElementoRecorrencia("aviso-recorrencias");
  elementosRecorrencia.filtrosRecorrencias = consultarElementoRecorrencia("filtros-recorrencias");
  elementosRecorrencia.filtroServicoRecorrencias = consultarElementoRecorrencia("filtro-servico-recorrencias");
  elementosRecorrencia.listaRecorrencias = consultarElementoRecorrencia("lista-recorrencias");
  elementosRecorrencia.recorrenciasAtivas = consultarElementoRecorrencia("recorrencia-ativas");
  elementosRecorrencia.recorrenciasInativas = consultarElementoRecorrencia("recorrencia-inativas");
  elementosRecorrencia.recorrenciasArquivadas = consultarElementoRecorrencia("recorrencia-arquivadas");
  elementosRecorrencia.recorrenciasValorAtivas = consultarElementoRecorrencia("recorrencia-valor-ativas");
  elementosRecorrencia.botaoNovaRecorrencia = consultarElementoRecorrencia("botao-nova-recorrencia");
  elementosRecorrencia.botaoVoltarRecorrencias = consultarElementoRecorrencia("botao-voltar-recorrencias");
  // detalhe
  elementosRecorrencia.detalheTitulo = consultarElementoRecorrencia("recorrencia-detalhe-titulo");
  elementosRecorrencia.detalheServico = consultarElementoRecorrencia("recorrencia-detalhe-servico");
  elementosRecorrencia.detalheFrequencia = consultarElementoRecorrencia("recorrencia-detalhe-frequencia");
  elementosRecorrencia.detalheInicio = consultarElementoRecorrencia("recorrencia-detalhe-inicio");
  elementosRecorrencia.detalheFim = consultarElementoRecorrencia("recorrencia-detalhe-fim");
  elementosRecorrencia.detalheDia = consultarElementoRecorrencia("recorrencia-detalhe-dia");
  elementosRecorrencia.detalheValor = consultarElementoRecorrencia("recorrencia-detalhe-valor");
  elementosRecorrencia.detalheEstado = consultarElementoRecorrencia("recorrencia-detalhe-estado");
  elementosRecorrencia.detalheCriada = consultarElementoRecorrencia("recorrencia-detalhe-criada");
  elementosRecorrencia.detalheAtualizada = consultarElementoRecorrencia("recorrencia-detalhe-atualizada");
  elementosRecorrencia.linhaArquivada = consultarElementoRecorrencia("linha-recorrencia-arquivada");
  elementosRecorrencia.detalheArquivada = consultarElementoRecorrencia("recorrencia-detalhe-arquivada");
  elementosRecorrencia.detalheDescricao = consultarElementoRecorrencia("recorrencia-detalhe-descricao");
  elementosRecorrencia.avisoRecorrenciaDetalhe = consultarElementoRecorrencia("aviso-recorrencia-detalhe");
  elementosRecorrencia.acoesRecorrenciaDetalhe = consultarElementoRecorrencia("acoes-recorrencia-detalhe");
  // geração de ocorrências (Fase 10.4)
  elementosRecorrencia.secaoGerarOcorrencias = consultarElementoRecorrencia("secao-gerar-ocorrencias");
  elementosRecorrencia.formularioGeracao = consultarElementoRecorrencia("formulario-geracao");
  elementosRecorrencia.campoGerarInicio = consultarElementoRecorrencia("campo-gerar-inicio");
  elementosRecorrencia.campoGerarFim = consultarElementoRecorrencia("campo-gerar-fim");
  elementosRecorrencia.avisoGeracao = consultarElementoRecorrencia("aviso-geracao");
  elementosRecorrencia.botaoGerarOcorrencias = consultarElementoRecorrencia("botao-gerar-ocorrencias");
  elementosRecorrencia.resultadoGeracao = consultarElementoRecorrencia("resultado-geracao");
  elementosRecorrencia.geracaoEncontradas = consultarElementoRecorrencia("geracao-encontradas");
  elementosRecorrencia.geracaoCriadas = consultarElementoRecorrencia("geracao-criadas");
  elementosRecorrencia.geracaoExistentes = consultarElementoRecorrencia("geracao-existentes");
  // formulário
  elementosRecorrencia.formularioTituloSecao = consultarElementoRecorrencia("formulario-recorrencia-titulo-secao");
  elementosRecorrencia.formularioTitulo = consultarElementoRecorrencia("formulario-recorrencia-titulo");
  elementosRecorrencia.formularioRecorrencia = consultarElementoRecorrencia("formulario-recorrencia");
  elementosRecorrencia.campoServico = consultarElementoRecorrencia("campo-recorrencia-servico");
  elementosRecorrencia.campoFrequencia = consultarElementoRecorrencia("campo-recorrencia-frequencia");
  elementosRecorrencia.campoInicio = consultarElementoRecorrencia("campo-recorrencia-inicio");
  elementosRecorrencia.campoFim = consultarElementoRecorrencia("campo-recorrencia-fim");
  elementosRecorrencia.campoDia = consultarElementoRecorrencia("campo-recorrencia-dia");
  elementosRecorrencia.campoValor = consultarElementoRecorrencia("campo-recorrencia-valor");
  elementosRecorrencia.campoDescricao = consultarElementoRecorrencia("campo-recorrencia-descricao");
  elementosRecorrencia.avisoFormulario = consultarElementoRecorrencia("aviso-formulario-recorrencia");
  elementosRecorrencia.botaoSalvarRecorrencia = consultarElementoRecorrencia("botao-salvar-recorrencia");
  elementosRecorrencia.botaoCancelarRecorrencia = consultarElementoRecorrencia("botao-cancelar-recorrencia");
}

// ── Config (frequências e estados controlados pelo núcleo) ────────────────
async function carregarConfigRecorrencias() {
  try {
    const resultado = await ponteRecorrencia().config();
    if (!resultado.ok) return;
    estadoRecorrencia.config = resultado.config;
    preencherSeletorFrequencias();
  } catch (erro) {
    console.error(`PULSO: falha ao carregar configuração de recorrências — ${erro.message}`, erro);
  }
}

function preencherSeletorFrequencias() {
  const valorAtual = elementosRecorrencia.campoFrequencia.value;
  elementosRecorrencia.campoFrequencia.replaceChildren();
  for (const frequencia of estadoRecorrencia.config?.frequencias ?? []) {
    const opcao = document.createElement("option");
    opcao.value = frequencia.valor;
    opcao.textContent = frequencia.rotulo;
    elementosRecorrencia.campoFrequencia.append(opcao);
  }
  if (valorAtual) elementosRecorrencia.campoFrequencia.value = valorAtual;
}

/**
 * Carrega os serviços do jogador para os seletores (filtro e formulário).
 * Serviços arquivados aparecem no filtro, mas não recebem novas regras.
 */
async function carregarServicosDisponiveisRecorrencia() {
  const jogador = jogadorAtualRecorrencia();
  if (!jogador) return;
  try {
    const resultado = await ponteServicoRecorrencia().listar(jogador.id);
    if (!resultado.ok) {
      elementosRecorrencia.avisoRecorrencias.textContent =
        resultado.mensagem ?? "Não foi possível carregar os serviços.";
      return;
    }
    estadoRecorrencia.servicos = resultado.servicos ?? [];
    estadoRecorrencia.servicoPorId = new Map(estadoRecorrencia.servicos.map((s) => [s.id, s]));
    preencherSeletorServicosRecorrencia();
  } catch (erro) {
    console.error(`PULSO: falha ao carregar serviços para recorrências — ${erro.message}`, erro);
  }
}

function preencherSeletorServicosRecorrencia() {
  const filtroAtual = estadoRecorrencia.filtroServico;
  elementosRecorrencia.filtroServicoRecorrencias.replaceChildren();
  const todos = document.createElement("option");
  todos.value = "";
  todos.textContent = "TODOS OS SERVIÇOS";
  elementosRecorrencia.filtroServicoRecorrencias.append(todos);
  for (const servico of estadoRecorrencia.servicos) {
    const opcao = document.createElement("option");
    opcao.value = String(servico.id);
    opcao.textContent = servico.nome;
    elementosRecorrencia.filtroServicoRecorrencias.append(opcao);
  }
  elementosRecorrencia.filtroServicoRecorrencias.value = filtroAtual;

  const valorAtual = elementosRecorrencia.campoServico.value;
  elementosRecorrencia.campoServico.replaceChildren();
  const disponiveis = estadoRecorrencia.servicos.filter((s) => s.estado !== "arquivado");
  for (const servico of disponiveis) {
    const opcao = document.createElement("option");
    opcao.value = String(servico.id);
    opcao.textContent = servico.nome;
    elementosRecorrencia.campoServico.append(opcao);
  }
  if (valorAtual) elementosRecorrencia.campoServico.value = valorAtual;
}

// ── Resumo e lista ────────────────────────────────────────────────────────
async function carregarResumoRecorrencias() {
  const jogador = jogadorAtualRecorrencia();
  if (!jogador) return;
  try {
    const resultado = await ponteRecorrencia().listar(jogador.id);
    if (!resultado.ok) {
      elementosRecorrencia.avisoRecorrencias.textContent =
        resultado.mensagem ?? "Não foi possível carregar o resumo.";
      return;
    }
    const todas = resultado.recorrencias ?? [];
    const ativas = todas.filter((r) => r.estado === "ativa");
    const inativas = todas.filter((r) => r.estado === "inativa");
    const arquivadas = todas.filter((r) => r.estado === "arquivada");
    elementosRecorrencia.recorrenciasAtivas.textContent = String(ativas.length);
    elementosRecorrencia.recorrenciasInativas.textContent = String(inativas.length);
    elementosRecorrencia.recorrenciasArquivadas.textContent = String(arquivadas.length);
    elementosRecorrencia.recorrenciasValorAtivas.textContent =
      formatarCentavosRecorrencia(ativas.reduce((soma, r) => soma + r.valorEsperado, 0));
  } catch (erro) {
    console.error(`PULSO: falha ao carregar resumo de recorrências — ${erro.message}`, erro);
  }
}

async function carregarRecorrencias() {
  const jogador = jogadorAtualRecorrencia();
  if (!jogador) return;
  try {
    const resultado = await ponteRecorrencia().listar(jogador.id, {
      estado: estadoRecorrencia.filtroEstado || null,
      servicoId: estadoRecorrencia.filtroServico ? Number(estadoRecorrencia.filtroServico) : null,
    });
    if (!resultado.ok) {
      elementosRecorrencia.avisoRecorrencias.textContent =
        resultado.mensagem ?? "Não foi possível carregar as recorrências.";
      return;
    }
    elementosRecorrencia.avisoRecorrencias.textContent = "";
    estadoRecorrencia.recorrencias = resultado.recorrencias ?? [];
    renderizarRecorrencias();
  } catch (erro) {
    console.error(`PULSO: falha ao carregar recorrências — ${erro.message}`, erro);
  }
}

function renderizarRecorrencias() {
  elementosRecorrencia.listaRecorrencias.replaceChildren();
  if (estadoRecorrencia.recorrencias.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "missoes-vazio";
    vazio.textContent = "Nenhuma recorrência nesta seleção.";
    elementosRecorrencia.listaRecorrencias.append(vazio);
    return;
  }
  for (const recorrencia of estadoRecorrencia.recorrencias) {
    elementosRecorrencia.listaRecorrencias.append(criarItemRecorrencia(recorrencia));
  }
}

function criarItemRecorrencia(recorrencia) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "missao-item desejo-item";
  item.dataset.id = String(recorrencia.id);
  item.onclick = () => visualizarRecorrencia(recorrencia.id);

  const topo = document.createElement("span");
  topo.className = "desejo-topo";

  const nome = document.createElement("span");
  nome.className = "missao-item-titulo";
  nome.textContent = nomeServicoRecorrencia(recorrencia.servicoId);

  const estadoEl = document.createElement("span");
  estadoEl.className = `missao-item-estado recorrencia-estado ${recorrencia.estado}`;
  estadoEl.textContent = rotuloEstadoRecorrencia(recorrencia.estado);
  topo.append(nome, estadoEl);

  const meta = document.createElement("span");
  meta.className = "desejo-meta";
  const periodo = recorrencia.dataFim
    ? `${formatarDataSimplesRecorrencia(recorrencia.dataInicio)} → ${formatarDataSimplesRecorrencia(recorrencia.dataFim)}`
    : `desde ${formatarDataSimplesRecorrencia(recorrencia.dataInicio)}`;
  meta.textContent = `${rotuloFrequenciaRecorrencia(recorrencia.frequencia)} · Vence dia ${recorrencia.diaVencimento} · ${periodo}`;

  const valor = document.createElement("span");
  valor.className = "conta-valor-esperado";
  valor.textContent = `Valor esperado: ${formatarCentavosRecorrencia(recorrencia.valorEsperado)}`;
  meta.append(valor);

  item.append(topo, meta);
  return item;
}

// ── Detalhe ───────────────────────────────────────────────────────────────
async function visualizarRecorrencia(id) {
  try {
    const resultado = await ponteRecorrencia().obter(id);
    if (!resultado.ok) {
      elementosRecorrencia.avisoRecorrencias.textContent =
        resultado.mensagem ?? "Não foi possível abrir a recorrência.";
      return;
    }
    renderizarDetalheRecorrencia(resultado.recorrencia);
    exibirVisaoRecorrencia("visao-recorrencia-detalhe");
  } catch (erro) {
    console.error(`PULSO: falha ao abrir a recorrência ${id} — ${erro.message}`, erro);
  }
}

function renderizarDetalheRecorrencia(recorrencia) {
  estadoRecorrencia.recorrenciaAtualId = recorrencia.id;
  elementosRecorrencia.detalheTitulo.textContent =
    `${nomeServicoRecorrencia(recorrencia.servicoId)} · ${rotuloFrequenciaRecorrencia(recorrencia.frequencia)}`;
  elementosRecorrencia.detalheServico.textContent = nomeServicoRecorrencia(recorrencia.servicoId);
  elementosRecorrencia.detalheFrequencia.textContent = rotuloFrequenciaRecorrencia(recorrencia.frequencia);
  elementosRecorrencia.detalheInicio.textContent = formatarDataSimplesRecorrencia(recorrencia.dataInicio);
  elementosRecorrencia.detalheFim.textContent = formatarDataSimplesRecorrencia(recorrencia.dataFim);
  elementosRecorrencia.detalheDia.textContent =
    `Dia ${recorrencia.diaVencimento} (ajusta ao último dia em meses menores)`;
  elementosRecorrencia.detalheValor.textContent = formatarCentavosRecorrencia(recorrencia.valorEsperado);
  elementosRecorrencia.detalheEstado.textContent = rotuloEstadoRecorrencia(recorrencia.estado);
  elementosRecorrencia.detalheCriada.textContent = formatarDataSimplesRecorrencia(recorrencia.criadoEm);
  elementosRecorrencia.detalheAtualizada.textContent = formatarDataSimplesRecorrencia(recorrencia.atualizadoEm);
  const arquivada = recorrencia.estado === "arquivada";
  elementosRecorrencia.linhaArquivada.classList.toggle("oculto", !arquivada);
  if (arquivada) elementosRecorrencia.detalheArquivada.textContent =
    formatarDataSimplesRecorrencia(recorrencia.arquivadoEm);
  elementosRecorrencia.detalheDescricao.textContent = recorrencia.descricao || "";
  elementosRecorrencia.avisoRecorrenciaDetalhe.textContent = "";
  // Geração (Fase 10.4): disponível apenas para regras ATIVAS — inativa está
  // pausada e arquivada está encerrada. Cada detalhe recomeça limpo.
  const podeGerar = recorrencia.estado === "ativa";
  elementosRecorrencia.secaoGerarOcorrencias.classList.toggle("oculto", !podeGerar);
  elementosRecorrencia.campoGerarInicio.value = "";
  elementosRecorrencia.campoGerarFim.value = "";
  elementosRecorrencia.avisoGeracao.textContent = "";
  elementosRecorrencia.resultadoGeracao.classList.add("oculto");
  montarAcoesDetalheRecorrencia(recorrencia);
}

function montarAcoesDetalheRecorrencia(recorrencia) {
  elementosRecorrencia.acoesRecorrenciaDetalhe.replaceChildren();
  const acoes = [];

  const voltar = document.createElement("button");
  voltar.type = "button";
  voltar.className = "botao-secundario";
  voltar.textContent = "VOLTAR À LISTA";
  voltar.addEventListener("click", () => {
    exibirVisaoRecorrencia("visao-recorrencias");
    carregarResumoRecorrencias();
    carregarRecorrencias();
  });
  acoes.push(voltar);

  if (recorrencia.estado === "ativa" || recorrencia.estado === "inativa") {
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "botao-secundario";
    editar.textContent = "EDITAR";
    editar.addEventListener("click", () => exibirFormularioRecorrencia(recorrencia));
    acoes.push(editar);
  }

  if (recorrencia.estado === "ativa") {
    const desativar = document.createElement("button");
    desativar.type = "button";
    desativar.className = "botao-secundario";
    desativar.textContent = "DESATIVAR";
    desativar.addEventListener("click", () => acaoDesativarRecorrencia(recorrencia.id));
    acoes.push(desativar);
  }

  if (recorrencia.estado === "inativa") {
    const ativar = document.createElement("button");
    ativar.type = "button";
    ativar.className = "botao-primario";
    ativar.textContent = "REATIVAR";
    ativar.addEventListener("click", () => acaoAtivarRecorrencia(recorrencia.id));
    acoes.push(ativar);
  }

  if (recorrencia.estado !== "arquivada") {
    const arquivar = document.createElement("button");
    arquivar.type = "button";
    arquivar.className = "botao-perigo";
    arquivar.textContent = "ARQUIVAR";
    arquivar.addEventListener("click", () => acaoArquivarRecorrencia(recorrencia.id));
    acoes.push(arquivar);
  }

  elementosRecorrencia.acoesRecorrenciaDetalhe.append(...acoes);
}

// Ações de estado não movimentam dinheiro nem geram contas.
async function acaoAtivarRecorrencia(id) {
  try {
    const resultado = await ponteRecorrencia().ativar(id);
    if (!resultado.ok) {
      elementosRecorrencia.avisoRecorrenciaDetalhe.textContent =
        resultado.mensagem ?? "Não foi possível reativar a recorrência.";
      return;
    }
    renderizarDetalheRecorrencia(resultado.recorrencia);
    carregarResumoRecorrencias();
  } catch (erro) {
    console.error(`PULSO: falha ao reativar a recorrência ${id} — ${erro.message}`, erro);
  }
}

async function acaoDesativarRecorrencia(id) {
  try {
    const resultado = await ponteRecorrencia().desativar(id);
    if (!resultado.ok) {
      elementosRecorrencia.avisoRecorrenciaDetalhe.textContent =
        resultado.mensagem ?? "Não foi possível desativar a recorrência.";
      return;
    }
    renderizarDetalheRecorrencia(resultado.recorrencia);
    carregarResumoRecorrencias();
  } catch (erro) {
    console.error(`PULSO: falha ao desativar a recorrência ${id} — ${erro.message}`, erro);
  }
}

async function acaoArquivarRecorrencia(id) {
  try {
    const resultado = await ponteRecorrencia().arquivar(id);
    if (!resultado.ok) {
      elementosRecorrencia.avisoRecorrenciaDetalhe.textContent =
        resultado.mensagem ?? "Não foi possível arquivar a recorrência.";
      return;
    }
    renderizarDetalheRecorrencia(resultado.recorrencia);
    carregarResumoRecorrencias();
  } catch (erro) {
    console.error(`PULSO: falha ao arquivar a recorrência ${id} — ${erro.message}`, erro);
  }
}

// ── Geração de ocorrências (Fase 10.4) ────────────────────────────────────
// Transforma a regra em contas PENDENTES no período — idempotente no
// núcleo: repetir a geração do mesmo período não duplica contas. Aqui só
// coletamos o período e exibimos o resumo; nenhuma regra de datas local.
async function acaoGerarOcorrencias(evento) {
  evento.preventDefault();
  const recorrenciaId = estadoRecorrencia.recorrenciaAtualId;
  if (!recorrenciaId) return;
  const periodoInicio = elementosRecorrencia.campoGerarInicio.value;
  const periodoFim = elementosRecorrencia.campoGerarFim.value;
  if (!periodoInicio || !periodoFim) {
    elementosRecorrencia.avisoGeracao.textContent =
      "Informe o início e o fim do período da geração.";
    return;
  }
  if (periodoFim < periodoInicio) {
    elementosRecorrencia.avisoGeracao.textContent =
      "O fim do período não pode ser anterior ao início.";
    return;
  }
  try {
    const resultado = await ponteRecorrencia().gerar(recorrenciaId, {
      periodoInicio,
      periodoFim,
    });
    if (!resultado.ok) {
      elementosRecorrencia.avisoGeracao.textContent =
        resultado.mensagem ?? "Não foi possível gerar as ocorrências.";
      return;
    }
    const { encontradas, criadas, existentes } = resultado.geracao;
    elementosRecorrencia.geracaoEncontradas.textContent = String(encontradas);
    elementosRecorrencia.geracaoCriadas.textContent = String(criadas);
    elementosRecorrencia.geracaoExistentes.textContent = String(existentes);
    elementosRecorrencia.resultadoGeracao.classList.remove("oculto");
    elementosRecorrencia.avisoGeracao.textContent =
      criadas === 0 && existentes > 0
        ? "Nenhuma conta nova: as ocorrências deste período já haviam sido geradas."
        : "";
  } catch (erro) {
    console.error(
      `PULSO: falha ao gerar ocorrências da recorrência ${recorrenciaId} — ${erro.message}`,
      erro,
    );
    elementosRecorrencia.avisoGeracao.textContent =
      "Falha interna ao gerar as ocorrências.";
  }
}

// ── Formulário (criação e edição) ─────────────────────────────────────────
function exibirFormularioRecorrencia(recorrencia = null) {
  estadoRecorrencia.modoEdicaoRecorrencia = !!recorrencia;
  estadoRecorrencia.recorrenciaAtualId = recorrencia?.id ?? null;
  elementosRecorrencia.formularioTituloSecao.textContent =
    estadoRecorrencia.modoEdicaoRecorrencia ? "EDITAR RECORRÊNCIA" : "NOVA RECORRÊNCIA";
  elementosRecorrencia.formularioTitulo.textContent =
    estadoRecorrencia.modoEdicaoRecorrencia ? "ATUALIZAR RECORRÊNCIA" : "REGISTRAR RECORRÊNCIA";
  if (recorrencia) {
    elementosRecorrencia.campoServico.value = String(recorrencia.servicoId);
    elementosRecorrencia.campoFrequencia.value = recorrencia.frequencia;
    elementosRecorrencia.campoInicio.value = recorrencia.dataInicio ?? "";
    elementosRecorrencia.campoFim.value = recorrencia.dataFim ?? "";
    elementosRecorrencia.campoDia.value = String(recorrencia.diaVencimento);
    elementosRecorrencia.campoValor.value =
      formatarCentavosParaEntradaRecorrencia(recorrencia.valorEsperado);
    elementosRecorrencia.campoDescricao.value = recorrencia.descricao ?? "";
  } else {
    elementosRecorrencia.campoFrequencia.value = "mensal";
    elementosRecorrencia.campoInicio.value = "";
    elementosRecorrencia.campoFim.value = "";
    elementosRecorrencia.campoDia.value = "";
    elementosRecorrencia.campoValor.value = "";
    elementosRecorrencia.campoDescricao.value = "";
  }
  elementosRecorrencia.campoServico.disabled = estadoRecorrencia.modoEdicaoRecorrencia;
  elementosRecorrencia.avisoFormulario.textContent = "";
  exibirVisaoRecorrencia("visao-formulario-recorrencia");
  if (!estadoRecorrencia.modoEdicaoRecorrencia) elementosRecorrencia.campoFrequencia.focus();
}

async function salvarRecorrencia(evento) {
  evento.preventDefault();
  const jogador = jogadorAtualRecorrencia();
  if (!jogador) {
    elementosRecorrencia.avisoFormulario.textContent = "Nenhum jogador identificado.";
    return;
  }
  const valorCentavos = lerCentavosRecorrencia(elementosRecorrencia.campoValor.value);
  const diaTexto = String(elementosRecorrencia.campoDia.value ?? "").trim();
  const dados = {
    frequencia: elementosRecorrencia.campoFrequencia.value,
    dataInicio: elementosRecorrencia.campoInicio.value,
    dataFim: elementosRecorrencia.campoFim.value || null,
    diaVencimento: /^\d+$/.test(diaTexto) ? Number(diaTexto) : diaTexto,
    valorEsperado: valorCentavos,
    descricao: elementosRecorrencia.campoDescricao.value,
  };
  try {
    const resultado = estadoRecorrencia.modoEdicaoRecorrencia
      ? await ponteRecorrencia().atualizar({ id: estadoRecorrencia.recorrenciaAtualId, ...dados })
      : await ponteRecorrencia().criar({
          jogadorId: jogador.id,
          servicoId: Number(elementosRecorrencia.campoServico.value),
          ...dados,
        });
    if (!resultado.ok) {
      elementosRecorrencia.avisoFormulario.textContent =
        resultado.mensagem ?? "Não foi possível salvar a recorrência.";
      return;
    }
    exibirVisaoRecorrencia("visao-recorrencias");
    carregarResumoRecorrencias();
    carregarRecorrencias();
  } catch (erro) {
    console.error(`PULSO: falha ao salvar a recorrência — ${erro.message}`, erro);
    elementosRecorrencia.avisoFormulario.textContent = "Falha interna ao salvar a recorrência.";
  }
}

// ── Eventos ───────────────────────────────────────────────────────────────
function aplicarFiltroEstadoRecorrencia(botao) {
  estadoRecorrencia.filtroEstado = botao.dataset.filtro ?? "";
  for (const b of elementosRecorrencia.filtrosRecorrencias.querySelectorAll("[data-filtro]")) {
    b.classList.toggle("ativo", b === botao);
  }
  carregarRecorrencias();
}

function registrarEventosRecorrencias() {
  elementosRecorrencia.filtrosRecorrencias.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-filtro]");
    if (!botao) return;
    aplicarFiltroEstadoRecorrencia(botao);
  });
  elementosRecorrencia.filtroServicoRecorrencias.addEventListener("change", () => {
    estadoRecorrencia.filtroServico = elementosRecorrencia.filtroServicoRecorrencias.value;
    carregarRecorrencias();
  });
  elementosRecorrencia.botaoNovaRecorrencia.addEventListener("click", () => exibirFormularioRecorrencia(null));
  elementosRecorrencia.botaoVoltarRecorrencias.addEventListener("click", voltarAoPainelRecorrencia);
  elementosRecorrencia.formularioRecorrencia.addEventListener("submit", salvarRecorrencia);
  elementosRecorrencia.formularioGeracao.addEventListener("submit", acaoGerarOcorrencias);
  elementosRecorrencia.botaoSalvarRecorrencia.addEventListener("click", (e) => {
    e.preventDefault();
    salvarRecorrencia(e);
  });
  elementosRecorrencia.botaoCancelarRecorrencia.addEventListener("click", () => {
    if (estadoRecorrencia.recorrenciaAtualId) {
      visualizarRecorrencia(estadoRecorrencia.recorrenciaAtualId);
    } else {
      exibirVisaoRecorrencia("visao-recorrencias");
      carregarRecorrencias();
    }
  });
}

/** Permite que principal.js navegue para as recorrências (botão do painel). */
window.__irParaRecorrencias = irParaRecorrencias;

document.addEventListener("DOMContentLoaded", () => {
  mapearRecorrencias();
  registrarEventosRecorrencias();
  carregarConfigRecorrencias();
});
