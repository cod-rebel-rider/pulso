/**
 * PULSO — Definição central dos canais IPC (Fase 01 — Fundação)
 *
 * Usado pelo processo principal (import ESM de módulo CJS).
 * O preload (src/main/preload.cjs) roda em ambiente sandbox e não pode
 * requerer arquivos locais, por isso replica os nomes manualmente —
 * mantenha os dois em sincronia (os testes verificam a consistência).
 */
module.exports = Object.freeze({
  INFO_SISTEMA: 'info:sistema',
  BANCO_INFO: 'banco:info',
  JOGADOR_ESTADO: 'jogador:estado',
  JOGADOR_CRIAR: 'jogador:criar',
  JOGADOR_ATUALIZAR: 'jogador:atualizar',
  STATUS_OBTER: 'status:obter',
  STATUS_ALTERAR: 'status:alterar',
  MISSAO_CRIAR: 'missao:criar',
  MISSAO_LISTAR: 'missao:listar',
  MISSAO_OBTER: 'missao:obter',
  MISSAO_ATUALIZAR: 'missao:atualizar',
  MISSAO_INICIAR: 'missao:iniciar',
  MISSAO_CONCLUIR: 'missao:concluir',
  MISSAO_CANCELAR: 'missao:cancelar',
  MISSAO_EXCLUIR: 'missao:excluir',
  PROGRESSAO_OBTER: 'progressao:obter',
  PROGRESSAO_ADICIONAR_XP: 'progressao:adicionar-xp',
  PROGRESSAO_AUMENTAR_ATRIBUTO: 'progressao:aumentar-atributo',
  PROJETO_CRIAR: 'projeto:criar',
  PROJETO_LISTAR: 'projeto:listar',
  PROJETO_OBTER: 'projeto:obter',
  PROJETO_ATUALIZAR: 'projeto:atualizar',
  PROJETO_INICIAR: 'projeto:iniciar',
  PROJETO_CONCLUIR: 'projeto:concluir',
  PROJETO_CANCELAR: 'projeto:cancelar',
  PROJETO_ARQUIVAR: 'projeto:arquivar',
  PROJETO_ASSOCIAR_MISSAO: 'projeto:associar-missao',
  PROJETO_REMOVER_MISSAO: 'projeto:remover-missao',
});
