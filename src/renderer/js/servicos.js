/**
 * PULSO — Renderer: Serviços (Fase 10.1)
 *
 * Interface do catálogo de serviços. Nenhuma regra de negócio aqui:
 * validações e ciclo de vida vivem no núcleo (dominio/servico.js e
 * aplicacao/servico-servicos.js). O valor esperado é ESTIMATIVA —
 * nada nesta tela movimenta dinheiro.
 */

const elementosServico = {};
const estadoServico = {
  config: null,
  servicos: [],
  filtroEstado: "",
  filtroCategoria: "",
  servicoAtualId: null,
  modoEdicaoServico: false,
};

function consultarElementoServico(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento da interface ausente: #${id}`);
  return el;
}

function jogadorAtualServico() {
  return window.__pulsoJogadorAtual ?? null;
}

function ponteServico() {
  if (!window.pulso || typeof window.pulso.servico?.listar !== "function") {
    throw new Error("A ponte window.pulso.servico não está disponível.");
  }
  return window.pulso.servico;
}

function formatarCentavosServico(centavos) {
  if (!Number.isFinite(centavos)) return "R$ 0,00";
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const inteiro = String(Math.trunc(absoluto / 100));
  const centavosStr = String(Math.trunc(absoluto % 100)).padStart(2, "0");
  const separado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-R$ " : "R$ "}${separado},${centavosStr}`;
}

function formatarCentavosParaEntradaServico(centavos) {
  return `${String(Math.trunc(centavos / 100))},${String(Math.trunc(centavos % 100)).padStart(2, "0")}`;
}

function lerCentavosServico(texto) {
  if (typeof texto !== "string") return null;
  const limpo = texto
    .replace(/\s+/g, "")
    .replace(/R\$/i, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(parseFloat(limpo) * 100);
}

function formatarDataSimplesServico(dataIso) {
  if (!dataIso) return "—";
  const partes = String(dataIso.slice(0, 10)).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(dataIso);
}

function rotuloCategoriaServico(valor) {
  const categoria = estadoServico.config?.categorias?.find((c) => c.valor === valor);
  return categoria ? categoria.rotulo : String(valor ?? "—").toUpperCase();
}

function rotuloEstadoServico(valor) {
  const rotulos = estadoServico.config?.rotulosEstados ?? {};
  return rotulos[valor] ?? String(valor ?? "—").toUpperCase();
}

// ── Navegação entre as visões de serviço ─────────────────────────────────
// Fase 10.6: cada módulo esconde também as visões dos outros módulos da
// FASE 10 (serviços/contas/recorrências) e o hub consolidado — nenhuma
// visão "vaza" para baixo da tela ao navegar entre eles.
function exibirVisaoServico(nome) {
  for (const visao of ["visao-servicos", "visao-servico-detalhe", "visao-formulario-servico"]) {
    consultarElementoServico(visao).classList.toggle("oculto", visao !== nome);
  }
  for (const visao of [
    "visao-recorrencias", "visao-recorrencia-detalhe", "visao-formulario-recorrencia",
    "visao-contas", "visao-conta-detalhe", "visao-formulario-conta",
    "visao-formulario-pagamento-conta", "visao-servicos-despesas",
    "visao-dashboard",
  ]) {
    const el = document.getElementById(visao);
    if (el) el.classList.add("oculto");
  }
  consultarElementoServico("visao-configuracao").classList.add("oculto");
  consultarElementoServico("visao-boot").classList.add("oculto");
  if (nome === "visao-boot") consultarElementoServico("visao-boot").classList.remove("oculto");
}

function irParaServicos() {
  exibirVisaoServico("visao-servicos");
  carregarResumo();
  carregarServicos();
}

function voltarAoPainelServico() {
  // Fase 15: o painel principal é o DASHBOARD (com retorno ao boot por lá).
  if (typeof window.__irParaDashboard === "function") {
    window.__irParaDashboard();
    return;
  }
  exibirVisaoServico("visao-boot");
}

// ── Mapeamento de elementos ───────────────────────────────────────────────
function mapearServicos() {
  // lista
  elementosServico.visaoServicos = consultarElementoServico("visao-servicos");
  elementosServico.avisoServicos = consultarElementoServico("aviso-servicos");
  elementosServico.filtrosServicos = consultarElementoServico("filtros-servicos");
  elementosServico.filtroCategoriaServicos = consultarElementoServico("filtro-categoria-servicos");
  elementosServico.listaServicos = consultarElementoServico("lista-servicos");
  elementosServico.servicosAtivos = consultarElementoServico("servico-ativos");
  elementosServico.servicosInativos = consultarElementoServico("servico-inativos");
  elementosServico.servicosArquivados = consultarElementoServico("servico-arquivados");
  elementosServico.servicosCustoEstimado = consultarElementoServico("servico-custo-estimado");
  elementosServico.botaoNovoServico = consultarElementoServico("botao-novo-servico");
  elementosServico.botaoVoltarServicos = consultarElementoServico("botao-voltar-servicos");
  // detalhe
  elementosServico.visaoDetalhe = consultarElementoServico("visao-servico-detalhe");
  elementosServico.detalheTitulo = consultarElementoServico("servico-detalhe-titulo");
  elementosServico.detalheFornecedor = consultarElementoServico("servico-detalhe-fornecedor");
  elementosServico.detalheCategoria = consultarElementoServico("servico-detalhe-categoria");
  elementosServico.detalheValor = consultarElementoServico("servico-detalhe-valor");
  elementosServico.detalheStatus = consultarElementoServico("servico-detalhe-status");
  elementosServico.detalheCriado = consultarElementoServico("servico-detalhe-criado");
  elementosServico.detalheAtualizado = consultarElementoServico("servico-detalhe-atualizado");
  elementosServico.linhaArquivado = consultarElementoServico("linha-servico-arquivado");
  elementosServico.detalheArquivado = consultarElementoServico("servico-detalhe-arquivado");
  elementosServico.detalheDescricao = consultarElementoServico("servico-detalhe-descricao");
  elementosServico.avisoServicoDetalhe = consultarElementoServico("aviso-servico-detalhe");
  elementosServico.acoesServicoDetalhe = consultarElementoServico("acoes-servico-detalhe");
  // formulário
  elementosServico.visaoFormulario = consultarElementoServico("visao-formulario-servico");
  elementosServico.formularioTituloSecao = consultarElementoServico("formulario-servico-titulo-secao");
  elementosServico.formularioTitulo = consultarElementoServico("formulario-servico-titulo");
  elementosServico.formularioServico = consultarElementoServico("formulario-servico");
  elementosServico.campoNome = consultarElementoServico("campo-servico-nome");
  elementosServico.campoFornecedor = consultarElementoServico("campo-servico-fornecedor");
  elementosServico.campoCategoria = consultarElementoServico("campo-servico-categoria");
  elementosServico.campoValor = consultarElementoServico("campo-servico-valor");
  elementosServico.campoDescricao = consultarElementoServico("campo-servico-descricao");
  elementosServico.avisoFormulario = consultarElementoServico("aviso-formulario-servico");
  elementosServico.botaoSalvarServico = consultarElementoServico("botao-salvar-servico");
  elementosServico.botaoCancelarServico = consultarElementoServico("botao-cancelar-servico");
}

// ── Config (categorias/estados controlados pelo núcleo) ───────────────────
async function carregarConfigServicos() {
  try {
    const resultado = await ponteServico().config();
    if (!resultado.ok) return;
    estadoServico.config = resultado.config;
    const categorias = estadoServico.config?.categorias ?? [];
    for (const categoria of categorias) {
      const opcaoFiltro = document.createElement("option");
      opcaoFiltro.value = categoria.valor;
      opcaoFiltro.textContent = categoria.rotulo;
      elementosServico.filtroCategoriaServicos.append(opcaoFiltro);
      const opcaoForm = document.createElement("option");
      opcaoForm.value = categoria.valor;
      opcaoForm.textContent = categoria.rotulo;
      elementosServico.campoCategoria.append(opcaoForm);
    }
  } catch (erro) {
    console.error(`PULSO: falha ao carregar configuração de serviços — ${erro.message}`, erro);
  }
}

// ── Resumo e lista ────────────────────────────────────────────────────────
async function carregarResumo() {
  const jogador = jogadorAtualServico();
  if (!jogador) return;
  try {
    const resultado = await ponteServico().listar(jogador.id);
    if (!resultado.ok) {
      elementosServico.avisoServicos.textContent = resultado.mensagem ?? "Não foi possível carregar o resumo.";
      return;
    }
    const todos = resultado.servicos ?? [];
    const ativos = todos.filter((s) => s.estado === "ativo");
    const inativos = todos.filter((s) => s.estado === "inativo");
    const arquivados = todos.filter((s) => s.estado === "arquivado");
    elementosServico.servicosAtivos.textContent = String(ativos.length);
    elementosServico.servicosInativos.textContent = String(inativos.length);
    elementosServico.servicosArquivados.textContent = String(arquivados.length);
    const custo = ativos.reduce((soma, s) => soma + s.valorEsperado, 0);
    elementosServico.servicosCustoEstimado.textContent = formatarCentavosServico(custo);
  } catch (erro) {
    console.error(`PULSO: falha ao carregar resumo de serviços — ${erro.message}`, erro);
  }
}

async function carregarServicos() {
  const jogador = jogadorAtualServico();
  if (!jogador) return;
  try {
    const resultado = await ponteServico().listar(jogador.id, {
      estado: estadoServico.filtroEstado || null,
      categoria: estadoServico.filtroCategoria || null,
    });
    if (!resultado.ok) {
      elementosServico.avisoServicos.textContent = resultado.mensagem ?? "Não foi possível carregar os serviços.";
      return;
    }
    elementosServico.avisoServicos.textContent = "";
    estadoServico.servicos = resultado.servicos ?? [];
    renderizarServicos();
  } catch (erro) {
    console.error(`PULSO: falha ao carregar serviços — ${erro.message}`, erro);
  }
}

function renderizarServicos() {
  elementosServico.listaServicos.replaceChildren();
  if (estadoServico.servicos.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "missoes-vazio";
    vazio.textContent = "Nenhum serviço nesta seleção.";
    elementosServico.listaServicos.append(vazio);
    return;
  }
  for (const servico of estadoServico.servicos) {
    elementosServico.listaServicos.append(criarItemServico(servico));
  }
}

function criarItemServico(servico) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "missao-item desejo-item";
  item.dataset.id = String(servico.id);
  item.onclick = () => visualizarServico(servico.id);

  const topo = document.createElement("span");
  topo.className = "desejo-topo";

  const nome = document.createElement("span");
  nome.className = "missao-item-titulo";
  nome.textContent = servico.nome;

  const estadoEl = document.createElement("span");
  estadoEl.className = `missao-item-estado servico-estado ${servico.estado}`;
  estadoEl.textContent = rotuloEstadoServico(servico.estado);
  topo.append(nome, estadoEl);

  const meta = document.createElement("span");
  meta.className = "desejo-meta";
  const fornecedor = servico.fornecedor ? ` · ${servico.fornecedor}` : "";
  meta.textContent = `${rotuloCategoriaServico(servico.categoria)}${fornecedor}`;

  const valor = document.createElement("span");
  valor.className = "servico-valor-esperado";
  valor.textContent = `Valor esperado: ${formatarCentavosServico(servico.valorEsperado)}`;
  meta.append(valor);

  item.append(topo, meta);
  return item;
}

// ── Detalhe ───────────────────────────────────────────────────────────────
async function visualizarServico(id) {
  try {
    const resultado = await ponteServico().obter(id);
    if (!resultado.ok) {
      elementosServico.avisoServicos.textContent = resultado.mensagem ?? "Não foi possível abrir o serviço.";
      return;
    }
    renderizarDetalhe(resultado.servico);
    exibirVisaoServico("visao-servico-detalhe");
  } catch (erro) {
    console.error(`PULSO: falha ao abrir o serviço ${id} — ${erro.message}`, erro);
  }
}

function renderizarDetalhe(servico) {
  estadoServico.servicoAtualId = servico.id;
  elementosServico.detalheTitulo.textContent = servico.nome;
  elementosServico.detalheFornecedor.textContent = servico.fornecedor ?? "—";
  elementosServico.detalheCategoria.textContent = rotuloCategoriaServico(servico.categoria);
  elementosServico.detalheValor.textContent = formatarCentavosServico(servico.valorEsperado);
  elementosServico.detalheStatus.textContent = rotuloEstadoServico(servico.estado);
  elementosServico.detalheCriado.textContent = formatarDataSimplesServico(servico.criadoEm);
  elementosServico.detalheAtualizado.textContent = formatarDataSimplesServico(servico.atualizadoEm);
  const arquivado = servico.estado === "arquivado";
  elementosServico.linhaArquivado.classList.toggle("oculto", !arquivado);
  if (arquivado) {
    elementosServico.detalheArquivado.textContent = formatarDataSimplesServico(servico.arquivadoEm);
  }
  elementosServico.detalheDescricao.textContent = servico.descricao || "";
  elementosServico.avisoServicoDetalhe.textContent = "";
  montarAcoesDetalhe(servico);
}

function montarAcoesDetalhe(servico) {
  elementosServico.acoesServicoDetalhe.replaceChildren();
  const acoes = [];

  const voltar = document.createElement("button");
  voltar.type = "button";
  voltar.className = "botao-secundario";
  voltar.textContent = "VOLTAR À LISTA";
  voltar.addEventListener("click", () => {
    exibirVisaoServico("visao-servicos");
    carregarServicos();
  });
  acoes.push(voltar);

  if (servico.estado === "ativo" || servico.estado === "inativo") {
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "botao-secundario";
    editar.textContent = "EDITAR";
    editar.addEventListener("click", () => exibirFormularioServico(servico));
    acoes.push(editar);
  }

  if (servico.estado === "inativo") {
    const ativar = document.createElement("button");
    ativar.type = "button";
    ativar.className = "botao-primario";
    ativar.textContent = "ATIVAR";
    ativar.addEventListener("click", () => acaoEstadoServico("ativar", servico.id));
    acoes.push(ativar);
  }

  if (servico.estado === "ativo") {
    const desativar = document.createElement("button");
    desativar.type = "button";
    desativar.className = "botao-secundario";
    desativar.textContent = "DESATIVAR";
    desativar.addEventListener("click", () => acaoEstadoServico("desativar", servico.id));
    acoes.push(desativar);
  }

  if (servico.estado === "ativo" || servico.estado === "inativo") {
    const arquivar = document.createElement("button");
    arquivar.type = "button";
    arquivar.className = "botao-perigo";
    arquivar.textContent = "ARQUIVAR";
    arquivar.addEventListener("click", () => acaoEstadoServico("arquivar", servico.id));
    acoes.push(arquivar);
  }

  // Navegação cruzada da FASE 10 (Fase 10.6): a partir do serviço, saltar
  // para as recorrências e as contas DESTE serviço (com filtro aplicado).
  if (servico.estado !== "arquivado") {
    const verRecorrencias = document.createElement("button");
    verRecorrencias.type = "button";
    verRecorrencias.className = "botao-secundario";
    verRecorrencias.textContent = "VER RECORRÊNCIAS";
    verRecorrencias.addEventListener("click", () => {
      if (typeof window.__irParaRecorrenciasComServico === "function") {
        window.__irParaRecorrenciasComServico(servico.id);
      }
    });
    acoes.push(verRecorrencias);

    const verContas = document.createElement("button");
    verContas.type = "button";
    verContas.className = "botao-secundario";
    verContas.textContent = "VER CONTAS";
    verContas.addEventListener("click", () => {
      if (typeof window.__irParaContasComServico === "function") {
        window.__irParaContasComServico(servico.id);
      }
    });
    acoes.push(verContas);
  }

  elementosServico.acoesServicoDetalhe.append(...acoes);
}

async function acaoEstadoServico(acao, id) {
  try {
    const resultado = await ponteServico()[acao](id);
    if (!resultado.ok) {
      elementosServico.avisoServicoDetalhe.textContent = resultado.mensagem ?? "Não foi possível concluir a operação.";
      return;
    }
    renderizarDetalhe(resultado.servico);
    carregarResumo();
    // Feedback de sucesso (Fase 10.6 — consistência entre módulos).
    const rotulosAcao = {
      ativar: "Serviço ativado.",
      desativar: "Serviço desativado.",
      arquivar: "Serviço arquivado.",
    };
    elementosServico.avisoServicoDetalhe.textContent = rotulosAcao[acao] ?? "Operação concluída.";
  } catch (erro) {
    console.error(`PULSO: falha ao executar ${acao} no serviço ${id} — ${erro.message}`, erro);
  }
}

// ── Formulário (criação e edição) ─────────────────────────────────────────
function exibirFormularioServico(servico = null) {
  estadoServico.modoEdicaoServico = !!servico;
  estadoServico.servicoAtualId = servico?.id ?? null;
  elementosServico.formularioTituloSecao.textContent = estadoServico.modoEdicaoServico
    ? "EDITAR SERVIÇO"
    : "NOVO SERVIÇO";
  elementosServico.formularioTitulo.textContent = estadoServico.modoEdicaoServico
    ? "ATUALIZAR SERVIÇO"
    : "REGISTRAR SERVIÇO";
  elementosServico.campoNome.value = servico?.nome ?? "";
  elementosServico.campoFornecedor.value = servico?.fornecedor ?? "";
  elementosServico.campoCategoria.value = servico?.categoria ?? "";
  elementosServico.campoValor.value = servico
    ? formatarCentavosParaEntradaServico(servico.valorEsperado)
    : "";
  elementosServico.campoDescricao.value = servico?.descricao ?? "";
  elementosServico.avisoFormulario.textContent = "";
  exibirVisaoServico("visao-formulario-servico");
  elementosServico.campoNome.focus();
}

async function salvarServico(evento) {
  evento.preventDefault();
  const jogador = jogadorAtualServico();
  if (!jogador) {
    elementosServico.avisoFormulario.textContent = "Nenhum jogador identificado.";
    return;
  }
  const valorCentavos = lerCentavosServico(elementosServico.campoValor.value);
  const dados = {
    nome: elementosServico.campoNome.value,
    fornecedor: elementosServico.campoFornecedor.value,
    categoria: elementosServico.campoCategoria.value || null,
    valorEsperado: valorCentavos,
    descricao: elementosServico.campoDescricao.value,
  };
  try {
    const resultado = estadoServico.modoEdicaoServico
      ? await ponteServico().atualizar({ id: estadoServico.servicoAtualId, ...dados })
      : await ponteServico().criar({ jogadorId: jogador.id, ...dados });
    if (!resultado.ok) {
      elementosServico.avisoFormulario.textContent = resultado.mensagem ?? "Não foi possível salvar o serviço.";
      return;
    }
    exibirVisaoServico("visao-servicos");
    carregarResumo();
    carregarServicos();
    // Feedback de sucesso (Fase 10.6 — consistência entre módulos).
    elementosServico.avisoServicos.textContent = estadoServico.modoEdicaoServico
      ? "Serviço atualizado com sucesso."
      : "Serviço registrado com sucesso.";
  } catch (erro) {
    console.error(`PULSO: falha ao salvar o serviço — ${erro.message}`, erro);
    elementosServico.avisoFormulario.textContent = "Falha interna ao salvar o serviço.";
  }
}

// ── Eventos ───────────────────────────────────────────────────────────────
function aplicarFiltroEstadoServico(botao) {
  estadoServico.filtroEstado = botao.dataset.filtro ?? "";
  for (const b of elementosServico.filtrosServicos.querySelectorAll("[data-filtro]")) {
    b.classList.toggle("ativo", b === botao);
  }
  carregarServicos();
}

function registrarEventosServicos() {
  elementosServico.filtrosServicos.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-filtro]");
    if (!botao) return;
    aplicarFiltroEstadoServico(botao);
  });
  elementosServico.filtroCategoriaServicos.addEventListener("change", () => {
    estadoServico.filtroCategoria = elementosServico.filtroCategoriaServicos.value;
    carregarServicos();
  });
  elementosServico.botaoNovoServico.addEventListener("click", () => {
    exibirFormularioServico(null);
  });
  // Navegação cruzada da FASE 10 (Fase 10.6).
  elementosServico.botaoServicosIrRecorrencias = consultarElementoServico("botao-servicos-ir-recorrencias");
  elementosServico.botaoServicosIrRecorrencias.addEventListener("click", () => {
    if (typeof window.__irParaRecorrencias === "function") window.__irParaRecorrencias();
  });
  elementosServico.botaoServicosIrContas = consultarElementoServico("botao-servicos-ir-contas");
  elementosServico.botaoServicosIrContas.addEventListener("click", () => {
    if (typeof window.__irParaContas === "function") window.__irParaContas();
  });
  elementosServico.botaoVoltarServicos.addEventListener("click", voltarAoPainelServico);
  elementosServico.formularioServico.addEventListener("submit", salvarServico);
  elementosServico.botaoSalvarServico.addEventListener("click", (e) => {
    e.preventDefault();
    salvarServico(e);
  });
  elementosServico.botaoCancelarServico.addEventListener("click", () => {
    if (estadoServico.servicoAtualId) {
      visualizarServico(estadoServico.servicoAtualId);
    } else {
      exibirVisaoServico("visao-servicos");
      carregarServicos();
    }
  });
}

/** Permite que principal.js e os demais módulos naveguem para os serviços. */
window.__irParaServicos = irParaServicos;
/** Abre o DETALHE de um serviço direto (navegação cruzada da Fase 10.6). */
window.__visualizarServico = visualizarServico;

// Fase 15: ponte para a ação rápida "NOVO SERVIÇO" do dashboard.
if (typeof window.__abrirNovoServico !== "function") {
  window.__abrirNovoServico = () => exibirFormularioServico(null);
}

document.addEventListener("DOMContentLoaded", () => {
  mapearServicos();
  registrarEventosServicos();
  carregarConfigServicos();
});
