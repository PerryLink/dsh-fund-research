<div align="center">

# 📊 dsh-fund-research
- **1024 商店渠道**：先 `npm i -g dsh1024`，再 `dsh1024 plugin --profile web add dsh-fund-research`（计入 [deepseek1024.com](https://deepseek1024.com) 安装排行）。

**DeepSeek Harness 上的中国公募基金确定性研究报告插件。**

*报告中每个关键数字都可回溯到带哈希的源快照——缺口显式声明，绝不编造。仅供研究，不构成投资建议。*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-fund-research)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-🧩-green)](https://github.com/topics/dsh-plugin)
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-fund-research.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-zh.svg)](https://dsh.market/)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-fund-research/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-fund-research/actions)
[![npm version](https://img.shields.io/npm/v/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)
[![npm downloads](https://img.shields.io/npm/dm/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-fund-research?metric=downloads&lang=zh)](https://dshfind.com/zh/plugins/PerryLink/dsh-fund-research?ref=badge)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <name> add dsh-fund-research
```


</div>

---


**📖 生态实测知识库**（实测数据，不是营销）：[插件开发指南 · 选型实测数据 · 维护取舍判据](https://perrylink.github.io/dsh-plugin-guide/)。

<!-- star-cta -->
## Install & uninstall

```sh
dsh plugin --profile web add dsh-fund-research     # 安装（npm 或 tarball）
dsh plugin --profile web remove dsh-fund-research  # 卸载
```

安装后重启 profile 生效（bundle 以重启方式激活）。官方随附的 profile 通过 dsh-base 组合存储栈（`dsh-storage` + `dsh-storage-json` + `dsh-storage-domain`）；bundle patch 只挂载插件行。

## ⭐ 如果它帮到了你

这个插件是 [DSH 插件家族](https://github.com/PerryLink)的一员（40+ 个，全部 Apache-2.0）。如果你在用，**给个 star** —— 它不会解锁任何功能，但会让下一个人在搜索里更容易找到它。

*English:* part of a 40+ plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.

## What is dsh-fund-research?

DeepSeek Harness 上的中国公募基金确定性研究报告插件。

报告中每个关键数字都可回溯到带哈希的源快照——缺口显式声明，绝不编造。仅供研究，不构成投资建议。

![dsh-fund-research 终端演示：dsh-fund-research — one fund_research call, the sealed day directory](https://raw.githubusercontent.com/PerryLink/dsh-fund-research/main/docs/assets/dsh-fund-research-hero.png)

![Animated terminal demo of dsh-fund-research](https://raw.githubusercontent.com/PerryLink/dsh-fund-research/main/docs/assets/dsh-fund-research-demo.gif)

*同一次运行，动图版。*

## Compatibility

| 组件 | 版本 |
|---|---|
| DeepSeek Harness | `dsh-v0.2.1-rc.2`（peer 范围已接纳 alpha.2 线：`>=0.1.2-rc.1 <0.2.0 \|\| >=0.1.5-alpha.1 <0.2.0 \|\| >=0.1.6-0 <0.2.0 \|\| >=0.1.7-0 <0.2.0`）。该线上 `Session.append` 的第三参仅对表面事件类型为 `SurfaceIntent`，因此 `fund-research/*` 审计事件仍不落盘（工具结果与已封存快照/报告即审计轨迹）。已于 2026-09-24 核验（双 typecheck 尺子 + 176 项测试）。 |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| 包管理器 | `pnpm@11.7.0` |
| 平台 | Windows / macOS / Linux（纯宿主插件） |
| 数据源 | 天天基金 / 东方财富公开端点（免 key、免登录） |

## What you get

- **`fund_research` 工具** —— 输入基金代码，产出版本化 Markdown 研究报告：概览、业绩拆解、持仓穿透、风格归因（简版）、经理画像、同类/指数基准对比、风险与缺口声明、免责声明，以及**数字回溯表附录**——把每个关键数字映射到快照 JSON 路径与核查结论。封存到 `fund-reports/{code}/{YYYYMMDD-HHmmss}/`：`report.md` + `manifest.json` + `snapshot.json`。`background: true` 可作为 `fund-report` 后台任务运行。
- **`fund_snapshot` 工具** —— 轻量快照卡（最新净值、发布口径阶段收益、规模、经理、前三大重仓），封存进该基金当日目录。
- **确定性指标，零模型心算** —— 区间/年化收益、波动率、最大回撤、Sharpe；前 N 大集中度、HHI、行业分布、重仓环比；规模-估值风格分档；经理任期与同类对比。全部是作用于封存快照的纯函数。
- **回溯是第一卖点** —— 封存前，每个关键数字都会对照封存的 `snapshot.json` 核查：安装了 [`dsh-data-quality`](https://github.com/topics/dsh-plugin) 时走该服务，否则走内置同构兜底核查（`builtin-fallback`）。附录表记录 数值 ↔ 路径 ↔ 结论。
- **诚实缺口** —— 数据源失败或降级时，对应章节显式渲染"数据缺口"声明；插件绝不用编造的数字填坑。
- **离线模式** —— `offline: true`（配置或工具参数）下一切从存储域快照层或最新磁盘版本快照读取，零外呼。适合测试与复现。
- **asOf 截点** —— `asOfDate`（ISO `YYYY-MM-DD`）把净值序列截断到该日期（含）之前，并在快照与报告中标注截点；非法或未来日期响亮失败。
- **断点续跑** —— `<reportRoot>/.run-state.json` 记录各阶段（快照/报告）进度、时间戳与输入指纹；`resume: true` 从首个未完成阶段继续，复用封存产物，指纹不匹配则拒绝。
- **数据源发现记录** —— 每次采集封存代码生成的 `sources-discovery.json`（端点清单、主/回退源、逐源覆盖与缺口、降级原因），并作为"数据源与缺口声明"并入报告附录。
- **多基金 fan-out** —— `codes` 接受基金代码数组：逐基金独立跑管线、失败隔离（失败项进入汇总缺口），输出汇总卡（code / asOf / seal 哈希 / verdicts / 失败原因）。
- **追踪账本** —— 每次成功封存向 `<reportRoot>/.tracking.jsonl` 确定性追加一行；`includeComparison: true` 时渲染确定性的"与上次对比"章节（净值区间 / 规模 / 前 N 重仓），无上一期记录则声明缺口。
- **只读复核** —— 封存后派生 `fund-review` 只读复核 job（缺口声明完整性、数字回溯表一致性、免责声明）并写回 `review-note.md`；无 jobs 服务时优雅跳过（记录于状态文件）。
- **逐源质量信号** —— 每源携带确定性质量元数据（`requested`/`succeeded`/`fieldsPresent`/`parseWarnings`/`degraded`），呈现在附录并进入工具值，供下游降权（而非硬过滤）低质量源。
- **样本外稳定性摘要** —— `includeWalkForward: true` 追加"样本外稳定性摘要"章节：确定性滚动窗口的收益/夏普符号持续率与均值/标准差，显式标注仅为统计描述、不构成预测。
- **会话审计事件（取决于宿主）** —— 宿主允许仓外事件类型时，`fund-research/snapshot` 与 `fund-research/report` 仅日志事件携带代码、版本目录、manifest 哈希与缺口清单（模型可见 ⟺ 已记录）；在 `0.1.2-alpha.1`–`0.1.5-alpha.1` 宿主上，已知类型目录是构建期生成的仓内清单，门控不追加任何事件，工具结果与封存产物即审计轨迹。
- **方法论 skill** —— 内置 `fund-research` skill 教模型指标口径、缺口处理与合规话术；计算始终在代码里。

## Quick start

```sh
dsh plugin --profile web add github:PerryLink/dsh-fund-research
```

```text
> 用 fund_research 出一份 161725 的研究报告
```

agent 调用 `fund_research({ code: "161725" })`；片刻后工作区内出现：

```text
fund-reports/161725/20260819-153012/
├── snapshot.json    # 原始提取数据 + 确定性计算 + 逐源 sha256
├── report.md        # 带数字回溯表附录的研究报告
└── manifest.json    # 快照/报告哈希、计算参数、核查引擎、缺口清单
```

`report.md` 附录中每个数字都带 `verified` / `mismatch` / `not-found` / `unverifiable` 结论；任何人可用文档化口径从 `raw.*` 重算，对插件本身进行审计。

## Configuration

所有键均可选（所示为默认值）；非法值在加载期响亮失败。

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | 总开关；`false` 时什么都不挂载。 |
| `eastmoneyBaseUrl` | `https://fund.eastmoney.com` | 天天基金 pingzhongdata 主机。 |
| `f10BaseUrl` | `https://fundf10.eastmoney.com` | 天天基金 F10 主机（持仓 + 经理页）。 |
| `quoteBaseUrl` | `https://push2.eastmoney.com` | 东方财富行情主机（个股估值快照）。 |
| `quoteFallbackBaseUrl` | `https://push2delay.eastmoney.com` | 主行情主机失败时逐股重试的兜底主机（东方财富自有的延时行情主机）；设为 `''` 关闭。 |
| `requestIntervalMs` | `1000` | 出站请求最小间隔（礼貌采集）。 |
| `timeoutMs` | `15000` | 单请求超时。 |
| `retries` | `2` | 单请求重试次数（指数退避）。 |
| `cacheTtlHours` | `12` | 存储域快照复用窗口。 |
| `riskFreeRate` | `0.02` | Sharpe 比率使用的年无风险利率。 |
| `offline` | `false` | 永不发请求，只读快照层。 |
| `reportRoot` | `fund-reports` | 报告树根目录（工作区相对或绝对路径）。 |
| `styleQuotes` | `true` | 为风格归因抓取个股估值快照。 |

## Tools & surfaces

### `fund_research`

| 参数 | 类型 | 说明 |
|---|---|---|
| `code` | string | 六位基金代码，如 `"161725"`（单基金）。与 `codes` 互斥。 |
| `codes` | string[] | 多个六位基金代码：逐基金 fan-out、失败隔离（返回汇总）。与 `code` 互斥。 |
| `sections` | string[] | 渲染章节（`overview`/`performance`/`holdings`/`style`/`manager`/`benchmark`/`risk`/`disclaimer`），默认全部。 |
| `offline` | boolean | 只读快照层（无网络），默认取插件配置。 |
| `asOfDate` | string | ISO 8601 日期（`YYYY-MM-DD`）截点：只采用不晚于该日期的数据（净值序列截断）。空 = 无截点；未来日期响亮失败。 |
| `resume` | boolean | 从 `.run-state.json` 记录的运行自首个未完成阶段续跑（复用封存产物）；指纹不匹配则拒绝。默认 `false`。 |
| `includeComparison` | boolean | 针对上一期 `.tracking.jsonl` 记录渲染确定性的"与上次对比"章节；证据缺失声明为缺口。默认 `false`。 |
| `includeWalkForward` | boolean | 渲染确定性的"样本外稳定性摘要"章节：滚动窗口收益/夏普符号持续率与均值/标准差。仅为统计描述，不构成预测。默认 `false`。 |
| `background` | boolean | 以 `fund-report` 后台任务运行，返回 `{ kind: "background", jobId }`，默认 `false`。 |

### `fund_snapshot`

| 参数 | 类型 | 说明 |
|---|---|---|
| `code`（必填） | string | 六位基金代码。 |
| `offline` | boolean | 只读快照层，默认取插件配置。 |
| `asOfDate` | string | ISO 8601 日期（`YYYY-MM-DD`）截点：只采用不晚于该日期的数据。空 = 无截点；未来日期响亮失败。 |

### 报告章节

概览 · 业绩拆解 · 持仓穿透 · 风格归因（简版） · 经理画像 · 同类/指数基准对比 · 风险与缺口声明 · 免责声明 · 附录：数字回溯表。

## Permissions & data

- **读取**天天基金 / 东方财富公开端点（`fund.eastmoney.com/pingzhongdata/*.js`、`fundf10.eastmoney.com` F10 页面、`push2.eastmoney.com` 行情），带浏览器 UA 与可配置的礼貌间隔。免 key、免登录、无付费 API、不绕反爬。
- **只写**会话工作区内配置的报告根目录，以及 `dsh_fund_research` 存储域（每只基金最新快照）。
- **绝不**执行远程 JavaScript（pingzhongdata 块只扫描不执行）、绝不存取凭据、绝不交易。
- 会话事件为仅日志审计记录，走 `src/events.ts` 的自适应门：只有宿主允许仓外类型时才追加——其已知类型集合覆盖该词汇，或其 `Session.append` 接受 `ignorable` 信封。自 `0.1.2-alpha.1` 起（含 `0.1.5-alpha.1`）两者均不成立：`KNOWN_SESSION_EVENT_TYPES` 是构建期生成的仓内清单，按构造排除仓外事件；`Session.append` 也没有 `ignorable` 选项，因此门控不追加任何事件——工具结果与封存产物仍是可重建的审计轨迹，且追加失败永不改变工具结果。
0.1.5-alpha.1（2026-09-09 已适配）：在新基线上复核门控——目录仍排除仓外事件，`Session.append` 仍无法盖 `ignorable` 信封，门控行为不变。
0.1.5-rc.1（2026-09-10 已适配）：依赖钉号移至已发布的 0.1.5-rc.1 线；无接缝变化影响本插件行为。
0.1.5-rc.2（2026-09-11 已适配）：依赖钉号移至已发布的 0.1.5-rc.2 线；无接缝变化影响本插件行为。

## Security boundaries

- 基金代码先校验为恰好六位数字才允许进入路径或 URL；报告根解析在会话工作区内。
- 源载荷在采集时计算 SHA-256；封存 manifest 可检测两次运行之间的上游静默改动。
- 核查永不阻塞封存：可选的 `dsh-data-quality` 服务故障时降级到内置核查器，所用引擎记录在 manifest 与附录中。
- 报告政策见 [SECURITY.md](SECURITY.md)。

## Known limitations

- **上游结构漂移风险。** 解析器刻意严格：天天基金一旦变更 `var Data_*` 结构或 F10 表布局，受影响源抛出指名字段的 `SourceParseError`，对应章节降级为显式缺口（核心 pingzhongdata 块失败则整次运行响亮失败）。这是有意设计——静默错解析比显式缺口更糟。
- **风格归因是估算口径。** 固定规模分档（≥1000亿 / 300–1000亿 / <300亿）与 PE 分档，外加持仓内五分位——不查询全市场分布。报告中已标注。
- **持仓为季度披露数据**（披露滞后）；F10 页携带最近两个季度。
- **每次调用一只基金；不做组合分析、不解析 PDF 年报、不做实时盯盘**（`fundgz.1234567.com.cn` 实时估值端点已失效，刻意不用）。
- Web UI 的 deliverables 行由变更类工具的调用卡片驱动；本插件的产出文件经工具调用卡片的 follow-along 位置（该基金报告目录）呈现，而非逐文件行。

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci && pnpm run typecheck:checkout   # 类型（含 CI 严格档）
pnpm test                                     # 176 个真实接缝测试
pnpm run test:e2e                              # 可选的真网 E2E（LIVE_E2E=1）
pnpm run build && pnpm run verify:artifacts   # tsdown + tsc 声明
pnpm run verify:self-contained                # 无出仓依赖规格
node scripts/check-readme-sync.mjs            # 五语 README 门禁
node scripts/check-endpoints.mjs              # M3 端点存活探测（4 个 eastmoney 主机）
pnpm pack                                     # tarball
```

测试使用来自 0.1.7-rc.2 peers 的真实 `Context`/`SessionStore`/`ToolRuntime`/`LocalJobRegistry`/存储接缝；网络仅在 fetch 边界由保存的真实响应 fixtures（`fixtures/`，基金 161725）替换。用 `.tmp/` 下的采集脚本刷新 fixtures。

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `fund-research` · `mutual-fund` · `investment-research` · `finance` · `research-report`

## Contributors

- **PerryLink** — 维护者：采集/指标/报告密封管线、端点存活探测、CI 与发布、五语文档。
- **dsh-fund-research contributors** — 基础构建的集体署名（插件契约、配置 schema、工具、测试、打包）。

暂无外部贡献者——合并的社区 PR/issue 为 0。欢迎通过 `.github/ISSUE_TEMPLATE/` 的表单提 issue，或向 `main` 提交 pull request，即可被列在此处。

## PerryLink DSH Plugin Family

本项目是 [PerryLink](https://github.com/PerryLink) 维护的 DeepSeek Harness 插件家族成员：**87 个活跃维护**，名册共 **95** 个，其中 **5 个已冻结**、**3 个已退役**。完整名单默认折叠，避免每个 README 的首屏被长表淹没；点击展开可查看每一行，原因见「状态」列。

<details>
<summary>展开全部 95 个插件</summary>

| 插件 | 一句话 | 状态 |
|---|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** | 水产养殖投入品记录核对（按投入品用量、休药期与起捕间隔核对记录自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** | 档案归档完整性与保管期限核对（依据《档案法》及配套规定，仅提示差异，不作出定性结论） |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command |  |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | 🚫 已退役 — 见仓库 README |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** | 投标文件符合性预检（按招标文件逐条核对响应情况，仅提示差异，不作出定性结论） |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** | 投标人资格条件核对（按资格条件与证明材料核对逐条响应，仅提示差异，不作出定性结论） |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | 🧊 已冻结 — 见仓库 README |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |  |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | 🧊 已冻结 — 见仓库 README |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** | 合同条款立场台账核对（按立场、风险等级与退让底线核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** | 报关单证一致性核对（按公开的报关单填制规范核对单证间字段一致性，仅提示差异，不作出定性结论） |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) |  |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | 🧊 已冻结 — 见仓库 README |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** | 滞箱费台账核对（按免箱期与费率核对超期天数与金额的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review |  |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | 🧊 已冻结 — 见仓库 README |
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
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | 🧊 已冻结 — 见仓库 README |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** | 维修工单结算核对（按项目金额、配件工时合计与结算总额核对算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** | 审稿意见逐条回应覆盖核对（按意见与回应一一对应核对覆盖完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** | 规则库文件自检核对（按条款引用纪律与效力上限核对规则库自身合规，仅提示差异，不作出定性结论） |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** | 安全技术交底记录要素齐备性与签字闭环核对（依据公开的安全生产法规与检查标准，仅提示差异，不作出定性结论） |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. |  |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | 🚫 已退役 — 见仓库 README |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** | 监理日志跨日连续性与旁站覆盖提示（依据 GB/T 50319-2013 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** | 三重一大决策台账核对（按前置研究、会议审议与决议记录核对程序留痕，仅提示差异，不作出定性结论） |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** | 土壤与地下水监测台账核对（按点位、监测项目、限值与超标判定核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** | 作业规程与 FMEA／控制计划一致性核对（按编号与版本核对三份文件是否同步，仅提示差异，不作出定性结论） |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** | 控制图常数与过程能力指数核对（按 GB/T 4091 的常规控制图常数表核对控制限与 Cp/Cpk 的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |  |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | 🚫 已退役 — 见仓库 README |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** | 招标文件条款摘录核对（按出处与原文逐字核对摘录完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** | 评标因素评分矩阵核对（按分值上限与合计核对矩阵自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** | 质保期与索赔金额核对（按质保期月数与里程、索赔金额算式核对自洽，仅提示差异，不作出定性结论） |  |

</details>

</details>

</details>