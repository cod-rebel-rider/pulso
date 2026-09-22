/**
 * PULSO — Domínio: Dashboard (Fase 15 — Dashboard)
 *
 * O DASHBOARD é uma CAMADA DE CONSOLIDAÇÃO: ele não possui banco próprio,
 * não cria entidades, não altera regras e não movimenta nada. Tudo aqui são
 * FUNÇÕES PURAS de agregação/apresentação sobre dados vindos dos módulos
 * existentes (Fases 03–10) — a FONTE DOS DADOS continua sendo cada módulo.
 *
 * Nada aqui sabe sobre Electron, SQLite ou interface. Regras de negócio
 * (atraso de missão, situação de conta, progresso de projeto) permanecem nos
 * domínios de origem — este módulo apenas chama e conta.
 *
 * Regras puras, sem E/S — nunca no renderer, nunca no SQL.
 */

import { ErroValidacao } from '../erros.js';
import { estaAtrasada } from './missao.js';
import { validarDataIso } from './conta.js';

// ── Período (mês civil) ──────────────────────────────────────────────────

const PADRAO_ANO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const ROTULOS_MES = Object.freeze([
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]);

/** Último dia do mês civil (interpreta regra real do calendário). */
export function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Valida `AAAA-MM` (competência do período do dashboard).
 * @throws {ErroValidacao} formato inválido
 */
export function validarAnoMes(anoMes) {
  if (typeof anoMes !== 'string' || !PADRAO_ANO_MES.test(anoMes.trim())) {
    throw new ErroValidacao(
      `O período deve estar no formato AAAA-MM (ex.: 2026-09). Recebido: ${String(anoMes)}.`,
      'anoMes',
    );
  }
  return anoMes.trim();
}

/** `AAAA-MM` atual (fuso local) a partir de um instante. */
export function anoMesAtual(agora = new Date()) {
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

/** Desloca `AAAA-MM` em `delta` meses (negativo = mês anterior). */
export function deslocarAnoMes(anoMes, delta) {
  const limpo = validarAnoMes(anoMes);
  const deslocamento = Math.trunc(Number(delta) || 0);
  const [ano, mes] = limpo.split('-').map(Number);
  const total = (ano * 12 + (mes - 1)) + deslocamento;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12 + 12) % 12; // 0–11
  return `${novoAno}-${String(novoMes + 1).padStart(2, '0')}`;
}

/** Rótulo humano do período (ex.: `2026-09` → `SETEMBRO/2026`). */
export function rotuloAnoMes(anoMes) {
  const limpo = validarAnoMes(anoMes);
  const [ano, mes] = limpo.split('-').map(Number);
  return `${ROTULOS_MES[mes - 1].toUpperCase()}/${ano}`;
}

/**
 * Período completo do dashboard a partir de uma competência `AAAA-MM`
 * (ou a competência atual quando omitida).
 *
 * O período é INCLUSIVO nas duas pontas e usa datas civis `AAAA-MM-DD`,
 * comparáveis lexicograficamente — mesmo contrato do motor financeiro
 * (Fase 08: `financa:saldo` e `financa:listar-transacoes`).
 */
export function periodoDoMes(anoMes = null, agora = new Date()) {
  const competencia = validarAnoMes(anoMes ?? anoMesAtual(agora));
  const [ano, mes] = competencia.split('-').map(Number);
  const dois = (n) => String(n).padStart(2, '0');
  return Object.freeze({
    anoMes: competencia,
    inicio: `${competencia}-01`,
    fim: `${competencia}-${dois(ultimoDiaDoMes(ano, mes))}`,
    rotulo: rotuloAnoMes(competencia),
    anterior: deslocarAnoMes(competencia, -1),
    proximo: deslocarAnoMes(competencia, 1),
    atual: competencia === anoMesAtual(agora),
  });
}

// ── Missões ──────────────────────────────────────────────────────────────

/**
 * Contagem de missões por situação de exibição.
 * O atraso usa a MESMA regra do domínio de missões (`estaAtrasada`):
 * atrasada = tem prazo, prazo < hoje e não está em estado terminal.
 */
export function contarMissoes(missoes, hojeIso) {
  const data = validarDataIso(hojeIso);
  const lista = Array.isArray(missoes) ? missoes : [];
  const contagem = {
    total: lista.length,
    pendentes: 0,
    emAndamento: 0,
    concluidas: 0,
    canceladas: 0,
    atrasadas: 0,
  };
  for (const missao of lista) {
    switch (missao.estado) {
      case 'pendente': contagem.pendentes += 1; break;
      case 'em_andamento': contagem.emAndamento += 1; break;
      case 'concluida': contagem.concluidas += 1; break;
      case 'cancelada': contagem.canceladas += 1; break;
      default: break;
    }
    if (estaAtrasada(missao.estado, missao.prazo)) contagem.atrasadas += 1;
  }
  return Object.freeze(contagem);
}

// ── Projetos ─────────────────────────────────────────────────────────────

/**
 * Contagem de projetos por estado. O sinalizador `atrasado` e o `progresso`
 * VÊM do serviço de projetos (Fase 07) — nada é recalculado aqui além da
 * contagem em si.
 */
export function contarProjetos(projetos) {
  const lista = Array.isArray(projetos) ? projetos : [];
  const contagem = {
    total: lista.length,
    planejados: 0,
    emAndamento: 0,
    concluidos: 0,
    cancelados: 0,
    arquivados: 0,
    atrasados: 0,
  };
  for (const projeto of lista) {
    switch (projeto.estado) {
      case 'planejado': contagem.planejados += 1; break;
      case 'em_andamento': contagem.emAndamento += 1; break;
      case 'concluido': contagem.concluidos += 1; break;
      case 'cancelado': contagem.cancelados += 1; break;
      case 'arquivado': contagem.arquivados += 1; break;
      default: break;
    }
    if (projeto.atrasado) contagem.atrasados += 1;
  }
  return Object.freeze(contagem);
}

/** Projetos em andamento (para a lista de progresso do dashboard). */
export function projetosEmAndamento(projetos) {
  const lista = Array.isArray(projetos) ? projetos : [];
  return Object.freeze(
    lista
      .filter((p) => p.estado === 'em_andamento')
      .map((p) => Object.freeze({
        id: p.id,
        titulo: p.titulo,
        progresso: p.progresso,
        totalMissoes: p.totalMissoes,
        missoesConcluidas: p.missoesConcluidas,
        atrasado: Boolean(p.atrasado),
      })),
  );
}

// ── Contas / Despesas (Fase 10.2) ────────────────────────────────────────

/**
 * Contagem de contas pela SITUAÇÃO DERIVADA que já vem do serviço de contas
 * (`pendente` | `vencida` | `cancelada` | `paga`). Nada é reescrito: o estado
 * persistido permanece intocado — o dashboard apenas lê.
 */
export function contarContas(contas) {
  const lista = Array.isArray(contas) ? contas : [];
  const contagem = {
    total: lista.length,
    pendentes: 0,
    vencidas: 0,
    canceladas: 0,
    pagas: 0,
  };
  for (const conta of lista) {
    switch (conta.situacao) {
      case 'pendente': contagem.pendentes += 1; break;
      case 'vencida': contagem.vencidas += 1; break;
      case 'cancelada': contagem.canceladas += 1; break;
      case 'paga': contagem.pagas += 1; break;
      default: break;
    }
  }
  return Object.freeze(contagem);
}

/**
 * Próximas contas em aberto (pendentes + vencidas), ordenadas por vencimento
 * (mais urgente primeiro), limitadas a `limite` itens. Atrasos permanecem
 * marcados — o dashboard SÓ destaca, nunca altera os dados da conta.
 */
export function proximasContas(contas, limite = 5) {
  const lista = Array.isArray(contas) ? contas : [];
  const quantidade = Math.max(0, Math.trunc(Number(limite) || 0));
  const emAberto = lista
    .filter((c) => c.situacao === 'pendente' || c.situacao === 'vencida')
    .slice()
    .sort((a, b) => {
      const vencA = a.vencimento ?? '9999-12-31';
      const vencB = b.vencimento ?? '9999-12-31';
      if (vencA !== vencB) return vencA < vencB ? -1 : 1;
      return (a.id ?? 0) - (b.id ?? 0);
    });
  return Object.freeze(
    emAberto.slice(0, quantidade).map((c) => Object.freeze({
      id: c.id,
      servicoId: c.servicoId,
      nomeServico: c.nomeServico ?? null,
      referencia: c.referencia,
      descricao: c.descricao,
      valorEsperado: c.valorEsperado,
      vencimento: c.vencimento,
      situacao: c.situacao,
    })),
  );
}

// ── Serviços (Fase 10.1) ─────────────────────────────────────────────────

/**
 * Contagem de serviços por estado (regra do módulo: `ativo`/`inativo`/
 * `arquivado`). Apenas leitura — criar/editar serviço nunca teve efeito
 * financeiro e o dashboard mantém isso inalterado.
 */
export function contarServicos(servicos) {
  const lista = Array.isArray(servicos) ? servicos : [];
  const contagem = {
    total: lista.length,
    ativos: 0,
    inativos: 0,
    arquivados: 0,
  };
  for (const servico of lista) {
    switch (servico.estado) {
      case 'ativo': contagem.ativos += 1; break;
      case 'inativo': contagem.inativos += 1; break;
      case 'arquivado': contagem.arquivados += 1; break;
      default: break;
    }
  }
  return Object.freeze(contagem);
}

// ── Orçamentos (Fase 08) ─────────────────────────────────────────────────

/**
 * Orçamentos VIGENTES em (pelo menos parte de) um período, com a situação
 * calculada pelo serviço financeiro (`gasto`, `percentual`, `estourado`).
 * Não há novo cálculo de orçamento aqui — apenas o recorte do período.
 */
export function orcamentosNoPeriodo(orcamentos, inicio, fim) {
  const comeco = validarDataIso(inicio);
  const termino = validarDataIso(fim);
  const lista = Array.isArray(orcamentos) ? orcamentos : [];
  return Object.freeze(
    lista
      .filter((o) => o.inicio <= termino && o.fim >= comeco)
      .map((o) => Object.freeze({
        id: o.id,
        nome: o.nome,
        categoria: o.categoria,
        valorCentavos: o.valorCentavos,
        inicio: o.inicio,
        fim: o.fim,
        gastoCentavos: o.situacao?.gasto ?? 0,
        percentual: o.situacao?.percentual ?? 0,
        estourado: Boolean(o.situacao?.estourado),
      })),
  );
}

// ── Status e atributos (apresentação) ────────────────────────────────────

/** Ordem e rótulos de exibição dos status (Fase 04). */
export const STATUS_ORDEM_DASHBOARD = Object.freeze(['energia', 'foco', 'estresse', 'criatividade']);
export const STATUS_ROTULOS_DASHBOARD = Object.freeze({
  energia: 'ENERGIA',
  foco: 'FOCO',
  estresse: 'ESTRESSE',
  criatividade: 'CRIATIVIDADE',
});

/** Ordem e rótulos de exibição dos atributos (Fase 06). */
export const ATRIBUTOS_ORDEM_DASHBOARD = Object.freeze([
  'tecnologia', 'criatividade', 'musica', 'social', 'energia', 'foco', 'disciplina',
]);
export const ATRIBUTOS_ROTULOS_DASHBOARD = Object.freeze({
  tecnologia: 'TECNOLOGIA',
  criatividade: 'CRIATIVIDADE',
  musica: 'MÚSICA',
  social: 'SOCIAL',
  energia: 'ENERGIA',
  foco: 'FOCO',
  disciplina: 'DISCIPLINA',
});
