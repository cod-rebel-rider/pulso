/**
 * PULSO — Renderer: SERVIÇOS E DESPESAS (Fase 10.6 — visão consolidada)
 *
 * Hub da FASE 10: reúne Serviços (10.1), Contas (10.2), Recorrências (10.3),
 * Geração de Ocorrências (10.4) e Pagamentos (10.5) em uma única área com
 * resumo consolidado e navegação. Nenhuma regra de negócio aqui — os resumos
 * vêm das pontes IPC dos módulos existentes (window.pulso.servico/conta/
 * recorrencia) e os números são apenas contagens/somatórias de apresentação.
 *
 * Fluxo definitivo consolidado nesta visão:
 *   SERVIÇO → RECORRÊNCIA → OCORRÊNCIA/CONTA → PAGAMENTO → TRANSAÇÃO → CARTEIRA
 */

const elementosHub = {};

function consultarElementoHub(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento da interface ausente: #${id}`);
  return el;
}

function formatarCentavosHub(centavos) {
  if (!Number.isFinite(centavos)) return "R$ 0,00";
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const inteiro = String(Math.trunc(absoluto / 100));
  const centavosStr = String(Math.trunc(absoluto % 100)).padStart(2, "0");
  const separado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-R$ " : "R$ "}${separado},${centavosStr}`;
}

/** Todas as visões gerenciadas pelos módulos da FASE 10 (escondidas no hub). */
const VISOES_MODULO_FASE10 = [
  "visao-servicos", "visao-servico-detalhe", "visao-formulario-servico",
  "visao-recorrencias", "visao-recorrencia-detalhe", "visao-formulario-recorrencia",
  "visao-contas", "visao-conta-detalhe", "visao-formulario-conta",
  "visao-formulario-pagamento-conta",
];

function mapearHub() {
  elementosHub.servicosAtivos = consultarElementoHub("sd-servicos-ativos");
  elementosHub.recorrenciasAtivas = consultarElementoHub("sd-recorrencias-ativas");
  elementosHub.contasAberto = consultarElementoHub("sd-contas-aberto");
  elementosHub.contasValor = consultarElementoHub("sd-contas-valor");
  elementosHub.contasPagas = consultarElementoHub("sd-contas-pagas");
  elementosHub.aviso = consultarElementoHub("aviso-servicos-despesas");
  elementosHub.botaoIrServicos = consultarElementoHub("sd-ir-servicos");
  elementosHub.botaoIrRecorrencias = consultarElementoHub("sd-ir-recorrencias");
  elementosHub.botaoIrContas = consultarElementoHub("sd-ir-contas");
  elementosHub.botaoVoltarPainel = consultarElementoHub("sd-voltar-painel");
}

/** Entra no hub: esconde os módulos e o painel, atualiza o resumo. */
function exibirHub() {
  for (const visao of VISOES_MODULO_FASE10) {
    const el = document.getElementById(visao);
    if (el) el.classList.add("oculto");
  }
  const resultadoPagamento = document.getElementById("resultado-pagamento");
  if (resultadoPagamento) resultadoPagamento.classList.add("oculto");
  consultarElementoHub("visao-configuracao").classList.add("oculto");
  consultarElementoHub("visao-boot").classList.add("oculto");
  consultarElementoHub("visao-servicos-despesas").classList.remove("oculto");
  elementosHub.aviso.textContent = "";
}

/** Resumo consolidado (apenas leitura — nada aqui movimenta dinheiro). */
async function carregarResumoConsolidado() {
  const jogador = window.__pulsoJogadorAtual ?? null;
  if (!jogador) {
    elementosHub.aviso.textContent = "Nenhum jogador identificado.";
    return;
  }
  const p = window.pulso;
  if (!p?.servico || !p?.recorrencia || !p?.conta) {
    elementosHub.aviso.textContent = "A ponte dos módulos de serviços não está disponível.";
    return;
  }
  try {
    const [servicos, recorrencias, contas] = await Promise.all([
      p.servico.listar(jogador.id),
      p.recorrencia.listar(jogador.id),
      p.conta.listar(jogador.id),
    ]);
    if (!servicos.ok || !recorrencias.ok || !contas.ok) {
      elementosHub.aviso.textContent = "Não foi possível carregar o resumo consolidado.";
      return;
    }
    const listaServicos = servicos.servicos ?? [];
    const listaRecorrencias = recorrencias.recorrencias ?? [];
    const listaContas = contas.contas ?? [];
    const ativos = listaServicos.filter((s) => s.estado === "ativo").length;
    const recAtivas = listaRecorrencias.filter((r) => r.estado === "ativa").length;
    const emAberto = listaContas.filter((c) => c.situacao === "pendente" || c.situacao === "vencida");
    const pagas = listaContas.filter((c) => c.situacao === "paga");
    elementosHub.servicosAtivos.textContent = String(ativos);
    elementosHub.recorrenciasAtivas.textContent = String(recAtivas);
    elementosHub.contasAberto.textContent = String(emAberto.length);
    elementosHub.contasValor.textContent = formatarCentavosHub(
      emAberto.reduce((soma, c) => soma + (c.valorEsperado ?? 0), 0),
    );
    elementosHub.contasPagas.textContent = String(pagas.length);
    elementosHub.aviso.textContent = "";
  } catch (erro) {
    console.error(`PULSO: falha ao carregar o resumo consolidado — ${erro.message}`, erro);
    elementosHub.aviso.textContent = "Falha interna ao carregar o resumo consolidado.";
  }
}

function voltarAoPainelHub() {
  consultarElementoHub("visao-servicos-despesas").classList.add("oculto");
  consultarElementoHub("visao-boot").classList.remove("oculto");
}

function registrarEventosHub() {
  elementosHub.botaoIrServicos.addEventListener("click", () => {
    if (typeof window.__irParaServicos === "function") window.__irParaServicos();
  });
  elementosHub.botaoIrRecorrencias.addEventListener("click", () => {
    if (typeof window.__irParaRecorrencias === "function") window.__irParaRecorrencias();
  });
  elementosHub.botaoIrContas.addEventListener("click", () => {
    if (typeof window.__irParaContas === "function") window.__irParaContas();
  });
  elementosHub.botaoVoltarPainel.addEventListener("click", voltarAoPainelHub);
}

/** Entrada da visão consolidada (usada pelo botão do painel — principal.js). */
window.__irParaServicosDespesas = function () {
  exibirHub();
  carregarResumoConsolidado();
};

document.addEventListener("DOMContentLoaded", () => {
  mapearHub();
  registrarEventosHub();
});
