<div align="center">

# 📊 dsh-fund-research
- **Canal 1024 store**: `npm i -g dsh1024` uma vez, depois `dsh1024 plugin --profile web add dsh-fund-research` (conta para o ranking de instalações do [deepseek1024.com](https://deepseek1024.com)).

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
| DeepSeek Harness | `0.1.2-alpha.5` (peer dependencies fixadas) |
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
- **Corte asOf** — `asOfDate` (ISO `YYYY-MM-DD`) trunca a série de NAV para dados em/antes dessa data e sela o corte no snapshot e no relatório; datas inválidas ou futuras falham em voz alta.
- **Retomada por checkpoint** — `<reportRoot>/.run-state.json` registra cada etapa do pipeline com timestamps e uma impressão digital de entrada; `resume: true` continua da primeira etapa incompleta reutilizando artefatos selados, e rejeita uma impressão digital divergente.
- **Registro de descoberta de fontes** — toda aquisição sela um `sources-discovery.json` gerado por código (lista de endpoints, resolução primária/reserva, cobertura e lacunas por fonte, motivos de degradação) e o incorpora ao apêndice como 数据源与缺口声明.
- **Fan-out de múltiplos fundos** — `codes` aceita um array de códigos; cada fundo executa o pipeline de forma independente com isolamento de falhas (falhas viram lacunas do resumo) e o resultado é um cartão de resumo (code / asOf / hash de selo / vereditos / motivo da falha).
- **Livro de acompanhamento** — cada selo bem-sucedido anexa uma linha determinística a `<reportRoot>/.tracking.jsonl`; `includeComparison: true` renderiza uma seção determinística 与上次对比 (faixa de NAV / escala / principais posições) com uma declaração de lacuna quando não há registro anterior.
- **Revisão somente-leitura** — após o selo, um job `fund-review` revisa os artefatos selados (completude da declaração de lacunas, consistência da tabela de rastreabilidade, aviso legal) e escreve `review-note.md`; é omitido com elegância (registrado no run-state) quando não há serviço de jobs.
- **Sinais de qualidade por fonte** — cada fonte carrega metadados de qualidade determinísticos (`requested`/`succeeded`/`fieldsPresent`/`parseWarnings`/`degraded`), apresentados no apêndice e nos valores de ferramenta para que o downstream possa reduzir o peso (nunca filtrar de forma rígida) de uma fonte de baixa qualidade.
- **Resumo de estabilidade walk-forward** — `includeWalkForward: true` adiciona uma seção 样本外稳定性摘要: persistência de sinal de retorno/Sharpe em janelas deslizantes e média/desvio, rotulada explicitamente como descrição estatística, não uma previsão.
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
- Eventos de sessão são registros de auditoria somente-log que cruzam uma porta adaptativa: hosts que conhecem o vocabulário acrescentam diretamente, hosts com o envelope `ignorable` acrescentam com o marcador, e hosts sem envelope (rc.6–rc.8, `0.1.1-rc.2` e `0.1.2-alpha.5`, que removeu o envelope e falha fechado para tipos desconhecidos na leitura) não recebem append — os resultados das ferramentas e os artefatos selados continuam sendo a trilha reconstruível.
0.1.2-alpha.5 (adaptado em 2026-09-02): o envelope de sessão mantém seu campo ignorable apenas para compatibilidade de leitura de logs armazenados - o Session.append ainda não consegue estampá-lo, então o comportamento da porta não muda.

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

Os testes usam os seams REAIS `Context`/`SessionStore`/`ToolRuntime`/`LocalJobRegistry`/storage dos peers 0.1.2-alpha.5; a rede é substituída apenas na fronteira de fetch por fixtures de respostas reais salvas (`fixtures/`, fundo 161725). Atualize os fixtures com os scripts de `.tmp/`.

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `fund-research` · `mutual-fund` · `investment-research` · `finance` · `research-report`

## Contributors

- **PerryLink** — mantenedor: o pipeline de coleta/métricas/selo de relatórios, a sonda de vivacidade de endpoints, CI e releases, e a documentação em cinco idiomas.
- **dsh-fund-research contributors** — autoria coletiva da construção fundacional (contrato do plugin, schema de configuração, ferramentas, testes, empacotamento).

Sem contribuidores externos ainda — 0 PRs/issues da comunidade mesclados. Abra um issue pelos formulários em `.github/ISSUE_TEMPLATE/` ou um pull request contra `main` para aparecer aqui.

## PerryLink DSH Plugin Family

Parte de uma família de plugins independentes do DeepSeek Harness compartilhando uma mesma base de engenharia: peers 0.1.2-alpha.5 fixados, config Schemastery com falha ruidosa, READMEs em cinco idiomas e cobertura vitest sobre seams reais.

## PerryLink DSH Plugin Family

Este projeto é um dos [33 plugins de DeepSeek Harness](https://github.com/PerryLink) mantidos por [PerryLink](https://github.com/PerryLink). Se este ajuda você, os outros provavelmente também:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | Auto-revisão de segundo modelo na cadeia de aprovação, com falha fechada por padrão | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | Agentes filhos em segundo plano duráveis com barra lateral de UI web, mensagens e interrupção | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | Governança de custos para DeepSeek Harness: orçamentos, carbono e latência em um painel. | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Equivalente ao /rewind do Claude Code: instantâneos, bifurcações de sessão, restauração de uso único | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Migre sessões, memória, habilidades e CLAUDE.md do Claude Code para o DSH | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | Controle de desktop nativo multiplataforma para DeepSeek Harness — Windows primeiro. | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | Histórico de entrada estilo terminal para o compositor web: setas, busca Ctrl+R | |
| **[dsh-dsh-data-quality](https://github.com/PerryLink/dsh-dsh-data-quality)** | Verificações de qualidade de datasets e verificação de citações (a ponte numérica opcional consumida aqui) | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | Defesa contra injeção de prompt, jailbreak e vazamento de segredos para DeepSeek Harness. | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | Guardião de disciplina de engenharia: sabatina de requisitos, portões de teste, revisão adversária | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | Roteamento unificado de geração de imagens estáticas para DeepSeek Harness. | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | Diagnóstico de desempenho só de leitura para DeepSeek Harness. | |
| **[dsh-dsh-github](https://github.com/PerryLink/dsh-dsh-github)** | Integração de PR/issues do GitHub para o DSH, cada escrita controlada por aprovação | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | Orquestração de pesquisa setorial que sela as suas entregas através do `ctx.researchReport.assemble` deste plugin | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | Base de conhecimento documental local para DeepSeek Harness. | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | Integração de modelos locais (Ollama) para DeepSeek Harness. | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | Diagnósticos, formatação, autocompletar, ações de código e renomeação LSP sobre servidores de linguagem | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | Middleware de mascaramento de PII: anonimiza no limite do modelo, restaura na camada de exibição | |
| **[dsh-dsh-mcp-panel](https://github.com/PerryLink/dsh-dsh-mcp-panel)** | Painel de tempo de execução MCP somente leitura: comando /mcp + aba Settings com status, ferramentas e erros | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | Memória entre sessões controlada por aprovação: costura ctx.memory + SQLite + ferramenta de memória | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | Exportador de observabilidade OpenTelemetry e Langfuse para DeepSeek Harness. | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Troca de estilo em tempo de execução equivalente ao outputStyles do Claude Code | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | Regras de permissão declarativas allow/deny/ask estilo Claude Code com auditoria | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | Base de conhecimento de desenvolvimento de plugins como habilidade de agente sob demanda | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | Motor de relatórios de pesquisa verificáveis com evidência endereçada por conteúdo | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | Pontuação de qualidade multidimensional para plugins de DeepSeek Harness. | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | Fixe sessões na barra lateral web com ordenação durável | |
| **[dsh-dsh-session-sync](https://github.com/PerryLink/dsh-dsh-session-sync)** | Sincronização de sessões entre dispositivos para DeepSeek Harness — um espelho git dedicado do seu armazenamento de sessões. | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | Pacote de habilidades de auditoria de segurança: varredura de segredos, revisão de dependências e cadeia de suprimentos | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | Loop de sessão com voz para DeepSeek Harness: fale e ouça a resposta. | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | Test drives isolados de instalação e smoke para plugins de DeepSeek Harness. | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | Tradução de parâmetros entre fornecedores e reparo determinístico de JSON para DeepSeek Harness. | |

## License

[Apache-2.0](LICENSE). Avisos de terceiros: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

**Aviso: este plugin produz apenas artefatos de pesquisa. Nada do que emite constitui aconselhamento de investimento.**

### Instalar a partir do mercado do DSH Desktop

Todos os plugins PerryLink podem ser explorados no mercado integrado do DSH Desktop: **Market → Sources → add source → colar** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ selecionar**. A instalação continua passando pela verificação de identidade npm do mercado e pela sua confirmação.
