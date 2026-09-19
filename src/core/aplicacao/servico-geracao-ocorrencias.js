/**
 * PULSO — Serviço da aplicação: Geração de Ocorrências (Fase 10.4)
 *
 * Transforma a REGRA (recorrência, Fase 10.3) em CONTAS CONCRETAS
 * (servico_conta, Fase 10.2) dentro de um período informado:
 *
 *   RECORRÊNCIA (regra)  →  GERAÇÃO  →  CONTAS / OCORRÊNCIAS (pendentes)
 *
 * Contratos desta subfase:
 * - IDEMPOTÊNCIA: a identidade da ocorrência é (servico_id, referencia
 *   `AAAA-MM`) — a MESMA unicidade da Fase 10.2. Ocorrência que já tem
 *   conta (manual ou gerada antes) é apenas CONTADA como "existente";
 *   executar a geração de novo não duplica nada;
 * - contas nascem SEMPRE `pendente` (nunca paga, nunca cancelada aqui);
 * - o valor esperado é COPIADO da recorrência no momento da geração:
 *   alterar a regra depois não altera contas já geradas;
 * - a conta gerada guarda `recorrenciaId` (rastreabilidade) e vence na
 *   data calculada pela regra canônica de meses curtos;
 * - o vencido continua sendo DERIVADO pelas regras da Fase 10.2
 *   (`situacaoConta`) — nada é reescrito porque a data passou;
 * - CRÍTICO: gerar NÃO paga, NÃO cria transação, NÃO altera carteira,
 *   saldo ou orçamento. Contas são obrigações registradas, não dinheiro
 *   gasto. O pagamento é a Fase 10.5.
 *
 * A geração roda dentro de uma transação SQLite (quando o banco é
 * informado): ou todas as contas do período nascem, ou nenhuma.
 */

import {
  calcularOcorrencias,
  validarPeriodoGeracao,
} from '../dominio/geracao.js';
import { ESTADOS_RECORRENCIA } from '../dominio/recorrencia.js';
import {
  ESTADO_CONTA_INICIAL,
  dataHojeIso,
  situacaoConta,
} from '../dominio/conta.js';
import { comTransacao } from '../database/transacao.js';
import { ErroValidacao, ErroConflito } from '../erros.js';

export class ServicoGeracaoOcorrencias {
  /**
   * @param {object} dependencias
   * @param {import('../database/repositorios/recorrencia.js').RepositorioRecorrencia} dependencias.repositorioRecorrencia
   * @param {import('../database/repositorios/conta.js').RepositorioConta} dependencias.repositorioContas
   * @param {import('node:sqlite').DatabaseSync|null} [dependencias.banco] transação opcional
   */
  constructor({ repositorioRecorrencia, repositorioContas, banco = null }) {
    this._recorrencias = repositorioRecorrencia;
    this._contas = repositorioContas;
    this._banco = banco;
  }

  /** Anexa a situação derivada (nunca gravada no banco) — regra da Fase 10.2. */
  _comSituacao(conta, hoje) {
    return Object.freeze({ ...conta, situacao: situacaoConta(conta, hoje) });
  }

  /**
   * Gera as ocorrências da recorrência no período informado.
   *
   * @param {number} recorrenciaId identidade da regra
   * @param {{ periodoInicio: string, periodoFim: string, hoje?: string }} parametros
   * @returns {Readonly<{encontradas: number, criadas: number, existentes: number,
   *   contas: ReadonlyArray<object>}>} resumo: ocorrências válidas no
   *   período, quantas viraram conta nova e quantas já existiam.
   */
  gerar(recorrenciaId, { periodoInicio, periodoFim, hoje = dataHojeIso() } = {}) {
    const periodo = validarPeriodoGeracao(periodoInicio, periodoFim);
    const recorrencia = this._recorrencias.buscarPorId(recorrenciaId);
    if (!recorrencia) {
      throw new ErroConflito(`Recorrência ${recorrenciaId} não encontrada.`);
    }
    if (recorrencia.estado === ESTADOS_RECORRENCIA.ARQUIVADA) {
      throw new ErroValidacao(
        'Uma recorrência arquivada está encerrada e não gera ocorrências.',
      );
    }
    if (recorrencia.estado === ESTADOS_RECORRENCIA.INATIVA) {
      throw new ErroValidacao(
        'Uma recorrência inativa está pausada e não gera ocorrências — reative-a antes.',
      );
    }

    const ocorrencias = calcularOcorrencias(recorrencia, periodo);

    const executar = () => {
      const criadas = [];
      let existentes = 0;
      for (const ocorrencia of ocorrencias) {
        // Idempotência: (servico_id, referencia) já tem conta → pula.
        const existente = this._contas.buscarPorServicoEReferencia(
          recorrencia.servicoId,
          ocorrencia.competencia,
        );
        if (existente) {
          existentes += 1;
          continue;
        }
        // Valor COPIADO da regra no momento da geração: mudanças futuras na
        // recorrência não alteram contas já criadas.
        criadas.push(
          this._contas.criar(
            recorrencia.jogadorId,
            {
              servicoId: recorrencia.servicoId,
              referencia: ocorrencia.competencia,
              descricao: recorrencia.descricao,
              valorEsperado: recorrencia.valorEsperado,
              vencimento: ocorrencia.vencimento,
              recorrenciaId: recorrencia.id,
            },
            ESTADO_CONTA_INICIAL,
          ),
        );
      }
      return Object.freeze({
        encontradas: ocorrencias.length,
        criadas: criadas.length,
        existentes,
        contas: Object.freeze(criadas.map((conta) => this._comSituacao(conta, hoje))),
      });
    };

    return this._banco ? comTransacao(this._banco, executar) : executar();
  }
}