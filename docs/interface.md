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

## 5. Acessibilidade

- contraste mínimo AA (4,5:1) para texto;
- nunca comunicar estado **apenas** por cor (usar texto/ícone junto);
- navegação por teclado considerada desde o início da implementação;
- respeito a preferências de movimento reduzido nas animações.
