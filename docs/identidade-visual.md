# Identidade Visual — PULSO

**Fase:** 00 (apenas documentação — a construção visual começa em fases posteriores).

## 1. Conceito

**Cyberpunk / Netrunner / terminal / trilha de rede.**

O PULSO se parece com um terminal de netrunner: superfícies escuras, sinais vermelhos, traços precisos e informação viva correndo pela tela.

## 2. Paleta (proposta inicial)

| Papel | Cor | Hex sugerido | Uso |
| --- | --- | --- | --- |
| Fundo profundo | preto | `#0B0B0D` | fundo principal |
| Superfície | preto elevado | `#131318` | painéis, cartões |
| Destaque | vermelho | `#E5484D` | ação primária, alerta, atenção |
| Destaque escuro | vermelho escuro | `#7F1D1D` | hover ativo, bordas de ênfase |
| Estrutura | cinza | `#8A8A93` | linhas, grades, texto secundário |
| Texto | branco | `#F2F2F5` | texto principal |

> Os valores são **propostas iniciais** para orientar as primeiras telas; serão refinados nas fases de interface, com testes reais de contraste.

**Regra do vermelho:** cor de **destaque**, não de preenchimento. Grandes áreas permanecem escuras/cinza; o vermelho marca o que importa (ação primária, alertas, progresso crítico).

## 3. Motivos gráficos

- nós conectados por linhas (trilha de rede);
- grade sutil ao fundo;
- cantos de moldura estilo HUD;
- estados de sistema com indicadores luminosos (pontos/traços);
- tipografia monoespaçada para dados/terminal e sans-serif para leitura.

## 4. Tipografia

- **Monoespaçada** para números, logs, terminal e dados — fontes locais (a escolha final acontece na fase de interface, sempre offline, nunca via CDN);
- **Sans-serif** para leitura contínua.

## 5. Acessibilidade

- contraste mínimo AA; vermelho sobre preto sempre acompanhado de texto/ícone;
- animações discretas, com respeito a preferências de movimento reduzido.
