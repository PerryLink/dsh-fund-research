/**
 * Checkpoint-resume suite over `.run-state.json`: idempotent resume (twice to
 * the identical sealed report), loud rejection on a fingerprint mismatch, and
 * continuation from the snapshot stage (reusing the sealed snapshot with zero
 * re-collection). Uses the real Context/session and the in-memory storage
 * domain; the network is forbidden throughout.
 * @module dsh-fund-research/test/resume.spec
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { mountBase, unmountBase } from './harness.ts'
import { buildFixtureSnapshot, FIXTURE_CODE, loadFixtures } from './fixtures.ts'
import { fundResearchDomainSpec } from '../src/store.ts'
import { resolveConfig } from '../src/config.ts'
import { runResearch } from '../src/tools/shared.ts'
import { newRunState, markStageDone, readRunStateMap, runFingerprint, writeRunStateMap } from '../src/run-state.ts'
import { sealSnapshot, versionStamp } from '../src/report.ts'
import { buildSourcesDiscovery } from '../src/discovery.ts'
import type { ResolvedConfig } from '../src/config.ts'
import { PoliteFetcher } from '../src/sources/eastmoney.ts'

/** A fetch stub that fails the test if any outbound call happens. */
function forbiddenFetch(): typeof fetch {
  return (() => {
    throw new Error('network is forbidden in this test')
  }) as unknown as typeof fetch
}

/** The fingerprint one run computes for the given config and inputs. */
function fingerprintOf(config: ResolvedConfig, code: string): string {
  return runFingerprint({
    code,
    sections: undefined,
    asOfDate: null,
    offline: config.offline,
    riskFreeRate: config.riskFreeRate,
    styleQuotes: config.styleQuotes,
    includeComparison: false,
    includeWalkForward: false,
  })
}

describe('run-state resume', () => {
  it('resumes twice to the identical sealed report (idempotent)', async () => {
    const base = await mountBase('resume-twice')
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

      const run1 = await runResearch(deps, FIXTURE_CODE, base.agent, {})
      const run2 = await runResearch(deps, FIXTURE_CODE, base.agent, { resume: true })
      const run3 = await runResearch(deps, FIXTURE_CODE, base.agent, { resume: true })

      expect(run2.seal.version).toBe(run1.seal.version)
      expect(run3.seal.version).toBe(run1.seal.version)
      expect(run2.seal.manifestSha256).toBe(run1.seal.manifestSha256)
      expect(run3.seal.manifestSha256).toBe(run1.seal.manifestSha256)
      expect(run2.seal.manifest.reportSha256).toBe(run1.seal.manifest.reportSha256)

      // Only one version directory exists — resume never re-seals.
      const entries = await readdir(path.join(base.workspace, 'fund-reports', FIXTURE_CODE))
      expect(entries).toEqual([run1.seal.version])

      // The run-state file records both stages done.
      const map = await readRunStateMap(path.join(base.workspace, 'fund-reports'))
      expect(map[FIXTURE_CODE]?.stages.snapshot.status).toBe('done')
      expect(map[FIXTURE_CODE]?.stages.report.status).toBe('done')
      expect(map[FIXTURE_CODE]?.fingerprint).toBe(fingerprintOf(config, FIXTURE_CODE))
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })

  it('rejects a resume when the recorded fingerprint does not match', async () => {
    const base = await mountBase('resume-mismatch')
    try {
      const config = resolveConfig({ offline: true, reportRoot: 'fund-reports' })
      const reportRoot = path.join(base.workspace, 'fund-reports')
      const bogus = 'deadbeef'.repeat(8)
      await writeRunStateMap(reportRoot, {
        [FIXTURE_CODE]: newRunState(FIXTURE_CODE, bogus, versionStamp(1_755_600_000_000), 1_755_600_000_000),
      })
      const deps = {
        ctx: base.ctx,
        config,
        store: { domain: null, config, fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, forbiddenFetch()) },
        logger: undefined as never,
        generator: 'dsh-fund-research@test',
      }
      await expect(runResearch(deps, FIXTURE_CODE, base.agent, { resume: true })).rejects.toThrow(/fingerprint mismatch/u)
    } finally {
      await unmountBase(base)
    }
  })

  it('continues from the snapshot stage, reusing the sealed snapshot without re-collecting', async () => {
    const base = await mountBase('resume-continue')
    try {
      const config = resolveConfig({ offline: true, reportRoot: 'fund-reports' })
      const reportRoot = path.join(base.workspace, 'fund-reports')
      const version = versionStamp(1_755_600_000_000)
      const versionDir = path.join(reportRoot, FIXTURE_CODE, version)
      await mkdir(versionDir, { recursive: true })

      // Seed the completed snapshot-stage artifacts.
      const snapshot = buildFixtureSnapshot(await loadFixtures())
      await sealSnapshot(snapshot, versionDir)
      const discovery = buildSourcesDiscovery(snapshot, {
        primaryUrl: 'https://push2.eastmoney.com',
        fallbackUrl: null,
        fallbackUsed: false,
        requested: 10,
        succeeded: 9,
      }, 1_755_600_000_000, false)
      await writeFile(path.join(versionDir, 'sources-discovery.json'), JSON.stringify(discovery, null, 2), 'utf8')

      // Record the snapshot stage as done, report pending, with the matching fingerprint.
      const state = newRunState(FIXTURE_CODE, fingerprintOf(config, FIXTURE_CODE), version, 1_755_600_000_000)
      await markStageDone(reportRoot, state, 'snapshot', 1_755_600_000_000)

      const deps = {
        ctx: base.ctx,
        config,
        store: { domain: null, config, fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, forbiddenFetch()) },
        logger: undefined as never,
        generator: 'dsh-fund-research@test',
      }
      const run = await runResearch(deps, FIXTURE_CODE, base.agent, { resume: true })
      expect(run.seal.version).toBe(version)
      expect(run.seal.reportPathAbs).toBe(path.join(versionDir, 'report.md'))
      expect(run.seal.manifestPathAbs).toBe(path.join(versionDir, 'manifest.json'))
      // report.md and manifest.json landed in the reused version directory.
      const entries = (await readdir(versionDir)).sort()
      expect(entries).toEqual(expect.arrayContaining(['snapshot.json', 'sources-discovery.json', 'report.md', 'manifest.json']))
    } finally {
      await unmountBase(base)
    }
  })
})
