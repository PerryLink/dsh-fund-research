/**
 * LIVE end-to-end suite (opt-in): mounts the plugin with the REAL network and
 * seals a full report for 161725, then spot-checks five report numbers against
 * the sealed snapshot and against an independent second fetch of the same
 * public endpoints. Skipped unless `LIVE_E2E=1` (CI never sets it).
 *
 *   LIVE_E2E=1 pnpm run test:e2e
 *
 * Evidence artifacts (report + manifest + snapshot) are copied under
 * `.tmp/live-e2e/` in the repository before the temp workspace is removed.
 * @module dsh-fund-research/test/e2e.live.spec
 */

import { cp, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { CallId } from './call-id.ts'
import { afterEach, describe, expect, it } from 'vitest'
import { mountBase, unmountBase, type BaseHarness } from './harness.ts'
import { parsePingzhongdata } from '../src/sources/eastmoney.ts'
import type { FundSnapshot } from '../src/model.ts'

const LIVE = process.env.LIVE_E2E === '1'
const CODE = '161725'

const fibers: Array<{ dispose(): Promise<void> }> = []
const bases: BaseHarness[] = []
afterEach(async () => {
  await Promise.all(fibers.splice(0).map(fiber => fiber.dispose()))
  await Promise.all(bases.splice(0).map(base => unmountBase(base)))
})

describe.skipIf(!LIVE)('fund_research (live network)', () => {
  it('seals a real 161725 report whose key numbers match the snapshot and the source', async () => {
    const base = await mountBase('fund-e2e-live')
    bases.push(base)

    // Mount the plugin with default (live) config: real base URLs, polite pacing.
    const plugin = await import('../src/index.ts')
    const fiber = await base.ctx.plugin(plugin as never, {} as never)
    fibers.push(fiber)

    const result = await base.ctx.tools.execute({
      callId: CallId('fund-e2e-live-call'),
      name: 'fund_research',
      arguments: { code: CODE },
      agent: base.agent,
      signal: new AbortController().signal,
    })
    expect(result.isError, JSON.stringify(result.error)).toBe(false)
    const value = result.value as Record<string, unknown>
    expect(value.kind).toBe('sealed')
    expect(value.code).toBe(CODE)
    expect(value.live).toBe(true)

    // Verdict tallies: every traceable number verified, nothing mismatched.
    const verdicts = value.verdicts as Record<string, number>
    expect(verdicts.mismatch).toBe(0)
    expect(verdicts.notFound).toBe(0)
    expect(verdicts.verified).toBeGreaterThan(15)

    const reportAbs = path.join(base.workspace, String(value.reportPath))
    const manifestAbs = path.join(base.workspace, String(value.manifestPath))
    const snapshotAbs = path.join(base.workspace, String(value.snapshotPath))
    const report = await readFile(reportAbs, 'utf8')
    const manifest = JSON.parse(await readFile(manifestAbs, 'utf8')) as Record<string, unknown>
    const snapshot = JSON.parse(await readFile(snapshotAbs, 'utf8')) as FundSnapshot

    expect(report).toContain('## 附录：数字回溯表')
    expect(report).toContain('不构成任何投资建议')
    expect(report).toContain('| verified |')
    expect(manifest.schema).toBe('dsh-fund-research/manifest@v1')
    expect(snapshot.schema).toBe('dsh-fund-research/snapshot@v1')

    // --- Spot-check 5: report number ↔ sealed snapshot path ↔ source. ---
    const raw = snapshot.raw
    expect(raw.navTrend.length).toBeGreaterThan(300)

    // 1. Latest NAV: report ← computed.performance.latestNav ← raw.navTrend[last].nav.
    const lastPoint = raw.navTrend[raw.navTrend.length - 1]!
    expect(report).toContain(String(snapshot.computed.performance.latestNav))
    expect(snapshot.computed.performance.latestNav).toBeCloseTo(lastPoint.nav, 4)
    expect(snapshot.computed.performance.latestDate).toBe(new Date(lastPoint.t).toISOString().slice(0, 10))

    // 2. One-year published return: report ← raw.returns.year1 (source-published口径).
    expect(report).toContain(`${raw.returns.year1}%`)
    expect(Number.parseFloat(raw.returns.year1)).not.toBeNaN()

    // 3. Max drawdown (近1年): report ← computed; recomputed here independently
    //    over the same calendar-day window (t >= latest - 365d) with the
    //    positive peak-to-trough convention.
    const DAY_MS = 86_400_000
    const lastT = raw.navTrend[raw.navTrend.length - 1]!.t
    const window1y = snapshot.computed.performance.windows.find(win => win.label === '近1年')
    expect(window1y).toBeDefined()
    const inWindow = raw.navTrend.filter(point => point.t >= lastT - 365 * DAY_MS)
    expect(inWindow.length).toBe(window1y!.days)
    let peak = inWindow[0]!.nav
    let maxDD = 0
    for (const point of inWindow) {
      if (point.nav > peak) peak = point.nav
      const dd = (peak - point.nav) / peak
      if (dd > maxDD) maxDD = dd
    }
    expect(window1y!.maxDrawdownPct).toBeCloseTo(maxDD * 100, 4)
    expect(report).toContain(String(window1y!.maxDrawdownPct))

    // 4. Scale: report ← raw.scaleHistory last value.
    const lastScale = raw.scaleHistory.values[raw.scaleHistory.values.length - 1]!
    expect(report).toContain(String(lastScale))

    // 5. Top holding: report ← raw.holdings.rows[0].
    const topHolding = raw.holdings?.rows[0]
    expect(topHolding).toBeDefined()
    expect(report).toContain(String(topHolding!.name))
    expect(report).toContain(`${topHolding!.navPct}%`)

    // --- Independent second fetch of the same endpoint (source 对源). ---
    const second = await fetch(`https://fund.eastmoney.com/pingzhongdata/${CODE}.js`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', Referer: 'https://fund.eastmoney.com/' },
    })
    expect(second.ok).toBe(true)
    const reparse = parsePingzhongdata(await second.text(), CODE)
    expect(reparse.navTrend.at(-1)!.t).toBe(snapshot.raw.navTrend.at(-1)!.t)
    expect(reparse.navTrend.at(-1)!.nav).toBeCloseTo(snapshot.raw.navTrend.at(-1)!.nav, 4)

    // Keep the evidence in the repo before teardown wipes the temp workspace.
    const evidenceDir = path.resolve(import.meta.dirname, '..', '.tmp', 'live-e2e', String(value.version))
    await mkdir(evidenceDir, { recursive: true })
    await cp(reportAbs, path.join(evidenceDir, 'report.md'))
    await cp(manifestAbs, path.join(evidenceDir, 'manifest.json'))
    await cp(snapshotAbs, path.join(evidenceDir, 'snapshot.json'))
    console.log(`[live-e2e] sealed fund-reports/${CODE}/${String(value.version)} -> ${evidenceDir}`)
  }, 240_000)
})
