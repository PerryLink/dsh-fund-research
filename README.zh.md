<div align="center">

# 📊 dsh-fund-research

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
| DeepSeek Harness | `0.1.0-rc.8`（peer 依赖钉版） |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| 包管理器 | `pnpm@11.7.0` |
| 平台 | Windows / macOS / Linux（纯宿主插件） |
| 数据源 | 天天基金 / 东方财富公开端点（免 key、免登录） |

## What you get

- **`fund_research` 工具** —— 输入基金代码，产出版本化 Markdown 研究报告：概览、业绩拆解、持仓穿透、风格归因（简版）、经理画像、风险与缺口声明、免责声明，以及**数字回溯表附录**——把每个关键数字映射到快照 JSON 路径与核查结论。封存到 `fund-reports/{code}/{YYYYMMDD-HHmmss}/`：`report.md` + `manifest.json` + `snapshot.json`。`background: true` 可作为 `fund-report` 后台任务运行。
- **`fund_snapshot` 工具** —— 轻量快照卡（最新净值、发布口径阶段收益、规模、经理、前三大重仓），封存进该基金当日目录。
- **确定性指标，零模型心算** —— 区间/年化收益、波动率、最大回撤、Sharpe；前 N 大集中度、HHI、行业分布、重仓环比；规模-估值风格分档；经理任期与同类对比。全部是作用于封存快照的纯函数。
- **回溯是第一卖点** —— 封存前，每个关键数字都会对照封存的 `snapshot.json` 核查：安装了 [`dsh-data-quality`](https://github.com/topics/dsh-plugin) 时走该服务，否则走内置同构兜底核查（`builtin-fallback`）。附录表记录 数值 ↔ 路径 ↔ 结论。
- **诚实缺口** —— 数据源失败或降级时，对应章节显式渲染"数据缺口"声明；插件绝不用编造的数字填坑。
- **离线模式** —— `offline: true`（配置或工具参数）下一切从存储域快照层或最新磁盘版本快照读取，零外呼。适合测试与复现。
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
| `code`（必填） | string | 六位基金代码，如 `"161725"`。 |
| `sections` | string[] | 渲染章节（`overview`/`performance`/`holdings`/`style`/`manager`/`risk`/`disclaimer`），默认全部。 |
| `offline` | boolean | 只读快照层（无网络），默认取插件配置。 |
| `background` | boolean | 以 `fund-report` 后台任务运行，返回 `{ kind: "background", jobId }`，默认 `false`。 |

### `fund_snapshot`

| 参数 | 类型 | 说明 |
|---|---|---|
| `code`（必填） | string | 六位基金代码。 |
| `offline` | boolean | 只读快照层，默认取插件配置。 |

### 报告章节

概览 · 业绩拆解 · 持仓穿透 · 风格归因（简版） · 经理画像 · 风险与缺口声明 · 免责声明 · 附录：数字回溯表。

## Permissions & data

- **读取**天天基金 / 东方财富公开端点（`fund.eastmoney.com/pingzhongdata/*.js`、`fundf10.eastmoney.com` F10 页面、`push2.eastmoney.com` 行情），带浏览器 UA 与可配置的礼貌间隔。免 key、免登录、无付费 API、不绕反爬。
- **只写**会话工作区内配置的报告根目录，以及 `dsh_fund_research` 存储域（每只基金最新快照）。
- **绝不**执行远程 JavaScript（pingzhongdata 块只扫描不执行）、绝不存取凭据、绝不交易。
- 会话事件为仅日志审计记录；钉版的 0.1.0-rc.8 peers 没有 `ignorable` 信封，因此由*未安装*本插件的 build 恢复会话时会拒绝这些日志行——与本家族其他研究插件接受的同一折衷。

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
pnpm test                                     # 113 个真实接缝测试
pnpm run test:e2e                              # 可选的真网 E2E（LIVE_E2E=1）
pnpm run build && pnpm run verify:artifacts   # tsdown + tsc 声明
pnpm run verify:self-contained                # 无出仓依赖规格
node scripts/check-readme-sync.mjs            # 五语 README 门禁
pnpm pack                                     # tarball
```

测试使用来自 0.1.0-rc.8 peers 的真实 `Context`/`SessionStore`/`ToolRuntime`/`LocalJobRegistry`/存储接缝；网络仅在 fetch 边界由保存的真实响应 fixtures（`fixtures/`，基金 161725）替换。用 `.tmp/` 下的采集脚本刷新 fixtures。

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `fund-research` · `mutual-fund` · `investment-research` · `finance` · `research-report`

## Contributors

由 dsh-fund-research contributors 构建。欢迎到上方仓库提交 issue 与 pull request。

## PerryLink DSH Plugin Family

PerryLink 独立 DeepSeek Harness 插件家族成员，共享同一工程基线：钉版 0.1.0-rc.8 peers、响亮失败的 Schemastery 配置、五语 README、真实接缝 vitest 覆盖。

## License

[Apache-2.0](LICENSE)。第三方声明：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

**免责声明：本插件只产出研究制品，其任何输出均不构成投资建议。**
