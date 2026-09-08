# assets

Destinado aos recursos estáticos do PULSO: ícones, fontes locais, logotipo e demais elementos da identidade visual (Cyberpunk/Netrunner).

Estrutura planejada (as subpastas serão criadas quando os primeiros arquivos existirem):

```text
assets/
├── icons/   → ícones do aplicativo (janela, instalador)
├── fonts/   → fontes locais (mono + sans) — nunca CDN
├── images/  → logotipo e imagens
└── ui/      → elementos de interface reutilizáveis
```

**Estado atual (Fase 01):** nenhum asset externo foi necessário — a tela de fundação usa apenas CSS (grade, scanlines, nós em SVG inline) e um favicon em data-URI. A escolha de fontes locais está registrada em `docs/pendencias.md` (P-011).
