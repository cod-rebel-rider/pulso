/**
 * PULSO — Domínio: Validação de conta para pagamento (Fase 10.5)
 *
 * Separa a lógica de validação da conta para pagamento do serviço de
 * aplicação, mantendo o domínio puro (sem dependência de repositório).
 */

import { ErroConflito, ErroValidacao } from '../erros.js';
import { podePagareLancar } from './pagamento.js';

/**
 * Busca a conta e valida que pode ser paga.
 *
 * @param {import('../database/repositorios/conta.js').RepositorioConta} repositorio
 * @param {number} jogadorId
 * @param {number} contaId
 * @returns {Object} conta encontrada (já validada para pagamento)
 * @throws {ErroConflito|ErroValidacao} se a conta não pode ser paga
 */
export function buscarContaEValidarParaPagamento(repositorio, jogadorId, contaId) {
  const linha = repositorio.buscarPorId(contaId);
  if (!linha) {
    throw new ErroConflito('Conta não encontrada.');
  }

  const conta = repositorio.paraConta(linha);

  // Propriedade do jogador
  if (conta.jogadorId !== jogadorId) {
    throw new ErroConflito('Esta conta pertence a outro jogador.');
  }

  // Validação de regra de pagamento
  podePagareLancar(conta);

  return Object.freeze(conta);
}
