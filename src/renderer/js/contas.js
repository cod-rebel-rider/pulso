/**
 * PULSO — Renderer: Contas / Despesas (Fase 10.2)
 *
 * Interface das ocorrências de serviço. Nenhuma regra de negócio aqui:
 * validações, derivação de situação (VENCIDA) e cancelamento vivem no
 * núcleo (dominio/conta.js e aplicacao/servico-contas.js).
 *
 * Nada nesta tela movimenta dinheiro: criar/editar/cancelar uma conta NÃO
 * cria transação e NÃO altera a carteira (o pagamento é futuro — Fase 10.5).
 */

const elementosConta = {};
const estadoConta = {
  config: null,
  contas: [],
  servicos: [],
  servicoPorId: new Map(),
  filtroSituacao: "",
  filtroServico: "",
  contaAtualId: null,
  modoEdicaoConta: false,
};

function consultarElementoConta(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento da interface ausente: #${id}`);
  return el;
}

function jogadorAtualConta() {
  return window.__pulsoJogadorAtual ?? null;
}

/** Nome legível de um serviço a partir do mapa em cache do renderer. */
function nomeServico(servicoId) {
  return estadoConta.servicoPorId.get(servicoId)?.nome ?? `Serviço ${servicoId}`;
}

function ponteConta() {
  if (!window.pulso || typeof window.pulso.conta?.listar !== "function") {
    throw new Error("A ponte window.pulso.conta não está disponível.");
  }
  return window.pulso.conta;
}

function ponteServicoConta() {
  if (!window.pulso || typeof window.pulso.servico?.listar !== "function") {
    throw new Error("A ponte window.pulso.servico não está disponível.");
  }
  return window.pulso.servico;
}

function formatarCentavosConta(centavos) {
  if (!Number.isFinite(centavos)) return "R$ 0,00";
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const inteiro = String(Math.trunc(absoluto / 100));
  const centavosStr = String(Math.trunc(absoluto % 100)).padStart(2, "0");
  const separado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-R$ " : "R$ "}${separado},${centavosStr}`;
}

function formatarCentavosParaEntradaConta(centavos) {
  return `${String(Math.trunc(centavos / 100))},${String(Math.trunc(centavos % 100)).padStart(2, "0")}`;
}

function lerCentavosConta(texto) {
  if (typeof texto !== "string") return null;
  const limpo = texto
    .replace(/\s+/g, "")
    .replace(/R\$/i, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(parseFloat(limpo) * 100);
}

function formatarDataSimplesConta(dataIso) {
  if (!dataIso) return "—";
  const partes = String(dataIso.slice(0, 10)).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(dataIso);
}

/** Rótulo humano da referência (AAAA-MM → Setembro/2026), sem regra de negócio. */
function rotuloReferenciaConta(referencia) {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const texto = String(referencia ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(texto)) return texto || "—";
  return `${meses[Number(texto.slice(5, 7)) - 1]}/${texto.slice(0, 4)}`;
}

function rotuloSituacaoConta(valor) {
  const rotulos = estadoConta.config?.rotulosSituacoes ?? {};
  return rotulos[valor] ?? String(valor ?? "—").toUpperCase();
}

function nomeServicoConta(servicoId) {
  return estadoConta.servicoPorId.get(servicoId)?.nome ?? `Serviço ${servicoId}`;
}

// ── Navegação entre as visões de conta ───────────────────────────────────
// Fase 10.6: correção do retorno ao painel (antes escondia o visao-boot,
// deixando a tela em branco) e isolamento entre os módulos da FASE 10.
function exibirVisaoConta(nome) {
  for (const visao of ["visao-contas", "visao-conta-detalhe", "visao-formulario-conta"]) {
    consultarElementoConta(visao).classList.toggle("oculto", visao !== nome);
  }
  for (const visao of [
    "visao-servicos", "visao-servico-detalhe", "visao-formulario-servico",
    "visao-recorrencias", "visao-recorrencia-detalhe", "visao-formulario-recorrencia",
    "visao-servicos-despesas", "visao-dashboard",
  ]) {
    const el = document.getElementById(visao);
    if (el) el.classList.add("oculto");
  }
  // Formulário e resultado do pagamento (Fase 10.5) são sobreposições:
  // escondidos em qualquer troca de visão para não "vazar" na lista.
  if (nome !== "visao-formulario-pagamento-conta") {
    consultarElementoConta("visao-formulario-pagamento-conta").classList.add("oculto");
    consultarElementoConta("resultado-pagamento").classList.add("oculto");
  }
  consultarElementoConta("visao-configuracao").classList.add("oculto");
  consultarElementoConta("visao-boot").classList.add("oculto");
  if (nome === "visao-boot") consultarElementoConta("visao-boot").classList.remove("oculto");
}

async function irParaContas() {
  exibirVisaoConta("visao-contas");
  await carregarServicosDisponiveisConta();
  carregarResumoContas();
  carregarContas();
}

function voltarAoPainelConta() {
  // Fase 15: o painel principal é o DASHBOARD (com retorno ao boot por lá).
  if (typeof window.__irParaDashboard === "function") {
    window.__irParaDashboard();
    return;
  }
  exibirVisaoConta("visao-boot");
}

// ── Mapeamento de elementos ──────────────────────────────────────────────
function mapearContas() {
  // lista
  elementosConta.avisoContas = consultarElementoConta("aviso-contas");
  elementosConta.filtrosContas = consultarElementoConta("filtros-contas");
  elementosConta.filtroServicoContas = consultarElementoConta("filtro-servico-contas");
  elementosConta.listaContas = consultarElementoConta("lista-contas");
  elementosConta.contasPendentes = consultarElementoConta("conta-pendentes");
  elementosConta.contasVencidas = consultarElementoConta("conta-vencidas");
  elementosConta.contasCanceladas = consultarElementoConta("conta-canceladas");
  elementosConta.contasPagas = consultarElementoConta("conta-pagas");
  elementosConta.contasValorAberto = consultarElementoConta("conta-valor-aberto");
  elementosConta.botaoNovaConta = consultarElementoConta("botao-nova-conta");
  elementosConta.botaoVoltarContas = consultarElementoConta("botao-voltar-contas");
  // detalhe
  elementosConta.detalheTitulo = consultarElementoConta("conta-detalhe-titulo");
  elementosConta.detalheServico = consultarElementoConta("conta-detalhe-servico");
  elementosConta.detalheReferencia = consultarElementoConta("conta-detalhe-referencia");
  elementosConta.detalheValor = consultarElementoConta("conta-detalhe-valor");
  elementosConta.detalheVencimento = consultarElementoConta("conta-detalhe-vencimento");
  elementosConta.detalheSituacao = consultarElementoConta("conta-detalhe-situacao");
  elementosConta.detalheCriada = consultarElementoConta("conta-detalhe-criada");
  elementosConta.detalheAtualizada = consultarElementoConta("conta-detalhe-atualizada");
  elementosConta.linhaCancelada = consultarElementoConta("linha-conta-cancelada");
  elementosConta.detalheCancelada = consultarElementoConta("conta-detalhe-cancelada");
  // Campos de pagamento no detalhe (Fase 10.6 — consolidação da 10.5).
  elementosConta.linhaPagamento = consultarElementoConta("linha-conta-pagamento");
  elementosConta.detalhePago = consultarElementoConta("conta-detalhe-pago");
  elementosConta.linhaPagamentoData = consultarElementoConta("linha-conta-pagamento-data");
  elementosConta.detalhePagoEm = consultarElementoConta("conta-detalhe-pago-em");
  elementosConta.linhaPagamentoObs = consultarElementoConta("linha-conta-pagamento-obs");
  elementosConta.detalhePagamentoObs = consultarElementoConta("conta-detalhe-pagamento-obs");
  elementosConta.linhaTransacao = consultarElementoConta("linha-conta-transacao");
  elementosConta.detalheTransacao = consultarElementoConta("conta-detalhe-transacao");
  elementosConta.detalheDescricao = consultarElementoConta("conta-detalhe-descricao");
  elementosConta.avisoContaDetalhe = consultarElementoConta("aviso-conta-detalhe");
  elementosConta.acoesContaDetalhe = consultarElementoConta("acoes-conta-detalhe");
  // formulário
  elementosConta.formularioTituloSecao = consultarElementoConta("formulario-conta-titulo-secao");
  elementosConta.formularioTitulo = consultarElementoConta("formulario-conta-titulo");
  elementosConta.formularioConta = consultarElementoConta("formulario-conta");
  elementosConta.campoServico = consultarElementoConta("campo-conta-servico");
  elementosConta.campoReferencia = consultarElementoConta("campo-conta-referencia");
  elementosConta.campoVencimento = consultarElementoConta("campo-conta-vencimento");
  elementosConta.campoValor = consultarElementoConta("campo-conta-valor");
  elementosConta.campoDescricao = consultarElementoConta("campo-conta-descricao");
  elementosConta.avisoFormulario = consultarElementoConta("aviso-formulario-conta");
  elementosConta.botaoSalvarConta = consultarElementoConta("botao-salvar-conta");
  elementosConta.botaoCancelarConta = consultarElementoConta("botao-cancelar-conta");
  // pagamento (Fase 10.5)
  elementosConta.visaoFormularioPagamentoConta = consultarElementoConta("visao-formulario-pagamento-conta");
  elementosConta.resultadoPagamento = consultarElementoConta("resultado-pagamento");
  elementosConta.pagamentoDetalheConta = consultarElementoConta("pagamento-detalhe-conta");
  elementosConta.pagamentoDetalheServico = consultarElementoConta("pagamento-detalhe-servico");
  elementosConta.pagamentoDetalheValorEsperado = consultarElementoConta("pagamento-detalhe-valor-esperado");
  elementosConta.pagamentoDetalheVencimento = consultarElementoConta("pagamento-detalhe-vencimento");
  elementosConta.campoPagamentoContaId = consultarElementoConta("campo-pagamento-conta-id");
  elementosConta.campoPagamentoValor = consultarElementoConta("campo-pagamento-valor");
  elementosConta.campoPagamentoData = consultarElementoConta("campo-pagamento-data");
  elementosConta.campoPagamentoObservacao = consultarElementoConta("campo-pagamento-observacao");
  elementosConta.avisoFormularioPagamento = consultarElementoConta("aviso-formulario-pagamento");
  elementosConta.formularioPagamentoConta = consultarElementoConta("formulario-pagamento-conta");
  elementosConta.botaoSalvarPagamento = consultarElementoConta("botao-salvar-pagamento");
  elementosConta.botaoCancelarPagamento = consultarElementoConta("botao-cancelar-pagamento");
  elementosConta.pagamentoResultadoStatus = consultarElementoConta("pagamento-resultado-status");
  elementosConta.pagamentoResultadoValorEsperado = consultarElementoConta("pagamento-resultado-valor-esperado");
  elementosConta.pagamentoResultadoValorPago = consultarElementoConta("pagamento-resultado-valor-pago");
  elementosConta.pagamentoResultadoData = consultarElementoConta("pagamento-resultado-data");
  elementosConta.pagamentoResultadoTransacao = consultarElementoConta("pagamento-resultado-transacao");
  elementosConta.pagamentoResultadoObservacao = consultarElementoConta("pagamento-resultado-observacao");
}

// ── Config (situações controladas pelo núcleo) ────────────────────────────
async function carregarConfigContas() {
  try {
    const resultado = await ponteConta().config();
    if (!resultado.ok) return;
    estadoConta.config = resultado.config;
  } catch (erro) {
    console.error(`PULSO: falha ao carregar configuração de contas — ${erro.message}`, erro);
  }
}

/**
 * Carrega os serviços do jogador para os seletores (filtro e formulário).
 * Serviços arquivados aparecem no filtro, mas não no cadastro de novas contas.
 */
async function carregarServicosDisponiveisConta() {
  const jogador = jogadorAtualConta();
  if (!jogador) return;
  try {
    const resultado = await ponteServicoConta().listar(jogador.id);
    if (!resultado.ok) {
      elementosConta.avisoContas.textContent = resultado.mensagem ?? "Não foi possível carregar os serviços.";
      return;
    }
    estadoConta.servicos = resultado.servicos ?? [];
    estadoConta.servicoPorId = new Map(estadoConta.servicos.map((s) => [s.id, s]));
    preencherSeletorServicosConta();
  } catch (erro) {
    console.error(`PULSO: falha ao carregar serviços para contas — ${erro.message}`, erro);
  }
}

function preencherSeletorServicosConta() {
  const filtroAtual = estadoConta.filtroServico;
  elementosConta.filtroServicoContas.replaceChildren();
  const todos = document.createElement("option");
  todos.value = "";
  todos.textContent = "TODOS OS SERVIÇOS";
  elementosConta.filtroServicoContas.append(todos);
  for (const servico of estadoConta.servicos) {
    const opcao = document.createElement("option");
    opcao.value = String(servico.id);
    opcao.textContent = servico.nome;
    elementosConta.filtroServicoContas.append(opcao);
  }
  elementosConta.filtroServicoContas.value = filtroAtual;

  const valorAtual = elementosConta.campoServico.value;
  elementosConta.campoServico.replaceChildren();
  const disponiveis = estadoConta.servicos.filter((s) => s.estado !== "arquivado");
  for (const servico of disponiveis) {
    const opcao = document.createElement("option");
    opcao.value = String(servico.id);
    opcao.textContent = servico.nome;
    elementosConta.campoServico.append(opcao);
  }
  if (valorAtual) elementosConta.campoServico.value = valorAtual;
}

// ── Resumo e lista ────────────────────────────────────────────────────────
async function carregarResumoContas() {
  const jogador = jogadorAtualConta();
  if (!jogador) return;
  try {
    const resultado = await ponteConta().listar(jogador.id);
    if (!resultado.ok) {
      elementosConta.avisoContas.textContent = resultado.mensagem ?? "Não foi possível carregar o resumo.";
      return;
    }
    const todas = resultado.contas ?? [];
    const pendentes = todas.filter((c) => c.situacao === "pendente");
    const vencidas = todas.filter((c) => c.situacao === "vencida");
    const canceladas = todas.filter((c) => c.situacao === "cancelada");
    const pagas = todas.filter((c) => c.situacao === "paga");
    elementosConta.contasPendentes.textContent = String(pendentes.length);
    elementosConta.contasVencidas.textContent = String(vencidas.length);
    elementosConta.contasCanceladas.textContent = String(canceladas.length);
    elementosConta.contasPagas.textContent = String(pagas.length);
    const emAberto = [...pendentes, ...vencidas].reduce((soma, c) => soma + c.valorEsperado, 0);
    elementosConta.contasValorAberto.textContent = formatarCentavosConta(emAberto);
  } catch (erro) {
    console.error(`PULSO: falha ao carregar resumo de contas — ${erro.message}`, erro);
  }
}

async function carregarContas() {
  const jogador = jogadorAtualConta();
  if (!jogador) return;
  try {
    const resultado = await ponteConta().listar(jogador.id, {
      situacao: estadoConta.filtroSituacao || null,
      servicoId: estadoConta.filtroServico ? Number(estadoConta.filtroServico) : null,
    });
    if (!resultado.ok) {
      elementosConta.avisoContas.textContent = resultado.mensagem ?? "Não foi possível carregar as contas.";
      return;
    }
    elementosConta.avisoContas.textContent = "";
    estadoConta.contas = resultado.contas ?? [];
    renderizarContas();
  } catch (erro) {
    console.error(`PULSO: falha ao carregar contas — ${erro.message}`, erro);
  }
}

function renderizarContas() {
  elementosConta.listaContas.replaceChildren();
  if (estadoConta.contas.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "missoes-vazio";
    vazio.textContent = "Nenhuma conta nesta seleção.";
    elementosConta.listaContas.append(vazio);
    return;
  }
  for (const conta of estadoConta.contas) {
    elementosConta.listaContas.append(criarItemConta(conta));
  }
}

function criarItemConta(conta) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "missao-item desejo-item";
  item.dataset.id = String(conta.id);
  item.onclick = () => visualizarConta(conta.id);

  const topo = document.createElement("span");
  topo.className = "desejo-topo";

  const nome = document.createElement("span");
  nome.className = "missao-item-titulo";
  nome.textContent = nomeServicoConta(conta.servicoId);

  const situacaoEl = document.createElement("span");
  situacaoEl.className = `missao-item-estado conta-situacao ${conta.situacao}`;
  situacaoEl.textContent = rotuloSituacaoConta(conta.situacao);
  topo.append(nome, situacaoEl);

  const meta = document.createElement("span");
  meta.className = "desejo-meta";
  meta.textContent = `${rotuloReferenciaConta(conta.referencia)} · Vencimento: ${formatarDataSimplesConta(conta.vencimento)}`;

  const valor = document.createElement("span");
  valor.className = "conta-valor-esperado";
  // Fase 10.6: contas PAGAS destacam o valor pago (× o esperado); as demais,
  // apenas o valor esperado — nenhuma lista aqui movimenta dinheiro.
  valor.textContent = conta.estado === "paga"
    ? `Valor pago: ${formatarCentavosConta(conta.paidAmount)} · Esperado: ${formatarCentavosConta(conta.valorEsperado)}`
    : `Valor esperado: ${formatarCentavosConta(conta.valorEsperado)}`;
  meta.append(valor);

  item.append(topo, meta);
  return item;
}

// ── Detalhe ───────────────────────────────────────────────────────────────
async function visualizarConta(id) {
  try {
    const resultado = await ponteConta().obter(id);
    if (!resultado.ok) {
      elementosConta.avisoContas.textContent = resultado.mensagem ?? "Não foi possível abrir a conta.";
      return;
    }
    renderizarDetalheConta(resultado.conta);
    exibirVisaoConta("visao-conta-detalhe");
  } catch (erro) {
    console.error(`PULSO: falha ao abrir a conta ${id} — ${erro.message}`, erro);
  }
}

function renderizarDetalheConta(conta) {
  estadoConta.contaAtualId = conta.id;
  elementosConta.detalheTitulo.textContent =
    `${nomeServicoConta(conta.servicoId)} · ${rotuloReferenciaConta(conta.referencia)}`;
  elementosConta.detalheServico.textContent = nomeServicoConta(conta.servicoId);
  elementosConta.detalheReferencia.textContent = rotuloReferenciaConta(conta.referencia);
  elementosConta.detalheValor.textContent = formatarCentavosConta(conta.valorEsperado);
  elementosConta.detalheVencimento.textContent = formatarDataSimplesConta(conta.vencimento);
  elementosConta.detalheSituacao.textContent = rotuloSituacaoConta(conta.situacao);
  elementosConta.detalheCriada.textContent = formatarDataSimplesConta(conta.criadoEm);
  elementosConta.detalheAtualizada.textContent = formatarDataSimplesConta(conta.atualizadoEm);
  const cancelada = conta.estado === "cancelada";
  elementosConta.linhaCancelada.classList.toggle("oculto", !cancelada);
  if (cancelada) elementosConta.detalheCancelada.textContent = formatarDataSimplesConta(conta.canceladoEm);
  // Destaque do pagamento (Fase 10.6): valor pago, data, observação e a
  // transação financeira da Fase 08 — visíveis somente na conta PAGA.
  const paga = conta.estado === "paga";
  elementosConta.linhaPagamento.classList.toggle("oculto", !paga);
  elementosConta.linhaPagamentoData.classList.toggle("oculto", !paga);
  elementosConta.linhaPagamentoObs.classList.toggle("oculto", !paga);
  elementosConta.linhaTransacao.classList.toggle("oculto", !paga);
  if (paga) {
    elementosConta.detalhePago.textContent = formatarCentavosConta(conta.paidAmount);
    elementosConta.detalhePagoEm.textContent = formatarDataSimplesConta(conta.paidAt);
    elementosConta.detalhePagamentoObs.textContent = conta.paymentDescription || "—";
    elementosConta.detalheTransacao.textContent = conta.transactionId
      ? `ID ${conta.transactionId} · DESPESA`
      : "—";
  }
  elementosConta.detalheDescricao.textContent = conta.descricao || "";
  elementosConta.avisoContaDetalhe.textContent = "";
  montarAcoesDetalheConta(conta);
}

function montarAcoesDetalheConta(conta) {
  elementosConta.acoesContaDetalhe.replaceChildren();
  const acoes = [];

  const voltar = document.createElement("button");
  voltar.type = "button";
  voltar.className = "botao-secundario";
  voltar.textContent = "VOLTAR À LISTA";
  voltar.addEventListener("click", () => {
    exibirVisaoConta("visao-contas");
    carregarResumoContas();
    carregarContas();
  });
  acoes.push(voltar);

  // Navegação cruzada da FASE 10 (Fase 10.6): da conta, abrir o serviço.
  const verServico = document.createElement("button");
  verServico.type = "button";
  verServico.className = "botao-secundario";
  verServico.textContent = "VER SERVIÇO";
  verServico.addEventListener("click", () => {
    if (typeof window.__visualizarServico === "function") {
      window.__visualizarServico(conta.servicoId);
    }
  });
  acoes.push(verServico);

  if (conta.estado === "pendente") {
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "botao-secundario";
    editar.textContent = "EDITAR";
    editar.addEventListener("click", () => exibirFormularioConta(conta));
    acoes.push(editar);

    const cancelar = document.createElement("button");
    cancelar.type = "button";
    cancelar.className = "botao-perigo";
    cancelar.textContent = "CANCELAR CONTA";
    cancelar.addEventListener("click", () => acaoCancelarConta(conta.id));
    acoes.push(cancelar);

    const pagar = document.createElement("button");
    pagar.type = "button";
    pagar.className = "botao-primario";
    pagar.textContent = "REGISTRAR PAGAMENTO";
    pagar.addEventListener("click", () => exibirFormularioPagamentoConta(conta));
    acoes.push(pagar);
  }

  elementosConta.acoesContaDetalhe.append(...acoes);
}

/** Registrar pagamento: transforma obrigação (conta) em DESPESA financeira. */
async function acaoPagamentoConta(id) {
  const jogador = jogadorAtualConta();
  if (!jogador) {
    elementosConta.avisoFormularioPagamento.textContent = "Nenhum jogador identificado.";
    return;
  }
  try {
    const valorCentavos = lerCentavosConta(elementosConta.campoPagamentoValor.value);
    const dados = {
      valorPagoCentavos: valorCentavos,
      paidAt: elementosConta.campoPagamentoData.value,
      paymentDescription: elementosConta.campoPagamentoObservacao.value || null,
    };
    // Assinatura da ponte: pagar(jogadorId, id, dados) — o jogador vem da
    // sessão (Fase 10.6: correção da integração renderer → preload → main).
    const resultado = await ponteConta().pagar(jogador.id, id, dados);
    if (!resultado.ok) {
      elementosConta.avisoFormularioPagamento.textContent = resultado.mensagem ?? "Não foi possível registrar o pagamento.";
      return;
    }
    // Esconde o formulário e exibe o resultado do pagamento (Fase 10.5).
    elementosConta.avisoFormularioPagamento.textContent = "";
    elementosConta.visaoFormularioPagamentoConta.classList.add("oculto");
    // Exibir resultado
    elementosConta.pagamentoResultadoStatus.textContent = "PAGA";
    elementosConta.pagamentoResultadoValorEsperado.textContent = formatarCentavosConta(resultado.conta.valorEsperado);
    elementosConta.pagamentoResultadoValorPago.textContent = formatarCentavosConta(resultado.conta.paidAmount);
    elementosConta.pagamentoResultadoData.textContent = resultado.conta.paidAt;
    elementosConta.pagamentoResultadoTransacao.textContent = resultado.transacao?.id ? `ID ${resultado.transacao.id}` : "—";
    elementosConta.pagamentoResultadoObservacao.textContent = resultado.conta.paymentDescription || "—";
    elementosConta.resultadoPagamento.classList.remove("oculto");
    // Limpar formulário
    elementosConta.campoPagamentoContaId.value = "";
    elementosConta.campoPagamentoValor.value = "";
    elementosConta.campoPagamentoData.value = "";
    elementosConta.campoPagamentoObservacao.value = "";
    // Detalhe atualizado (valor pago, data e transação) + resumo/lista
    // consistentes (Fase 10.6) + feedback de sucesso.
    renderizarDetalheConta(resultado.conta);
    carregarResumoContas();
    carregarContas();
    elementosConta.avisoContaDetalhe.textContent =
      "Pagamento registrado: despesa criada e carteira atualizada.";
  } catch (erro) {
    console.error(`PULSO: falha ao registrar pagamento da conta ${id} — ${erro.message}`, erro);
    elementosConta.avisoFormularioPagamento.textContent = "Falha interna ao registrar pagamento.";
  }
}

// ── Formulário de pagamento ────────────────────────────────────────────────
function exibirFormularioPagamentoConta(conta) {
  estadoConta.modoPagamentoConta = true;
  estadoConta.contaAtualId = conta?.id ?? null;
  elementosConta.visaoFormularioPagamentoConta.classList.remove("oculto");
  elementosConta.resultadoPagamento.classList.add("oculto");
  elementosConta.campoPagamentoContaId.value = String(conta.id);
  elementosConta.campoPagamentoValor.value = formatarCentavosParaEntradaConta(conta.valorEsperado);
  elementosConta.campoPagamentoData.value = conta.vencimento;
  elementosConta.campoPagamentoObservacao.value = "";
  elementosConta.avisoFormularioPagamento.textContent = "";
  // Preencher detalhes da conta no formulário
  elementosConta.pagamentoDetalheConta.textContent = `ID ${conta.id}`;
  elementosConta.pagamentoDetalheServico.textContent = nomeServico(conta.servicoId);
  elementosConta.pagamentoDetalheValorEsperado.textContent = formatarCentavosConta(conta.valorEsperado);
  elementosConta.pagamentoDetalheVencimento.textContent = formatarDataSimplesConta(conta.vencimento);
}

function esconderFormularioPagamentoConta() {
  estadoConta.modoPagamentoConta = false;
  estadoConta.contaAtualId = null;
  elementosConta.visaoFormularioPagamentoConta.classList.add("oculto");
  elementosConta.resultadoPagamento.classList.add("oculto");
  elementosConta.campoPagamentoContaId.value = "";
  elementosConta.campoPagamentoValor.value = "";
  elementosConta.campoPagamentoData.value = "";
  elementosConta.campoPagamentoObservacao.value = "";
  elementosConta.avisoFormularioPagamento.textContent = "";
}
async function acaoCancelarConta(id) {
  try {
    const resultado = await ponteConta().cancelar(id);
    if (!resultado.ok) {
      elementosConta.avisoContaDetalhe.textContent = resultado.mensagem ?? "Não foi possível cancelar a conta.";
      return;
    }
    renderizarDetalheConta(resultado.conta);
    carregarResumoContas();
    // Feedback de sucesso (Fase 10.6 — consistência entre módulos).
    elementosConta.avisoContaDetalhe.textContent =
      "Conta cancelada — nenhuma movimentação financeira foi feita.";
  } catch (erro) {
    console.error(`PULSO: falha ao cancelar a conta ${id} — ${erro.message}`, erro);
  }
}

// ── Formulário (criação e edição) ────────────────────────────────────────
function exibirFormularioConta(conta = null) {
  estadoConta.modoEdicaoConta = !!conta;
  estadoConta.contaAtualId = conta?.id ?? null;
  elementosConta.formularioTituloSecao.textContent = estadoConta.modoEdicaoConta ? "EDITAR CONTA" : "NOVA CONTA";
  elementosConta.formularioTitulo.textContent = estadoConta.modoEdicaoConta ? "ATUALIZAR CONTA" : "REGISTRAR CONTA";
  if (conta) elementosConta.campoServico.value = String(conta.servicoId);
  elementosConta.campoServico.disabled = estadoConta.modoEdicaoConta;
  elementosConta.campoReferencia.value = conta?.referencia ?? "";
  elementosConta.campoVencimento.value = conta?.vencimento ?? "";
  elementosConta.campoValor.value = conta ? formatarCentavosParaEntradaConta(conta.valorEsperado) : "";
  elementosConta.campoDescricao.value = conta?.descricao ?? "";
  elementosConta.avisoFormulario.textContent = "";
  exibirVisaoConta("visao-formulario-conta");
  elementosConta.campoReferencia.focus();
}

async function salvarConta(evento) {
  evento.preventDefault();
  const jogador = jogadorAtualConta();
  if (!jogador) {
    elementosConta.avisoFormulario.textContent = "Nenhum jogador identificado.";
    return;
  }
  const valorCentavos = lerCentavosConta(elementosConta.campoValor.value);
  const dados = {
    referencia: elementosConta.campoReferencia.value,
    vencimento: elementosConta.campoVencimento.value,
    valorEsperado: valorCentavos,
    descricao: elementosConta.campoDescricao.value,
  };
  try {
    const resultado = estadoConta.modoEdicaoConta
      ? await ponteConta().atualizar({ id: estadoConta.contaAtualId, ...dados })
      : await ponteConta().criar({
          jogadorId: jogador.id,
          servicoId: Number(elementosConta.campoServico.value),
          ...dados,
        });
    if (!resultado.ok) {
      elementosConta.avisoFormulario.textContent = resultado.mensagem ?? "Não foi possível salvar a conta.";
      return;
    }
    exibirVisaoConta("visao-contas");
    carregarResumoContas();
    carregarContas();
    // Feedback de sucesso (Fase 10.6 — consistência entre módulos).
    elementosConta.avisoContas.textContent = estadoConta.modoEdicaoConta
      ? "Conta atualizada com sucesso."
      : "Conta registrada com sucesso — nenhuma movimentação financeira foi feita.";
  } catch (erro) {
    console.error(`PULSO: falha ao salvar a conta — ${erro.message}`, erro);
    elementosConta.avisoFormulario.textContent = "Falha interna ao salvar a conta.";
  }
}

// ── Eventos ───────────────────────────────────────────────────────────────
function aplicarFiltroSituacaoConta(botao) {
  estadoConta.filtroSituacao = botao.dataset.filtro ?? "";
  for (const b of elementosConta.filtrosContas.querySelectorAll("[data-filtro]")) {
    b.classList.toggle("ativo", b === botao);
  }
  carregarContas();
}

function registrarEventosContas() {
  elementosConta.filtrosContas.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-filtro]");
    if (!botao) return;
    aplicarFiltroSituacaoConta(botao);
  });
  elementosConta.filtroServicoContas.addEventListener("change", () => {
    estadoConta.filtroServico = elementosConta.filtroServicoContas.value;
    carregarContas();
  });
  elementosConta.botaoNovaConta.addEventListener("click", () => exibirFormularioConta(null));
  // Navegação cruzada da FASE 10 (Fase 10.6).
  elementosConta.botaoContasIrServicos = consultarElementoConta("botao-contas-ir-servicos");
  elementosConta.botaoContasIrServicos.addEventListener("click", () => {
    if (typeof window.__irParaServicos === "function") window.__irParaServicos();
  });
  elementosConta.botaoContasIrRecorrencias = consultarElementoConta("botao-contas-ir-recorrencias");
  elementosConta.botaoContasIrRecorrencias.addEventListener("click", () => {
    if (typeof window.__irParaRecorrencias === "function") window.__irParaRecorrencias();
  });
  elementosConta.botaoVoltarContas.addEventListener("click", voltarAoPainelConta);
  elementosConta.formularioConta.addEventListener("submit", salvarConta);
  elementosConta.botaoSalvarConta.addEventListener("click", (e) => {
    e.preventDefault();
    salvarConta(e);
  });
  elementosConta.botaoCancelarConta.addEventListener("click", () => {
    if (estadoConta.contaAtualId) {
      visualizarConta(estadoConta.contaAtualId);
    } else {
      exibirVisaoConta("visao-contas");
      carregarContas();
    }
  });
  // Pagamento (Fase 10.5)
  elementosConta.formularioPagamentoConta.addEventListener("submit", (evento) => {
    evento.preventDefault();
    acaoPagamentoConta(Number(elementosConta.campoPagamentoContaId.value));
  });
  elementosConta.botaoSalvarPagamento.addEventListener("click", (evento) => {
    evento.preventDefault();
    acaoPagamentoConta(Number(elementosConta.campoPagamentoContaId.value));
  });
  elementosConta.botaoCancelarPagamento.addEventListener("click", esconderFormularioPagamentoConta);
}

/** Permite que principal.js e os demais módulos naveguem para as contas. */
window.__irParaContas = irParaContas;
/** Contas de um serviço, com o filtro já aplicado (navegação da Fase 10.6). */
window.__irParaContasComServico = async function (servicoId) {
  await irParaContas();
  estadoConta.filtroServico = String(servicoId);
  elementosConta.filtroServicoContas.value = estadoConta.filtroServico;
  carregarContas();
};

// Fase 15: ponte para a ação rápida "NOVA CONTA" do dashboard.
if (typeof window.__abrirNovaConta !== "function") {
  window.__abrirNovaConta = () => exibirFormularioConta(null);
}


document.addEventListener("DOMContentLoaded", () => {
  mapearContas();
  registrarEventosContas();
  carregarConfigContas();
});