/**
 * Review-stage suite: the deterministic read-only reviewer (checks + review-note.md),
 * the graceful skip when `ctx.jobs` is absent (real harness without a job
 * registry), and the scheduled `fund-review` job writing review-note.md back
 * into the version directory. Offline, real harness/fixtures.
 * @module dsh-fund-research/test/review.spec
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { JobId } from '@deepseek-ai/dsh-jobs'
import { describe, expect, it } from 'vitest'
import { FUND_REVIEW_JOB_KIND, renderReviewNote, reviewSealedReport } from '../src/review.ts'
import { buildFixtureSnapshot, FIXTURE_CODE, loadFixtures } from './fixtures.ts'
import { fundResearchDomainSpec } from '../src/store.ts'
import { resolveConfig } from '../src/config.ts'
import { runResearch } from '../src/tools/shared.ts'
import { readRunStateMap } from '../src/run-state.ts'
import { mountBase, unmountBase, type BaseHarness } from './harness.ts'
import { PoliteFetcher } from '../src/sources/eastmoney.ts'

function forbiddenFetch(): typeof fetch {
  return (() => {
    throw new Error('network is forbidden in this test')
  }) as unknown as typeof fetch
}

/** Open a seeded domain and build a deps object over one harness base. */
async function seededDeps(base: BaseHarness, config = resolveConfig({ offline: true, reportRoot: 'fund-reports' })) {
  const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
  await domain.table('snapshots').put(FIXTURE_CODE, {
    code: FIXTURE_CODE,
    storedAt: Date.now(),
    snapshot: buildFixtureSnapshot(await loadFixtures()),
  })
  const deps = {
    ctx: base.ctx,
    config,
    store: { domain, config, fetcher: new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, forbiddenFetch()) },
    logger: undefined as never,
    generator: 'dsh-fund-research@test',
  }
  return { domain, deps }
}

describe('renderReviewNote', () => {
  it('renders the read-only checklist with the trace tally', () => {
    const markdown = renderReviewNote(
      { code: FIXTURE_CODE, name: 'x', version: 'v', reportSha256: 'r', verifyEngine: 'builtin-fallback' } as never,
      {
        disclaimerPresent: true,
        gapDeclared: { declared: ['holdings'], missing: [] },
        traceTally: { verified: 20, mismatch: 0, notFound: 0, unverifiable: 0 },
      },
    )
    expect(markdown).toContain('# 复核审阅记录')
    expect(markdown).toContain('缺口声明完整性')
    expect(markdown).toContain('verified 20')
  })
})

describe('reviewSealedReport', () => {
  it('writes review-note.md with all checks passing for the fixture report', async () => {
    const base = await mountBase('review-sealed')
    try {
      const { domain, deps } = await seededDeps(base)
      const run = await runResearch(deps, FIXTURE_CODE, base.agent, {})
      const { markdown, checks } = await reviewSealedReport(run.seal.versionDir)
      expect(checks.disclaimerPresent).toBe(true)
      expect(checks.gapDeclared.missing).toEqual([])
      expect(checks.traceTally.mismatch).toBe(0)
      expect(checks.traceTally.notFound).toBe(0)
      expect(markdown).toContain('数字回溯表一致性')

      const note = await readFile(path.join(run.seal.versionDir, 'review-note.md'), 'utf8')
      expect(note).toContain('PASS')
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })
})

describe('review scheduling', () => {
  it('spawns a fund-review job that writes review-note.md into the version directory', async () => {
    const base = await mountBase('review-jobs')
    try {
      const { domain, deps } = await seededDeps(base)
      const run = await runResearch(deps, FIXTURE_CODE, base.agent, {})
      const state = (await readRunStateMap(path.join(base.workspace, 'fund-reports')))[FIXTURE_CODE]
      expect(state?.review).toMatch(/^queued\(/u)

      const jobId = /^queued\((.+)\)$/u.exec(state?.review ?? '')?.[1]
      expect(jobId).toBeDefined()
      const settled = await base.ctx.jobs.wait(JobId(jobId!), 15_000, base.agent)
      expect(settled.status).toBe('completed')

      const note = await readFile(path.join(run.seal.versionDir, 'review-note.md'), 'utf8')
      expect(note).toContain('# 复核审阅记录')
      expect(base.ctx.jobs.read(JobId(jobId!), base.agent).text).toContain('复核审阅记录')
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })

  it('records a graceful skip in the run state when no jobs service is mounted', async () => {
    const base = await mountBase('review-nojobs', { jobs: false })
    try {
      const { domain, deps } = await seededDeps(base)
      const run = await runResearch(deps, FIXTURE_CODE, base.agent, {})
      const state = (await readRunStateMap(path.join(base.workspace, 'fund-reports')))[FIXTURE_CODE]
      expect(state?.review).toBe('skipped(jobs unavailable)')
      // The report is sealed; only the review note is absent.
      expect(run.seal.markdown).toContain('研究报告')
      expect(FUND_REVIEW_JOB_KIND).toBe('fund-review')
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })
})
