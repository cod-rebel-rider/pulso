/**
 * PULSO — Erros do núcleo (Fase 03 — Jogador)
 *
 * Tipos identificáveis para que a camada de aplicação (IPC) traduza as
 * falhas para a interface sem expor detalhes internos do banco.
 */

/** Dados rejeitados pelas regras do domínio. */
export class ErroValidacao extends Error {
  /**
   * @param {string} mensagem mensagem segura para exibição ao usuário
   * @param {string|null} [campo] campo relacionado à rejeição
   */
  constructor(mensagem, campo = null) {
    super(mensagem);
    this.name = 'ErroValidacao';
    this.campo = campo;
  }
}

/** Operação incompatível com o estado atual (ex.: jogador já existe). */
export class ErroConflito extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroConflito';
  }
}
