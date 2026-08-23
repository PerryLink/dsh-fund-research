<div align="center">

# 📊 dsh-fund-research

**Relatórios de pesquisa determinísticos para fundos mútuos públicos chineses, no DeepSeek Harness.**

*Cada número-chave de cada relatório remonta a um snapshot-fonte com hash — lacunas são declaradas, nunca inventadas. Apenas para pesquisa; não é aconselhamento de investimento.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-🧩-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-fund-research/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-fund-research/actions)
[![npm version](https://img.shields.io/npm/v/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)
[![npm downloads](https://img.shields.io/npm/dm/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## Compatibility

| Componente | Versão |
|---|---|
| DeepSeek Harness | `0.1.1-rc.2` (peer dependencies fixadas) |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| Gerenciador de pacotes | `pnpm@11.7.0` |
| Plataforma | Windows / macOS / Linux (plugin somente host) |
| Fontes de dados | Endpoints públicos Tiantian Fund / Eastmoney (sem chave, sem login) |

## What you get

- **Ferramenta `fund_research`** — um código de fundo entra, um relatório Markdown versionado sai: visão geral, decomposição de desempenho, penetração de posições, atribuição de estilo simplificada, perfil do gestor, declarações de risco e lacunas, aviso legal e um **apêndice de rastreabilidade numérica** mapeando cada figura-chave para seu caminho JSON no snapshot e seu veredito de verificação. Selado em `fund-reports/{code}/{YYYYMMDD-HHmmss}/` como `report.md` + `manifest.json` + `snapshot.json`. `background: true` executa como job em segundo plano `fund-report`.
- **Ferramenta `fund_snapshot`** — um cartão leve (último NAV, retornos de etapa publicados, escala, gestor, top-3 posições) selado no diretório do dia do fundo.
- **Métricas determinísticas, zero aritmética de modelo** — retorno por período/anualizado, volatilidade, drawdown máximo, Sharpe; concentração top-N, HHI, distribuição setorial, comparação trimestral de posições; bandas de estilo tamanho-valor; tempo de gestão e comparação entre pares. Tudo funções puras sobre o snapshot selado.
- **Rastreabilidade como recurso de primeira classe** — antes do selamento, cada número-chave é verificado contra o `snapshot.json` selado através do serviço opcional [`dsh-data-quality`](https://github.com/topics/dsh-plugin) quando instalado, ou do verificador isomórfico embutido (`builtin-fallback`) caso contrário. A tabela do apêndice registra valor ↔ caminho ↔ veredito.
- **Lacunas honestas** — uma fonte falha ou degradada produz uma declaração explícita de 数据缺口 (lacuna de dados) na seção afetada. O plugin nunca preenche uma lacuna com um número inventado.
- **Modo offline** — `offline: true` (config ou argumento da ferramenta) serve tudo da camada de snapshots do storage domain ou do snapshot de versão mais recente em disco, com zero requisições de saída. Ideal para testes e reprodução.
- **Eventos de auditoria de sessão** — eventos somente-log `fund-research/snapshot` e `fund-research/report` carregam o código, o diretório de versão, o hash do manifest e a lista de lacunas (visível ao modelo ⟺ registrado).
- **Skill de metodologia** — um skill `fund-research` embutido ensina ao modelo as definições de métricas (口径), o tratamento de lacunas e a linguagem de conformidade. O cálculo permanece no código.

## Quick start

```text
> 用 fund_research 出一份 161725 的研究报告
```

O agente chama `fund_research({ code: "161725" })`; um momento depois o workspace contém:

```text
fund-reports/161725/20260819-153012/
├── snapshot.json    # dados extraídos + métricas calculadas + sha256 por fonte
├── report.md        # o relatório com o apêndice de rastreabilidade
└── manifest.json    # hashes snapshot/relatório, parâmetros, motor de verificação, lacunas
```

Cada número no apêndice de `report.md` carrega um veredito `verified` / `mismatch` / `not-found` / `unverifiable` contra `snapshot.json` — recalcule qualquer um a partir de `raw.*` com as definições documentadas para auditar o próprio plugin.

## Install & uninstall

```sh
dsh plugin --profile web add dsh-fund-research     # instalar (npm ou tarball)
dsh plugin --profile web remove dsh-fund-research  # desinstalar
```

Reinicie o perfil após instalar (a ativação de bundle é baseada em restart). O patch do bundle compõe a pilha de storage (`dsh-storage` + `dsh-storage-json` + `dsh-storage-domain`) que a camada de snapshots precisa.

## Configuration

Todas as chaves são opcionais (padrões mostrados); valores inválidos falham ruidosamente ao carregar.

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Interruptor mestre; `false` não monta nada. |
| `eastmoneyBaseUrl` | `https://fund.eastmoney.com` | Host pingzhongdata do Tiantian Fund. |
| `f10BaseUrl` | `https://fundf10.eastmoney.com` | Host F10 do Tiantian Fund (páginas de posições e gestor). |
| `quoteBaseUrl` | `https://push2.eastmoney.com` | Host de cotações Eastmoney para snapshots de avaliação por ação. |
| `quoteFallbackBaseUrl` | `https://push2delay.eastmoney.com` | Host de cotações alternativo tentado por ação quando o principal falha (host de cotações diferidas próprio da Eastmoney); `''` o desativa. |
| `requestIntervalMs` | `1000` | Intervalo mínimo entre requisições de saída (coleta cortês). |
| `timeoutMs` | `15000` | Timeout por requisição. |
| `retries` | `2` | Tentativas por requisição com backoff exponencial. |
| `cacheTtlHours` | `12` | Janela de reutilização de snapshots do storage domain. |
| `riskFreeRate` | `0.02` | Taxa livre de risco anual para o índice de Sharpe. |
| `offline` | `false` | Nunca enviar requisições; ler apenas a camada de snapshots. |
| `reportRoot` | `fund-reports` | Raiz da árvore de relatórios (relativa ao workspace ou absoluta). |
| `styleQuotes` | `true` | Buscar cotações de avaliação por ação para a atribuição de estilo. |

## Tools & surfaces

### `fund_research`

| Argumento | Tipo | Descrição |
|---|---|---|
| `code` (obrigatório) | string | Código de fundo de seis dígitos, ex. `"161725"`. |
| `sections` | string[] | Seções a renderizar (`overview`/`performance`/`holdings`/`style`/`manager`/`risk`/`disclaimer`). Padrão: todas. |
| `offline` | boolean | Ler apenas a camada de snapshots (sem rede). Padrão: config do plugin. |
| `background` | boolean | Executar como job em segundo plano `fund-report`; retorna `{ kind: "background", jobId }`. Padrão: `false`. |

### `fund_snapshot`

| Argumento | Tipo | Descrição |
|---|---|---|
| `code` (obrigatório) | string | Código de fundo de seis dígitos. |
| `offline` | boolean | Ler apenas a camada de snapshots. Padrão: config do plugin. |

### Seções do relatório

概览 visão geral · 业绩拆解 decomposição de desempenho · 持仓穿透 penetração de posições · 风格归因 atribuição de estilo (simplificada) · 经理画像 perfil do gestor · 风险与缺口声明 riscos e lacunas · 免责声明 aviso legal · 附录：数字回溯表 apêndice de rastreabilidade.

## Permissions & data

- **Lê** os endpoints públicos Tiantian Fund / Eastmoney (`fund.eastmoney.com/pingzhongdata/*.js`, páginas F10 de `fundf10.eastmoney.com`, cotações de `push2.eastmoney.com`) com User-Agent de navegador e ritmo cortês configurável. Sem chave, sem login, sem API paga, sem contornar anti-bot.
- **Escreve** apenas sob a raiz de relatórios configurada dentro do workspace da sessão, mais o storage domain `dsh_fund_research` (último snapshot por fundo).
- **Nunca** avalia JavaScript remoto (o bloco pingzhongdata é escaneado, nunca executado), nunca armazena credenciais, nunca opera.
- Eventos de sessão são registros de auditoria somente-log; os peers 0.1.1-rc.2 fixados não oferecem envelope `ignorable`, então uma sessão restaurada por um build *sem* este plugin recusa essas linhas de log — a mesma compensação aceita por outros plugins de pesquisa desta família.

## Security boundaries

- Códigos de fundo são validados como exatamente seis dígitos antes de tocar um caminho ou URL; a raiz de relatórios resolve dentro do workspace da sessão.
- Cargas-fonte são hasheadas (SHA-256) na aquisição; o manifest selado permite detectar edições silenciosas upstream entre execuções.
- A verificação nunca bloqueia um selamento: um serviço `dsh-data-quality` opcional quebrado degrada para o verificador embutido, e o motor usado fica registrado no manifest e no apêndice.
- Veja [SECURITY.md](SECURITY.md) para a política de divulgação.

## Known limitations

- **Deriva estrutural upstream.** Os parsers são estritos por design: se o Tiantian Fund mudar uma forma `var Data_*` ou o layout de uma tabela F10, a fonte afetada lança um `SourceParseError` nomeando o campo, e a seção degrada para uma lacuna declarada (a falha do bloco pingzhongdata central aborta a execução ruidosamente). É deliberado — um misparse silencioso é pior que uma lacuna declarada.
- **A atribuição de estilo é 估算口径 (estimada).** Bandas fixas de tamanho (≥1000亿 / 300–1000亿 / <300亿) e de PE, mais quintis dentro das posições — nenhuma distribuição de mercado completa é consultada. O relatório rotula isso.
- **Posições são dados de divulgação trimestral** (atraso de publicação); a página F10 traz os dois últimos trimestres.
- **Um fundo por chamada; sem análise de portfólio, sem relatórios anuais em PDF, sem cotações em tempo real** (o endpoint em tempo real `fundgz.1234567.com.cn` está morto e deliberadamente não é usado).
- A linha de "deliverables" da Web UI é alimentada pelos cards de chamada de ferramentas de mutação; os arquivos produzidos por este plugin aparecem via localização de acompanhamento do card da chamada (o diretório de relatórios do fundo), não como linhas por arquivo.

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci   # tipos, incl. estrito CI
pnpm test                                     # 124 testes sobre seams reais
pnpm run test:e2e                              # E2E opcional em rede REAL (LIVE_E2E=1)
pnpm run build && pnpm run verify:artifacts   # tsdown + declarações tsc
pnpm run verify:self-contained                # sem specs de dependências fora do repo
node scripts/check-readme-sync.mjs            # gate README em cinco idiomas
node scripts/check-endpoints.mjs              # sonda de atividade M3 (4 hosts eastmoney)
pnpm pack                                     # tarball
```

Os testes usam os seams REAIS `Context`/`SessionStore`/`ToolRuntime`/`LocalJobRegistry`/storage dos peers 0.1.1-rc.2; a rede é substituída apenas na fronteira de fetch por fixtures de respostas reais salvas (`fixtures/`, fundo 161725). Atualize os fixtures com os scripts de `.tmp/`.

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `fund-research` · `mutual-fund` · `investment-research` · `finance` · `research-report`

## Contributors

Construído pelos contribuidores de dsh-fund-research. Issues e pull requests bem-vindos no repositório acima.

## PerryLink DSH Plugin Family

Parte de uma família de plugins independentes do DeepSeek Harness compartilhando uma mesma base de engenharia: peers 0.1.1-rc.2 fixados, config Schemastery com falha ruidosa, READMEs em cinco idiomas e cobertura vitest sobre seams reais.

## License

[Apache-2.0](LICENSE). Avisos de terceiros: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

**Aviso: este plugin produz apenas artefatos de pesquisa. Nada do que emite constitui aconselhamento de investimento.**
