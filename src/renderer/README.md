# src/renderer — Interface

Destinado à **camada de interface** (processo de renderização do Electron, a partir da **Fase 01 — Fundação**).

Responsabilidades futuras:

- telas, componentes visuais e estilos (identidade Cyberpunk/Netrunner);
- apresentação dos dados vindos do núcleo;
- captura das interações do usuário.

A interface **não** acessa banco de dados nem arquivos diretamente: tudo passará pela camada de aplicação via IPC.

Consulte `docs/interface.md` e `docs/identidade-visual.md` para os princípios visuais.
