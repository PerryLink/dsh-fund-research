/**
 * Metadata quality-signal suite: per-source deterministic signals
 * (requested/succeeded/fieldsPresent/parseWarnings/degraded) in the discovery
 * record, their appendix rendering, their flattening into tool values, and the
 * end-to-end surfacing on a real `fund_research` value. Offline, real harness.
 * @module dsh-fund-research/test/quality.spec
 */

import { CallId } from '@deepseek-ai/dsh-llm'
import { afterEach, describe, expect, it } from 'vitest'
import { buildSourcesDiscovery, renderSourcesDiscoverySection, sourceQualityOf } from '../src/discovery.ts'
import { buildFixtureSnapshot, FIXTURE_CODE, loadFixtures } from './fixtures.ts'
import { fundResearchDomainSpec } from '../src/store.ts'
import { mountBase, unmountBase, type BaseHarness } from './harness.ts'

const QUOTE_FACTS = {
  primaryUrl: 'https://push2.eastmoney.com',
  fallbackUrl: 'https://push2delay.eastmoney.com',
  fallbackUsed: false,
  requested: 10,
  succeeded: 9,
}

const fibers: Array<{ dispose(): Promise<void> }> = []
const bases: BaseHarness[] = []
afterEach(async () => {
  await Promise.all(fibers.splice(0).map(fiber => fiber.dispose()))
  await Promise.all(bases.splice(0).map(base => unmountBase(base)))
})

describe('buildSourcesDiscovery quality', () => {
  it('derives per-source quality signals from the snapshot and quote facts', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const discovery = buildSourcesDiscovery(snapshot, QUOTE_FACTS, 1, true)
    const ping = discovery.endpoints.find(endpoint => endpoint.source === 'pingzhongdata')
    expect(ping?.quality).toEqual({ requested: 1, succeeded: 1, fieldsPresent: 7, parseWarnings: [], degraded: false })
    expect(discovery.quotes.quality).toEqual({
      requested: 10,
      succeeded: 9,
      fieldsPresent: 9,
      parseWarnings: ['partial: 9/10 quotes'],
      degraded: true,
    })
  })

  it('marks a failed source degraded with zero fields present', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const gapped = {
      ...snapshot,
      sources: {
        ...snapshot.sources,
        holdings: { ...snapshot.sources.holdings, ok: false, sha256: '', error: 'holdings down' },
      },
      raw: { ...snapshot.raw, holdings: null },
      gaps: ['holdings'],
    }
    const discovery = buildSourcesDiscovery(gapped, QUOTE_FACTS, 1, true)
    const holdings = discovery.endpoints.find(endpoint => endpoint.source === 'holdings')
    expect(holdings?.quality.degraded).toBe(true)
    expect(holdings?.quality.succeeded).toBe(0)
    expect(holdings?.quality.fieldsPresent).toBe(0)
  })
})

describe('quality rendering + flattening', () => {
  it('renders the quality signal into the 数据源与缺口声明 appendix', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const discovery = buildSourcesDiscovery(snapshot, QUOTE_FACTS, 1, true)
    const markdown = renderSourcesDiscoverySection(discovery)
    expect(markdown).toContain('质量信号')
    expect(markdown).toContain('1/1 · 字段 7 · 正常')
    expect(markdown).toContain('供下游降权而非硬过滤')
  })

  it('flattens per-source quality entries for tool values', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const discovery = buildSourcesDiscovery(snapshot, QUOTE_FACTS, 1, true)
    const entries = sourceQualityOf(discovery)
    expect(entries.map(entry => entry.source)).toEqual(['pingzhongdata', 'holdings', 'managerHistory', 'quotes'])
    expect(entries.find(entry => entry.source === 'quotes')?.degraded).toBe(true)
  })
})

describe('quality in the tool value (real harness)', () => {
  it('surfaces sourceQuality on a sealed fund_research value', async () => {
    const base = await mountBase('quality-tool')
    bases.push(base)
    const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
    await domain.table('snapshots').put(FIXTURE_CODE, {
      code: FIXTURE_CODE,
      storedAt: Date.now(),
      snapshot: buildFixtureSnapshot(await loadFixtures()),
    })
    await domain.close()

    const plugin = await import('../src/index.ts')
    const fiber = await base.ctx.plugin(plugin as never, { offline: true } as never)
    fibers.push(fiber)

    const result = await base.ctx.tools.execute({
      callId: CallId('fund-quality-spec'),
      name: 'fund_research',
      arguments: { code: FIXTURE_CODE },
      agent: base.agent,
      signal: new AbortController().signal,
    })
    expect(result.isError).toBe(false)
    const value = result.value as { sourceQuality: Array<{ source: string, requested: number, degraded: boolean }> }
    expect(Array.isArray(value.sourceQuality)).toBe(true)
    expect(value.sourceQuality.map(entry => entry.source)).toEqual(['pingzhongdata', 'holdings', 'managerHistory', 'quotes'])
  })
})
