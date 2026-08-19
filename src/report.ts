/**
 * Versioned report assembly: fold one snapshot into the Markdown research
 * report (概览 / 业绩拆解 / 持仓穿透 / 风格归因 / 经理画像 / 风险与缺口声明 /
 * 免责声明 / 附录), collecting one traceability-table row per key number, then
 * seal `snapshot.json` + `report.md` + `manifest.json` into
 * `{reportRoot}/{code}/{YYYYMMDD-HHmmss}/`. Data gaps render as explicit
 * section-level declarations; no number outside the snapshot ever appears.
 * @module dsh-fund-research/report
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { FundSnapshot, ReportManifest, TraceRow } from './model.ts'
import { sha256Of } from './sources/eastmoney.ts'
import type { VerifyOutcome } from './verify-bridge.ts'

/** All report section ids in default order. */
export const ALL_SECTIONS = ['overview', 'performance', 'holdings', 'style', 'manager', 'risk', 'disclaimer', 'appendix'] as const

/** A report section id. */
export type SectionId = (typeof ALL_SECTIONS)[number]

/** One assembled section: Markdown plus its traceability rows. */
export interface BuiltSection {
  id: SectionId
  markdown: string
  traces: TraceRow[]
}

/** The compliance disclaimer rendered into every report and echoed in tool descriptions. */
export const DISCLAIMER = '本报告由 dsh-fund-research 基于公开数据自动生成，仅供研究参考，不构成任何投资建议。数据可能存在滞后或缺漏，据此操作风险自负。'

/** Format one percent number for the report body (the exact snapshot value). */
function pct(value: number): string {
  return `${value}%`
}

/** Format epoch milliseconds as YYYY-MM-DD (UTC). */
function ymd(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

/** Trace-row factory with the default exact-match tolerance. */
function trace(id: string, label: string, value: number | string, path_: string, tolerance = 0): TraceRow {
  return { id, label, value, path: path_, tolerance }
}

/** Build the 概览 section. */
function buildOverview(snapshot: FundSnapshot): BuiltSection {
  const { raw, computed } = snapshot
  const lastNavIndex = raw.navTrend.length - 1
  const lastScaleIndex = raw.scaleHistory.values.length - 1
  const traces: TraceRow[] = [
    trace('overview.latestNav', '最新单位净值', computed.performance.latestNav, `raw.navTrend[${lastNavIndex}].nav`),
    trace('overview.year1Return', '近1年收益率（源发布值）', raw.returns.year1, 'raw.returns.year1'),
    trace('overview.manager', '基金经理', raw.manager.name, 'raw.manager.name'),
  ]
  const lines = [
    `# ${snapshot.name}（${snapshot.code}）研究报告`,
    '',
    `- 数据截止：净值 ${computed.performance.latestDate}；采集时间 ${ymd(snapshot.fetchedAt)}（asOf 逐源见附录）`,
    `- 最新单位净值：**${computed.performance.latestNav}**（${computed.performance.latestDate}）`,
    `- 近1年收益率（数据源发布口径）：**${raw.returns.year1}%**`,
  ]
  if (lastScaleIndex >= 0) {
    traces.push(trace('overview.scale', '最新规模（亿元）', raw.scaleHistory.values[lastScaleIndex] ?? 0, `raw.scaleHistory.values[${lastScaleIndex}]`))
    lines.push(`- 最新规模：**${raw.scaleHistory.values[lastScaleIndex]} 亿元**（${raw.scaleHistory.dates[lastScaleIndex]}）`)
  }
  traces.push(trace('overview.stockPct', '最新股票仓位占净比', raw.assetAllocation.stockPct[raw.assetAllocation.stockPct.length - 1] ?? 0, `raw.assetAllocation.stockPct[${raw.assetAllocation.stockPct.length - 1}]`))
  lines.push(
    `- 基金经理：**${raw.manager.name}**（从业 ${raw.manager.workTime}，在管 ${raw.manager.fundSize}）`,
    `- 最新资产配置：股票 ${raw.assetAllocation.stockPct[raw.assetAllocation.stockPct.length - 1]}% / 债券 ${raw.assetAllocation.bondPct[raw.assetAllocation.bondPct.length - 1]}% / 现金 ${raw.assetAllocation.cashPct[raw.assetAllocation.cashPct.length - 1]}%（${raw.assetAllocation.dates[raw.assetAllocation.dates.length - 1]}）`,
    `- 费率：申购费 ${raw.fees.rate}%（原价 ${raw.fees.sourceRate}%），最小申购 ${raw.fees.minSubscription} 元`,
  )
  if (raw.holdings !== null && raw.holdings.rows.length >= 3) {
    const top3 = raw.holdings.rows.slice(0, 3).map(row => `${row.name} ${row.navPct}%`).join('、')
    lines.push(`- 前三大重仓：${top3}（${raw.holdings.asOf}）`)
  }
  return { id: 'overview', markdown: lines.join('\n'), traces }
}

/** Build the 业绩拆解 section. */
function buildPerformance(snapshot: FundSnapshot): BuiltSection {
  const { computed } = snapshot
  const traces: TraceRow[] = []
  const lines = [
    '## 业绩拆解',
    '',
    `基于日净值序列（${snapshot.raw.navTrend.length} 个交易日，${snapshot.raw.navTrend[0] !== undefined ? ymd(snapshot.raw.navTrend[0].t) : '?'} 起）的确定性计算；口径见附录。`,
    '',
    '| 区间 | 起止 | 交易日数 | 区间收益 | 年化收益 | 年化波动率 | 最大回撤 | Sharpe |',
    '|---|---|---|---|---|---|---|---|',
  ]
  computed.performance.windows.forEach((window, index) => {
    lines.push(`| ${window.label} | ${window.start} ~ ${window.end} | ${window.days} | ${pct(window.periodReturnPct)} | ${pct(window.annualizedReturnPct)} | ${pct(window.volatilityPct)} | ${pct(window.maxDrawdownPct)}（${window.maxDrawdownPeak}→${window.maxDrawdownTrough}） | ${window.sharpe} |`)
    traces.push(
      trace(`performance.windows[${index}].periodReturnPct`, `${window.label}区间收益`, window.periodReturnPct, `computed.performance.windows[${index}].periodReturnPct`),
      trace(`performance.windows[${index}].annualizedReturnPct`, `${window.label}年化收益`, window.annualizedReturnPct, `computed.performance.windows[${index}].annualizedReturnPct`),
      trace(`performance.windows[${index}].volatilityPct`, `${window.label}年化波动率`, window.volatilityPct, `computed.performance.windows[${index}].volatilityPct`),
      trace(`performance.windows[${index}].maxDrawdownPct`, `${window.label}最大回撤`, window.maxDrawdownPct, `computed.performance.windows[${index}].maxDrawdownPct`),
      trace(`performance.windows[${index}].sharpe`, `${window.label}Sharpe`, window.sharpe, `computed.performance.windows[${index}].sharpe`),
    )
  })
  lines.push('', `无风险利率取 ${snapshot.parameters.riskFreeRate}（配置项），波动率年化系数 √${snapshot.parameters.tradingDaysPerYear}。`)
  return { id: 'performance', markdown: lines.join('\n'), traces }
}

/** Build the 持仓穿透 section (gap-aware). */
function buildHoldings(snapshot: FundSnapshot): BuiltSection {
  const traces: TraceRow[] = []
  if (snapshot.raw.holdings === null || computedHoldingsAbsent(snapshot)) {
    return {
      id: 'holdings',
      markdown: '## 持仓穿透\n\n**数据缺口**：持仓明细数据源本次不可用（来源 fundf10.eastmoney.com F10 持仓页），本版不产出持仓分析，不编造。',
      traces,
    }
  }
  const holdings = snapshot.raw.holdings
  const metrics = snapshot.computed.holdings
  if (metrics === null) throw new Error('holdings metrics absent despite raw holdings')
  const lines = [
    '## 持仓穿透',
    '',
    `截止 ${holdings.asOf} 的前十大重仓（来源：天天基金 F10）：`,
    '',
    '| 序号 | 代码 | 名称 | 占净值比例 | 持仓市值（万元） |',
    '|---|---|---|---|---|',
  ]
  for (const row of holdings.rows) {
    lines.push(`| ${row.rank} | ${row.code} | ${row.name} | ${pct(row.navPct)} | ${row.marketValue10k} |`)
  }
  traces.push(
    trace('holdings.top10Pct', '前十大重仓合计占比', metrics.top10Pct, 'computed.holdings.top10Pct'),
    trace('holdings.top3Pct', '前三大重仓合计占比', metrics.top3Pct, 'computed.holdings.top3Pct'),
    trace('holdings.hhi', '持仓集中度 HHI', metrics.hhi, 'computed.holdings.hhi'),
  )
  lines.push(
    '',
    `- 前十大合计占净值 **${pct(metrics.top10Pct)}**，前三大合计 **${pct(metrics.top3Pct)}**`,
    `- 持仓集中度（HHI，权重平方和×10000 口径的百分权重形式）：**${metrics.hhi}**`,
  )

  const industries = Object.entries(metrics.industryPct).sort((a, b) => b[1] - a[1])
  if (industries.length > 0) {
    lines.push('', '行业分布（按重仓股市值权重，本地映射表口径）：', '', '| 行业 | 合计占净值比例 |', '|---|---|')
    for (const [industry, value] of industries) {
      lines.push(`| ${industry} | ${pct(value)} |`)
      traces.push(trace(`holdings.industryPct.${industry}`, `行业分布·${industry}`, value, `computed.holdings.industryPct.${industry}`))
    }
  }

  if (metrics.quarterCompare !== null && holdings.previousAsOf !== null) {
    const compare = metrics.quarterCompare
    lines.push(
      '',
      `与上期（${holdings.previousAsOf}）对比：新晋 ${compare.added.length === 0 ? '无' : compare.added.join('、')}；剔除 ${compare.removed.length === 0 ? '无' : compare.removed.join('、')}；留存 ${compare.kept.length} 只。`,
    )
  } else {
    lines.push('', '上期持仓：数据源未提供可对比的上期明细，本版缺口。')
  }
  return { id: 'holdings', markdown: lines.join('\n'), traces }
}

/** Whether the holdings section must degrade despite raw rows (defensive). */
function computedHoldingsAbsent(snapshot: FundSnapshot): boolean {
  return snapshot.computed.holdings === null
}

/** Build the 风格归因 section (gap-aware). */
function buildStyle(snapshot: FundSnapshot): BuiltSection {
  if (snapshot.computed.style === null) {
    return {
      id: 'style',
      markdown: '## 风格归因（简版）\n\n**数据缺口**：个股估值快照本次不可用（或被 styleQuotes: false 关闭），本版不产出风格归因，不编造。',
      traces: [],
    }
  }
  const style = snapshot.computed.style
  const traces: TraceRow[] = []
  const lines = [
    '## 风格归因（简版，估算口径）',
    '',
    `基于前十大重仓股的市值/估值特征（覆盖 ${style.coverage} 只；固定分档近似，无全市场分位数据，方法论见 skill 与下方口径说明）：`,
    '',
    '| 代码 | 名称 | 占净值 | 总市值（亿） | 规模分档 | 规模分位（持仓内） | PE（动态） | PB | 估值分档 |',
    '|---|---|---|---|---|---|---|---|---|',
  ]
  for (const row of style.rows) {
    lines.push(`| ${row.code} | ${row.name} | ${pct(row.navPct)} | ${row.marketCapYi} | ${row.sizeBand} | 第${row.sizeQuintile}分位 | ${row.peDynamic} | ${row.pb} | ${row.valueBand} |`)
  }
  lines.push('', '规模分布（权重合计）：' + Object.entries(style.sizeDistribution).map(([band, value]) => `${band} ${pct(value)}`).join('，'))
  lines.push('估值分布（权重合计）：' + Object.entries(style.valueDistribution).map(([band, value]) => `${band} ${pct(value)}`).join('，'))
  for (const [band, value] of Object.entries(style.sizeDistribution)) {
    traces.push(trace(`style.sizeDistribution.${band}`, `规模分布·${band}`, value, `computed.style.sizeDistribution.${band}`))
  }
  for (const [band, value] of Object.entries(style.valueDistribution)) {
    traces.push(trace(`style.valueDistribution.${band}`, `估值分布·${band}`, value, `computed.style.valueDistribution.${band}`))
  }
  lines.push('', '口径说明：规模分档为固定阈值（大盘≥1000亿、中盘300-1000亿、小盘<300亿）；规模分位为前十大持仓内市值降序五分位；估值分档按动态 PE（深度价值<15、价值15-25、均衡25-40、成长≥40）。均为估算口径。')
  return { id: 'style', markdown: lines.join('\n'), traces }
}

/** Build the 经理画像 section (gap-aware). */
function buildManager(snapshot: FundSnapshot): BuiltSection {
  const { raw, computed } = snapshot
  const traces: TraceRow[] = []
  const lines = ['## 经理画像', '']
  lines.push(
    `- 现任经理：**${raw.manager.name}**（星级 ${raw.manager.star}，从业 ${raw.manager.workTime}，在管规模 ${raw.manager.fundSize}）`,
    `- 经理评分：综合 ${raw.manager.powerAvr}（${raw.manager.powerCategories.map((category, index) => `${category} ${raw.manager.powerData[index] ?? '?'}`).join('，')}；截止 ${raw.manager.powerAsOf}）`,
  )
  traces.push(trace('manager.powerAvr', '经理综合评分', raw.manager.powerAvr, 'raw.manager.powerAvr'))

  if (computed.manager.profitComparison.length > 0) {
    lines.push('- 盈利对比（数据源发布口径，截止 ' + raw.manager.profitAsOf + '）：' + computed.manager.profitComparison.map(entry => `${entry.label} ${pct(entry.valuePct)}`).join('，'))
    computed.manager.profitComparison.forEach((entry, index) => {
      traces.push(trace(`manager.profitComparison.${entry.label}`, `盈利对比·${entry.label}`, entry.valuePct, `raw.manager.profitValues[${index}]`))
    })
  }

  if (computed.manager.tenureStart === null) {
    lines.push('', '**数据缺口**：本基金任职沿革数据源（F10 经理页）本次不可用，任职起始/任期回报不编造。')
  } else {
    lines.push(
      '',
      `- 本基金任职起始：**${computed.manager.tenureStart}**（任期 ${computed.manager.tenureDurationText ?? '?'}）`,
      `- 本基金任期回报：**${pct(computed.manager.tenureReturnPct ?? 0)}**（数据源发布口径）`,
      `- 历任管理基金 ${computed.manager.managedFundCount ?? 0} 只，其中 ${computed.manager.beatPeerCount ?? 0} 只任期回报跑赢同类平均（同类分位由数据源按只给出，见快照 raw.managerHistory.managedFunds）。`,
    )
    traces.push(
      trace('manager.tenureStart', '本基金任职起始', computed.manager.tenureStart, 'computed.manager.tenureStart'),
      trace('manager.tenureReturnPct', '本基金任期回报', computed.manager.tenureReturnPct ?? 0, 'computed.manager.tenureReturnPct'),
    )
  }
  return { id: 'manager', markdown: lines.join('\n'), traces }
}

/** Build the 风险与缺口声明 section. */
function buildRisk(snapshot: FundSnapshot): BuiltSection {
  const gapLines = snapshot.gaps.length === 0
    ? ['本次采集无数据源缺口。']
    : snapshot.gaps.map(gap => `- 缺口：${gap}（对应章节已声明，未编造）`)
  const lines = [
    '## 风险与缺口声明',
    '',
    '- 历史业绩不预示未来表现；净值序列未含申赎费用影响。',
    '- 持仓明细为季度披露口径，存在披露滞后；日内仓位为估算。',
    ...gapLines,
    '',
    '数据源（逐源 asOf 与哈希见附录与 manifest）：',
    `- pingzhongdata：${snapshot.sources.pingzhongdata.ok ? 'OK' : `失败（${snapshot.sources.pingzhongdata.error ?? '?'}）`} ${snapshot.sources.pingzhongdata.url}`,
    `- F10 持仓：${snapshot.sources.holdings.ok ? 'OK' : `失败（${snapshot.sources.holdings.error ?? '?'}）`} ${snapshot.sources.holdings.url}`,
    `- F10 经理：${snapshot.sources.managerHistory.ok ? 'OK' : `失败（${snapshot.sources.managerHistory.error ?? '?'}）`} ${snapshot.sources.managerHistory.url}`,
    `- 个股估值：${snapshot.sources.quotes.ok ? 'OK' : `缺口/部分（${snapshot.sources.quotes.error ?? '?'}）`} ${snapshot.sources.quotes.url}`,
  ]
  return { id: 'risk', markdown: lines.join('\n'), traces: [] }
}

/** Build the 免责声明 section. */
function buildDisclaimer(): BuiltSection {
  return { id: 'disclaimer', markdown: `## 免责声明\n\n${DISCLAIMER}`, traces: [] }
}

/** All section builders in default order (appendix excluded — assembled after verification). */
const SECTION_BUILDERS: Record<Exclude<SectionId, 'appendix'>, (snapshot: FundSnapshot) => BuiltSection> = {
  overview: buildOverview,
  performance: buildPerformance,
  holdings: buildHoldings,
  style: buildStyle,
  manager: buildManager,
  risk: buildRisk,
  disclaimer: buildDisclaimer,
}

/** The body assembly result: markdown plus the flat citation list. */
export interface ReportBody {
  markdown: string
  citations: TraceRow[]
  /** Section ids actually rendered (gap sections still render — as declarations). */
  renderedSections: SectionId[]
}

/**
 * Assemble the report body (every requested section except the appendix).
 * @param snapshot - the fund snapshot.
 * @param sections - section ids to render (defaults to all).
 * @returns the body markdown and the citations to verify before sealing.
 */
export function buildBody(snapshot: FundSnapshot, sections?: readonly SectionId[]): ReportBody {
  const wanted = sections ?? ALL_SECTIONS.filter(id => id !== 'appendix')
  const markdown: string[] = []
  const citations: TraceRow[] = []
  const rendered: SectionId[] = []
  for (const id of wanted) {
    if (id === 'appendix') continue
    const builder = SECTION_BUILDERS[id]
    const built = builder(snapshot)
    markdown.push(built.markdown)
    citations.push(...built.traces)
    rendered.push(id)
  }
  return { markdown: markdown.join('\n\n'), citations, renderedSections: rendered }
}

/**
 * Assemble the 附录（数字回溯表）from the verified citations. Every key number
 * in the report maps to one row: report value ↔ snapshot JSON path ↔ verdict.
 * @param citations - the citations with verdicts filled in.
 * @param outcome - the verification outcome (engine + verdicts).
 * @param snapshot - the fund snapshot.
 * @returns the appendix markdown.
 */
export function assembleAppendix(citations: readonly TraceRow[], outcome: VerifyOutcome, snapshot: FundSnapshot): string {
  const lines = [
    '## 附录：数字回溯表',
    '',
    `核查引擎：${outcome.engine}。报告中每个关键数字 ↔ 快照 JSON 路径 ↔ 核查结论：`,
    '',
    '| 数字 | 报告值 | 快照路径 | 结论 | 说明 |',
    '|---|---|---|---|---|',
  ]
  const byId = new Map(outcome.result.results.map(result => [result.id, result]))
  for (const citation of citations) {
    const verdict = byId.get(citation.id)
    const status = verdict?.status ?? 'unverifiable'
    const note = verdict?.note ?? ''
    lines.push(`| ${citation.label} | ${String(citation.value)} | \`${citation.path}\` | ${status} | ${note} |`)
  }
  lines.push(
    '',
    '口径与复现：snapshot.json 同目录封存（含原始提取数据 raw 与确定性计算 computed 及参数 parameters），任何方可由 raw 重算 computed 逐一对账。',
    `采集时间：${ymd(snapshot.fetchedAt)}；计算参数：riskFreeRate=${snapshot.parameters.riskFreeRate}，tradingDaysPerYear=${snapshot.parameters.tradingDaysPerYear}。`,
  )
  return lines.join('\n')
}

/** The sealed-report facts returned to the tools and the session event. */
export interface SealResult {
  /** Version directory name (YYYYMMDD-HHmmss). */
  version: string
  /** Absolute version directory. */
  versionDir: string
  /** Workspace-relative report path. */
  reportPathRel: string
  /** Workspace-relative manifest path. */
  manifestPathRel: string
  /** Workspace-relative snapshot path. */
  snapshotPathRel: string
  /** Absolute report path. */
  reportPathAbs: string
  /** Absolute manifest path. */
  manifestPathAbs: string
  /** SHA-256 of the sealed manifest.json bytes. */
  manifestSha256: string
  /** The sealed manifest. */
  manifest: ReportManifest
  /** The full report markdown. */
  markdown: string
}

/** Format epoch milliseconds as the version-directory stamp (YYYYMMDD-HHmmss, UTC). */
export function versionStamp(now: number): string {
  const d = new Date(now)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
}

/** Options for {@link sealReport}. */
export interface SealOptions {
  /** Absolute report root (already resolved against the workspace). */
  reportRootAbs: string
  /** Workspace root used to compute the relative paths (`undefined` keeps paths absolute in the manifest). */
  workspaceRoot?: string
  /** The verification outcome over the body's citations. */
  outcome: VerifyOutcome
  /** SHA-256 of the already-sealed snapshot.json in this version directory. */
  snapshotSha256: string
  /** Seal clock (tests inject a fixed value). */
  now?: number
  /** Generator identity for the manifest. */
  generator: string
}

/** Compute the workspace-relative form of one absolute path (forward slashes). */
function relativeTo(workspaceRoot: string | undefined, absolute: string): string {
  if (workspaceRoot === undefined) return absolute
  const rel = path.relative(workspaceRoot, absolute)
  return rel === '' ? '.' : rel.split(path.sep).join('/')
}

/**
 * Seal the snapshot into its version directory. Always done before citation
 * verification, because the checker reads the sealed file back from disk.
 * @param snapshot - the fund snapshot.
 * @param versionDir - absolute version directory.
 * @returns the absolute snapshot path and its SHA-256.
 */
export async function sealSnapshot(snapshot: FundSnapshot, versionDir: string): Promise<{ path: string, sha256: string }> {
  await mkdir(versionDir, { recursive: true })
  const json = JSON.stringify(snapshot, null, 2)
  const target = path.join(versionDir, 'snapshot.json')
  await writeFile(target, json, 'utf8')
  return { path: target, sha256: sha256Of(json) }
}

/**
 * Seal one report version: write report.md and manifest.json into the version
 * directory that {@link sealSnapshot} already holds.
 * @param snapshot - the fund snapshot.
 * @param markdown - the full report markdown (body + appendix).
 * @param options - seal options.
 * @returns the sealed-report facts.
 */
export async function sealReport(
  snapshot: FundSnapshot,
  markdown: string,
  options: SealOptions,
): Promise<SealResult> {
  const now = options.now ?? Date.now()
  const version = versionStamp(now)
  const versionDir = path.join(options.reportRootAbs, snapshot.code, version)

  const reportPathAbs = path.join(versionDir, 'report.md')
  await writeFile(reportPathAbs, markdown, 'utf8')

  const manifest: ReportManifest = {
    schema: 'dsh-fund-research/manifest@v1',
    code: snapshot.code,
    name: snapshot.name,
    version,
    sealedAt: now,
    sources: snapshot.sources,
    snapshotSha256: options.snapshotSha256,
    parameters: snapshot.parameters,
    reportSha256: sha256Of(markdown),
    verifyEngine: options.outcome.engine,
    gaps: snapshot.gaps,
    generator: options.generator,
  }
  const manifestPathAbs = path.join(versionDir, 'manifest.json')
  const manifestJson = JSON.stringify(manifest, null, 2)
  await writeFile(manifestPathAbs, manifestJson, 'utf8')

  return {
    version,
    versionDir,
    reportPathRel: relativeTo(options.workspaceRoot, reportPathAbs),
    manifestPathRel: relativeTo(options.workspaceRoot, manifestPathAbs),
    snapshotPathRel: relativeTo(options.workspaceRoot, path.join(versionDir, 'snapshot.json')),
    reportPathAbs,
    manifestPathAbs,
    manifestSha256: sha256Of(manifestJson),
    manifest,
    markdown,
  }
}

/** Re-export for the tool layer. */
export { sha256Of }
