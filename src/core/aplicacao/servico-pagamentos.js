/**
 * PULSO — Serviço de aplicação: Pagamentos (Fase 10.5 — Pagamentos)
 *
 * Transforma uma CONTA (obrigação registrada) em uma DESPESA concreta no
 * sistema financeiro da FASE 08. Registra o pagamento de uma conta existente,
 * cria a transação de despesa, vincula conta↔transação e atualiza a carteira
 * pelo mecanismo financeiro já existente — tudo em UMA transação SQLite.
 *
 * Regras capturadas aqui (não no domínio):
 * - conta deve ser PENDENTE ou VENCIDA (estado persistido `pendente`);
 * - valor pago pode diferir do esperado (a DESPESA registra o REAL);
 * - idempotência: conta já paga → erro (bloqueia duplicata);
 * - atomicidade: se a transação falhar, a conta volta a `pendente` (ROLLBACK);
 * - a carteira é atualizada pelo mecanismo financeiro (nunca diretamente);
 * - o vínculo é `conta.transaction_id → transacao.id`.
 *
 * Limitações desta subfase:
 * - não implementa estorno (Fase futura);
 * - não altera valor esperado da conta (só o estado + campos de pagamento);
 * - a categoria da despesa é fixa em `contas` (serviços).
 */

import { ServicoFinanca } from './servico-financa.js';
import { RepositorioConta } from '../database/repositorios/conta.js';
import { comTransacao } from '../database/transacao.js';
import {
  podePagareLancar,
  validarPagamento,
} from '../dominio/pagamento.js';
import {
  buscarContaEValidarParaPagamento,
} from '../dominio/conta-pagamento.js';
import { ErroConflito, ErroValidacao } from '../erros.js';
import { CATEGORIAS_DESPESA } from '../dominio/financa.js';

// Categoria padrão para pagamento de serviços (FASE 10.5).
const CATEGORIA_PAGAMENTO_SERVICO = 'contas';

const categoriaPagamento = CATEGORIAS_DESPESA.find(
  (c) => c.valor === CATEGORIA_PAGAMENTO_SERVICO,
);
if (!categoriaPagamento) {
  throw new Error(
    `Categoria de pagamento de serviço "${CATEGORIA_PAGAMENTO_SERVICO}" não encontrada nas categorias de despesa.`,
  );
}

/**
 * @param {object} deps
 * @param {import('../database/repositorios/conta.js').RepositorioConta} deps.repositorioConta
 * @param {{ repositorioCarteira: any, repositorioTransacao: any, repositorioOrcamento: any, repositorioJogador?: any }} deps.financa
 * @param {import('node:sqlite').DatabaseSync} deps.banco
 */
export class ServicoPagamentos {
  constructor({ repositorioConta, financa, banco }) {
    this._contas = repositorioConta;
    this._financa = new ServicoFinanca(financa);
    this._banco = banco;
  }

  /**
   * Registra o pagamento de uma conta.
   *
   * @param {number} jogadorId
   * @param {number} contaId
   * @param {object} dados
   * @param {number} dados.valorPagoCentavos - valor efetivamente pago (centavos)
   * @param {string} dados.paidAt - data do pagamento (AAAA-MM-DD)
   * @param {string} [dados.paymentDescription] - observação opcional (máx 500)
   * @returns {Object} resultado com conta paga, transação criada e resumo
   */
  registrarPagamento(jogadorId, contaId, dados) {
    // 1. Validar a conta (existe, pertence ao jogador, não cancelada, não paga).
    const conta = buscarContaEValidarParaPagamento(
      this._contas,
      jogadorId,
      contaId,
    );

    // 2. Validar os dados de pagamento.
    const pagamentoValidado = validarPagamento(dados);

    // 3. Executar em transação atômica: criar DESPESA + marcar conta como PAGA.
    const resultado = comTransacao(this._banco, () => {
      // 3a. Criar a DESPESA no sistema financeiro (atualiza carteira/saldo).
      const transacao = this._financa.criarTransacao(jogadorId, {
        tipo: 'despesa',
        valorCentavos: pagamentoValidado.valorPagoCentavos,
        categoria: CATEGORIA_PAGAMENTO_SERVICO,
        descricao: montarDescricaoPagamento(conta, pagamentoValidado),
        data: pagamentoValidado.paidAt,
      });

      // 3b. Marcar a conta como PAGA, vinculando a transação.
      const contaPaga = this._contas.marcarComoPaga(contaId, {
        paidAmount: pagamentoValidado.valorPagoCentavos,
        paidAt: pagamentoValidado.paidAt,
        paymentDescription: pagamentoValidado.paymentDescription,
        transactionId: transacao.id,
      });

      return Object.freeze({
        conta: contaPaga,
        transacao,
        resumo: this._financa.obterResumo(jogadorId),
      });
    });

    return resultado;
  }
}

/** Monta a descrição da transação de despesa para rastreabilidade. */
function montarDescricaoPagamento(conta, pagamento) {
  const referencia = conta.referencia ? `[${conta.referencia}] ` : '';
  const observacao = pagamento.paymentDescription
    ? ` — ${pagamento.paymentDescription}`
    : '';
  return `${referencia}Pagamento da conta${observacao}`;
}
