/**
 * End-to-end tool suite through the REAL ToolRuntime dispatch: offline
 * `fund_snapshot` and `fund_research` over a fixture-seeded domain, the sealed
 * artifacts on disk, the session audit events, the background-job branch, and
 * honest argument/config failures. Zero network: the plugin config is offline
 * and every acquisition is served from the seeded snapshot.
 * @module dsh-fund-research/test/tools.spec
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { CallId } from '@deepseek-ai/dsh-llm'
import { JobId } from '@deepseek-ai/dsh-jobs'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { afterEach, describe, expect, it } from 'vitest'
import { mountBase, unmountBase, type BaseHarness } from './harness.ts'
import { buildFixtureSnapshot, FIXTURE_CODE, loadFixtures } from './fixtures.ts'
import { fundResearchDomainSpec } from '../src/store.ts'

const fibers: Array<{ dispose(): Promise<void> }> = []
const bases: BaseHarness[] = []
afterEach(async () => {
  await Promise.all(fibers.splice(0).map(fiber => fiber.dispose()))
  await Promise.all(bases.splice(0).map(base => unmountBase(base)))
})

let callCounter = 0

/** Dispatch one tool call through the real registry. */
async function callTool(base: BaseHarness, name: string, args: unknown): Promise<ToolExecutionResult> {
  callCounter += 1
  return base.ctx.tools.execute({
    callId: CallId(`fund-tools-spec-${callCounter}`),
    name,
    arguments: args,
    agent: base.agent,
    signal: new AbortController().signal,
  })
}

/** Mount a base, seed the snapshot domain, then mount the plugin offline. */
async function mountOfflinePlugin(config: Record<string, unknown> = {}): Promise<BaseHarness> {
  const base = await mountBase(`fund-tools-${callCounter}`)
  bases.push(base)
  // Seed before the plugin opens the domain (single-open rule).
  const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
  const snapshot = buildFixtureSnapshot(await loadFixtures())
  await domain.table('snapshots').put(FIXTURE_CODE, { code: FIXTURE_CODE, storedAt: Date.now(), snapshot })
  await domain.close()

  const plugin = await import('../src/index.ts')
  const fiber = await base.ctx.plugin(plugin as never, { offline: true, ...config } as never)
  fibers.push(fiber)
  return base
}

describe('fund_snapshot (offline)', () => {
  it('seals the day-directory card and returns the canonical value', async () => {
    const base = await mountOfflinePlugin()
    const result = await callTool(base, 'fund_snapshot', { code: FIXTURE_CODE })
    expect(result.isError).toBe(false)
    const value = result.value as Record<string, unknown>
    expect(value.code).toBe(FIXTURE_CODE)
    expect(value.name).toContain('招商中证白酒')
    expect(value.manager).toBe('侯昊')
    expect(value.offline).toBe(true)
    expect(value.live).toBe(false)
    const top3 = value.top3 as { name: string }[]
    expect(top3[0]?.name).toBe('贵州茅台')

    const cardAbs = path.join(base.workspace, String(value.cardPath))
    expect(existsSync(cardAbs)).toBe(true)
    const card = await readFile(cardAbs, 'utf8')
    expect(card).toContain('快照卡')
    expect(card).toContain('不构成投资建议')

    // The session audit event was appended.
    const events = base.session.events.filter(event => event.type === 'fund-research/snapshot')
    expect(events.length).toBe(1)
  })

  it('rejects a malformed fund code loudly', async () => {
    const base = await mountOfflinePlugin()
    const result = await callTool(base, 'fund_snapshot', { code: 'abc' })
    expect(result.isError).toBe(true)
  })
})

describe('fund_research (offline)', () => {
  it('seals a versioned report whose traceability table fully verifies', async () => {
    const base = await mountOfflinePlugin()
    const result = await callTool(base, 'fund_research', { code: FIXTURE_CODE })
    expect(result.isError).toBe(false)
    const value = result.value as Record<string, unknown>
    expect(value.kind).toBe('sealed')
    expect(value.verifyEngine).toBe('builtin-fallback')
    const verdicts = value.verdicts as Record<string, number>
    expect(verdicts.mismatch).toBe(0)
    expect(verdicts.notFound).toBe(0)
    expect(verdicts.verified).toBeGreaterThan(15)

    const reportAbs = path.join(base.workspace, String(value.reportPath))
    const report = await readFile(reportAbs, 'utf8')
    expect(report).toContain('## 附录：数字回溯表')
    expect(report).toContain('不构成任何投资建议')
    expect(report).toContain('| verified |')

    const manifestAbs = path.join(base.workspace, String(value.manifestPath))
    const manifest = JSON.parse(await readFile(manifestAbs, 'utf8')) as Record<string, unknown>
    expect(manifest.schema).toBe('dsh-fund-research/manifest@v1')
    expect(manifest.reportSha256).toBe(value.reportSha256)

    const snapshotAbs = path.join(base.workspace, String(value.snapshotPath))
    const sealed = JSON.parse(await readFile(snapshotAbs, 'utf8')) as Record<string, unknown>
    expect(sealed.schema).toBe('dsh-fund-research/snapshot@v1')

    // Both audit events landed in the session log.
    const types = base.session.events.map(event => event.type)
    expect(types).toContain('fund-research/snapshot')
    expect(types).toContain('fund-research/report')
  })

  it('runs as a background job and settles with the sealed summary', async () => {
    const base = await mountOfflinePlugin()
    const result = await callTool(base, 'fund_research', { code: FIXTURE_CODE, background: true })
    expect(result.isError).toBe(false)
    const value = result.value as Record<string, unknown>
    expect(value.kind).toBe('background')
    const jobId = String(value.jobId)
    expect(jobId).toMatch(/^fund-report-/u)

    const settled = await base.ctx.jobs.wait(JobId(jobId), 15_000, base.agent)
    expect(settled.status).toBe('completed')
    const read = base.ctx.jobs.read(JobId(jobId), base.agent)
    expect(read.text).toContain('研究报告已封存')
  })

  it('renders only requested sections', async () => {
    const base = await mountOfflinePlugin()
    const result = await callTool(base, 'fund_research', { code: FIXTURE_CODE, sections: ['overview', 'disclaimer'] })
    expect(result.isError).toBe(false)
    const value = result.value as Record<string, unknown>
    const report = await readFile(path.join(base.workspace, String(value.reportPath)), 'utf8')
    expect(report).toContain('研究报告')
    expect(report).not.toContain('## 业绩拆解')
  })

  it('rejects an unknown section id loudly', async () => {
    const base = await mountOfflinePlugin()
    const result = await callTool(base, 'fund_research', { code: FIXTURE_CODE, sections: ['bogus'] })
    expect(result.isError).toBe(true)
  })
})
