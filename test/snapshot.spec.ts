/**
 * Snapshot acquisition suite: hash consistency, TTL reuse, offline mode
 * (asserting zero outbound calls with a throwing fetch stub), the on-disk
 * fallback, and loud failure when offline finds nothing.
 * @module dsh-fund-research/test/snapshot.spec
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PoliteFetcher } from '../src/sources/eastmoney.ts'
import { acquireSnapshot, OfflineGapError } from '../src/sources/snapshot.ts'
import { resolveConfig } from '../src/config.ts'
import { buildFixtureSnapshot, FIXTURE_CODE, loadFixtures } from './fixtures.ts'
import { mountBase, unmountBase } from './harness.ts'
import { fundResearchDomainSpec } from '../src/store.ts'
import { sealSnapshot } from '../src/report.ts'
import { readDiskSnapshot } from '../src/sources/snapshot.ts'

/** A fetch stub that fails the test if any outbound call happens. */
function forbiddenFetch(): typeof fetch {
  return (() => {
    throw new Error('network is forbidden in this test')
  }) as unknown as typeof fetch
}

describe('acquireSnapshot', () => {
  it('serves offline mode from the storage domain with zero outbound calls', async () => {
    const base = await mountBase('snapshot-offline')
    try {
      const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
      const snapshot = buildFixtureSnapshot(await loadFixtures())
      await domain.table('snapshots').put(FIXTURE_CODE, { code: FIXTURE_CODE, storedAt: Date.now(), snapshot })

      const store = {
        domain,
        config: resolveConfig({ offline: true }),
        fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, forbiddenFetch()),
      }
      const acquired = await acquireSnapshot(store, FIXTURE_CODE, { offline: true })
      expect(acquired.live).toBe(false)
      expect(acquired.snapshot.code).toBe(FIXTURE_CODE)
      expect(acquired.snapshot.computed.performance.windows.length).toBeGreaterThan(0)
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })

  it('reuses a fresh domain snapshot inside the TTL window (no fetch)', async () => {
    const base = await mountBase('snapshot-ttl')
    try {
      const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
      const snapshot = buildFixtureSnapshot(await loadFixtures())
      await domain.table('snapshots').put(FIXTURE_CODE, { code: FIXTURE_CODE, storedAt: Date.now(), snapshot })

      const store = {
        domain,
        config: resolveConfig({ offline: false, cacheTtlHours: 12 }),
        fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, forbiddenFetch()),
      }
      const acquired = await acquireSnapshot(store, FIXTURE_CODE)
      expect(acquired.live).toBe(false)
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })

  it('falls back to the newest on-disk snapshot when the domain is empty', async () => {
    const base = await mountBase('snapshot-disk')
    try {
      const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
      const snapshot = buildFixtureSnapshot(await loadFixtures())
      const reportRoot = path.join(base.workspace, 'fund-reports')
      await sealSnapshot(snapshot, path.join(reportRoot, FIXTURE_CODE, '20260801-120000'))

      const store = {
        domain,
        config: resolveConfig({ offline: true }),
        fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, forbiddenFetch()),
      }
      const acquired = await acquireSnapshot(store, FIXTURE_CODE, { offline: true, reportRootAbs: reportRoot })
      expect(acquired.live).toBe(false)
      expect(acquired.snapshot.name).toContain('招商中证白酒')
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })

  it('fails loud when offline finds no snapshot anywhere', async () => {
    const base = await mountBase('snapshot-gap')
    try {
      const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
      const store = {
        domain,
        config: resolveConfig({ offline: true }),
        fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, forbiddenFetch()),
      }
      await expect(acquireSnapshot(store, FIXTURE_CODE, { offline: true, reportRootAbs: path.join(base.workspace, 'none') }))
        .rejects.toThrowError(OfflineGapError)
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })
})

describe('readDiskSnapshot', () => {
  it('returns null for a missing root instead of throwing', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'fund-disk-'))
    try {
      expect(await readDiskSnapshot(path.join(dir, 'missing'), FIXTURE_CODE)).toBeNull()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('hash consistency', () => {
  it('sealed snapshot.json hashes identically across two seals of the same snapshot', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const dir = await mkdtemp(path.join(tmpdir(), 'fund-hash-'))
    try {
      const a = await sealSnapshot(snapshot, path.join(dir, 'a'))
      const b = await sealSnapshot(snapshot, path.join(dir, 'b'))
      expect(a.sha256).toBe(b.sha256)
      expect(a.sha256).toMatch(/^[0-9a-f]{64}$/u)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
