<div align="center">

# 📊 dsh-fund-research
- **1024 商店渠道**：先 `npm i -g dsh1024`，再 `dsh1024 plugin --profile web add dsh-fund-research`（计入 [deepseek1024.com](https://deepseek1024.com) 安装排行）。

**DeepSeek Harness 上的中国公募基金确定性研究报告插件。**

*报告中每个关键数字都可回溯到带哈希的源快照——缺口显式声明，绝不编造。仅供研究，不构成投资建议。*

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

| 组件 | 版本 |
|---|---|
| DeepSeek Harness | `0.1.2-alpha.3`（peer 依赖钉版） |
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
- **会话审计事件** —— `fund-research/snapshot` 与 `fund-research/report` 仅日志事件，携带代码、版本目录、manifest 哈希与缺口清单（模型可见 ⟺ 已记录）。
- **方法论 skill** —— 内置 `fund-research` skill 教模型指标口径、缺口处理与合规话术；计算始终在代码里。

## Quick start

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

## Install & uninstall

```sh
dsh plugin --profile web add dsh-fund-research     # 安装（npm 或 tarball）
dsh plugin --profile web remove dsh-fund-research  # 卸载
```

安装后重启 profile 生效（bundle 以重启方式激活）。bundle patch 会组合快照层所需的存储栈（`dsh-storage` + `dsh-storage-json` + `dsh-storage-domain`）。

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
- 会话事件为仅日志审计记录，走自适应门：认识该词汇的宿主直接追加，带 `ignorable` 信封的宿主带标记追加，无信封宿主（rc.6–rc.8、`0.1.1-rc.2` 以及移除信封并对未知类型读取即失败的 `0.1.2-alpha.3`）不追加——工具结果与封存产物仍是可重建的审计轨迹。
0.1.2-alpha.3（2026-09-01 已适配）：会话信封保留 ignorable 字段但仅用于存量日志读取兼容——Session.append 仍无法盖章，门控行为不变。

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
pnpm run typecheck && pnpm run typecheck:ci   # 类型（含 CI 严格档）
pnpm test                                     # 124 个真实接缝测试
pnpm run test:e2e                              # 可选的真网 E2E（LIVE_E2E=1）
pnpm run build && pnpm run verify:artifacts   # tsdown + tsc 声明
pnpm run verify:self-contained                # 无出仓依赖规格
node scripts/check-readme-sync.mjs            # 五语 README 门禁
node scripts/check-endpoints.mjs              # M3 端点存活探测（4 个 eastmoney 主机）
pnpm pack                                     # tarball
```

测试使用来自 0.1.2-alpha.3 peers 的真实 `Context`/`SessionStore`/`ToolRuntime`/`LocalJobRegistry`/存储接缝；网络仅在 fetch 边界由保存的真实响应 fixtures（`fixtures/`，基金 161725）替换。用 `.tmp/` 下的采集脚本刷新 fixtures。

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `fund-research` · `mutual-fund` · `investment-research` · `finance` · `research-report`

## Contributors

- **PerryLink** — 维护者：采集/指标/报告密封管线、端点存活探测、CI 与发布、五语文档。
- **dsh-fund-research contributors** — 基础构建的集体署名（插件契约、配置 schema、工具、测试、打包）。

暂无外部贡献者——合并的社区 PR/issue 为 0。欢迎通过 `.github/ISSUE_TEMPLATE/` 的表单提 issue，或向 `main` 提交 pull request，即可被列在此处。

## PerryLink DSH Plugin Family

PerryLink 独立 DeepSeek Harness 插件家族成员，共享同一工程基线：钉版 0.1.2-alpha.3 peers、响亮失败的 Schemastery 配置、五语 README、真实接缝 vitest 覆盖。

## PerryLink DSH Plugin Family

这是 [PerryLink](https://github.com/PerryLink) 维护的 [33 个 DeepSeek Harness 插件](https://github.com/PerryLink) 之一。如果它能帮到你，其他的也会：

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | 审批链上的第二模型自动审查，默认失败关闭 | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | 带 Web UI 侧栏、消息与中断的持久后台子代理 | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | DeepSeek Harness 的成本治理：预算、碳排与延迟一屏呈现。 | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Claude Code /rewind 等价：快照、会话 fork、一次性恢复 | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | 把 Claude Code 会话、记忆、技能与 CLAUDE.md 迁入 DSH | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | 跨平台原生桌面控制（DeepSeek Harness），Windows 优先。 | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | Web 输入框的终端式历史：方向键、Ctrl+R 搜索 | |
| **[dsh-dsh-data-quality](https://github.com/PerryLink/dsh-dsh-data-quality)** | 数据集质量检查与引文核查（本插件可选消费的数字核查桥） | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | DeepSeek Harness 的提示注入、越狱与密钥泄露防护。 | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | 工程纪律守卫：需求质询、测试门禁、对手评审 | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | DeepSeek Harness 的统一静态图像生成路由。 | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | DeepSeek Harness 只读性能诊断。 | |
| **[dsh-dsh-github](https://github.com/PerryLink/dsh-dsh-github)** | 面向 DSH 的 GitHub PR/issues 集成，每次写入经审批门控 | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | 行业研究编排，经本插件的 `ctx.researchReport.assemble` 封存交付物 | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | DeepSeek Harness 的本地文档知识库。 | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | DeepSeek Harness 的本地模型（Ollama）接入。 | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | 通过语言服务器的 LSP 诊断、格式化、补全、代码操作与重命名 | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | PII 脱敏中间件：模型边界匿名化、展示层还原 | |
| **[dsh-dsh-mcp-panel](https://github.com/PerryLink/dsh-dsh-mcp-panel)** | 只读 MCP 运行时面板：/mcp 命令 + 带状态、工具与错误的 Settings 标签页 | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | 审批门控的跨会话记忆：ctx.memory 接缝 + SQLite + 记忆工具 | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | DeepSeek Harness 的 OpenTelemetry 与 Langfuse 可观测导出器。 | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Claude Code outputStyles 等价的运行时风格切换 | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | Claude Code 风格声明式 allow/deny/ask 权限规则，带审计 | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | 作为按需代理技能的插件开发知识库 | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | 可验证研究报告引擎：内容寻址证据账本与封存版本 | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | DeepSeek Harness 插件的多维质量评分。 | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | 在 Web 侧栏置顶会话，带持久排序 | |
| **[dsh-dsh-session-sync](https://github.com/PerryLink/dsh-dsh-session-sync)** | DeepSeek Harness 的跨设备会话同步——会话存储的专用 git 镜像。 | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | 安全审计技能包：密钥扫描、依赖与供应链审查 | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | DeepSeek Harness 的语音优先会话闭环：对它说，听它答。 | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | DeepSeek Harness 插件的隔离试装冒烟。 | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | DeepSeek Harness 的厂商参数翻译与确定性 JSON 修复。 | |

## License

[Apache-2.0](LICENSE)。第三方声明：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

**免责声明：本插件只产出研究制品，其任何输出均不构成投资建议。**
