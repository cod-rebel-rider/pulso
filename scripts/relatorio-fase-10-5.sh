#!/bin/sh
# FASE 10.5 — RELATÓRIO — PULSO
cd "$(dirname "$0")/.." || exit 1
echo "Status:"
echo "CONCLUÍDA"
echo
echo "Implementado:"
echo "- Domínio do pagamento: podePagareLancar (estados pagáveis pendente/vencida; bloqueia inexistente, cancelada, já paga e conta de outro jogador), validarPagamento (valor real em centavos inteiros > 0 podendo diferir do esperado, data civil AAAA-MM-DD, observação opcional truncada em 500), situacaoPagamento derivada (PAGO/A_PAGAR)."
echo "- Aplicação: ServicoPagamentos.registrarPagamento — cria DESPESA via ServicoFinanca (Fase 08), marca a conta como PAGA com paid_amount/paid_at/payment_description/transaction_id, tudo em UMA transação SQLite (comTransacao/BEGIN IMMEDIATE, ROLLBACK em falha)."
echo "- Repositório: marcarComoPaga em servico_conta; colunas de pagamento na projeção padrão."
echo "- Migração 014 (schema v14): servico_conta reconstruída — estado 'paga', paid_amount (>0), paid_at, payment_description, transaction_id → transacao(id) ON DELETE SET NULL + índice único parcial (uma transação só debita uma conta), CHECK conta paga exige desfecho completo."
echo "- IPC controlado: canal conta:pagar (canais.cjs, preload conta.pagar, handler em main.js) delegando ao ServicoPagamentos; erros de domínio viram {ok:false, mensagem}."
echo "- Interface: ação REGISTRAR PAGAMENTO no detalhe (pendente/vencida) pede valor pago, data e observação opcional; após pagar exibe status PAGA, valor esperado, valor pago, data e transação relacionada; contas PAGA sem ação de pagamento; listagem com filtro TODAS/PENDENTES/VENCIDAS/PAGAS/CANCELADAS."
echo "- Carteira NUNCA alterada por SQL direto: saldo muda exclusivamente pela criarTransacao da Fase 08 (categoria 'contas')."
echo
echo "Banco de dados:"
echo "- servico_conta (v14): + estado 'paga'; + paid_amount INTEGER; + paid_at TEXT; + payment_description TEXT; + transaction_id REFERENCES transacao(id) ON DELETE SET NULL; CHECKs (paid_amount > 0; paid_at GLOB; estado='paga' exige paid_amount e paid_at); UNIQUE(servico_id, referencia) preservada; índice único parcial em transaction_id."
echo
echo "Entidade:"
echo "- CONTA = obrigação registrada (Internet · 2026-09 · vence 15/09 · R\$120,00)."
echo "- PAGAMENTO = realização da obrigação (valor real, data, observação opcional)."
echo "- TRANSAÇÃO = registro financeiro (DESPESA pelo valor pago, categoria 'contas')."
echo "- CARTEIRA = consequência financeira (saldo cai pelo mecanismo da Fase 08)."
echo
echo "Regras de negócio:"
echo "- Só paga conta PENDENTE ou VENCIDA (vencida é derivada; estado persistido é pendente)."
echo "- Valor pago pode diferir do esperado: Esperado R\$120,00 pago R\$127,50 → DESPESA de R\$127,50."
echo "- Idempotência por estado: PAGA é terminal nesta fase; duplicata bloqueada antes de tocar o financeiro."
echo "- Atomicidade: falha em qualquer etapa → ROLLBACK (conta continua pendente/vencida, saldo intacto, nenhuma transação parcial)."
echo "- Estorno deliberadamente NÃO implementado (fase futura)."
echo
echo "Testes automatizados:"
echo "- tests/unidade/pagamento.test.mjs: validação de dados (valor/data/observação), bloqueios de estado e dono, situação derivada."
echo "- tests/integracao/pagamento.test.mjs: pendente e vencida, valor diferente do esperado, criação da DESPESA, saldo correto (1000−125=875), vínculo conta↔transação, duplicidade, cancelada/inexistente/jogador errado/valor inválido, atomicidade com falha simulada, isolamento entre jogadores, persistência fechar→reabrir."
echo "- Suíte completa: 333 testes, 333 passaram, 0 falhas."
echo
echo "Testes manuais:"
echo "- Cenário do requisito via script: saldo R\$1000,00, conta R\$120,00, pagamento R\$125,00 → saldo R\$875,00, conta PAGA, DESPESA de R\$125,00, vínculo conferido; duplicata bloqueada; falha simulada → rollback completo; reabertura do banco → estado/saldo/vínculo persistidos. 22/22 verificações OK."
echo "- Teste de fumaça do app (electron . --teste-fumaca): ok:true, schema v14, IPC ativo, sem erros de console."
echo
echo "Arquivos alterados/criados (principal):"
for f in src/core/dominio/pagamento.js src/core/dominio/conta-pagamento.js src/core/dominio/conta.js src/core/database/migracoes.js src/core/database/repositorios/conta.js src/core/aplicacao/servico-pagamentos.js src/main/canais.cjs src/main/preload.cjs src/main/main.js src/renderer/index.html src/renderer/js/contas.js tests/unidade/pagamento.test.mjs tests/integracao/pagamento.test.mjs docs/pagamentos.md docs/banco-de-dados.md docs/arquitetura.md docs/testes.md docs/roadmap.md; do echo "  - $f"; done
echo
echo "Migrations:"
echo "  MIGRACAO_014 campos-de-pagamento-e-estado-paga-em-servico-conta (versão 14)."
echo
echo "Commits (topo da branch):"
git log --oneline -n 10 --decorate
echo
echo "Problemas encontrados:"
echo "- Nenhum. (SQLite não permite ALTER de CHECK; a tabela foi reconstruída no padrão já usado pela conciliação da v9.)"
echo
echo "Decisões arquiteturais:"
echo "- PAGA é ESTADO PERSISTIDO (não derivado); VENCIDA continua derivada — o banco nunca é reescrito só porque a data passou."
echo "- Idempotência por estado, não por busca de transação: bloqueio acontece antes de qualquer movimento financeiro."
echo "- Vínculo CONTA → TRANSAÇÃO por transaction_id com SET NULL: excluir a transação no financeiro não desfaz a conta paga."
echo "- Reuso total da Fase 08 (validarValorCentavos, ServicoFinanca.criarTransacao); sem segunda implementação de dinheiro."
echo
echo "Pendências:"
echo "  Nenhuma desta subfase."
echo
echo "Itens deliberadamente NÃO implementados:"
echo "- Estorno/reembolso, pagamento parcial com geração de restante, juros/multas, comprovantes/anexos, meios de pagamento."
echo "- Notificações/lembretes, débito automático, agendamento de pagamento, integração bancária."
