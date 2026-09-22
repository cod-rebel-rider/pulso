/**
 * PULSO — Serviço da aplicação: Dashboard (Fase 15 — Dashboard)
 *
 * O DASHBOARD é uma CAMADA DE CONSOLIDAÇÃO. Este serviço NÃO possui banco
 * próprio, NÃO cria entidades, NÃO altera regras e NÃO movimenta nada:
 * ele apenas ORQUESTRA CONSULTAS de leitura nos serviços existentes
 * (Fases 03–10) e devolve uma visão única e congelada.
 *
 *   FONTE DOS DADOS = módulos existentes
 *   DASHBOARD       = camada de consolidação (somente leitura)
 *
 * - jogador/status/progressão → Fases 03/04/06;
 * - missões/projetos          → Fases 05/07 (contagens usam a MESMA regra
 *   de atraso do domínio de missões e os indicadores do serviço de projetos);
 * - finanças                  → Fase 08 (obterSaldo do período + orçamentos
 *   com situação calculada pelo motor financeiro — nenhum cálculo novo);
 * - serviços/contas           → Fases 10.1/10.2 (situação derivada do serviço
 *   de contas; o dashboard destaca vencidas SEM alterar seus dados).
 *
 * Performance: uma única consulta por módulo (agregações no serviço), em vez
 * de dezenas de chamadas individuais da interface.
 */

import {
  periodoDoMes,
  contarMissoes,
  contarProjetos,
  projetosEmAndamento,
  contarContas,
  proximasContas,
  contarServicos,
  orcamentosNoPeriodo,
} from '../dominio/dashboard.js';
import { dataHojeIso } from '../dominio/conta.js';
import { ErroConflito } from '../erros.js';

/** Quantidade de contas exibidas em "próximas contas". */
const LIMITE_PROXIMAS_CONTAS = 5;

export class ServicoDashboard {
  /**
   * @param {{
   *   servicoJogador: import('./servico-jogador.js').ServicoJogador,
   *   servicoStatus: import('./servico-status.js').ServicoStatus,
   *   servicoProgressao: import('./servico-progressao.js').ServicoProgressao,
   *   servicoMissao: import('./servico-missao.js').ServicoMissao,
   *   servicoProjeto: import('./servico-projeto.js').ServicoProjeto,
   *   servicoFinanca: import('./servico-financa.js').ServicoFinanca,
   *   servicoServicos?: import('./servico-servicos.js').ServicoServicos,
   *   servicoContas?: import('./servico-contas.js').ServicoContas,
   *   agora?: () => Date
   * }} dependências — todos os serviços já implementados; os da Fase 10 são
   * opcionais para permitir o dashboard em jogadores sem esses dados.
   */
  constructor({
    servicoJogador,
    servicoStatus,
    servicoProgressao,
    servicoMissao,
    servicoProjeto,
    servicoFinanca,
    servicoServicos = null,
    servicoContas = null,
    agora = () => new Date(),
  }) {
    this._jogador = servicoJogador;
    this._status = servicoStatus;
    this._progressao = servicoProgressao;
    this._missoes = servicoMissao;
    this._projetos = servicoProjeto;
    this._financa = servicoFinanca;
    this._servicos = servicoServicos;
    this._contas = servicoContas;
    this._agora = agora;
  }

  /**
   * Visão consolidada do dashboard para um período (mês civil).
   * @param {{ anoMes?: string|null }} [opcoes] competência `AAAA-MM`
   *   (omitida = mês atual). O SALDO EXIBIDO é sempre o saldo ATUAL da
   *   carteira, independentemente do filtro de período (Fase 08).
   * @returns {object} visão congelada — somente leitura
   * @throws {ErroConflito} quando não há jogador configurado
   */
  visao({ anoMes = null } = {}) {
    const jogador = this._jogador.obter();
    if (!jogador) {
      throw new ErroConflito('Nenhum jogador configurado ainda.');
    }

    const instante = this._agora();
    const hoje = dataHojeIso(instante);
    const periodo = periodoDoMes(anoMes, instante);

    // ── Consultas (uma por módulo — fontes existentes) ────────────────────
    const status = this._status.obter(jogador.id);
    const progressao = this._progressao.obter(jogador.id);
    const missoes = this._missoes.listar(jogador.id);
    const projetos = this._projetos.listar(jogador.id);
    const saldoPeriodo = this._financa.obterSaldo(jogador.id, {
      inicio: periodo.inicio,
      fim: periodo.fim,
    });
    const orcamentos = this._financa.listarOrcamentos(jogador.id);

    const listaServicos = this._servicos ? this._servicos.listar(jogador.id) : [];
    const contas = this._contas ? this._contas.listar(jogador.id) : [];

    // Mapa id → nome para apresentar o serviço de cada conta (somente leitura).
    const nomesPorServico = new Map(listaServicos.map((s) => [s.id, s.nome]));

    const contagemContas = contarContas(contas);
    const emAberto = contas.filter(
      (c) => c.situacao === 'pendente' || c.situacao === 'vencida',
    );

    return Object.freeze({
      geradoEm: instante.toISOString(),
      hoje,
      periodo,
      jogador: Object.freeze({
        id: jogador.id,
        nome: jogador.nome,
        codinome: jogador.codinome,
      }),
      status: Object.freeze({
        energia: status.energia,
        foco: status.foco,
        estresse: status.estresse,
        criatividade: status.criatividade,
      }),
      progressao,
      missoes: contarMissoes(missoes, hoje),
      projetos: Object.freeze({
        ...contarProjetos(projetos),
        emAndamentoLista: projetosEmAndamento(projetos),
      }),
      financas: Object.freeze({
        moeda: saldoPeriodo.carteira.moeda,
        // Saldo ATUAL da carteira — não varia com o filtro de período.
        saldoAtualCentavos: saldoPeriodo.carteira.saldo,
        // Movimentações do PERÍODO selecionado (Fase 08).
        receitasPeriodoCentavos: saldoPeriodo.receitas,
        despesasPeriodoCentavos: saldoPeriodo.despesas,
        saldoPeriodoCentavos: saldoPeriodo.saldo,
        orcamentos: orcamentosNoPeriodo(orcamentos, periodo.inicio, periodo.fim),
      }),
      contas: Object.freeze({
        ...contagemContas,
        // Soma ESPERADA em aberto (pendentes + vencidas) — expectativa,
        // não despesa paga; não movimenta dinheiro.
        valorEmAbertoCentavos: emAberto.reduce((soma, c) => soma + c.valorEsperado, 0),
        proximas: proximasContas(contas, LIMITE_PROXIMAS_CONTAS).map((c) =>
          Object.freeze({ ...c, nomeServico: nomesPorServico.get(c.servicoId) ?? null })),
      }),
      servicos: contarServicos(listaServicos),
    });
  }
}
