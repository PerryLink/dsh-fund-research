/**
 * Tracking-ledger suite: deterministic comparison facts, the 与上次对比 section
 * (gap vs diff, idempotent rendering), the JSONL append/read round-trip, and the
 * end-to-end wiring (every seal appends a line; includeComparison renders the
 * section against the previous line). Offline, real harness, no network.
 * @module dsh-fund-research/test/tracking.spec
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  appendTrackingRecord,
  comparisonFactsOf,
  readTracking,
  renderComparisonSection,
  TRACKING_LINE_SCHEMA,
  type TrackingRecord,
} from '../src/tracking.ts'
import { buildFixtureSnapshot, FIXTURE_CODE, loadFixtures } from './fixtures.ts'
import { fundResearchDomainSpec } from '../src/store.ts'
import { resolveConfig } from '../src/config.ts'
import { runResearch } from '../src/tools/shared.ts'
import { mountBase, unmountBase } from './harness.ts'
import { PoliteFetcher } from '../src/sources/eastmoney.ts'

function forbiddenFetch(): typeof fetch {
  return (() => {
    throw new Error('network is forbidden in this test')
  }) as unknown as typeof fetch
}

function recordOf(snapshot: ReturnType<typeof buildFixtureSnapshot>, code: string, recordedAt: number): TrackingRecord {
  return {
    schema: TRACKING_LINE_SCHEMA,
    code,
    snapshotSha256: `snap-${code}`,
    quotesSha256: `q-${code}`,
    reportSha256: `r-${code}`,
    version: `v-${code}`,
    sealedAt: recordedAt,
    recordedAt,
    comparison: comparisonFactsOf(snapshot),
  }
}

describe('comparisonFactsOf', () => {
  it('derives deterministic facts from a snapshot', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const facts = comparisonFactsOf(snapshot)
    expect(facts.latestNav).toBe(snapshot.computed.performance.latestNav)
    expect(facts.latestNavDate).toBe(snapshot.computed.performance.latestDate)
    expect(facts.navPoints).toBe(snapshot.raw.navTrend.length)
    expect(facts.topHoldings).toHaveLength(5)
    expect(facts.topHoldings[0]?.code).toBe('600519')
  })
})

describe('renderComparisonSection', () => {
  it('declares a gap when there is no previous record', async () => {
    const current = comparisonFactsOf(buildFixtureSnapshot(await loadFixtures()))
    const markdown = renderComparisonSection(null, current, FIXTURE_CODE)
    expect(markdown).toContain('## 与上次对比')
    expect(markdown).toContain('数据缺口')
    expect(markdown).toContain(FIXTURE_CODE)
  })

  it('renders a deterministic diff and is stable across identical calls', async () => {
    const previous = comparisonFactsOf(buildFixtureSnapshot(await loadFixtures()))
    const current = { ...comparisonFactsOf(buildFixtureSnapshot(await loadFixtures())), latestNav: 1.2345 }
    const first = renderComparisonSection(previous, current, FIXTURE_CODE)
    const second = renderComparisonSection(previous, current, FIXTURE_CODE)
    expect(first).toBe(second)
    expect(first).toContain('净值：上期')
    expect(first).toContain('规模：上期')
    expect(first).toContain('前 5 大重仓')
  })
})

describe('tracking ledger append/read', () => {
  it('appends deterministic JSON lines and reads them back in append order', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'fund-tracking-'))
    try {
      const snapshot = buildFixtureSnapshot(await loadFixtures())
      const first = recordOf(snapshot, '161725', 1)
      const second = recordOf(snapshot, '000001', 2)
      await appendTrackingRecord(dir, first)
      await appendTrackingRecord(dir, second)

      const text = await readFile(path.join(dir, '.tracking.jsonl'), 'utf8')
      expect(text).toBe(`${JSON.stringify(first)}\n${JSON.stringify(second)}\n`)

      const records = await readTracking(dir)
      expect(records.map(record => record.code)).toEqual(['161725', '000001'])
      expect(records[0]?.snapshotSha256).toBe('snap-161725')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('tracking + comparison integration', () => {
  it('appends one line per seal and renders the comparison section on the second run', async () => {
    const base = await mountBase('tracking-integration')
    try {
      const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
      await domain.table('snapshots').put(FIXTURE_CODE, {
        code: FIXTURE_CODE,
        storedAt: Date.now(),
        snapshot: buildFixtureSnapshot(await loadFixtures()),
      })
      const config = resolveConfig({ offline: true, reportRoot: 'fund-reports' })
      const deps = {
        ctx: base.ctx,
        config,
        store: { domain, config, fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, forbiddenFetch()) },
        logger: undefined as never,
        generator: 'dsh-fund-research@test',
      }

      const first = await runResearch(deps, FIXTURE_CODE, base.agent, {})
      expect(first.seal.markdown).not.toContain('## 与上次对比')

      const second = await runResearch(deps, FIXTURE_CODE, base.agent, { includeComparison: true })
      expect(second.seal.markdown).toContain('## 与上次对比')

      const records = await readTracking(path.join(base.workspace, 'fund-reports'))
      expect(records).toHaveLength(2)
      expect(records[1]?.code).toBe(FIXTURE_CODE)
      expect(records[1]?.snapshotSha256).toBe(second.seal.manifest.snapshotSha256)
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })

  it('declares a gap when includeComparison finds no previous record', async () => {
    const base = await mountBase('tracking-gap')
    try {
      const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
      await domain.table('snapshots').put(FIXTURE_CODE, {
        code: FIXTURE_CODE,
        storedAt: Date.now(),
        snapshot: buildFixtureSnapshot(await loadFixtures()),
      })
      const config = resolveConfig({ offline: true, reportRoot: 'fund-reports' })
      const deps = {
        ctx: base.ctx,
        config,
        store: { domain, config, fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, forbiddenFetch()) },
        logger: undefined as never,
        generator: 'dsh-fund-research@test',
      }
      const run = await runResearch(deps, FIXTURE_CODE, base.agent, { includeComparison: true })
      expect(run.seal.markdown).toContain('## 与上次对比')
      expect(run.seal.markdown).toContain('数据缺口')
      expect(run.seal.markdown).toContain('无 161725 的上一期记录')
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })
})
