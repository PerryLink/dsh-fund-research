# dsh-fund-research · 开发总结（v0.1.0）

本文件记录本插件的交付物、验收结果、已知限制与后续建议。仓库：`D:\deepseek-harness\Project\Plugins\dsh-fund-research\`。

## 实现清单

- **工具 ×2（经 `tools` 服务注册，描述含"仅供研究、不构成投资建议"）**
  - `fund_research`：code → 版本化 Markdown 研究报告；参数 `sections`（章节裁剪）、`offline`、`background`（经 `ctx.jobs` 以 `fund-report` 后台任务运行，返回 typed handle）。
  - `fund_snapshot`：轻量快照卡（最新净值、发布口径阶段收益、规模、经理、前三大重仓），复用当日目录 `{code}/{YYYYMMDD}-snapshot/`。
- **数据源采集（公开端点，礼貌采集，永不 eval 远程代码）**
  - pingzhongdata JS 块（深度扫描 `var X =` 提取 + `JSON.parse`）、F10 `jjcc` 持仓页（按各表自身 thead 映射列，兼容当季 9 列/上季 7 列）、F10 `jjjl` 经理页、push2 个股估值（PE/PB ÷100）。
  - **行情兜底**：主行情主机失败时逐股重试东方财富自有延时行情主机（`quoteFallbackBaseUrl`，默认 `https://push2delay.eastmoney.com`，可配、`''` 关闭）；实测本机 Node undici 与 push2 主站 TLS 不兼容、而 push2delay 稳定可用，兜底后真实 E2E 零缺口。
  - `PoliteFetcher`：共享限速时钟、超时、指数退避重试；浏览器 UA + `Referer: https://fund.eastmoney.com/`。
  - 结构漂移抛 `SourceParseError`（指名字段），失败源降级为显式"数据缺口"，绝不用编造数字填充。
- **确定性指标（纯函数，零模型心算）**：业绩拆解（区间/年化收益、波动率、最大回撤、Sharpe）、持仓穿透（前 N 集中度、HHI、行业分布、环比）、简化风格归因（规模×估值分档 + 持仓内五分位）、经理画像（任期、同类对比）。
- **可追溯封存**：`fund-reports/{code}/{YYYYMMDD-HHmmss}/` 下 `snapshot.json`（raw + computed + 逐源 sha256）→ `report.md`（八章节 + 附录数字回溯表）→ `manifest.json`（哈希、参数、核查引擎、缺口清单）。附录每个数字带 `verified/mismatch/not-found/unverifiable` 结论，可据此用文档化口径从 `raw.*` 重算复核。
- **核查桥**：`src/verify-bridge.ts` 含冻结的 `dsh-data-quality` 契约（`ctx.get('dataQuality')` 可选消费，绝不注入/导入），未装该服务时内置同构兜底（`builtin-fallback`），所用引擎记入 manifest 与附录。
- **配置**：Schemastery schema + 显式 `resolveConfig`，13 项（URL×4/限速/超时/重试/TTL/无风险利率/offline/报告根/风格行情开关/enabled），非法值加载期响亮失败。
- **会话审计事件**：`fund-research/snapshot`、`fund-research/report`（仅日志，追加失败不影响工具结果）。
- **方法论 skill**：`skills/fund-research/SKILL.md`（口径定义、缺口处理、合规话术），skills 服务在场时动态注册。
- **社区工程件**：`.github/ISSUE_TEMPLATE/bug_report.yml` + `feature_request.yml`（必填项齐全、日志选填带加粗脱敏警告）、`.github/PULL_REQUEST_TEMPLATE.md`（门禁/测试/CHANGELOG/多语言同步/关联 issue/不含密钥 checklist）、`SECURITY.md`（私有漏洞报告通道 + 脱敏提醒 + 响应时间 + 致谢披露）、五语 README 徽章（License/DSH/Node/CI/npm 版本/下载量）与 Contributors 段。
- **工程基线**：`cordis.patch.yml` bundle（组合存储栈）、五语 README + 同步门禁、CI/compat/release 三件 workflow、`release.mjs`、Apache-2.0、THIRD_PARTY_NOTICES.md。

## 验收

| 检查 | 结果（2026-08-19 复跑） |
|---|---|
| `pnpm run typecheck` / `typecheck:ci` | EXIT 0 / EXIT 0 |
| `pnpm test` | **113/113 通过**（12 个 spec；真实 Context/Session/ToolRuntime/JobRegistry/存储接缝；网络仅在 fetch 边界以真实响应 fixture 替换；含行情兜底正反例） |
| `pnpm run test:coverage` | EXIT 0（阈值 90/80/90/90，全绿） |
| `pnpm run lint`（oxlint） | 0 warnings / 0 errors |
| `pnpm run build` + `verify:artifacts` + `verify:self-contained` | 通过 |
| `node scripts/check-readme-sync.mjs` | 通过（五语章节结构与 13 个配置键一致） |
| `pnpm pack` | tarball 完整（lib + src + skills + 五语 README + LICENSE + patch） |
| **真实网络 E2E**（§9.3 有网分支） | ✅ `LIVE_E2E=1 pnpm run test:e2e`：真实采集 `fund_research({code:'161725'})` 封存 `fund-reports/161725/20260819-163808/`（report.md + manifest.json + snapshot.json），附录 verdicts 全 verified（>15 条、0 mismatch、0 not-found），抽查 5 数字（最新净值 0.5536 / 近1年 -29.74% / 近1年最大回撤 40.8869% / 规模 197.4亿 / 第一重仓 贵州茅台 17.28%）全部对上快照 JSON 路径，并对源端点二次独立抓取比对一致。证据留存 `.tmp/live-e2e/20260819-163808/` |
| **offline 全流程**（§9.3 无网分支） | ✅ tools.spec/report.spec 用预置快照经真实 ToolRuntime 跑通并断言零外呼 |
| **试装**（§9.4，复用 dsh-test-drive 同 profile 共存 + 手动矩阵兜底） | ✅ `.tmp/dsh-home/profiles/td/`：`dsh plugin add`（dsh-base + dsh-headless + **dsh-test-drive** + 本插件 tarball）→ `--dump-config` 两行挂载且新配置默认值可见 → keyless headless 冒烟 2s 得 MISSING_CREDENTIAL（插件树加载、无 PENDING 卡死）→ `dsh plugin remove` 后本插件行移除、test-drive 行与 profile 完好。证据留存 `.tmp/dsh-home/td-evidence/` |
| **git** | 分主题 conventional commits（见下），工作树干净，tag `v0.1.0` 指向最终 head（**未 push**） |

Commit 清单（按时间倒序，本轮新增见变更说明）：

```
（本轮收尾新增，见下文"变更说明"）
83932ea chore(release): 0.1.0
16246cd docs: coverage gate acceptance + release-session wording
67bf3ef test: coverage gate green (collector + live acquisition + branch fixes)
36e0459 docs: development summary (acceptance, limitations, follow-ups)
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
- **push2 主行情主机与本机 Node TLS 不兼容**（UND_ERR_SOCKET，curl 可通）：已由 push2delay 兜底主机解决；若兜底也被禁用（`quoteFallbackBaseUrl: ''`）或双主机同挂，风格归因降级为缺口声明。
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
- 带模型 key 的环境里可用 dsh-test-drive 的 `/testdrive` 命令跑 capability 断言（本会话 keyless 只到 smoke 阶段）。

## 发布会话（已执行完成 ✅，2026-08-19/20）

**发布（标准件 C）**：0.1.0 由并行发布会话首发（npm + GitHub Release + topics）；本会话完成 0.1.1 补丁发布：`release.mjs 0.1.1`（全门禁绿 + annotated tag）→ `git push -u origin main --follow-tags` → CI ✅ + Release ✅ → **npm `dsh-fund-research@0.1.1`（latest）** + [GitHub Release v0.1.1](https://github.com/PerryLink/dsh-fund-research/releases/tag/v0.1.1)。

**社区反馈检查（步骤 0）**：issues/PR = 0，无未回复评论，无可处理项。

**社区工程（标准件 B）**：topics ×9 已设；About homepage → npm 包页 ✅；徽章/issue 表单 ×2/PR 模板/SECURITY.md 已随 0.1.1 推送 ✅；Discussions 开启 ✅ + 四分类 + [欢迎帖](https://github.com/PerryLink/dsh-fund-research/discussions/1)；main 分支保护 ✅（required_status_checks contexts=["gates"]、strict=false、enforce_admins=false、allow_force_pushes=true、无 PR 强制）。

**生态投递（标准件 A）**：
- ✅ [AdamPlatin123/awesome-dsh-plugins#267](https://github.com/AdamPlatin123/awesome-dsh-plugins/pull/267)（📚 学习研究；分类器实跑输出贴 PR；运行级如实「待测」；@dsh-external scope 迁移备注已写）
- ✅ [0xsline/awesome-deepseek-harness#432](https://github.com/0xsline/awesome-deepseek-harness/pull/432)（双语同一 PR，Domain & Specialist Skills）
- ✅ 阶段二 [omdsh-dev/dsh-hub-workshop#82](https://github.com/omdsh-dev/dsh-hub-workshop/issues/82)：`dshWorkshop.capability` 已对齐 package-manifest schema（kind: tool，commit cc90d33），提交 JSON 经 `scripts/intake.mjs validate` 通过 → pending-review 队列
- ✅ 阶段三 [官方 showcase 帖](https://github.com/deepseek-ai/deepseek-harness/discussions/3523)（Show Your Plugins! 类目）
- ⏸ awesome-dsh-plugin：仓库创建于 2026-08-19T14:22Z，未满其「1 天」门槛，**2026-08-20T14:22Z 之后**重投（`data/plugins/PerryLink__dsh-fund-research.yml`，category `tools`，npm ci + generate-readme 已按规则就绪）
- ⏸ bruc3van 作者自荐：需 stars > 10（当前 1）；其全量目录由每日 topic 快照自动收录
- ⏳ 阶段四聚合核验：Oh-My-DSH / oh-my-dsh / YELEBAI 当前均未出现；预期延迟 Adam ≤8h（topic 设置 14:40 起）、bruc3van 每日快照，届时复核

**人工待办（无需本会话处理）**：Discord 分享、中文渠道推广、「项目总览」更新一行（见本文件末尾建议）。
