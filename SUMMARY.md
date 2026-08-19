# dsh-fund-research · 开发总结（v0.1.0）

本文件记录本次开发的交付物、验收结果、已知限制与后续建议。仓库：`D:\deepseek-harness\Project\Plugins\dsh-fund-research\`。

## 实现清单

- **工具 ×2（经 `tools` 服务注册，描述含"仅供研究、不构成投资建议"）**
  - `fund_research`：code → 版本化 Markdown 研究报告；参数 `sections`（章节裁剪）、`offline`、`background`（经 `ctx.jobs` 以 `fund-report` 后台任务运行，返回 typed handle）。
  - `fund_snapshot`：轻量快照卡（最新净值、发布口径阶段收益、规模、经理、前三大重仓）。
- **数据源采集（公开端点，礼貌采集，永不 eval 远程代码）**
  - pingzhongdata JS 块（深度扫描 `var X =` 提取 + `JSON.parse`）、F10 `jjcc` 持仓页（按各表自身 thead 映射列，兼容当季 9 列/上季 7 列）、F10 `jjjl` 经理页、push2 个股估值（PE/PB ÷100）。
  - `PoliteFetcher`：共享限速时钟、超时、指数退避重试；浏览器 UA + `Referer: https://fund.eastmoney.com/`。
  - 结构漂移抛 `SourceParseError`（指名字段），失败源降级为显式"数据缺口"，绝不用编造数字填充。
- **确定性指标（纯函数，零模型心算）**：业绩拆解（区间/年化收益、波动率、最大回撤、Sharpe）、持仓穿透（前 N 集中度、HHI、行业分布、环比）、简化风格归因（规模×估值分档 + 持仓内五分位）、经理画像（任期、同类对比）。
- **可追溯封存**：`fund-reports/{code}/{YYYYMMDD-HHmmss}/` 下 `snapshot.json`（raw + computed + 逐源 sha256）→ `report.md`（八章节 + 附录数字回溯表）→ `manifest.json`（哈希、参数、核查引擎、缺口清单）。附录每个数字带 `verified/mismatch/not-found/unverifiable` 结论，可据此用文档化口径从 `raw.*` 重算复核。
- **核查桥**：`src/verify-bridge.ts` 含冻结的 `dsh-data-quality` 契约（`ctx.get('dataQuality')` 可选消费，绝不注入/导入），未装该服务时内置同构兜底（`builtin-fallback`），所用引擎记入 manifest 与附录。
- **配置**：Schemastery schema + 显式 `resolveConfig`，12 项（URL×3/限速/超时/重试/TTL/无风险利率/offline/报告根/风格行情开关/enabled），非法值加载期响亮失败。
- **会话审计事件**：`fund-research/snapshot`、`fund-research/report`（仅日志，追加失败不影响工具结果）。
- **方法论 skill**：`skills/fund-research/SKILL.md`（口径定义、缺口处理、合规话术），skills 服务在场时动态注册。
- **工程基线**：`cordis.patch.yml` bundle（组合存储栈）、五语 README + 同步门禁、CI/compat/release 三件 workflow、`release.mjs`、Apache-2.0、SECURITY.md、THIRD_PARTY_NOTICES.md。

## 验收

| 检查 | 结果 |
|---|---|
| `pnpm run typecheck` / `typecheck:ci` | EXIT 0 / EXIT 0 |
| `pnpm test` | **65/65 通过**（9 个 spec，真实 Context/Session/ToolRuntime/JobRegistry/存储接缝） |
| `pnpm run build` + `verify:artifacts` | 通过（lib/index.js、lib/types、cordis.patch.yml、SKILL.md 均在） |
| `verify:self-contained` | 通过（依赖规格全部来自 registry） |
| `pnpm run lint`（oxlint） | 0 warnings / 0 errors（39 文件，`git init` 后生效） |
| `node scripts/check-readme-sync.mjs` | 通过（五语章节结构与配置键一致） |
| `pnpm pack` | tarball 完整（lib + src + skills + 五语 README + LICENSE + patch） |
| **手动试装**（临时 DSH_HOME） | ✅ 装 tarball + dsh-base + dsh-headless；`--dump-config` 确认 storage 栈 + 插件行挂载；keyless headless 冒烟得 `MISSING_CREDENTIAL`（证明插件树加载、无 PENDING 卡死）；`dsh plugin remove` 后行移除、profile 完好 |
| **git** | `main` 分支 7 个分主题 commit（见下），工作树干净 |

Commit 清单：

```
5534f52 docs: five-language README, security policy, licenses, and CI workflows
d8507d2 test: real-context suite against the 0.1.0-rc.6 peers (65 tests)
ccf6832 feat(tools): fund_snapshot and fund_research tools with background job and audit events
f1e2385 feat(report): versioned seal with per-number traceability appendix and verify bridge
7c4fa63 feat(metrics): deterministic performance, holdings, style, and manager metrics
99ad50d feat(sources): eastmoney collectors/parsers and snapshot acquisition with real fixtures
c76bc74 chore: project scaffolding (package, tsconfigs, bundle patch, build scripts)
```

## 已知限制

- **上游结构漂移**：解析器刻意严格；天天基金改结构时对应源抛错并降级为缺口，核心 pingzhongdata 失败则整次响亮失败。
- **push2 上海个股行情偶发断连**：已有重试 + 缺口声明兜底；真实 E2E 可能偶遇抖动。
- **风格归因为估算口径**（固定分档 + 持仓内五分位，不查全市场分布），报告中已标注。
- **持仓为季度披露数据**（F10 页仅最近两季）。
- **rc.6 平台限制（两处有意偏差，与其他家族插件同款接受）**：
  1. `ctx.attachments` 仅支持图片，报告文件无法进入 Web UI deliverables 行；经工具调用卡片的 follow-along 位置（基金报告目录）呈现。
  2. 自定义 session events 在 rc.6 无 `ignorable` 信封选项：由未安装本插件的 build 恢复会话时会拒绝这两条日志（dsh-defend/dsh-library 相同的已接受折衷）。
- `fundgz.1234567.com.cn` 实时估值端点已失效，刻意不使用。

## 后续建议

- 扩充行业映射表（当前内置约 30 个行业名）与细分风格因子。
- F10 债券持仓（`f10-jbgk`）解析器已备 fixture，可补债券型基金支持。
- 定期报告 PDF 解析（如必要，作为独立来源接入并纳入缺口体系）。
- 发布路径：`node scripts/release.mjs <x.y.z>` → `git push origin main --follow-tags`（CI 复跑门禁 + npm publish + GitHub Release）。