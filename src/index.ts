/**
 * `dsh-fund-research` — deterministic research reports for Chinese public
 * mutual funds. Collects public data from Tiantian Fund / Eastmoney endpoints
 * (polite, keyed-off, no login), computes manager profile / holdings
 * penetration / simplified style attribution / performance decomposition as
 * pure functions, verifies every key report number against the sealed source
 * snapshot (via the optional `dsh-data-quality` service or the built-in
 * fallback), and seals versioned Markdown reports with a traceability table
 * under the workspace report root. Research only — no trading, no investment
 * advice.
 *
 * Function plugin — no default export (the Loader unwraps
 * `exports.default ?? exports`, and a stray default would discard
 * `name`/`inject`/`Config`/`apply`).
 * @module dsh-fund-research
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import { Config, resolveConfig } from './config.ts'
import { PoliteFetcher } from './sources/eastmoney.ts'
import { fundResearchDomainSpec } from './store.ts'
import { buildSnapshotTool } from './tools/snapshot.ts'
import { buildResearchTool } from './tools/research.ts'
import type { ToolDeps } from './tools/shared.ts'
import { VERSION } from './version.ts'

export const name = 'dsh-fund-research'

/**
 * Hard services: the tool registry and the durable snapshot domain (the bundle
 * patch composes the storage stack). `jobs`, `skills`, `systemPrompt`, and
 * `dataQuality` stay optional `ctx.get` lookups so the plugin still activates
 * in leaner compositions.
 */
export const inject = ['tools', 'storageDomain']

export { Config, resolveConfig } from './config.ts'
export type { ResolvedConfig } from './config.ts'
export { VERSION } from './version.ts'
export * from './model.ts'
export { fundResearchDomainSpec, fundSnapshotSchema, snapshotRecordSchema } from './store.ts'
export type { SnapshotRecord } from './store.ts'
export { SNAPSHOT_EVENT, REPORT_EVENT } from './events.ts'
export { PoliteFetcher, SourceFetchError, SourceParseError, extractVar, parsePingzhongdata, parseHoldingsPage, parseManagerPage, parseQuote, sha256Of, secidOf, sourceUrls, quoteUrl, collectFund, COLLECTOR_HEADERS } from './sources/eastmoney.ts'
export type { FetchPolicy, SourceUrls, CollectedSources } from './sources/eastmoney.ts'
export { acquireSnapshot, computeMetrics, computationParameters, readDiskSnapshot, readDomainSnapshot, storeSnapshot, OfflineGapError } from './sources/snapshot.ts'
export type { SnapshotStore, AcquireOptions } from './sources/snapshot.ts'
export { windowMetrics, decomposePerformance, dateOf, round4, TRADING_DAYS_PER_YEAR, CALENDAR_DAYS_PER_YEAR, STANDARD_WINDOWS } from './metrics/performance.ts'
export { holdingsMetrics, BUILTIN_INDUSTRY_MAP, UNMAPPED_INDUSTRY } from './metrics/holdings.ts'
export { styleMetrics, sizeBandOf, valueBandOf, SIZE_BANDS, VALUE_BANDS, YI_YUAN } from './metrics/style.ts'
export { managerMetrics } from './metrics/manager.ts'
export { buildBody, assembleAppendix, sealSnapshot, sealReport, versionStamp, ALL_SECTIONS, DISCLAIMER } from './report.ts'
export type { SectionId, BuiltSection, ReportBody, SealOptions, SealResult } from './report.ts'
export { builtinVerifyCitations, verifyCitations, resolvePath } from './verify-bridge.ts'
export type { CitationCheckRequest, CitationCheckResult, DataQualityLike, VerifyOutcome } from './verify-bridge.ts'
export { buildSnapshotTool } from './tools/snapshot.ts'
export type { SnapshotCardValue } from './tools/snapshot.ts'
export { buildResearchTool, FUND_REPORT_JOB_KIND } from './tools/research.ts'
export type { ResearchValue, BackgroundValue } from './tools/research.ts'
export { runResearch, runSnapshotCard, renderSnapshotCard, assertFundCode, workspaceOf, reportRootOf } from './tools/shared.ts'
export type { ToolDeps, ResearchRun, ResearchOptions, SnapshotCardRun } from './tools/shared.ts'

/** The structural surface of the optional `ctx.systemPrompt` service (section registration only). */
interface SystemPromptLike {
  section(section: { name: string, order: number, text: string }): () => void
}

/** The structural surface of the optional `ctx.skills` service (provider registration only). */
interface SkillsLike {
  registerProvider(factory: (control: unknown) => { dispose?(): Promise<void> | void }): () => void
}

/** Directory of this module: `src/` under tsx, `lib/` when built. */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url))

/** The bundled skill root (`skills/` sits beside `src/` and `lib/`). */
function bundledSkillsRoot(): string | undefined {
  const candidate = join(MODULE_DIR, '..', 'skills')
  return existsSync(join(candidate, 'fund-research', 'SKILL.md')) ? candidate : undefined
}

/**
 * Mount the plugin: resolve config (fail loud), open the snapshot domain,
 * register the two tools, a short prompt section, and the bundled methodology
 * skill. With `enabled: false` nothing registers and the plugin stays inert.
 * @param ctx - the plugin context (host).
 * @param config - raw plugin config.
 */
export async function apply(ctx: Context, config: Config = {}): Promise<void> {
  const resolved = resolveConfig(config)
  const logger = ctx.logger(name)
  if (!resolved.enabled) {
    logger.info('disabled: enabled is false — no fund-research capabilities are mounted')
    return
  }

  const domain = await ctx.storageDomain.open(fundResearchDomainSpec)
  ctx.effect(() => () => domain.close(), 'dsh-fund-research: storage domain')

  const fetcher = new PoliteFetcher({
    requestIntervalMs: resolved.requestIntervalMs,
    timeoutMs: resolved.timeoutMs,
    retries: resolved.retries,
  })
  const deps: ToolDeps = {
    ctx,
    config: resolved,
    store: { domain, config: resolved, fetcher },
    logger,
    generator: `dsh-fund-research@${VERSION}`,
  }

  ctx.effect(() => ctx.tools.register(buildSnapshotTool(deps)), 'dsh-fund-research: fund_snapshot tool')
  ctx.effect(() => ctx.tools.register(buildResearchTool(deps)), 'dsh-fund-research: fund_research tool')

  // Short role-statement prompt section: the compliance stance and when to use
  // the tools. The assembled prompt is logged via request/header events.
  const systemPrompt = ctx.get('systemPrompt') as unknown as SystemPromptLike | undefined
  if (systemPrompt !== undefined && typeof systemPrompt.section === 'function') {
    ctx.effect(() => systemPrompt.section({
      name: 'fund-research',
      order: 150,
      text: [
        '你是基金研究助手：经 fund_snapshot / fund_research 获取中国公募基金数据与版本化研究报告；所有指标由插件确定性计算，禁止心算或编造数字。',
        '报告与表述仅供研究参考，不构成投资建议；引用结论时保留数据截止（asOf）与缺口声明。方法论细节见 fund-research skill。',
      ].join('\n'),
    }), 'dsh-fund-research: prompt section')
  } else {
    logger.info('systemPrompt service not mounted; skipping the prompt section')
  }

  // Bundled methodology skill via the official filesystem provider. Dynamic
  // import keeps the optional peer truly optional: a composition without
  // dsh-skill-filesystem still activates.
  const skills = ctx.get('skills') as unknown as SkillsLike | undefined
  const skillsRoot = bundledSkillsRoot()
  if (skills !== undefined && skillsRoot !== undefined) {
    try {
      const filesystem = await import('@deepseek-ai/dsh-skill-filesystem')
      ctx.effect(() => skills.registerProvider(control => new filesystem.FileSystemSkillProvider(ctx, control as never, {
        providerName: 'dsh-fund-research',
        includeDefaultRoots: false,
        customSkillDirs: [skillsRoot],
        watch: false,
      })), 'dsh-fund-research: skill provider')
    } catch (error) {
      logger.warn(`skill provider unavailable: ${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    logger.info('skills service or bundled skill not present; skipping the methodology skill')
  }
}
