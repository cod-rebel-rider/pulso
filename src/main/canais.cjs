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
});
