# Interface — PULSO

**Fase responsável:** a partir da Fase 01 — Fundação (nada implementado nesta fase).

## 1. Conceito

Interface inspirada em **Cyberpunk / Netrunner / terminal / trilha de rede**: o usuário enxerga sua vida como um sistema operacional pessoal — nós, conexões, estados e sinais.

## 2. Elementos planejados

- linhas de conexão e nós (grafos de relações entre missões, projetos e habilidades);
- grades e molduras estilo HUD;
- indicadores de estado do sistema (online/offline, salvamento, erros);
- áreas de terminal (logs, eventos, feedback);
- barras de progresso (XP, atributos, orçamentos);
- estados de sistema visíveis (carregando, vazio, erro) sempre com textos em pt-BR.

## 3. Princípios

1. **Legibilidade primeiro** — o estilo cyberpunk serve ao uso diário, nunca o contrário.
2. **Vermelho como destaque** — reservado para ação primária, alerta e atenção; não como preenchimento de tela (ver `identidade-visual.md`).
3. **Feedback constante** — toda ação tem resposta visual imediata; o sistema sempre comunica seu estado.
4. **Hierarquia clara** — informação crítica primeiro; ruído visual mínimo.
5. **Tema escuro padrão** — fundos escuros, texto claro, contraste mínimo WCAG AA.
6. **Offline e local** — fontes e recursos carregados localmente; nada essencial depende de CDN/internet.
7. **Idioma único** — todos os textos visíveis em pt-BR.

## 4. Navegação (intenção inicial)

Navegação por módulos (Missões, Finanças, Música etc.) com um núcleo/dashboard central. O desenho detalhado será feito a partir da Fase 01/02, quando os módulos começarem a existir — esta fase apenas registra a direção.

## 5. Dashboard (Fase 15 — implementada)

O Dashboard é a **tela principal** do PULSO e uma **camada de consolidação**: exibe, em uma única visão, o estado dos módulos já implementados (Fases 03–10), sem criar banco próprio, sem duplicar dados e sem novas regras de negócio.

Organização por prioridade:

1. situação atual (jogador, status, atributos);
2. ações pendentes (missões e projetos com resumo e atalhos para as listas);
3. progresso (projetos em andamento com progresso);
4. situação financeira (saldo atual, receitas e despesas do período, orçamento quando aplicável); o saldo é sempre o saldo atual da carteira, independente do filtro de período;
5. contas próximas/vencidas (pendentes, vencidas, próximas, serviços ativos; contas vencidas destacadas sem alterar o estado persistido).

Período financeiro: padrão = mês civil atual, alterável pelos atalhos ‹ / › / MÊS ATUAL.

Ações rápidas: atalhos para os fluxos existentes (nova missão, novo projeto, nova transação, nova conta, novo serviço), sem duplicar regras de negócio.

Estética: PT-BR, cyberpunk/hacker-feiticeiro, fundo escuro, vermelho como destaque, blocos/cards com hierarquia visual, responsivo à resolução disponível, sem excesso de informação e sem gráficos desnecessários.

Escopo excluído por exigência da fase: habilidades (FASE 11 adiada), música (FASE 12 adiada), mapa/trilha (FASE 13 adiada), conquistas (FASE 14 adiada). O dashboard não implementa funcionalidades das FASES 11 a 14.

Src: `src/renderer/index.html` (seção `visao-dashboard`), `src/renderer/js/dashboard.js`, `src/renderer/css/principal.css` (blocos `.dashboard-*`), `src/core/dominio/dashboard.js`, `src/core/aplicacao/servico-dashboard.js`, IPC em `src/main/main.js` / `src/main/preload.cjs` / `src/main/canais.cjs`.

## 6. Tela de fundação (implementada na Fase 01)

A tela inicial do PULSO (`src/renderer/`) já aplica os princípios acima em escala mínima:

- fundo preto profundo com grade sutil desvanecida e scanlines discretas;
- trilha de rede decorativa (nós e conexões com fluxo animado lento), com dois nós em vermelho;
- filete vermelho no topo e moldura estilo HUD no cabeçalho/rodapé;
- sequência de inicialização em formato de terminal (linhas com ponto de guia e valores em vermelho);
- estado do sistema com luz pulsante (`INICIANDO…` → `SISTEMA ONLINE` ou `FALHA DE COMUNICAÇÃO`);
- rodapé com informações reais do sistema (ambiente, Electron, Node, Chrome, plataforma) vindas por IPC;
- tipografia monoespaçada do sistema (offline); animações desativadas quando o sistema pede movimento reduzido.

Arquivos: `src/renderer/index.html`, `css/base.css` (variáveis da paleta), `css/principal.css`, `js/principal.js`.

## 7. Acessibilidade

- contraste mínimo AA (4,5:1) para texto;
- nunca comunicar estado **apenas** por cor (usar texto/ícone junto);
- navegação por teclado considerada desde o início da implementação;
- respeito a preferências de movimento reduzido nas animações.
