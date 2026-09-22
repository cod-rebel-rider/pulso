# Relatório da FASE 15 — Dashboard

**Data:** 22/09/2026  
**Branch:** `tarefa/fase-15-dashboard` (commits 2b0fcc0, 8585a73, 4288d67, fed2132)  
**Status:** ✅ Concluída

## 1. Funcionalidades implementadas

### Dashboard como camada de consolidação
- `src/core/dominio/dashboard.js`: objeto de consolidação que reúne os módulos existentes (Fases 03–10) em uma única visão estruturada. Não cria regras, não duplica dados, não altera estado.
- `src/core/aplicacao/servico-dashboard.js`: orquestra consultas específicas/agregadas para a visão consolidada.

### Interface (tela principal)
- `src/renderer/index.html`: seção `visao-dashboard` com blocos organizados por prioridade:
  1. situação atual (jogador, status, atributos);
  2. ações pendentes (missões e projetos com resumo e atalhos para listas);
  3. progresso (projetos em andamento com barra de progresso);
  4. situação financeira (saldo atual, receitas e despesas do período, orçamento quando aplicável);
  5. contas próximas/vencidas (pendentes, vencidas, próximas, serviços ativos).
- `src/renderer/js/dashboard.js`: renderização e interação. Isolado em IIFE para evitar colisão de escopo com os demais scripts clássicos.
- `src/renderer/css/principal.css`: blocos `.dashboard-*` com estética cyberpunk/hacker-feiticeiro, fundo escuro, vermelho como destaque, hierarquia visual e responsividade.

### Ações rápidas
Atalhos que redirecionam para os fluxos existentes (sem duplicar regras):
- Nova missão
- Novo projeto
- Nova transação
- Nova conta
- Novo serviço

### Período financeiro
- Padrão = mês civil atual.
- Alterável pelos atalhos ‹ / › / MÊS ATUAL.
- O saldo exibido é sempre o saldo atual da carteira (Fase 08), independente do filtro de período.

### Destaque de contas vencidas
- Contas vencidas são marcadas visualmente (classe `.conta-vencida`), sem alterar o estado persistido.

### Estados vazios
- O dashboard continua funcional quando não há missões, projetos, transações, contas ou serviços, exibindo estados vazios em vez de dados fictícios.

## 2. Fontes de dados utilizadas

| Indicador | Fase | Serviço |
| --- | --- | --- |
| Jogador (nome, nível, XP, progresso, atributos disponíveis) | 03 | `ServicoJogador` |
| Status (energia, foco, estresse, criatividade) | 04 | `ServicoStatus` |
| Atributos (tecnologia, criatividade, música, social, energia, foco, disciplina) | 06 | `ServicoAtributos` (via `ServicoProgressao`) |
| Missões (resumo pendentes/em-andamento/concluídas/atasadas, atalho) | 07 | `ServicoMissao` |
| Projetos (resumo, lista em andamento com progresso) | 07 | `ServicoProjeto` |
| Finanças (saldo atual, receitas/despesas do período, orçamento) | 08 | `ServicoFinanca` |
| Contas (pendentes, vencidas, próximas, serviços ativos) | 09 | `ServicoContas` |
| Serviços ativos | 09 | `ServicoServicos` |
| Orquestração consolidada | 15 | `ServicoDashboard` |

## 3. Testes realizados

### Unidade
- `tests/unidade/dashboard.test.mjs`: consolidação, agrupamentos, datas, missões, projetos, atributos, status, financas, contas, serviços, estado vazio, sem dados fictícios.
- `tests/unidade/servico-dashboard.test.mjs`: visão consolidada pelo serviço, período financeiro, saldo atual independente do período, atalhos para listas, contas vencidas destacadas sem alterar estado, múltiplos dados simultaneamente, atualização após criar/concluir missão e criar/iniciar projeto, transação financeira, persistência após reinicialização.

### Integração
- `tests/integracao/dashboard.test.mjs`: cobre desde jogador sem dados adicionais até persistência após reabertura do banco.

### Fumaça end-to-end
- Smoke com Electron: dashboard visível como tela principal, valores exibidos correspondem a missão + transação criados, sem erros de console.

### Regressão
- `npm test`: **398 testes, 0 falhas, 0 skipped, 0 cancelled**.
- FASES 01 a 10 continuam operacionais.

## 4. Problemas encontrados e corrigidos

### Colisão de escopo no renderer
- **Problema:** o módulo dashboard.js, por ser script clássico, compartilhava o escopo global com os demais módulos. Funções com o mesmo nome (ex.: `renderizarMissoes`) seriam sobrescritas e a interface quebraria.
- **Correção:** o módulo agora vive dentro de uma IIFE e expõe apenas `window.__irParaDashboard` e `window.__atualizarDashboard`. Documentado no cabeçalho do arquivo.

### Destaque de contas vencidas sem mutação
- **Problema:** risco de alterar o estado persistido ao destacar visualmente.
- **Correção:** apenas aplicação de classe CSS `.conta-vencida`; o serviço não altera a conta nem seu estado.

### Valores correspondendo às fontes
- **Validação:** smoke test confirma que, após criar uma missão e uma transação, os valores exibidos no dashboard correspondem exatamente aos dados criados (`missaoOk: true`, `transacaoOk: true`).

## 5. Limitações

- Não há filtro de período persistente na UI além dos atalhos simples compatíveis com a arquitetura atual.
- O saldo exibido é o saldo atual da carteira (conforme exigido), não calculado pelo período.
- O dashboard é uma camada de visualização: não implementa novas regras de negócio, não possui banco próprio e não duplica dados.

## 6. Pendências futuras

- **FASES 11 a 14 (adiadas):** habilidades, música, mapa/trilha, conquistas. O dashboard não implementa essas funcionalidades e não criará estruturas, telas ou dados fictícios para elas.
- **FASE 16 não foi iniciada.**
- **FASE 17:** cobertura e estabilização (automação de interface dedicada).
- **FASE 18:** portabilidade (pacotes separados Linux/Windows/pendrive).

## 7. Registro documentacional

- `docs/roadmap.md`: fase 15 marcada como ✅ Concluída; FASES 11–14 reafirmadas como adiadas.
- `docs/arquitetura.md`: domínio e aplicação atualizados com `dashboard.js` e `servico-dashboard.js`; registro de que Dashboard = camada de consolidação e Fonte dos dados = módulos existentes.
- `docs/interface.md`: seção 5 (Dashboard) com organização, prioridades, período financeiro, ações rápidas, estética e escopo excluído.
- `docs/testes.md`: infraestrutura atualizada com `dashboard` em unidade e integração; tabela de coverage com linha Dashboard (Fase 15) descrevendo os três níveis de teste e a regressão.

## 8. Git

- Branch: `tarefa/fase-15-dashboard`
- Commits pequenos e objetivos em português:
  1. `2b0fcc0` feat(nucleo): domínio e serviço do dashboard como camada de consolidação (Fase 15)
  2. `8585a73` feat(interface): painel consolidado do dashboard como tela principal (Fase 15)
  3. `4288d67` test(dashboard): testes de domínio, serviço, integração e validação end-to-end (Fase 15)
  4. `fed2132` docs(fase-15): atualiza roadmap, arquitetura, interface e testes
- Zero arquivos não versionados no estado final.
