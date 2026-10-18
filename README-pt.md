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

```sh
dsh plugin --profile <name> add dsh-fund-research
```


</div>

---


**📖 Base de conhecimento do ecossistema** — dados medidos, não marketing: [guia de desenvolvimento · dados de seleção · critérios de manutenção](https://perrylink.github.io/dsh-plugin-guide/).

<!-- star-cta -->
## Install & uninstall

```sh
dsh plugin --profile web add dsh-fund-research     # instalar (npm ou tarball)
dsh plugin --profile web remove dsh-fund-research  # desinstalar
```

Reinicie o perfil após instalar (a ativação de bundle é baseada em restart). Os perfis incluídos compõem a pilha de storage por meio do `dsh-base` (`dsh-storage` + `dsh-storage-json` + `dsh-storage-domain`); o patch do bundle monta apenas a linha do plugin.

## ⭐ 如果它帮到了你

Este plugin faz parte da [família de plugins DSH](https://github.com/PerryLink) (mais de 40, todos Apache-2.0). Se for útil, **deixe uma estrela**: não desbloqueia nada, mas ajuda a próxima pessoa a encontrá-lo.

*English:* part of a 40+ plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.

## What is dsh-fund-research?

Relatórios de pesquisa determinísticos para fundos mútuos públicos chineses, no DeepSeek Harness.

Cada número-chave de cada relatório remonta a um snapshot-fonte com hash — lacunas são declaradas, nunca inventadas. Apenas para pesquisa; não é aconselhamento de investimento.

![Demonstração de terminal do dsh-fund-research: dsh-fund-research — one fund_research call, the sealed day directory](https://raw.githubusercontent.com/PerryLink/dsh-fund-research/main/docs/assets/dsh-fund-research-hero.png)

![Animated terminal demo of dsh-fund-research](https://raw.githubusercontent.com/PerryLink/dsh-fund-research/main/docs/assets/dsh-fund-research-demo.gif)

*A mesma execução, animada.*

## Compatibility

| Componente | Versão |
|---|---|
| DeepSeek Harness | `dsh-v0.2.1-rc.2` (o intervalo de peers admite a linha alpha.2: `>=0.1.2-rc.1 <0.2.0 \|\| >=0.1.5-alpha.1 <0.2.0 \|\| >=0.1.6-0 <0.2.0 \|\| >=0.1.7-0 <0.2.0`). Nesta linha o terceiro parâmetro de `Session.append` é um `SurfaceIntent` apenas para tipos de superfície, então os eventos de auditoria `fund-research/*` continuam sem ser gravados (os resultados das ferramentas e o snapshot/relatório selado são o rastro de auditoria). Verificado em 2026-09-24 (typecheck duplo + 176 testes). |
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

```sh
dsh plugin --profile web add github:PerryLink/dsh-fund-research
```

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
| `sections` | string[] | Seções a renderizar (`overview`/`performance`/`holdings`/`style`/`manager`/`benchmark`/`risk`/`disclaimer`). Padrão: todas. |
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
pnpm run typecheck && pnpm run typecheck:ci && pnpm run typecheck:checkout   # tipos, incl. estrito CI
pnpm test                                     # 176 testes sobre seams reais
pnpm run test:e2e                              # E2E opcional em rede REAL (LIVE_E2E=1)
pnpm run build && pnpm run verify:artifacts   # tsdown + declarações tsc
pnpm run verify:self-contained                # sem specs de dependências fora do repo
node scripts/check-readme-sync.mjs            # gate README em cinco idiomas
node scripts/check-endpoints.mjs              # sonda de atividade M3 (4 hosts eastmoney)
pnpm pack                                     # tarball
```

Os testes usam os seams REAIS `Context`/`SessionStore`/`ToolRuntime`/`LocalJobRegistry`/storage dos peers 0.1.7-rc.2; a rede é substituída apenas na fronteira de fetch por fixtures de respostas reais salvas (`fixtures/`, fundo 161725). Atualize os fixtures com os scripts de `.tmp/`.

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `fund-research` · `mutual-fund` · `investment-research` · `finance` · `research-report`

## Contributors

- **PerryLink** — mantenedor: o pipeline de coleta/métricas/selo de relatórios, a sonda de vivacidade de endpoints, CI e releases, e a documentação em cinco idiomas.
- **dsh-fund-research contributors** — autoria coletiva da construção fundacional (contrato do plugin, schema de configuração, ferramentas, testes, empacotamento).

Sem contribuidores externos ainda — 0 PRs/issues da comunidade mesclados. Abra um issue pelos formulários em `.github/ISSUE_TEMPLATE/` ou um pull request contra `main` para aparecer aqui.

## Família de plugins DSH da PerryLink

Este projeto é um dos **87 plugins ativamente mantidos** do DeepSeek Harness da [PerryLink](https://github.com/PerryLink). O registro da família tem **95** plugins — **5 congelados**, **3 retirados** — e fica recolhido abaixo para que cada README mantenha uma primeira tela curta. Expanda para ver cada linha, com o motivo na coluna Status.

<details>
<summary>Expandir os 95 plugins</summary>

| Plugin | Uma linha | Status |
|---|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** | 水产养殖投入品记录核对（按投入品用量、休药期与起捕间隔核对记录自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** | 档案归档完整性与保管期限核对（依据《档案法》及配套规定，仅提示差异，不作出定性结论） |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command |  |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** | 投标文件符合性预检（按招标文件逐条核对响应情况，仅提示差异，不作出定性结论） |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** | 投标人资格条件核对（按资格条件与证明材料核对逐条响应，仅提示差异，不作出定性结论） |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |  |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** | 合同条款立场台账核对（按立场、风险等级与退让底线核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** | 报关单证一致性核对（按公开的报关单填制规范核对单证间字段一致性，仅提示差异，不作出定性结论） |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) |  |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** | 滞箱费台账核对（按免箱期与费率核对超期天数与金额的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review |  |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** | 应急演练脚本核对（按阶段、响应分级、指挥与资源要素核对脚本齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** | 环评导则适用性核对（按要素、导则名称与执行标准核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** | 应急预案要素齐备性与条款级页码定位（依据 GB/T 29639-2020 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** | 作文量表评分核对（按评分项、原文定位与分值算术核对评分自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** | 证据清单齐备性核对（按待证事实与证据要素核对清单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** | 出口管制物项核对（按管制清单、最终用途与许可证核对台账齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** | FMEA 分析表要素齐备性与风险顺序数一致性核对（按公开的 FMEA 方法标准核对表内自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** | 预测准确率考核核对（按准确率、门槛与考核单价核对考核费用的算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** | 公文流转与办理时限核对（按公开的公文处理规范核对环节完整性与时限，仅提示差异，不作出定性结论） |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** | 公文格式要素核对（按公开的党政机关公文格式标准核对版头与主体要素，仅提示差异，不作出定性结论） |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** | 劳动保护与安全防护用品配置表核对（按公开的配备标准核对品名规格与配置数量，仅提示差异，不作出定性结论） |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** | 危险化学品临界量与重大危险源辨识核对（按储存量与临界量核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** | HAZOP 分析表要素齐备性与偏差推导一致性核对（依据公开的危险与可操作性分析标准，仅提示差异，不作出定性结论） |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** | 安全隐患台账→《工贸企业重大事故隐患判定标准》（应急管理部令第10号）条款映射提示（仅提示差异，不作出定性结论） |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** | 商品归类层级一致性核对（按章、品目、子目与商品编号的层级关系核对自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** | ICD 合并编码与星剑号配对提示（依据 GB/T 14396-2016 与公开的 ICD 使用说明，仅提示差异，不作出定性结论） |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** | 法条引用与文书要素核对（按名称、条号、原文与效力状态核对引用可核验性，仅提示差异，不作出定性结论） |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** | 信用证单据条款核对（按单据种类、份数、期限与不符点核对交单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** | 能力差距与培养计划核对（按能力等级差、培养措施与完成期限核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** | 病案首页形式质控与逻辑矛盾提示（依据国卫办医发〔2016〕24号等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool |  |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** | 国家自然科学基金申请书形式审查与匿名化提示（依据《国家自然科学基金条例》与申请人导入的当年指南，仅提示差异，不作出定性结论） |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** | 护理记录时限、签名与评估表完整性校验（依据《病历书写基本规范》等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** | 原产地区域价值成分核对（按 RVC 定义式与门槛核对原产地判定自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** | 在线点评回复台账核对（按回复时限、问题分类与整改状态核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** | 试卷解析结构核对（按题型、答案、分值与 yotta 标识核对试卷结构自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** | 行政许可办理核对（按申请材料、法定时限与决定记录核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** | 项目全流程文件链条核对（按环节先后与金额口径核对链条自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** | 起诉状要素齐备性核对（按诉请、事实、证据、法条四要素核对文书齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins |  |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins |  |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card |  |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** | 政策专报要素核对（按观点、依据、出处与建议核对专报齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** | 线损电量拆分与考核表核对（依据公开的线损计算口径，仅提示差异，不作出定性结论） |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** | 电力工作票要素齐备性与签发许可顺序核对（依据现行电力安全工作规程，仅提示差异，不作出定性结论） |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** | PPAP 提交要素齐备性核对（按公开的 PPAP 手册与提交等级核对要素齐备与版本填写，仅提示差异，不作出定性结论） |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** | 质疑与投诉期限核对（按公开的政府采购质疑投诉规定核对期限与台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** | 铁路施工天窗台账核对（按时间窗、时长算术与命令号核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** | 维修工单结算核对（按项目金额、配件工时合计与结算总额核对算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** | 审稿意见逐条回应覆盖核对（按意见与回应一一对应核对覆盖完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** | 规则库文件自检核对（按条款引用纪律与效力上限核对规则库自身合规，仅提示差异，不作出定性结论） |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** | 安全技术交底记录要素齐备性与签字闭环核对（依据公开的安全生产法规与检查标准，仅提示差异，不作出定性结论） |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. |  |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** | 监理日志跨日连续性与旁站覆盖提示（依据 GB/T 50319-2013 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** | 三重一大决策台账核对（按前置研究、会议审议与决议记录核对程序留痕，仅提示差异，不作出定性结论） |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** | 土壤与地下水监测台账核对（按点位、监测项目、限值与超标判定核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** | 作业规程与 FMEA／控制计划一致性核对（按编号与版本核对三份文件是否同步，仅提示差异，不作出定性结论） |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** | 控制图常数与过程能力指数核对（按 GB/T 4091 的常规控制图常数表核对控制限与 Cp/Cpk 的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |  |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** | 招标文件条款摘录核对（按出处与原文逐字核对摘录完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** | 评标因素评分矩阵核对（按分值上限与合计核对矩阵自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** | 质保期与索赔金额核对（按质保期月数与里程、索赔金额算式核对自洽，仅提示差异，不作出定性结论） |  |

</details>

</details>