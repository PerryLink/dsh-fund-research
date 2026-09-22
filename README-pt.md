<div align="center">

# 📊 dsh-fund-research
- **Canal 1024 store**: `npm i -g dsh1024` uma vez, depois `dsh1024 plugin --profile web add dsh-fund-research` (conta para o ranking de instalações do [deepseek1024.com](https://deepseek1024.com)).

**Relatórios de pesquisa determinísticos para fundos mútuos públicos chineses, no DeepSeek Harness.**

*Cada número-chave de cada relatório remonta a um snapshot-fonte com hash — lacunas são declaradas, nunca inventadas. Apenas para pesquisa; não é aconselhamento de investimento.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-fund-research)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-🧩-green)](https://github.com/topics/dsh-plugin)
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-fund-research.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg)](https://dsh.market/)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-fund-research/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-fund-research/actions)
[![npm version](https://img.shields.io/npm/v/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)
[![npm downloads](https://img.shields.io/npm/dm/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-fund-research?metric=downloads&lang=pt)](https://dshfind.com/pt/plugins/PerryLink/dsh-fund-research?ref=badge)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

</div>

---

## Compatibility

| Componente | Versão |
|---|---|
| DeepSeek Harness | `dsh-v0.1.7-alpha.1` (o intervalo de peers admite a linha alpha.2: `>=0.1.2-rc.1 <0.2.0 \|\| >=0.1.5-alpha.1 <0.2.0 \|\| >=0.1.6-0 <0.2.0`). Nesta linha o terceiro parâmetro de `Session.append` é um `SurfaceIntent` apenas para tipos de superfície, então os eventos de auditoria `fund-research/*` continuam sem ser gravados (os resultados das ferramentas e o snapshot/relatório selado são o rastro de auditoria). Verificado em 2026-09-18 (typecheck duplo + 176 testes). |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| Gerenciador de pacotes | `pnpm@11.7.0` |
| Plataforma | Windows / macOS / Linux (plugin somente host) |
| Fontes de dados | Endpoints públicos Tiantian Fund / Eastmoney (sem chave, sem login) |

## What you get

- **Ferramenta `fund_research`** — um código de fundo entra, um relatório Markdown versionado sai: visão geral, decomposição de desempenho, penetração de posições, atribuição de estilo simplificada, perfil do gestor, declarações de risco e lacunas, aviso legal e um **apêndice de rastreabilidade numérica** mapeando cada figura-chave para seu caminho JSON no snapshot e seu veredito de verificação. Selado em `fund-reports/{code}/{YYYYMMDD-HHmmss}/` como `report.md` + `manifest.json` + `snapshot.json`. `background: true` executa como job em segundo plano `fund-report`.
- **Ferramenta `fund_snapshot`** — um cartão leve (último NAV, retornos de etapa publicados, escala, gestor, top-3 posições) selado no diretório do dia do fundo.
- **Métricas determinísticas, zero aritmética de modelo** — retorno por período/anualizado, volatilidade, drawdown máximo, Sharpe; concentração top-N, HHI, distribuição setorial, comparação trimestral de posições; bandas de estilo tamanho-valor; tempo de gestão e comparação entre pares. Tudo funções puras sobre o snapshot selado.
- **Rastreabilidade como recurso de primeira classe** — antes do selamento, cada número-chave é verificado contra o `snapshot.json` selado através do serviço opcional [`dsh-data-quality`](https://github.com/topics/dsh-plugin) quando instalado, ou do verificador isomórfico embutido (`builtin-fallback`) caso contrário. A tabela do apêndice registra valor ↔ caminho ↔ veredito.
- **Lacunas honestas** — uma fonte falha ou degradada produz uma declaração explícita de lacuna de dados na seção afetada. O plugin nunca preenche uma lacuna com um número inventado.
- **Modo offline** — `offline: true` (config ou argumento da ferramenta) serve tudo da camada de snapshots do storage domain ou do snapshot de versão mais recente em disco, com zero requisições de saída. Ideal para testes e reprodução.
- **Corte asOf** — `asOfDate` (ISO `YYYY-MM-DD`) trunca a série de NAV para dados em/antes dessa data e sela o corte no snapshot e no relatório; datas inválidas ou futuras falham em voz alta.
- **Retomada por checkpoint** — `<reportRoot>/.run-state.json` registra cada etapa do pipeline com timestamps e uma impressão digital de entrada; `resume: true` continua da primeira etapa incompleta reutilizando artefatos selados, e rejeita uma impressão digital divergente.
- **Registro de descoberta de fontes** — toda aquisição sela um `sources-discovery.json` gerado por código (lista de endpoints, resolução primária/reserva, cobertura e lacunas por fonte, motivos de degradação) e o incorpora ao apêndice como 数据源与缺口声明.
- **Fan-out de múltiplos fundos** — `codes` aceita um array de códigos; cada fundo executa o pipeline de forma independente com isolamento de falhas (falhas viram lacunas do resumo) e o resultado é um cartão de resumo (code / asOf / hash de selo / vereditos / motivo da falha).
- **Livro de acompanhamento** — cada selo bem-sucedido anexa uma linha determinística a `<reportRoot>/.tracking.jsonl`; `includeComparison: true` renderiza uma seção determinística 与上次对比 (faixa de NAV / escala / principais posições) com uma declaração de lacuna quando não há registro anterior.
- **Revisão somente-leitura** — após o selo, um job `fund-review` revisa os artefatos selados (completude da declaração de lacunas, consistência da tabela de rastreabilidade, aviso legal) e escreve `review-note.md`; é omitido com elegância (registrado no run-state) quando não há serviço de jobs.
- **Sinais de qualidade por fonte** — cada fonte carrega metadados de qualidade determinísticos (`requested`/`succeeded`/`fieldsPresent`/`parseWarnings`/`degraded`), apresentados no apêndice e nos valores de ferramenta para que o downstream possa reduzir o peso (nunca filtrar de forma rígida) de uma fonte de baixa qualidade.
- **Resumo de estabilidade walk-forward** — `includeWalkForward: true` adiciona uma seção 样本外稳定性摘要: persistência de sinal de retorno/Sharpe em janelas deslizantes e média/desvio, rotulada explicitamente como descrição estatística, não uma previsão.
- **Eventos de auditoria de sessão (dependentes do host)** — os eventos somente-log `fund-research/snapshot` e `fund-research/report` carregam o código, o diretório de versão, o hash do manifest e a lista de lacunas (visível ao modelo ⟺ registrado) *quando o host admite tipos de evento fora do repositório*; em hosts `0.1.2-alpha.1`–`0.1.5-alpha.1` o catálogo de tipos conhecidos é gerado no build dentro do repositório, então a porta não acrescenta nada e os resultados das ferramentas mais os artefatos selados são a trilha de auditoria.
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

Reinicie o perfil após instalar (a ativação de bundle é baseada em restart). Os perfis incluídos compõem a pilha de storage por meio do `dsh-base` (`dsh-storage` + `dsh-storage-json` + `dsh-storage-domain`); o patch do bundle monta apenas a linha do plugin.

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
| `code` | string | Código de fundo de seis dígitos, ex. `"161725"` (fundo único). Mutuamente exclusivo com `codes`. |
| `codes` | string[] | Vários códigos de seis dígitos: fan-out com isolamento de falhas por fundo (retorna um resumo). Mutuamente exclusivo com `code`. |
| `sections` | string[] | Seções a renderizar (`overview`/`performance`/`holdings`/`style`/`manager`/`risk`/`disclaimer`). Padrão: todas. |
| `offline` | boolean | Ler apenas a camada de snapshots (sem rede). Padrão: config do plugin. |
| `asOfDate` | string | Corte ISO 8601 (`YYYY-MM-DD`): apenas dados em/antes dessa data são usados (série NAV truncada). Vazio = sem corte; datas futuras falham em voz alta. |
| `resume` | boolean | Retoma a execução registrada em `.run-state.json` a partir da primeira etapa incompleta (reutiliza artefatos selados); rejeita uma impressão digital divergente. Padrão: `false`. |
| `includeComparison` | boolean | Renderiza uma seção determinística 与上次对比 frente ao registro anterior de `.tracking.jsonl`; evidência ausente é declarada como lacuna. Padrão: `false`. |
| `includeWalkForward` | boolean | Renderiza uma seção determinística 样本外稳定性摘要: persistência de sinal de retorno/Sharpe em janelas deslizantes e média/desvio. Apenas descrição estatística, não uma previsão. Padrão: `false`. |
| `background` | boolean | Executar como job em segundo plano `fund-report`; retorna `{ kind: "background", jobId }`. Padrão: `false`. |

### `fund_snapshot`

| Argumento | Tipo | Descrição |
|---|---|---|
| `code` (obrigatório) | string | Código de fundo de seis dígitos. |
| `offline` | boolean | Ler apenas a camada de snapshots. Padrão: config do plugin. |
| `asOfDate` | string | Corte ISO 8601 (`YYYY-MM-DD`): apenas dados em/antes dessa data são usados. Vazio = sem corte; datas futuras falham em voz alta. |

### Seções do relatório

概览 visão geral · 业绩拆解 decomposição de desempenho · 持仓穿透 penetração de posições · 风格归因 atribuição de estilo (simplificada) · 经理画像 perfil do gestor · 风险与缺口声明 riscos e lacunas · 免责声明 aviso legal · 附录：数字回溯表 apêndice de rastreabilidade.

## Permissions & data

- **Lê** os endpoints públicos Tiantian Fund / Eastmoney (`fund.eastmoney.com/pingzhongdata/*.js`, páginas F10 de `fundf10.eastmoney.com`, cotações de `push2.eastmoney.com`) com User-Agent de navegador e ritmo cortês configurável. Sem chave, sem login, sem API paga, sem contornar anti-bot.
- **Escreve** apenas sob a raiz de relatórios configurada dentro do workspace da sessão, mais o storage domain `dsh_fund_research` (último snapshot por fundo).
- **Nunca** avalia JavaScript remoto (o bloco pingzhongdata é escaneado, nunca executado), nunca armazena credenciais, nunca opera.
- Eventos de sessão são registros de auditoria somente-log que cruzam uma porta adaptativa em `src/events.ts`: só acrescentam quando o host admite um tipo fora do repositório — seu conjunto de tipos conhecidos cobre o vocabulário, ou seu `Session.append` aceita um envelope `ignorable`. De `0.1.2-alpha.1` em diante (incluindo `0.1.5-alpha.1`) nenhum dos dois vale: `KNOWN_SESSION_EVENT_TYPES` é um catálogo gerado no build dentro do repositório que exclui por construção os eventos externos, e `Session.append` não tem opção `ignorable`, então a porta não acrescenta nada — os resultados das ferramentas e os artefatos selados continuam sendo a trilha reconstruível, e um append falho nunca muda o resultado de uma ferramenta.
0.1.5-alpha.1 (adaptado em 2026-09-09): porta re-verificada na nova base — o catálogo ainda exclui eventos externos e `Session.append` ainda não consegue estampar um envelope `ignorable`, então o comportamento da porta não muda.
0.1.5-rc.1 (adaptado em 2026-09-10): os pins de dependências passam para a linha publicada 0.1.5-rc.1; nenhuma mudança de seam afeta o comportamento deste plugin.
0.1.5-rc.2 (adaptado em 2026-09-11): os pins de dependências passam para a linha publicada 0.1.5-rc.2; nenhuma mudança de seam afeta o comportamento deste plugin.

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
pnpm test                                     # 176 testes sobre seams reais
pnpm run test:e2e                              # E2E opcional em rede REAL (LIVE_E2E=1)
pnpm run build && pnpm run verify:artifacts   # tsdown + declarações tsc
pnpm run verify:self-contained                # sem specs de dependências fora do repo
node scripts/check-readme-sync.mjs            # gate README em cinco idiomas
node scripts/check-endpoints.mjs              # sonda de atividade M3 (4 hosts eastmoney)
pnpm pack                                     # tarball
```

Os testes usam os seams REAIS `Context`/`SessionStore`/`ToolRuntime`/`LocalJobRegistry`/storage dos peers 0.1.5-rc.2; a rede é substituída apenas na fronteira de fetch por fixtures de respostas reais salvas (`fixtures/`, fundo 161725). Atualize os fixtures com os scripts de `.tmp/`.

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `fund-research` · `mutual-fund` · `investment-research` · `finance` · `research-report`

## Contributors

- **PerryLink** — mantenedor: o pipeline de coleta/métricas/selo de relatórios, a sonda de vivacidade de endpoints, CI e releases, e a documentação em cinco idiomas.
- **dsh-fund-research contributors** — autoria coletiva da construção fundacional (contrato do plugin, schema de configuração, ferramentas, testes, empacotamento).

Sem contribuidores externos ainda — 0 PRs/issues da comunidade mesclados. Abra um issue pelos formulários em `.github/ISSUE_TEMPLATE/` ou um pull request contra `main` para aparecer aqui.

## PerryLink DSH Plugin Family

This project is one of the **45 DeepSeek Harness plugins** maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command | |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |
| **[dsh-catalog](https://github.com/PerryLink/dsh-catalog)** | DSH Desktop Market standard catalog source for the PerryLink family | |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence | |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore | |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) | |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. | |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds | |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval | |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` | |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools | |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. | |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. | |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers | |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer | |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors | |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool | |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. | |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching | |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit | |
| **[dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification)** | Community certification registry with repro-checkable grades and badges | |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins | |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill | |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins | |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card | |
| **[dsh-plugin-upgrade-015](https://github.com/PerryLink/dsh-plugin-upgrade-015)** | Merged `0.1.3-alpha.1` → `0.1.5-rc.1` upgrade corridor card plus a zero-dependency seam scanner | |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions | |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. | |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. | |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review | |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. | |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. | |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools | |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. | |

