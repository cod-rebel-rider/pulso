/**
 * PULSO — Renderer: Loja / Lista de Desejos (Fase 09)
 *
 * Interface propria da loja. Nenhuma regra de negocio aqui:
 * validacoes, calculos e compras vivem no nucleo (dominio/servico).
 * A compra gera despesa via financas — a interface apenas confirma.
 */

const CATEGORIA_FINANCEIRA_ROTULOS = {
  alimentacao: 'ALIMENTAÇÃO',
  transporte: 'TRANSPORTE',
  moradia: 'MORADIA',
  contas: 'CONTAS',
  assinaturas: 'ASSINATURAS',
  lazer: 'LAZER',
  tecnologia: 'TECNOLOGIA',
  musica: 'MÚSICA',
  saude: 'SAÚDE',
  educacao: 'EDUCAÇÃO',
  compras: 'COMPRAS',
  outra_despesa: 'OUTRA DESPESA',
};

const MAPA_CATEGORIA_FINANCEIRA = {
  tecnologia: 'tecnologia',
  musica: 'musica',
  vestuario: 'compras',
  casa: 'moradia',
  transporte: 'transporte',
  educacao: 'educacao',
  lazer: 'lazer',
  trabalho: 'outra_despesa',
  hobby: 'lazer',
  outros: 'compras',
};

const elementosLoja = {};
const estado = {
  config: null,
  desejos: [],
  filtroEstado: '',
  filtroCategoria: '',
  filtroPrioridade: '',
  desejoAtualId: null,
  modoEdicaoDesejo: false,
  desejoCompraId: null,
};

function consultarElementoLoja(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento da interface ausente: #${id}`);
  return el;
}

function jogadorAtualLoja() {
  return window.__pulsoJogadorAtual ?? null;
}

function ponte() {
  if (!window.pulso || typeof window.pulso.loja?.listar !== 'function') {
    throw new Error('A ponte window.pulso.loja não está disponível.');
  }
  return window.pulso.loja;
}

function formatarCentavosLoja(centavos) {
  if (!Number.isFinite(centavos)) return 'R$ 0,00';
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const inteiro = String(Math.trunc(absoluto / 100));
  const centavosStr = String(Math.trunc(absoluto % 100)).padStart(2, '0');
  const separado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-R$ ' : 'R$ '}${separado},${centavosStr}`;
}

function formatarCentavosParaEntrada(centavos) {
  return `${String(Math.trunc(centavos / 100))},${String(Math.trunc(centavos % 100)).padStart(2, '0')}`;
}

function lerCentavosLoja(texto) {
  if (typeof texto !== 'string') return null;
  const limpo = texto
    .replace(/\s+/g, '')
    .replace(/R\$/i, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(parseFloat(limpo) * 100);
}

function formatarDataSimplesLoja(dataIso) {
  if (!dataIso) return '—';
  const partes = String(dataIso.slice(0, 10)).split('-');
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(dataIso);
}

function dataHojeIsoLoja() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(
    agora.getDate(),
  ).padStart(2, '0')}`;
}
function mapear() {
  elementosLoja.botaoVerLoja = consultarElementoLoja('botao-ver-loja');
  // lista
  elementosLoja.visaoLoja = consultarElementoLoja('visao-loja');
  elementosLoja.avisoLoja = consultarElementoLoja('aviso-loja');
  elementosLoja.filtrosLoja = consultarElementoLoja('filtros-loja');
  elementosLoja.filtroCategoriaLoja = consultarElementoLoja('filtro-categoria-loja');
  elementosLoja.filtroPrioridadeLoja = consultarElementoLoja('filtro-prioridade-loja');
  elementosLoja.listaDesejos = consultarElementoLoja('lista-desejos');
  elementosLoja.botaoNovoDesejo = consultarElementoLoja('botao-novo-desejo');
  elementosLoja.botaoHistoricoLoja = consultarElementoLoja('botao-historico-loja');
  elementosLoja.botaoVoltarLoja = consultarElementoLoja('botao-voltar-loja');
  // resumo
  elementosLoja.lojaAtivos = consultarElementoLoja('loja-ativos');
  elementosLoja.lojaPlanejados = consultarElementoLoja('loja-planejados');
  elementosLoja.lojaComprados = consultarElementoLoja('loja-comprados');
  elementosLoja.lojaValorEstimado = consultarElementoLoja('loja-valor-estimado');
  elementosLoja.lojaEconomia = consultarElementoLoja('loja-economia');
  // historico
  elementosLoja.visaoLojaHistorico = consultarElementoLoja('visao-loja-historico');
  elementosLoja.avisoLojaHistorico = consultarElementoLoja('aviso-loja-historico');
  elementosLoja.listaCompras = consultarElementoLoja('lista-compras');
  elementosLoja.botaoVoltarLojaHistorico = consultarElementoLoja('botao-voltar-loja-historico');
  // detalhe
  elementosLoja.visaoLojaDetalhe = consultarElementoLoja('visao-loja-detalhe');
  elementosLoja.detalheTitulo = consultarElementoLoja('loja-detalhe-titulo');
  elementosLoja.detalheCategoria = consultarElementoLoja('loja-detalhe-categoria');
  elementosLoja.detalhePrioridade = consultarElementoLoja('loja-detalhe-prioridade');
  elementosLoja.detalheStatus = consultarElementoLoja('loja-detalhe-status');
  elementosLoja.detalheCriado = consultarElementoLoja('loja-detalhe-criado');
  elementosLoja.detalheEsperado = consultarElementoLoja('loja-detalhe-esperado');
  elementosLoja.detalheFinal = consultarElementoLoja('loja-detalhe-final');
  elementosLoja.detalheDiferenca = consultarElementoLoja('loja-detalhe-diferenca');
  elementosLoja.detalhePercentual = consultarElementoLoja('loja-detalhe-percentual');
  elementosLoja.detalheData = consultarElementoLoja('loja-detalhe-data');
  elementosLoja.detalheDescricao = consultarElementoLoja('loja-detalhe-descricao');
  elementosLoja.avisoLojaDetalhe = consultarElementoLoja('aviso-loja-detalhe');
  elementosLoja.acoesLojaDetalhe = consultarElementoLoja('acoes-loja-detalhe');
  elementosLoja.linhaPrecoFinal = consultarElementoLoja('linha-preco-final');
  elementosLoja.linhaDiferenca = consultarElementoLoja('linha-diferenca');
  elementosLoja.linhaPercentual = consultarElementoLoja('linha-percentual');
  elementosLoja.linhaDataCompra = consultarElementoLoja('linha-data-compra');
  // formulario do desejo
  elementosLoja.visaoFormularioDesejo = consultarElementoLoja('visao-formulario-desejo');
  elementosLoja.formularioDesejo = consultarElementoLoja('formulario-desejo');
  elementosLoja.formularioDesejoTituloSecao = consultarElementoLoja('formulario-desejo-titulo-secao');
  elementosLoja.formularioDesejoTitulo = consultarElementoLoja('formulario-desejo-titulo');
  elementosLoja.campoDesejoTitulo = consultarElementoLoja('campo-desejo-titulo');
  elementosLoja.campoDesejoDescricao = consultarElementoLoja('campo-desejo-descricao');
  elementosLoja.campoDesejoCategoria = consultarElementoLoja('campo-desejo-categoria');
  elementosLoja.campoDesejoPrioridade = consultarElementoLoja('campo-desejo-prioridade');
  elementosLoja.campoDesejoPreco = consultarElementoLoja('campo-desejo-preco');
  elementosLoja.avisoFormularioDesejo = consultarElementoLoja('aviso-formulario-desejo');
  elementosLoja.botaoSalvarDesejo = consultarElementoLoja('botao-salvar-desejo');
  elementosLoja.botaoCancelarDesejo = consultarElementoLoja('botao-cancelar-desejo');
  // formulario de compra
  elementosLoja.visaoFormularioCompra = consultarElementoLoja('visao-formulario-compra');
  elementosLoja.formularioCompra = consultarElementoLoja('formulario-compra');
  elementosLoja.compraResumoItem = consultarElementoLoja('compra-resumo-item');
  elementosLoja.compraResumoEsperado = consultarElementoLoja('compra-resumo-esperado');
  elementosLoja.compraResumoFinanceiro = consultarElementoLoja('compra-resumo-financeiro');
  elementosLoja.campoCompraPreco = consultarElementoLoja('campo-compra-preco');
  elementosLoja.campoCompraData = consultarElementoLoja('campo-compra-data');
  elementosLoja.campoCompraObservacao = consultarElementoLoja('campo-compra-observacao');
  elementosLoja.avisoFormularioCompra = consultarElementoLoja('aviso-formulario-compra');
  elementosLoja.botaoSalvarCompra = consultarElementoLoja('botao-salvar-compra');
  elementosLoja.botaoCancelarCompra = consultarElementoLoja('botao-cancelar-compra');
}

function rotuloCategoriaLoja(codigo) {
  return (
    estado.config?.categorias?.find((c) => c.valor === codigo)?.rotulo ??
    String(codigo ?? '—').toUpperCase()
  );
}

function rotuloPrioridadeLoja(codigo) {
  return estado.config?.rotulosPrioridades?.[codigo] ?? String(codigo ?? '—');
}

function rotuloEstadoLoja(codigo) {
  return estado.config?.rotulosEstados?.[codigo] ?? String(codigo ?? '—');
}

function rotuloCategoriaFinanceira(codigo) {
  return CATEGORIA_FINANCEIRA_ROTULOS[codigo] ?? String(codigo ?? '—').toUpperCase();
}

function exibirVisaoLoja(nome) {
  for (const visao of ['visao-loja', 'visao-loja-historico', 'visao-loja-detalhe', 'visao-formulario-desejo', 'visao-formulario-compra']) {
    consultarElementoLoja(visao).classList.toggle('oculto', visao !== nome);
  }
  consultarElementoLoja('visao-configuracao').classList.add('oculto');
  consultarElementoLoja('visao-boot').classList.add('oculto');
  if (nome === 'visao-boot') consultarElementoLoja('visao-boot').classList.remove('oculto');
}

function irParaLoja() {
  exibirVisaoLoja('visao-loja');
  carregarResumo();
  carregarDesejos();
}

function voltarAoPainelPulso() {
  exibirVisaoLoja('visao-boot');
}

function preencherConfig(config) {
  estado.config = config;
  for (const select of [elementosLoja.filtroCategoriaLoja, elementosLoja.campoDesejoCategoria]) {
    const atual = select.value;
    select.replaceChildren();
    if (select === elementosLoja.filtroCategoriaLoja) {
      const opcao = document.createElement('option');
      opcao.value = '';
      opcao.textContent = 'TODAS AS CATEGORIAS';
      select.append(opcao);
    }
    for (const cat of config.categorias) {
      const opcao = document.createElement('option');
      opcao.value = cat.valor;
      opcao.textContent = cat.rotulo;
      select.append(opcao);
    }
    select.value = atual;
  }
  for (const select of [elementosLoja.filtroPrioridadeLoja, elementosLoja.campoDesejoPrioridade]) {
    const atual = select.value;
    select.replaceChildren();
    if (select === elementosLoja.filtroPrioridadeLoja) {
      const opcao = document.createElement('option');
      opcao.value = '';
      opcao.textContent = 'TODAS AS PRIORIDADES';
      select.append(opcao);
    }
    for (const prio of config.prioridades) {
      const opcao = document.createElement('option');
      opcao.value = prio;
      opcao.textContent = config.rotulosPrioridades[prio] ?? prio;
      select.append(opcao);
    }
    select.value = atual;
  }
}

async function carregarConfig() {
  if (estado.config) return;
  try {
    const resultado = await ponte().config();
    if (resultado.ok) preencherConfig(resultado.config);
  } catch (erro) {
    console.error(`PULSO: falha ao carregar config da loja — ${erro.message}`, erro);
  }
}

async function carregarResumo() {
  const jogador = jogadorAtualLoja();
  if (!jogador) return;
  try {
    const resultado = await ponte().resumo(jogador.id);
    if (!resultado.ok) return;
    const resumo = resultado.resumo ?? {};
    elementosLoja.lojaAtivos.textContent = String(resumo.ativos ?? 0);
    elementosLoja.lojaPlanejados.textContent = String(resumo.planejados ?? 0);
    elementosLoja.lojaComprados.textContent = String(resumo.comprados ?? 0);
    elementosLoja.lojaValorEstimado.textContent = formatarCentavosLoja(resumo.valorEstimado ?? 0);
    elementosLoja.lojaEconomia.textContent = formatarCentavosLoja(resumo.economiaHistorica ?? 0);
  } catch (erro) {
    console.error(`PULSO: falha ao carregar resumo da loja — ${erro.message}`, erro);
  }
}

async function carregarDesejos() {
  const jogador = jogadorAtualLoja();
  if (!jogador) return;
  try {
    const resultado = await ponte().listar(jogador.id, {
      estado: estado.filtroEstado || null,
      categoria: estado.filtroCategoria || null,
      prioridade: estado.filtroPrioridade || null,
    });
    if (!resultado.ok) {
      elementosLoja.avisoLoja.textContent = resultado.mensagem ?? 'Não foi possível carregar a lista de desejos.';
      return;
    }
    estado.desejos = resultado.desejos ?? [];
    renderizarDesejos();
  } catch (erro) {
    elementosLoja.avisoLoja.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao carregar desejos — ${erro.message}`, erro);
  }
}

function renderizarDesejos() {
  elementosLoja.listaDesejos.replaceChildren();
  if (estado.desejos.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'missoes-vazio';
    vazio.textContent = 'Nenhum desejo nesta seleção.';
    elementosLoja.listaDesejos.append(vazio);
    return;
  }
  for (const desejo of estado.desejos) {
    elementosLoja.listaDesejos.append(criarItemDesejo(desejo));
  }
}

function criarItemDesejo(desejo) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'missao-item desejo-item';
  item.dataset.id = String(desejo.id);
  item.onclick = () => visualizarDesejo(desejo.id);

  const topo = document.createElement('span');
  topo.className = 'desejo-topo';

  const titulo = document.createElement('span');
  titulo.className = 'missao-item-titulo';
  titulo.textContent = desejo.titulo;

  const prioridade = document.createElement('span');
  prioridade.className = `desejo-prioridade prioridade-${desejo.prioridade}`;
  prioridade.textContent = rotuloPrioridadeLoja(desejo.prioridade);
  topo.append(titulo, prioridade);

  const meta = document.createElement('span');
  meta.className = 'desejo-meta';
  meta.textContent = `${rotuloCategoriaLoja(desejo.categoria)} · Esperado: ${formatarCentavosLoja(
    desejo.precoEsperado,
  )}`;

  const estadoEl = document.createElement('span');
  estadoEl.className = `missao-item-estado desejo-estado estado-${desejo.estado}`;
  estadoEl.textContent = rotuloEstadoLoja(desejo.estado);

  item.append(topo, meta, estadoEl);
  return item;
}

async function visualizarDesejo(id) {
  try {
    const resultado = await ponte().obter(id);
function renderizarDetalhe(desejo) {
  estado.desejoAtualId = desejo.id;
  elementosLoja.detalheTitulo.textContent = desejo.titulo;
  elementosLoja.detalheCategoria.textContent = rotuloCategoriaLoja(desejo.categoria);
  elementosLoja.detalhePrioridade.textContent = rotuloPrioridadeLoja(desejo.prioridade);
  elementosLoja.detalheStatus.textContent = rotuloEstadoLoja(desejo.estado);
  elementosLoja.detalheCriado.textContent = formatarDataSimplesLoja(desejo.criadoEm);
  elementosLoja.detalheEsperado.textContent = formatarCentavosLoja(desejo.precoEsperado);

  const comprado = desejo.estado === 'comprado';
  elementosLoja.linhaPrecoFinal.classList.toggle('oculto', !comprado);
  elementosLoja.linhaDiferenca.classList.toggle('oculto', !comprado);
  elementosLoja.linhaPercentual.classList.toggle('oculto', !comprado);
  elementosLoja.linhaDataCompra.classList.toggle('oculto', !comprado);

  if (comprado) {
    elementosLoja.detalheFinal.textContent = formatarCentavosLoja(desejo.precoFinal ?? 0);
    const diferenca = desejo.diferencaCentavos ?? 0;
    elementosLoja.detalheDiferenca.textContent = formatarCentavosLoja(diferenca);
    elementosLoja.detalheDiferenca.classList.toggle('desejo-economia', diferenca <= 0);
    elementosLoja.detalheDiferenca.classList.toggle('desejo-custo', diferenca > 0);
    elementosLoja.detalhePercentual.textContent =
      desejo.percentual === null
        ? '—'
        : `${desejo.percentual > 0 ? '+' : ''}${desejo.percentual}%`;
    elementosLoja.detalheData.textContent = formatarDataSimplesLoja(
      desejo.dataCompra ?? desejo.compradoEm,
    );
  }

  elementosLoja.detalheDescricao.textContent = desejo.descricao || '';
  elementosLoja.avisoLojaDetalhe.textContent = '';
  montarAcoesDetalhe(desejo);
}

function montarAcoesDetalhe(desejo) {
  elementosLoja.acoesLojaDetalhe.replaceChildren();
  const acoes = [];

  const voltar = document.createElement('button');
  voltar.type = 'button';
  voltar.className = 'botao-secundario';
  voltar.textContent = 'VOLTAR À LISTA';
  voltar.addEventListener('click', () => {
    exibirVisaoLoja('visao-loja');
    carregarDesejos();
  });
  acoes.push(voltar);

  const ativo =
    desejo.estado === 'desejado' || desejo.estado === 'em_analise' || desejo.estado === 'planejado';
  if (!ativo) {
    elementosLoja.acoesLojaDetalhe.append(...acoes);
    return;
  }

  const editar = document.createElement('button');
  editar.type = 'button';
  editar.className = 'botao-secundario';
  editar.textContent = 'EDITAR';
  editar.addEventListener('click', () => exibirFormularioDesejo(desejo));
  acoes.push(editar);

  if (desejo.estado === 'desejado') {
    const analisar = document.createElement('button');
    analisar.type = 'button';
    analisar.className = 'botao-secundario';
    analisar.textContent = 'ANALISAR';
    analisar.addEventListener('click', () => acaoEstado('analisar', desejo));
    acoes.push(analisar);
  }

  if (desejo.estado === 'desejado' || desejo.estado === 'em_analise') {
    const planejar = document.createElement('button');
    planejar.type = 'button';
    planejar.className = 'botao-secundario';
    planejar.textContent = 'PLANEJAR';
    planejar.addEventListener('click', () => acaoEstado('planejar', desejo));
    acoes.push(planejar);
  }

  if (desejo.estado === 'planejado') {
    const comprar = document.createElement('button');
    comprar.type = 'button';
    comprar.className = 'botao-primario';
    comprar.textContent = 'REGISTRAR COMPRA';
    comprar.addEventListener('click', () => exibirFormularioCompra(desejo));
    acoes.push(comprar);
  }

  const cancelar = document.createElement('button');
  cancelar.type = 'button';
  cancelar.className = 'botao-perigo';
  cancelar.textContent = 'CANCELAR DESEJO';
  cancelar.addEventListener('click', () => acaoEstado('cancelar', desejo));
  acoes.push(cancelar);

  elementosLoja.acoesLojaDetalhe.append(...acoes);
}

async function acaoEstado(acao, desejo) {
  elementosLoja.avisoLojaDetalhe.textContent = '';
  try {
    const resultado =
      acao === 'analisar'
        ? await ponte().analisar(desejo.id)
        : acao === 'planejar'
          ? await ponte().planejar(desejo.id)
          : await ponte().cancelar(desejo.id);
    if (!resultado.ok) {
      elementosLoja.avisoLojaDetalhe.textContent =
        resultado.mensagem ?? 'Não foi possível executar a ação.';
      return;
    }
    renderizarDetalhe(resultado.desejo);
    carregarResumo();
    carregarDesejos();
  } catch (erro) {
    elementosLoja.avisoLojaDetalhe.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha na ação da loja — ${erro.message}`, erro);
  }
}
    if (!resultado.ok) {
      elementosLoja.avisoLojaDetalhe.textContent = resultado.mensagem ?? 'Não foi possível abrir o desejo.';
      return;
    }
    renderizarDetalhe(resultado.desejo);
    exibirVisaoLoja('visao-loja-detalhe');
  } catch (erro) {
    elementosLoja.avisoLojaDetalhe.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao abrir desejo — ${erro.message}`, erro);
  }
}

function exibirFormularioDesejo(desejo = null) {
  estado.modoEdicaoDesejo = !!desejo;
  elementosLoja.formularioDesejoTituloSecao.textContent = desejo ? 'EDITAR DESEJO' : 'NOVO DESEJO';
  elementosLoja.formularioDesejoTitulo.textContent = desejo ? 'Ajustar expectativa' : 'Adicionar à lista';
  elementosLoja.campoDesejoTitulo.value = desejo?.titulo ?? '';
  elementosLoja.campoDesejoDescricao.value = desejo?.descricao ?? '';
  elementosLoja.campoDesejoCategoria.value = desejo?.categoria ?? '';
  elementosLoja.campoDesejoPrioridade.value = desejo?.prioridade ?? 'normal';
  elementosLoja.campoDesejoPreco.value = desejo
    ? formatarCentavosParaEntrada(desejo.precoEsperado)
    : '';
  elementosLoja.avisoFormularioDesejo.textContent = '';
  exibirVisaoLoja('visao-formulario-desejo');
  elementosLoja.campoDesejoTitulo.focus();
}

async function salvarDesejo(evento) {
  evento.preventDefault();
  const jogador = jogadorAtualLoja();
  if (!jogador) return;
  elementosLoja.avisoFormularioDesejo.textContent = '';
  const precoCentavos = lerCentavosLoja(elementosLoja.campoDesejoPreco.value);
  const dados = {
    jogadorId: jogador.id,
    titulo: elementosLoja.campoDesejoTitulo.value,
    descricao: elementosLoja.campoDesejoDescricao.value || null,
    categoria: elementosLoja.campoDesejoCategoria.value,
    prioridade: elementosLoja.campoDesejoPrioridade.value,
    precoEsperado: precoCentavos,
  };
  try {
    const resultado = estado.modoEdicaoDesejo
      ? await ponte().atualizar({ id: estado.desejoAtualId, ...dados })
      : await ponte().criar(dados);
    if (!resultado.ok) {
      elementosLoja.avisoFormularioDesejo.textContent =
        resultado.mensagem ?? 'Não foi possível salvar o desejo.';
      return;
    }
    carregarResumo();
    carregarDesejos();
    if (estado.modoEdicaoDesejo) {
      renderizarDetalhe(resultado.desejo);
      exibirVisaoLoja('visao-loja-detalhe');
    } else {
      exibirVisaoLoja('visao-loja');
    }
  } catch (erro) {
    elementosLoja.avisoFormularioDesejo.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao salvar desejo — ${erro.message}`, erro);
  }
}

function exibirFormularioCompra(desejo) {
  estado.desejoCompraId = desejo.id;
  elementosLoja.compraResumoItem.textContent = `Item: ${desejo.titulo}`;
  elementosLoja.compraResumoEsperado.textContent = `Preço esperado: ${formatarCentavosLoja(
    desejo.precoEsperado,
  )}`;
  elementosLoja.compraResumoFinanceiro.textContent = `Categoria financeira (Fase 08): ${rotuloCategoriaFinanceira(
    MAPA_CATEGORIA_FINANCEIRA[desejo.categoria] ?? 'outra_despesa',
  )}`;
  elementosLoja.campoCompraPreco.value = formatarCentavosParaEntrada(desejo.precoEsperado);
  elementosLoja.campoCompraData.value = dataHojeIsoLoja();
  elementosLoja.campoCompraObservacao.value = '';
  elementosLoja.avisoFormularioCompra.textContent = '';
  exibirVisaoLoja('visao-formulario-compra');
  elementosLoja.campoCompraPreco.focus();
}

async function salvarCompra(evento) {
  evento.preventDefault();
  elementosLoja.avisoFormularioCompra.textContent = '';
  const precoFinal = lerCentavosLoja(elementosLoja.campoCompraPreco.value);
  const dados = {
    precoFinal,
    data: elementosLoja.campoCompraData.value || null,
    observacao: elementosLoja.campoCompraObservacao.value || null,
  };
  try {
    const resultado = await ponte().comprar(estado.desejoCompraId, dados);
    if (!resultado.ok) {
      elementosLoja.avisoFormularioCompra.textContent =
        resultado.mensagem ?? 'Não foi possível registrar a compra.';
      return;
    }
    renderizarDetalhe(resultado.desejo);
    exibirVisaoLoja('visao-loja-detalhe');
    carregarResumo();
    carregarDesejos();
  } catch (erro) {
    elementosLoja.avisoFormularioCompra.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao registrar compra — ${erro.message}`, erro);
  }
}

async function carregarHistorico() {
  const jogador = jogadorAtualLoja();
  if (!jogador) return;
  try {
    const resultado = await ponte().historico(jogador.id);
    if (!resultado.ok) {
      elementosLoja.avisoLojaHistorico.textContent =
        resultado.mensagem ?? 'Não foi possível carregar o histórico.';
      return;
    }
    renderizarHistorico(resultado.compras ?? []);
    exibirVisaoLoja('visao-loja-historico');
  } catch (erro) {
    elementosLoja.avisoLojaHistorico.textContent = 'Falha de comunicação com o núcleo.';
    console.error(`PULSO: falha ao carregar histórico — ${erro.message}`, erro);
  }
}

function renderizarHistorico(compras) {
  elementosLoja.listaCompras.replaceChildren();
  if (compras.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'missoes-vazio';
    vazio.textContent = 'Nenhuma compra registrada ainda.';
    elementosLoja.listaCompras.append(vazio);
    return;
  }
  for (const compra of compras) {
    elementosLoja.listaCompras.append(criarItemCompra(compra));
  }
}

function criarItemCompra(compra) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'missao-item desejo-item';
  item.dataset.id = String(compra.id);
  item.onclick = () => visualizarDesejo(compra.id);

  const titulo = document.createElement('span');
  titulo.className = 'missao-item-titulo';
  titulo.textContent = compra.titulo;

  const data = document.createElement('span');
  data.className = 'missao-prazo';
  data.textContent = formatarDataSimplesLoja(compra.dataCompra ?? compra.compradoEm);

  const valores = document.createElement('span');
  valores.className = 'desejo-meta';
  valores.textContent = `Esperado: ${formatarCentavosLoja(compra.precoEsperado)} · Pago: ${formatarCentavosLoja(
    compra.precoFinal ?? 0,
  )}`;

  const diferenca = document.createElement('span');
  const dif = compra.diferencaCentavos ?? 0;
  diferenca.className = `desejo-diferenca ${dif <= 0 ? 'desejo-economia' : 'desejo-custo'}`;
  diferenca.textContent =
    dif <= 0 ? `Economia: ${formatarCentavosLoja(-dif)}` : `Acima: ${formatarCentavosLoja(dif)}`;

  item.append(data, titulo, valores, diferenca);
  return item;
}

function aplicarFiltroEstado(botao) {
  estado.filtroEstado = botao.dataset.filtro ?? '';
  for (const b of elementosLoja.filtrosLoja.querySelectorAll('[data-filtro]')) {
    b.classList.toggle('ativo', b === botao);
  }
  carregarDesejos();
}

function registrarEventos() {
  elementosLoja.botaoVerLoja.addEventListener('click', irParaLoja);
  elementosLoja.filtrosLoja.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-filtro]');
    if (!botao) return;
    aplicarFiltroEstado(botao);
  });
  elementosLoja.filtroCategoriaLoja.addEventListener('change', () => {
    estado.filtroCategoria = elementosLoja.filtroCategoriaLoja.value;
    carregarDesejos();
  });
  elementosLoja.filtroPrioridadeLoja.addEventListener('change', () => {
    estado.filtroPrioridade = elementosLoja.filtroPrioridadeLoja.value;
    carregarDesejos();
  });
  elementosLoja.botaoNovoDesejo.addEventListener('click', () => {
    estado.desejoAtualId = null;
    exibirFormularioDesejo();
  });
  elementosLoja.botaoHistoricoLoja.addEventListener('click', carregarHistorico);
  elementosLoja.botaoVoltarLoja.addEventListener('click', voltarAoPainelPulso);
  elementosLoja.botaoVoltarLojaHistorico.addEventListener('click', () => {
    exibirVisaoLoja('visao-loja');
    carregarDesejos();
  });
  elementosLoja.formularioDesejo.addEventListener('submit', salvarDesejo);
  elementosLoja.botaoSalvarDesejo.addEventListener('click', (e) => {
    e.preventDefault();
    salvarDesejo(e);
  });
  elementosLoja.botaoCancelarDesejo.addEventListener('click', () => {
    if (estado.desejoAtualId) {
      visualizarDesejo(estado.desejoAtualId);
    } else {
      exibirVisaoLoja('visao-loja');
      carregarDesejos();
    }
  });
  elementosLoja.formularioCompra.addEventListener('submit', salvarCompra);
  elementosLoja.botaoSalvarCompra.addEventListener('click', (e) => {
    e.preventDefault();
    salvarCompra(e);
  });
  elementosLoja.botaoCancelarCompra.addEventListener('click', () => {
    if (estado.desejoCompraId) visualizarDesejo(estado.desejoCompraId);
    else exibirVisaoLoja('visao-loja');
  });
}

/** Permite que principal.js navegue para a loja (botão do painel). */
window.__irParaLoja = irParaLoja;

document.addEventListener('DOMContentLoaded', () => {
  mapear();
  registrarEventos();
  carregarConfig();
});