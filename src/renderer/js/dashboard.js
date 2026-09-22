/**
 * PULSO — Renderer: DASHBOARD (Fase 15 — painel consolidado)
 *
 * CAMADA DE VISUALIZAÇÃO: nenhuma regra de negócio aqui. Tudo que aparece
 * vem da visão consolidada por IPC (window.pulso.dashboard.visao), que reúne
 * os módulos existentes (Fases 03–10). O dashboard não cria, não altera e
 * não duplica dados.
 *
 * Período financeiro: mês civil (padrão = mês atual), alterável pelos
 * atalhos ‹ / › / MÊS ATUAL. O saldo exibido é SEMPRE o saldo atual da
 * carteira (Fase 08), independentemente do filtro de período.
 *
 * Ações rápidas: chamam os fluxos existentes via window.__* (expostos por
 * principal.js / contas.js / servicos.js) — nenhum fluxo é reimplementado.
 */

const VISAO_DASHBOARD = 'visao-dashboard';

/** Todas as outras visões da aplicação — escondidas ao entrar no dashboard. */
const VISOES_A_COBRIR = [
  'visao-configuracao', 'visao-boot',
  'visao-missao', 'visao-missoes', 'visao-formulario-missao',
  'visao-projeto', 'visao-projetos', 'visao-formulario-projeto',
  'visao-financas', 'visao-formulario-transacao', 'visao-formulario-orcamento',
  'visao-loja', 'visao-loja-historico', 'visao-loja-detalhe',
  'visao-formulario-desejo', 'visao-formulario-compra',
  'visao-servicos', 'visao-servico-detalhe', 'visao-formulario-servico',
  'visao-contas', 'visao-conta-detalhe', 'visao-formulario-conta',
  'visao-formulario-pagamento-conta', 'resultado-pagamento',
  'visao-recorrencias', 'visao-recorrencia-detalhe', 'visao-formulario-recorrencia',
  'visao-servicos-despesas',
];

const elementosDashboard = {};

/** Competência do período atualmente exibido (`AAAA-MM`) ou null = mês atual. */
let periodoAnoMes = null;

function consultarElementoDashboard(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento da interface ausente: #${id}`);
  return el;
}

function mapearDashboard() {
  elementosDashboard.visao = consultarElementoDashboard(VISAO_DASHBOARD);
  elementosDashboard.aviso = consultarElementoDashboard('dashboard-aviso');
  // operador
  elementosDashboard.jogadorNome = consultarElementoDashboard('dash-jogador-nome');
  elementosDashboard.jogadorCodinome = consultarElementoDashboard('dash-jogador-codinome');
  elementosDashboard.nivel = consultarElementoDashboard('dash-nivel');
  elementosDashboard.xpTotal = consultarElementoDashboard('dash-xp-total');
  elementosDashboard.barraXp = consultarElementoDashboard('dash-barra-xp');
  elementosDashboard.barraXpPreenchimento = consultarElementoDashboard('dash-barra-xp-preenchimento');
  elementosDashboard.xpProgresso = consultarElementoDashboard('dash-xp-progresso');
  elementosDashboard.pontos = consultarElementoDashboard('dash-pontos');
  // blocos
  elementosDashboard.status = consultarElementoDashboard('dash-status');
  elementosDashboard.atributos = consultarElementoDashboard('dash-atributos');
  elementosDashboard.missoes = consultarElementoDashboard('dash-missoes');
  elementosDashboard.projetos = consultarElementoDashboard('dash-projetos');
  elementosDashboard.projetosProgresso = consultarElementoDashboard('dash-projetos-progresso');
  elementosDashboard.financas = consultarElementoDashboard('dash-financas');
  elementosDashboard.orcamentos = consultarElementoDashboard('dash-orcamentos');
  elementosDashboard.periodoRotulo = consultarElementoDashboard('dash-periodo-rotulo');
  elementosDashboard.servicosContas = consultarElementoDashboard('dash-servicos-contas');
  elementosDashboard.proximasContas = consultarElementoDashboard('dash-proximas-contas');
  // controles
  elementosDashboard.periodoAnterior = consultarElementoDashboard('dash-periodo-anterior');
  elementosDashboard.periodoProximo = consultarElementoDashboard('dash-periodo-proximo');
  elementosDashboard.periodoAtual = consultarElementoDashboard('dash-periodo-atual');
  elementosDashboard.atualizar = consultarElementoDashboard('dash-atualizar');
  elementosDashboard.irBoot = consultarElementoDashboard('dash-ir-boot');
}

// ── Formatação (apresentação; valores vêm em centavos da Fase 08) ────────

function formatarCentavosDash(centavos) {
  if (!Number.isFinite(centavos)) return 'R$ 0,00';
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const inteiro = String(Math.trunc(absoluto / 100));
  const centavosStr = String(Math.trunc(absoluto % 100)).padStart(2, '0');
  const separado = inteiro.replace(/\B(?=(\d{3})+(?!))/g, '.');
  return `${negativo ? '-R$ ' : 'R$ '}${separado},${centavosStr}`;
}

function formatarDataDash(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

// ── Blocos de contagens (componente reutilizável de apresentação) ────────

/** Cria `<div><span class="dash-contagem-rotulo">…</span><span class="dash-contagem-valor">…</span></div>`. */
function criarContagem(rotulo, valor, classeExtra = null) {
  const item = document.createElement('div');
  const spanRotulo = document.createElement('span');
  spanRotulo.className = 'dash-contagem-rotulo';
  spanRotulo.textContent = rotulo;
  const spanValor = document.createElement('span');
  spanValor.className = 'dash-contagem-valor';
  if (classeExtra) spanValor.classList.add(classeExtra);
  spanValor.textContent = valor;
  item.append(spanRotulo, spanValor);
  return item;
}

/** Preenche um contêiner com as contagens; mostra estado vazio quando 0 de tudo. */
function renderizarContagens(container, pares, { forcar = false } = {}) {
  container.replaceChildren();
  const algumPositivo = pares.some(([, valor]) => Number(valor) > 0);
  if (!forcar && !algumPositivo) {
    container.append(criarVazio('Nada registrado ainda.'));
    return;
  }
  for (const [rotulo, valor, classeExtra] of pares) {
    container.append(criarContagem(rotulo, String(valor), classeExtra));
  }
}

/** Parágrafo de estado vazio (nunca dados fictícios). */
function criarVazio(texto) {
  const vazio = document.createElement('p');
  vazio.className = 'dash-vazio';
  vazio.textContent = texto;
  return vazio;
}

/** Barra de progresso reutilizável (0–1). */
function criarBarraDash(percentual, texto) {
  const linha = document.createElement('div');
  linha.className = 'dash-progresso';
  const barra = document.createElement('span');
  barra.className = 'dash-progresso-barra';
  const preenchimento = document.createElement('span');
  preenchimento.className = 'dash-progresso-preenchimento';
  const limitado = Math.max(0, Math.min(1, Number(percentual) || 0));
  preenchimento.style.width = `${Math.round(limitado * 100)}%`;
  barra.append(preenchimento);
  const rotulo = document.createElement('span');
  rotulo.className = 'dash-progresso-texto';
  rotulo.textContent = texto;
  linha.append(barra, rotulo);
  return linha;
}

// ── Renderização dos blocos ──────────────────────────────────────────────

const STATUS_ROTULOS_DASH = { energia: 'ENERGIA', foco: 'FOCO', estresse: 'ESTRESSE', criatividade: 'CRIATIVIDADE' };
const ATRIBUTOS_ROTULOS_DASH = {
  tecnologia: 'TECNOLOGIA', criatividade: 'CRIATIVIDADE', musica: 'MÚSICA',
  social: 'SOCIAL', energia: 'ENERGIA', foco: 'FOCO', disciplina: 'DISCIPLINA',
};

function renderizarOperador(visao) {
  const { jogador, progressao } = visao;
  elementosDashboard.jogadorNome.textContent = jogador.nome ?? '—';
  const codinome = jogador.codinome ? `CODINOME: ${jogador.codinome}` : '';
  elementosDashboard.jogadorCodinome.textContent = codinome;
  elementosDashboard.jogadorCodinome.hidden = !codinome;

  elementosDashboard.nivel.textContent = `NÍVEL ${progressao.nivel}`;
  elementosDashboard.xpTotal.textContent = `XP TOTAL: ${progressao.xpTotal}`;
  elementosDashboard.xpProgresso.textContent = `XP NO NÍVEL: ${progressao.xpNoNivel}/${progressao.xpNecessario}`;
  elementosDashboard.pontos.textContent = `Pontos de atributo disponíveis: ${progressao.pontosDisponiveis}`;
  elementosDashboard.barraXp.setAttribute('aria-valuenow', String(Math.round(progressao.progresso * 100)));
  elementosDashboard.barraXpPreenchimento.style.width = `${Math.round(progressao.progresso * 100)}%`;
}

function renderizarStatus(status) {
  elementosDashboard.status.replaceChildren();
  for (const nome of ['energia', 'foco', 'estresse', 'criatividade']) {
    const linha = document.createElement('div');
    linha.className = 'dash-status-item';
    const rotulo = document.createElement('span');
    rotulo.className = 'dash-contagem-rotulo';
    rotulo.textContent = STATUS_ROTULOS_DASH[nome];
    const barra = criarBarraDash(status[nome] / 100, `${status[nome]}/100`);
    linha.append(rotulo, barra);
    elementosDashboard.status.append(linha);
  }
}

function renderizarAtributos(atributos) {
  elementosDashboard.atributos.replaceChildren();
  const nomes = ['tecnologia', 'criatividade', 'musica', 'social', 'energia', 'foco', 'disciplina'];
  for (const nome of nomes) {
    elementosDashboard.atributos.append(
      criarContagem(ATRIBUTOS_ROTULOS_DASH[nome], atributos[nome] ?? 0),
    );
  }
}

function renderizarMissoes(missoes) {
  renderizarContagens(elementosDashboard.missoes, [
    ['PENDENTES', missoes.pendentes],
    ['EM ANDAMENTO', missoes.emAndamento],
    ['CONCLUÍDAS', missoes.concluidas],
    ['ATRASADAS', missoes.atrasadas, missoes.atrasadas > 0 ? 'alerta' : null],
    ['CANCELADAS', missoes.canceladas],
  ]);
}

function renderizarProjetos(projetos) {
  renderizarContagens(elementosDashboard.projetos, [
    ['PLANEJADOS', projetos.planejados],
    ['EM ANDAMENTO', projetos.emAndamento],
    ['CONCLUÍDOS', projetos.concluidos],
    ['ATRASADOS', projetos.atrasados, projetos.atrasados > 0 ? 'alerta' : null],
  ]);
  elementosDashboard.projetosProgresso.replaceChildren();
  for (const projeto of projetos.emAndamentoLista) {
    const item = document.createElement('div');
    item.className = 'dash-progresso-item';
    const titulo = document.createElement('span');
    titulo.className = 'dash-progresso-titulo';
    titulo.textContent = projeto.atrasado ? `${projeto.titulo} (ATRASADO)` : projeto.titulo;
    if (projeto.atrasado) titulo.classList.add('alerta');
    const barra = criarBarraDash(
      projeto.progresso,
      `${projeto.missoesConcluidas}/${projeto.totalMissoes}`,
    );
    item.append(titulo, barra);
    elementosDashboard.projetosProgresso.append(item);
  }
  if (projetos.emAndamentoLista.length === 0) {
    elementosDashboard.projetosProgresso.append(criarVazio('Nenhum projeto em andamento.'));
  }
}

function renderizarFinancas(financas, periodo) {
  elementosDashboard.periodoRotulo.textContent = periodo.rotulo;
  // O saldo e o período são SEMPRE exibidos (mesmo em R$ 0,00): são os
  // indicadores financeiros obrigatórios do dashboard (Fase 08).
  renderizarContagens(elementosDashboard.financas, [
    ['SALDO ATUAL', formatarCentavosDash(financas.saldoAtualCentavos)],
    ['RECEITAS DO PERÍODO', formatarCentavosDash(financas.receitasPeriodoCentavos)],
    ['DESPESAS DO PERÍODO', formatarCentavosDash(financas.despesasPeriodoCentavos)],
  ], { forcar: true });
  elementosDashboard.orcamentos.replaceChildren();
  if (financas.orcamentos.length === 0) {
    elementosDashboard.orcamentos.append(criarVazio('Nenhum orçamento vigente no período.'));
    return;
  }
  for (const orcamento of financas.orcamentos) {
    const item = document.createElement('div');
    item.className = 'dash-progresso-item';
    const titulo = document.createElement('span');
    titulo.className = 'dash-progresso-titulo';
    titulo.textContent = orcamento.estourado ? `${orcamento.nome} (ESTOURADO)` : orcamento.nome;
    if (orcamento.estourado) titulo.classList.add('alerta');
    const barra = criarBarraDash(
      orcamento.percentual,
      `${formatarCentavosDash(orcamento.gastoCentavos)} / ${formatarCentavosDash(orcamento.valorCentavos)}`,
    );
    item.append(titulo, barra);
    elementosDashboard.orcamentos.append(item);
  }
}

function renderizarServicosContas(contas, servicos) {
  renderizarContagens(elementosDashboard.servicosContas, [
    ['SERVIÇOS ATIVOS', servicos.ativos],
    ['CONTAS PENDENTES', contas.pendentes],
    ['CONTAS VENCIDAS', contas.vencidas, contas.vencidas > 0 ? 'alerta' : null],
    ['VALOR EM ABERTO', formatarCentavosDash(contas.valorEmAbertoCentavos)],
  ]);
  elementosDashboard.proximasContas.replaceChildren();
  if (contas.proximas.length === 0) {
    const vazio = document.createElement('li');
    vazio.className = 'dash-vazio';
    vazio.textContent = 'Nenhuma conta em aberto.';
    elementosDashboard.proximasContas.append(vazio);
    return;
  }
  for (const conta of contas.proximas) {
    const item = document.createElement('li');
    item.className = 'dash-conta-item';
    if (conta.situacao === 'vencida') item.classList.add('vencida');
    const nome = document.createElement('span');
    nome.className = 'dash-conta-nome';
    nome.textContent = conta.nomeServico ?? conta.descricao ?? `Conta ${conta.id}`;
    const detalhes = document.createElement('span');
    detalhes.className = 'dash-conta-detalhes';
    const situacao = conta.situacao === 'vencida' ? 'VENCIDA' : 'PENDENTE';
    detalhes.textContent = `${situacao} · vence ${formatarDataDash(conta.vencimento)} · ${formatarCentavosDash(conta.valorEsperado)}`;
    item.append(nome, detalhes);
    elementosDashboard.proximasContas.append(item);
  }
}

// ── Navegação e carregamento ─────────────────────────────────────────────

/** Entra no dashboard: cobre as outras visões e carrega a visão consolidada. */
function exibirDashboard() {
  for (const nome of VISOES_A_COBRIR) {
    const el = document.getElementById(nome);
    if (el) el.classList.add('oculto');
  }
  elementosDashboard.visao.classList.remove('oculto');
  elementosDashboard.aviso.textContent = '';
  carregarVisaoDashboard();
}

/** Volta ao painel de boot (tela principal de identidade/status). */
function voltarAoBoot() {
  elementosDashboard.visao.classList.add('oculto');
  const boot = document.getElementById('visao-boot');
  if (boot) boot.classList.remove('oculto');
}

/** Carrega a visão consolidada via IPC (somente leitura). */
async function carregarVisaoDashboard() {
  const jogador = window.__pulsoJogadorAtual ?? null;
  if (!jogador) {
    elementosDashboard.aviso.textContent = 'Nenhum jogador identificado.';
    return;
  }
  const ponte = window.pulso?.dashboard;
  if (!ponte?.visao) {
    elementosDashboard.aviso.textContent = 'A ponte do dashboard não está disponível.';
    return;
  }
  try {
    const resultado = await ponte.visao({ anoMes: periodoAnoMes });
    if (!resultado.ok) {
      elementosDashboard.aviso.textContent = resultado.mensagem ?? 'Não foi possível carregar o dashboard.';
      return;
    }
    renderizarTudoDashboard(resultado.visao);
    elementosDashboard.aviso.textContent = '';
  } catch (erro) {
    console.error(`PULSO: falha ao carregar o dashboard — ${erro.message}`, erro);
    elementosDashboard.aviso.textContent = 'Falha interna ao carregar o dashboard.';
  }
}

function renderizarTudoDashboard(visao) {
  renderizarOperador(visao);
  renderizarStatus(visao.status);
  renderizarAtributos(visao.progressao.atributos);
  renderizarMissoes(visao.missoes);
  renderizarProjetos(visao.projetos);
  renderizarFinancas(visao.financas, visao.periodo);
  renderizarServicosContas(visao.contas, visao.servicos);
}

// ── Ações rápidas: chamam os fluxos EXISTENTES — nada reimplementado ─────

function executarAcaoRapida(nome, funcao) {
  return () => {
    const alvo = window[funcao];
    if (typeof alvo !== 'function') {
      console.error(`PULSO: fluxo "${nome}" indisponível (${funcao}).`);
      return;
    }
    alvo();
  };
}

function registrarEventosDashboard() {
  elementosDashboard.atualizar.addEventListener('click', carregarVisaoDashboard);
  elementosDashboard.irBoot.addEventListener('click', voltarAoBoot);
  // Período: ‹ / › / MÊS ATUAL (saldo continua sendo o saldo atual).
  elementosDashboard.periodoAnterior.addEventListener('click', () => {
    periodoAnoMes = deslocarPeriodoExibido(-1);
    carregarVisaoDashboard();
  });
  elementosDashboard.periodoProximo.addEventListener('click', () => {
    periodoAnoMes = deslocarPeriodoExibido(1);
    carregarVisaoDashboard();
  });
  elementosDashboard.periodoAtual.addEventListener('click', () => {
    periodoAnoMes = null;
    carregarVisaoDashboard();
  });
  // Atalhos de navegação (fluxos existentes dos módulos).
  document.getElementById('dash-ir-missoes').addEventListener(
    'click', executarAcaoRapida('missões', '__irParaMissoes'));
  document.getElementById('dash-ir-projetos').addEventListener(
    'click', executarAcaoRapida('projetos', '__irParaProjetos'));
  document.getElementById('dash-ir-financas').addEventListener(
    'click', executarAcaoRapida('finanças', '__irParaFinancas'));
  document.getElementById('dash-ir-servicos-despesas').addEventListener(
    'click', executarAcaoRapida('serviços e despesas', '__irParaServicosDespesas'));
  // Ações rápidas (formulários existentes).
  document.getElementById('dash-acao-nova-missao').addEventListener(
    'click', executarAcaoRapida('nova missão', '__abrirNovaMissao'));
  document.getElementById('dash-acao-novo-projeto').addEventListener(
    'click', executarAcaoRapida('novo projeto', '__abrirNovoProjeto'));
  document.getElementById('dash-acao-nova-transacao').addEventListener(
    'click', executarAcaoRapida('nova transação', '__abrirNovaTransacao'));
  document.getElementById('dash-acao-nova-conta').addEventListener(
    'click', executarAcaoRapida('nova conta', '__abrirNovaConta'));
  document.getElementById('dash-acao-novo-servico').addEventListener(
    'click', executarAcaoRapida('novo serviço', '__abrirNovoServico'));
}

/** Desloca o período exibido sem conhecer regras de calendário aqui:
 * usa a própria visão anterior do núcleo (domínio dashboard). */
function deslocarPeriodoExibido(delta) {
  const base = periodoAnoMes ?? anoMesAtualDash();
  const [ano, mes] = base.split('-').map(Number);
  const total = ano * 12 + (mes - 1) + delta;
  return `${Math.floor(total / 12)}-${String(((total % 12) + 12) % 12 + 1).padStart(2, '0')}`;
}

function anoMesAtualDash() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

// ── Boot do módulo (após o DOM estar pronto; script clássico no fim do body) ──

function iniciarModuloDashboard() {
  mapearDashboard();
  registrarEventosDashboard();
  // Pontes globais: os demais módulos voltam ao painel principal por aqui
  // (Fase 15 — o dashboard é a tela principal; o boot continua acessível).
  window.__irParaDashboard = exibirDashboard;
  window.__atualizarDashboard = carregarVisaoDashboard;
  // O botão do painel de boot só fica disponível quando existe jogador.
  const botaoDashboard = document.getElementById('botao-ver-dashboard');
  if (botaoDashboard) {
    botaoDashboard.addEventListener('click', exibirDashboard);
    // Fallback caso dashboard.js carregue depois do handler do principal.js.
    if (window.__pulsoJogadorAtual) botaoDashboard.disabled = false;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarModuloDashboard);
} else {
  iniciarModuloDashboard();
}
