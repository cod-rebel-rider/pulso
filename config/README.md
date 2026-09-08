# Configuração

Esta pasta centraliza as configurações do PULSO, separadas por ambiente:

| Arquivo | Ambiente | Uso |
| --- | --- | --- |
| `desenvolvimento.json` | desenvolvimento | Execução local durante o desenvolvimento |
| `teste.json` | teste | Suíte de testes automatizados |
| `producao.json` | produção | Aplicativo empacotado (fases futuras) |

## Regras

1. **Nenhum dado pessoal** deve ser colocado aqui: senhas, tokens, chaves de API ou caminhos pessoais são proibidos no repositório.
2. O arquivo de dados do aplicativo ficará, a partir da Fase 02, **fora do repositório** (diretório de dados do usuário no sistema operacional).
3. Se um dia for necessário um arquivo `.env` (variáveis de ambiente), ele deverá permanecer no `.gitignore` — apenas um `.env.exemplo` documentando as variáveis poderá ser versionado.

Os arquivos desta fase contêm apenas os campos mínimos (`ambiente`, `idioma`, `depuracao`) para validar a estratégia de configuração. Campos específicos serão adicionados nas fases seguintes, conforme a necessidade real de cada uma.
