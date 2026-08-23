/**
 * asOf-date cutoff suite: ISO date validation (format, calendar, future),
 * NAV-series truncation, live acquisition stamping, and the storage-domain
 * TTL reuse consistency with the cutoff. No real network — live paths use the
 * fixture routes; domain paths use the in-memory backend.
 * @module dsh-fund-research/test/asof.spec
 */

import { describe, expect, it } from 'vitest'
import { PoliteFetcher } from '../src/sources/eastmoney.ts'
import { acquireSnapshot, applyAsOfCutoff, parseAsOfDate } from '../src/sources/snapshot.ts'
import { dateOf } from '../src/metrics/performance.ts'
import { resolveConfig } from '../src/config.ts'
import { buildFixtureSnapshot, FIXTURE_CODE, loadFixtures } from './fixtures.ts'
import { stubFetch } from './helpers/http-stub.ts'
import { mountBase, unmountBase } from './harness.ts'
import { fundResearchDomainSpec } from '../src/store.ts'

/** Happy-path routes over the real fixtures for live acquisitions. */
async function liveRoutes() {
  const fixtures = await loadFixtures()
  const quoteRoutes = Object.entries(fixtures.quotes).map(([secid, body]) => ({ match: `secid=${secid}`, body }))
  return [
    { match: '/pingzhongdata/', body: fixtures.pingzhongdata },
    { match: 'type=jjcc', body: fixtures.holdings },
    { match: '/jjjl_', body: fixtures.managerPage },
    ...quoteRoutes,
  ]
}

describe('parseAsOfDate', () => {
  it('returns the normalized date for a valid past date', () => {
    expect(parseAsOfDate('2024-06-30')).toBe('2024-06-30')
  })

  it('returns undefined for an empty or unset cutoff', () => {
    expect(parseAsOfDate(undefined)).toBeUndefined()
    expect(parseAsOfDate('')).toBeUndefined()
    expect(parseAsOfDate('   ')).toBeUndefined()
  })

  it('rejects a non-ISO format loudly', () => {
    expect(() => parseAsOfDate('06/30/2024')).toThrow(/ISO 8601/u)
    expect(() => parseAsOfDate('2024-6-30')).toThrow(/ISO 8601/u)
  })

  it('rejects a non-calendar date loudly', () => {
    expect(() => parseAsOfDate('2024-02-30')).toThrow(/real calendar date/u)
    expect(() => parseAsOfDate('2024-13-01')).toThrow(/real calendar date/u)
  })

  it('rejects a future date loudly', () => {
    expect(() => parseAsOfDate('2999-01-01')).toThrow(/future/u)
  })

  it('honours an injected clock for the future check', () => {
    const now = Date.UTC(2024, 5, 30)
    expect(parseAsOfDate('2024-06-30', now)).toBe('2024-06-30')
    expect(() => parseAsOfDate('2024-07-01', now)).toThrow(/future/u)
  })
})

describe('applyAsOfCutoff', () => {
  it('truncates the NAV series to the cutoff date', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const raw = applyAsOfCutoff(snapshot.raw, '2024-06-30')
    expect(raw.navTrend.length).toBeLessThan(snapshot.raw.navTrend.length)
    const last = raw.navTrend[raw.navTrend.length - 1]
    expect(last).toBeDefined()
    expect(dateOf(last?.t ?? 0) <= '2024-06-30').toBe(true)
  })

  it('throws when the cutoff leaves fewer than two NAV points', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    expect(() => applyAsOfCutoff(snapshot.raw, '1990-01-01')).toThrow(/fewer than 2 NAV points/u)
  })
})

describe('acquireSnapshot with asOfDate', () => {
  it('truncates the NAV series and stamps both the snapshot and the discovery record', async () => {
    const store = {
      domain: null,
      config: resolveConfig({ offline: false }),
      fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, stubFetch(await liveRoutes())),
    }
    const acquired = await acquireSnapshot(store, FIXTURE_CODE, { asOfDate: '2024-06-30' })
    expect(acquired.live).toBe(true)
    expect(acquired.snapshot.asOf).toBe('2024-06-30')
    expect(acquired.snapshot.computed.performance.latestDate <= '2024-06-30').toBe(true)
    expect(acquired.discovery.asOf).toBe('2024-06-30')
    expect(acquired.discovery.live).toBe(true)
  })

  it('rejects a future asOfDate loudly before any fetch', async () => {
    const store = {
      domain: null,
      config: resolveConfig({ offline: false }),
      fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 },
        (() => { throw new Error('must not fetch') }) as unknown as typeof fetch),
    }
    await expect(acquireSnapshot(store, FIXTURE_CODE, { asOfDate: '2999-01-01' })).rejects.toThrow(/future/u)
  })

  it('does not reuse a cached snapshot whose asOf does not match', async () => {
    const base = await mountBase('asof-ttl-mismatch')
    try {
      const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
      const snapshot = buildFixtureSnapshot(await loadFixtures())
      await domain.table('snapshots').put(FIXTURE_CODE, { code: FIXTURE_CODE, storedAt: Date.now(), snapshot })
      const store = {
        domain,
        config: resolveConfig({ offline: false }),
        fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, stubFetch(await liveRoutes())),
      }
      // The cached snapshot carries no asOf, so the cutoff must refetch.
      const acquired = await acquireSnapshot(store, FIXTURE_CODE, { asOfDate: '2024-06-30' })
      expect(acquired.live).toBe(true)
      expect(acquired.snapshot.asOf).toBe('2024-06-30')
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })

  it('reuses a cached snapshot when its asOf matches within the TTL window', async () => {
    const base = await mountBase('asof-ttl-match')
    try {
      const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
      const fixture = buildFixtureSnapshot(await loadFixtures())
      const snapshot = { ...fixture, asOf: '2024-06-30' }
      await domain.table('snapshots').put(FIXTURE_CODE, { code: FIXTURE_CODE, storedAt: Date.now(), snapshot })
      const store = {
        domain,
        config: resolveConfig({ offline: false, cacheTtlHours: 12 }),
        fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 },
          (() => { throw new Error('network is forbidden in this test') }) as unknown as typeof fetch),
      }
      const acquired = await acquireSnapshot(store, FIXTURE_CODE, { asOfDate: '2024-06-30' })
      expect(acquired.live).toBe(false)
      expect(acquired.snapshot.asOf).toBe('2024-06-30')
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })
})
