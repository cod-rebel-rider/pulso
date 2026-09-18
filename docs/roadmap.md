# Roadmap — PULSO

Fases conhecidas do projeto. Nenhuma fase antecipa o conteúdo da seguinte; o detalhamento de cada fase é feito ao iniciá-la.

| Fase | Nome | Objetivo (resumo) | Status |
| --- | --- | --- | --- |
| 00 | Preparação | Ambiente, stack, arquitetura, estrutura, Git e documentação | ✅ Concluída |
| 01 | Fundação | Núcleo mínimo da aplicação: janela, shell da interface, ciclo de vida | ✅ Concluída |
| 02 | Banco de Dados | SQLite, esquema inicial, migrações, camada de persistência | ✅ Concluída |
| 03 | Jogador | Personagem / identidade do usuário no sistema | ✅ Concluída |
| 04 | Status | Estado operacional do jogador (energia, foco, estresse, criatividade) | ✅ Concluída |
| 05 | Missões | Sistema de missões e tarefas | ✅ Concluída |
| 06 | Progressão | XP, níveis e evolução | ✅ Concluída |
| 07 | Projetos | Gestão de projetos | ✅ Concluída |
| 08 | Finanças | Transações, carteira, orçamento | ✅ Concluída |
| 09 | Loja / Lista de Desejos | Itens, desejos e compras | ✅ Concluída |
| 10.1 | Serviços (estrutura) | Estrutura permanente de serviços recorrentes | ✅ Concluída |
| 10.2 | Contas e Despesas | Ocorrências concretas de serviços, sem movimentar dinheiro | ✅ Concluída |
| 10.3 | Recorrências | Regra de repetição de serviços (frequência, período, vencimento, valor esperado) — sem gerar contas (Fase 10.4) | ✅ Concluída |
| 10 | Serviços e Despesas (total) | Recorrências, contas e serviços (subfases 10.4–10.6 restantes) | 🟡 Parcial (10.1–10.3 prontas) |
| 11 | Habilidades | Árvore de habilidades | ⬜ Pendente |
| 12 | Música | Acompanhamento musical | ⬜ Pendente |
| 13 | Mapa / Trilha | Visualização em rede / trilha | ⬜ Pendente |
| 14 | Conquistas | Conquistas e marcos | ⬜ Pendente |
| 15 | Dashboard | Painel consolidado definitivo | ⬜ Pendente |
| 16 | Polimento | Refinamento visual e de experiência | ⬜ Pendente |
| 17 | Testes e Estabilização | Cobertura, correções e estabilidade | ⬜ Pendente |
| 18 | Portabilidade | Pacotes separados: Linux, Windows e pendrive | ⬜ Pendente |

## Observações

- A **FASE 18** produzirá pacotes **separados** por destino (Linux / Windows / pendrive); as decisões das fases anteriores não podem dificultá-la (ver `arquitetura.md`, seção "Preparação para a portabilidade").
- Integrações externas não fazem parte das fases listadas; se um dia forem necessárias, serão avaliadas e documentadas quando o assunto surgir — o PULSO permanece local-first e offline-first.
- Pendências transversais identificadas durante as fases ficam registradas em `pendencias.md`.
