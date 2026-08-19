/**
 * Report assembly suite: section rendering from the fixture snapshot, explicit
 * gap declarations, the traceability appendix, and the versioned seal
 * (snapshot.json + report.md + manifest.json with consistent hashes).
 * @module dsh-fund-research/test/report.spec
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildBody, assembleAppendix, sealReport, sealSnapshot, versionStamp, DISCLAIMER } from '../src/report.ts'
import { builtinVerifyCitations } from '../src/verify-bridge.ts'
import { sha256Of } from '../src/sources/eastmoney.ts'
import { managerMetrics } from '../src/metrics/manager.ts'
import { buildFixtureSnapshot, loadFixtures } from './fixtures.ts'

describe('buildBody', () => {
  it('renders every default section with trace rows for key numbers', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const body = buildBody(snapshot)
    expect(body.markdown).toContain('# 招商中证白酒')
    expect(body.markdown).toContain('## 业绩拆解')
    expect(body.markdown).toContain('## 持仓穿透')
    expect(body.markdown).toContain('## 风格归因')
    expect(body.markdown).toContain('## 经理画像')
    expect(body.markdown).toContain('## 风险与缺口声明')
    expect(body.markdown).toContain('## 免责声明')
    expect(body.citations.length).toBeGreaterThan(15)
    // Every citation path is rooted in the snapshot document.
    for (const citation of body.citations) {
      expect(citation.path).toMatch(/^(raw|computed)\./u)
    }
  })

  it('declares gaps instead of inventing holdings when the source failed', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const gapped = {
      ...snapshot,
      raw: { ...snapshot.raw, holdings: null },
      computed: { ...snapshot.computed, holdings: null, style: null },
      gaps: ['holdings', 'quotes'],
    }
    const body = buildBody(gapped)
    expect(body.markdown).toContain('数据缺口')
    expect(body.markdown).not.toContain('| 1 | 600519 |')
  })

  it('renders only the requested sections', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const body = buildBody(snapshot, ['overview', 'disclaimer'])
    expect(body.markdown).toContain('研究报告')
    expect(body.markdown).toContain('免责声明')
    expect(body.markdown).not.toContain('## 业绩拆解')
    expect(body.renderedSections).toEqual(['overview', 'disclaimer'])
  })

  it('declares the missing previous-quarter details instead of inventing a comparison', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const noPrevious = {
      ...snapshot,
      raw: {
        ...snapshot.raw,
        holdings: { ...snapshot.raw.holdings!, previousRows: [], previousAsOf: null },
      },
      computed: {
        ...snapshot.computed,
        holdings: { ...snapshot.computed.holdings!, quarterCompare: null },
      },
    }
    const body = buildBody(noPrevious)
    expect(body.markdown).toContain('上期持仓：数据源未提供可对比的上期明细，本版缺口。')
  })

  it('declares the manager-tenure gap when the F10 manager page is a gap', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const gapped = {
      ...snapshot,
      raw: { ...snapshot.raw, managerHistory: null },
      computed: { ...snapshot.computed, manager: managerMetrics(snapshot.raw.manager, null) },
      gaps: [...snapshot.gaps, 'managerHistory'],
    }
    const body = buildBody(gapped)
    expect(body.markdown).toContain('**数据缺口**：本基金任职沿革数据源（F10 经理页）本次不可用，任职起始/任期回报不编造。')
  })
})

describe('appendix + seal', () => {
  it('verifies every citation against the sealed snapshot and seals consistent hashes', async () => {
    const snapshot = buildFixtureSnapshot(await loadFixtures())
    const dir = await mkdtemp(path.join(tmpdir(), 'fund-report-'))
    try {
      const body = buildBody(snapshot)
      const versionDir = path.join(dir, snapshot.code, versionStamp(1_755_600_000_000))
      const sealedSnap = await sealSnapshot(snapshot, versionDir)

      const outcome = {
        engine: 'builtin-fallback' as const,
        result: await builtinVerifyCitations({
          dataset: sealedSnap.path,
          citations: body.citations.map(c => ({ id: c.id, path: c.path, value: c.value, tolerance: c.tolerance })),
        }),
      }
      // Every citation of the fixture snapshot verifies or is honestly explained.
      const statuses = outcome.result.results.map(r => r.status)
      expect(statuses.every(s => s === 'verified')).toBe(true)

      const appendix = assembleAppendix(body.citations, outcome, snapshot)
      expect(appendix).toContain('数字回溯表')
      expect(appendix).toContain('builtin-fallback')
      expect(appendix).toContain('| 最新单位净值 |')

      const markdown = `${body.markdown}\n\n${appendix}\n`
      const seal = await sealReport(snapshot, markdown, {
        reportRootAbs: dir,
        workspaceRoot: dir,
        outcome,
        snapshotSha256: sealedSnap.sha256,
        now: 1_755_600_000_000,
        generator: 'dsh-fund-research@test',
      })
      expect(seal.version).toBe(versionStamp(1_755_600_000_000))

      const reportText = await readFile(seal.reportPathAbs, 'utf8')
      expect(sha256Of(reportText)).toBe(seal.manifest.reportSha256)
      expect(reportText).toContain(DISCLAIMER)

      const manifestText = await readFile(seal.manifestPathAbs, 'utf8')
      const manifest = JSON.parse(manifestText) as Record<string, unknown>
      expect(sha256Of(manifestText)).toBe(seal.manifestSha256)
      expect(manifest.snapshotSha256).toBe(sealedSnap.sha256)
      expect(manifest.gaps).toEqual([])
      expect(manifest.verifyEngine).toBe('builtin-fallback')

      // Relative paths are workspace-relative with forward slashes.
      expect(seal.reportPathRel).toMatch(/^161725\/\d{8}-\d{6}\/report\.md$/u)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('versionStamp', () => {
  it('formats UTC YYYYMMDD-HHmmss', () => {
    expect(versionStamp(1_755_600_000_000)).toMatch(/^\d{8}-\d{6}$/u)
  })
})
