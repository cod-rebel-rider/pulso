/**
 * PULSO — Aplicação: serviço de Progressão (Fase 06 — Progressão)
 *
 * Orquestra XP, nível, pontos e atributos. Aplica as regras do domínio
 * antes de persistir. O renderer alcança esta camada apenas via IPC.
 */

import {
  NIVEL_INICIAL,
  XP_INICIAL,
  PONTOS_INICIAIS,
  atributosIniciais,
  calcularProgresso,
  validarQuantidadeXp,
  validarOrigemXp,
  validarNomeAtributo,
  adicionarXp,
  aumentarAtributo,
} from '../dominio/progressao.js';
import { comTransacao } from '../database/transacao.js';
import { ErroConflito } from '../erros.js';

export class ServicoProgressao {
  /**
   * @param {{ repositorioProgressao: object, repositorioAtributos: object,
   *   repositorioJogador: object, banco?: import('node:sqlite').DatabaseSync|null }} deps
   */
  constructor({ repositorioProgressao, repositorioAtributos, repositorioJogador, banco = null }) {
    this._progressao = repositorioProgressao;
    this._atributos = repositorioAtributos;
    this._jogadores = repositorioJogador;
    this._banco = banco;
  }

  _garantirJogador(jogadorId) {
    if (!this._jogadores.buscarPorId(jogadorId)) {
      throw new ErroConflito('Jogador não encontrado.');
    }
  }

  /**
   * Monta a visão completa (progressão + atributos + progresso no nível).
   *
   * A visão tem forma ÚNICA e congelada para os três métodos públicos: os
   * sinalizadores de level up existem sempre — `false`/`0` quando a operação
   * não concede nível (consulta ou aumento de atributo). Assim a interface
   * pode ler a mesma estrutura em qualquer caminho, sem campos opcionais.
   */
  _montarVisao(progressao, atributos, { subiuNivel = false, niveisGanhos = 0 } = {}) {
    const detalhe = calcularProgresso(progressao.xpTotal);
    return Object.freeze({
      jogadorId: progressao.jogadorId,
      xpTotal: progressao.xpTotal,
      nivel: progressao.nivel,
      pontosDisponiveis: progressao.pontosDisponiveis,
      atributos: Object.freeze({
        tecnologia: atributos.tecnologia,
        criatividade: atributos.criatividade,
        musica: atributos.musica,
        social: atributos.social,
        energia: atributos.energia,
        foco: atributos.foco,
        disciplina: atributos.disciplina,
      }),
      xpNoNivel: detalhe.xpNoNivel,
      xpNecessario: detalhe.xpNecessario,
      progresso: detalhe.progresso,
      criadoEm: progressao.criadoEm,
      atualizadoEm: progressao.atualizadoEm,
      subiuNivel,
      niveisGanhos,
    });
  }

  /**
   * Cria a progressão inicial (chamado dentro da transação de criação do
   * jogador). Idempotente: se já existir, devolve o existente.
   */
  criarInicial(jogadorId) {
    const existente = this._progressao.buscarPorJogador(jogadorId);
    const atributosExistentes = this._atributos.buscarPorJogador(jogadorId);
    if (existente && atributosExistentes) {
      return this._montarVisao(existente, atributosExistentes);
    }
    const criar = () => {
      const prog = this._progressao.existe(jogadorId)
        ? this._progressao.buscarPorJogador(jogadorId)
        : this._progressao.criar(jogadorId, {
            xpTotal: XP_INICIAL,
            nivel: NIVEL_INICIAL,
            pontosDisponiveis: PONTOS_INICIAIS,
          });
      const atr = this._atributos.existe(jogadorId)
        ? this._atributos.buscarPorJogador(jogadorId)
        : this._atributos.criar(jogadorId, atributosIniciais());
      return this._montarVisao(prog, atr);
    };
    // Sem transação PRÓPRIA: os dois caminhos de chamada já rodam dentro de
    // uma transação — a criação do jogador (ServicoJogador.aoCriar, Fase 04/06)
    // e o reparo de jogador legado feito por `obter` (que abre a transação
    // quando há banco). Transações aninhadas são rejeitadas pelo SQLite, por
    // isso nenhuma transação é aberta aqui; as verificações `existe` mantêm a
    // operação idempotente em qualquer chamada repetida.
    return criar();
  }

  /**
   * Obtém a progressão; inicializa se o jogador veio de banco antigo.
   *
   * O reparo (progressão e/ou atributos ausentes) roda em transação quando há
   * banco disponível: ou as duas tabelas são criadas, ou nenhuma — nunca um
   * estado parcial.
   */
  obter(jogadorId) {
    this._garantirJogador(Number(jogadorId));
    const id = Number(jogadorId);
    const prog = this._progressao.buscarPorJogador(id);
    const atr = this._atributos.buscarPorJogador(id);
    if (prog && atr) return this._montarVisao(prog, atr);
    const reparar = () => this.criarInicial(id);
    return this._banco ? comTransacao(this._banco, reparar) : reparar();
  }

  /**
   * Concede XP ao jogador (operação interna/controlada).
   *
   * A `origem` é validada contra `ORIGENS_XP` e NÃO é persistida nesta fase
   * (não há histórico de XP); existe para que as integrações futuras
   * (missão/projeto) não precisem alterar este contrato. Zero não gera
   * alteração; negativo é rejeitado pelo domínio.
   *
   * @param {number} jogadorId
   * @param {number} quantidade XP a conceder
   * @param {string} [origem] uma de `ORIGENS_XP`
   * @returns {object} visão congelada — mesma forma de `obter`/`aumentarAtributo`
   */
  adicionarXp(jogadorId, quantidade, origem = 'OUTRO') {
    this._garantirJogador(Number(jogadorId));
    const id = Number(jogadorId);
    validarQuantidadeXp(Number(quantidade));
    validarOrigemXp(origem);
    const atual = this.obter(id);
    if (Number(quantidade) === 0) {
      return atual; // sem alteração: a visão já traz subiuNivel=false/niveisGanhos=0
    }
    const calculado = adicionarXp(
      { xpTotal: atual.xpTotal, nivel: atual.nivel, pontosDisponiveis: atual.pontosDisponiveis },
      Number(quantidade),
    );
    const persistir = () => {
      const prog = this._progressao.atualizar(id, {
        xpTotal: calculado.xpTotal,
        nivel: calculado.nivel,
        pontosDisponiveis: calculado.pontosDisponiveis,
      });
      const atr = this._atributos.buscarPorJogador(id);
      return this._montarVisao(prog, atr, {
        subiuNivel: calculado.subiuNivel,
        niveisGanhos: calculado.niveisGanhos,
      });
    };
    return this._banco ? comTransacao(this._banco, persistir) : persistir();
  }

  /**
   * Distribui pontos em um atributo (atômica: atributos + pontos).
   *
   * Devolve a mesma visão congelada das demais operações — sem level up,
   * `subiuNivel` é sempre `false` e `niveisGanhos` sempre `0`.
   */
  aumentarAtributo(jogadorId, nome, quantidade = 1) {
    this._garantirJogador(Number(jogadorId));
    const id = Number(jogadorId);
    validarNomeAtributo(nome);
    const atual = this.obter(id);
    const calculado = aumentarAtributo(
      { atributos: atual.atributos, pontosDisponiveis: atual.pontosDisponiveis },
      nome,
      Number(quantidade),
    );
    const persistir = () => {
      this._atributos.atualizar(id, calculado.atributos);
      this._progressao.atualizar(id, {
        xpTotal: atual.xpTotal,
        nivel: atual.nivel,
        pontosDisponiveis: calculado.pontosDisponiveis,
      });
      const prog = this._progressao.buscarPorJogador(id);
      const atr = this._atributos.buscarPorJogador(id);
      return this._montarVisao(prog, atr);
    };
    return this._banco ? comTransacao(this._banco, persistir) : persistir();
  }
}
