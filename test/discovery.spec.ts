/**
 * Data-source discovery suite: the deterministic record content (endpoint
 * roster, primary/fallback resolution, per-source coverage and gaps), its
 * appendix markdown rendering, and the end-to-end seal of
 * `sources-discovery.json` folded into the report appendix. No network.
 * @module dsh-fund-research/test/discovery.spec
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSourcesDiscovery, renderSourcesDiscoverySection } from '../src/discovery.ts'
import { buildFixtureSnapshot, FIXTURE_CODE, loadFixtures } from './fixtures.ts'
import { fundResearchDomainSpec } from '../src/store.ts'
import { resolveConfig } from '../src/config.ts'
import { runResearch } from '../src/tools/shared.ts'
import { mountBase, unmountBase } from './harness.ts'
import { PoliteFetcher } from '../src/sources/eastmoney.ts'

/** A fetch stub that fails the test if any outbound call happens. */
function forbiddenFetch(): typeof fetch {
  return (() => {
    throw new Error('network is forbidden in this test')
  }) as unknown as typeof fetch
}

const QUOTE_FACTS = {
  primaryUrl: 'https://push2.eastmoney.com',
  fallbackUrl: 'https://push2delay.eastmoney.com',
  fallbackUsed: false,
  requested: 10,
  succeeded: 9,
}

describe('buildSourcesDiscovery', () => {
  it('records the endpoint roster, per-source status, and quote coverage', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const discovery = buildSourcesDiscovery(snapshot, QUOTE_FACTS, 1_755_600_000_000, true)
    expect(discovery.schema).toBe('dsh-fund-research/sources-discovery@v1')
    expect(discovery.endpoints.map(endpoint => endpoint.source)).toEqual(['pingzhongdata', 'holdings', 'managerHistory'])
    expect(discovery.endpoints.every(endpoint => endpoint.ok)).toBe(true)
    expect(discovery.endpoints.every(endpoint => /^[0-9a-f]{64}$/u.test(endpoint.sha256))).toBe(true)
    expect(discovery.quotes.used).toBe('primary')
    expect(discovery.quotes.requested).toBe(10)
    expect(discovery.quotes.succeeded).toBe(9)
    expect(discovery.gaps).toEqual([])
    expect(discovery.asOf).toBeNull()
    expect(discovery.live).toBe(true)
  })

  it('marks the fallback host and the asOf cutoff when present', async () => {
    const snapshot = { ...buildFixtureSnapshot(await loadFixtures()), asOf: '2024-06-30' }
    const discovery = buildSourcesDiscovery(snapshot, { ...QUOTE_FACTS, fallbackUsed: true, succeeded: 10 }, 1_755_600_000_000, false)
    expect(discovery.quotes.used).toBe('fallback')
    expect(discovery.asOf).toBe('2024-06-30')
    expect(discovery.live).toBe(false)
  })

  it('declares a degraded source as a failure entry with its reason', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const gapped = {
      ...snapshot,
      sources: {
        ...snapshot.sources,
        holdings: { url: snapshot.sources.holdings.url, sha256: '', fetchedAt: snapshot.fetchedAt, ok: false, error: 'holdings down' },
      },
      raw: { ...snapshot.raw, holdings: null },
      gaps: ['holdings'],
    }
    const discovery = buildSourcesDiscovery(gapped, QUOTE_FACTS, 1_755_600_000_000, true)
    const holdings = discovery.endpoints.find(endpoint => endpoint.source === 'holdings')
    expect(holdings?.ok).toBe(false)
    expect(holdings?.error).toBe('holdings down')
    expect(discovery.gaps).toEqual(['holdings'])
  })
})

describe('renderSourcesDiscoverySection', () => {
  it('renders the 数据源与缺口声明 appendix section with the endpoint roster', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const discovery = buildSourcesDiscovery(snapshot, QUOTE_FACTS, 1_755_600_000_000, true)
    const markdown = renderSourcesDiscoverySection(discovery)
    expect(markdown).toContain('### 数据源与缺口声明')
    expect(markdown).toContain('pingzhongdata')
    expect(markdown).toContain('push2.eastmoney.com')
    expect(markdown).toContain('push2delay.eastmoney.com')
    expect(markdown).toContain('9/10')
  })
})

describe('sealed discovery + appendix integration', () => {
  it('seals sources-discovery.json and folds the section into the report appendix', async () => {
    const base = await mountBase('discovery-integration')
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
      const run = await runResearch(deps, FIXTURE_CODE, base.agent, {})
      expect(run.seal.markdown).toContain('### 数据源与缺口声明')

      const discoveryText = await readFile(path.join(run.seal.versionDir, 'sources-discovery.json'), 'utf8')
      const discovery = JSON.parse(discoveryText) as { schema: string, endpoints: unknown[], gaps: string[] }
      expect(discovery.schema).toBe('dsh-fund-research/sources-discovery@v1')
      expect(discovery.endpoints).toHaveLength(3)
      expect(discovery.gaps).toEqual([])
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })
})
