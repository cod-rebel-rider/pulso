/**
 * PULSO — Registro de eventos (Fase 01 — Fundação)
 *
 * Logging minimalista do processo principal: níveis identificáveis,
 * carimbo de tempo ISO e formato estável no console.
 *
 * Um sistema de logging com saída em arquivo ficou registrado como
 * pendência em docs/pendencias.md — a fundação apenas estabelece o formato.
 */

export const NIVEIS = Object.freeze({
  DEPURACAO: 'DEPURACAO',
  INFO: 'INFO',
  AVISO: 'AVISO',
  ERRO: 'ERRO',
});

/**
 * Formata uma linha de registro. Função pura (testável sem Electron).
 * @param {string} nivel Um dos valores de NIVEIS
 * @param {string} mensagem Mensagem curta e descritiva
 * @param {Date} [momento] Momento do registro (padrão: agora)
 * @returns {string} Linha pronta para exibição
 */
export function formatarLinha(nivel, mensagem, momento = new Date()) {
  const nivelValido = Object.values(NIVEIS).includes(nivel) ? nivel : NIVEIS.INFO;
  return `[PULSO][${momento.toISOString()}][${nivelValido}] ${mensagem}`;
}

function emitir(nivel, mensagem, detalhe) {
  const linha = formatarLinha(nivel, mensagem);
  if (nivel === NIVEIS.ERRO) {
    console.error(linha);
  } else if (nivel === NIVEIS.AVISO) {
    console.warn(linha);
  } else {
    console.log(linha);
  }
  if (detalhe) {
    const detalheTexto = detalhe instanceof Error ? detalhe.stack ?? detalhe.message : String(detalhe);
    console.error(detalheTexto);
  }
}

const registro = Object.freeze({
  depuracao: (mensagem, detalhe) => emitir(NIVEIS.DEPURACAO, mensagem, detalhe),
  info: (mensagem, detalhe) => emitir(NIVEIS.INFO, mensagem, detalhe),
  aviso: (mensagem, detalhe) => emitir(NIVEIS.AVISO, mensagem, detalhe),
  erro: (mensagem, detalhe) => emitir(NIVEIS.ERRO, mensagem, detalhe),
});

export default registro;
