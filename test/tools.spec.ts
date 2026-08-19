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
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import { JobId } from '@deepseek-ai/dsh-jobs'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { afterEach, describe, expect, it } from 'vitest'
import { mountBase, unmountBase, type BaseHarness } from './harness.ts'
import { buildFixtureSnapshot, FIXTURE_CODE, loadFixtures } from './fixtures.ts'
import { fundResearchDomainSpec } from '../src/store.ts'
import { resolveConfig } from '../src/config.ts'
import { buildResearchTool } from '../src/tools/research.ts'
import { audit } from '../src/tools/shared.ts'
import { SNAPSHOT_EVENT } from '../src/events.ts'
import type { FundSnapshot } from '../src/model.ts'

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
async function mountOfflinePlugin(config: Record<string, unknown> = {}, extras: Record<string, FundSnapshot> = {}): Promise<BaseHarness> {
  const base = await mountBase(`fund-tools-${callCounter}`)
  bases.push(base)
  // Seed before the plugin opens the domain (single-open rule).
  const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
  const snapshot = buildFixtureSnapshot(await loadFixtures())
  await domain.table('snapshots').put(FIXTURE_CODE, { code: FIXTURE_CODE, storedAt: Date.now(), snapshot })
  for (const [code, extra] of Object.entries(extras)) {
    await domain.table('snapshots').put(code, { code, storedAt: Date.now(), snapshot: extra })
  }
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

  it('tallies mixed verdicts from the dsh-data-quality service and tags its engine', async () => {
    const base = await mountOfflinePlugin()
    const statuses = ['verified', 'mismatch', 'not-found', 'unverifiable'] as const
    base.ctx.provide('dataQuality' as never, {
      verifyCitations: async (request: { citations: unknown[] }) => ({
        results: request.citations.map((citation, index) => ({
          id: (citation as { id: string }).id,
          status: statuses[index % statuses.length] as never,
          note: 'stub',
        })),
      }),
    } as never)
    const result = await callTool(base, 'fund_research', { code: FIXTURE_CODE })
    expect(result.isError).toBe(false)
    const value = result.value as Record<string, unknown>
    expect(value.verifyEngine).toBe('dsh-data-quality')
    const verdicts = value.verdicts as Record<string, number>
    expect(verdicts.verified).toBeGreaterThan(0)
    expect(verdicts.mismatch).toBeGreaterThan(0)
    expect(verdicts.notFound).toBeGreaterThan(0)
    expect(verdicts.unverifiable).toBeGreaterThan(0)
  })

  it('settles a background job as failed when the pipeline throws', async () => {
    const base = await mountOfflinePlugin()
    const result = await callTool(base, 'fund_research', { code: 'abc', background: true })
    expect(result.isError).toBe(false)
    const jobId = String((result.value as Record<string, unknown>).jobId)
    const settled = await base.ctx.jobs.wait(JobId(jobId), 15_000, base.agent)
    expect(settled.status).toBe('failed')
    expect(base.ctx.jobs.read(JobId(jobId), base.agent).text).toContain('failed: fund code must be exactly six digits')
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

describe('direct tool hooks (presentation + guard branches)', () => {
  it('maps an absolute report root into the presentCall location', async () => {
    const base = await mountBase('fund-hooks-abs')
    bases.push(base)
    const tool = buildResearchTool({
      ctx: base.ctx,
      config: resolveConfig({ reportRoot: path.join(base.workspace, 'abs-root') }),
      store: undefined as never,
      logger: undefined as never,
      generator: 'test',
    })
    const call = tool.presentCall?.({ code: FIXTURE_CODE })
    expect(call?.card).toBe('generic')
    if (call?.card === 'generic') {
      expect(call.locations?.[0]?.path).toBe(path.join(base.workspace, 'abs-root', FIXTURE_CODE))
    }
  })

  it('renders a relative report root as a workspace-relative location', async () => {
    const base = await mountBase('fund-hooks-rel')
    bases.push(base)
    const tool = buildResearchTool({
      ctx: base.ctx,
      config: resolveConfig({ reportRoot: 'reports' }),
      store: undefined as never,
      logger: undefined as never,
      generator: 'test',
    })
    const call = tool.presentCall?.({ code: FIXTURE_CODE })
    expect(call?.card).toBe('generic')
    if (call?.card === 'generic') {
      expect(call.locations?.[0]?.path).toBe(`reports/${FIXTURE_CODE}/`)
    }
  })

  it('presents a sealed result as a card and falls through otherwise', async () => {
    const base = await mountBase('fund-hooks-present')
    bases.push(base)
    const tool = buildResearchTool({
      ctx: base.ctx,
      config: resolveConfig({ reportRoot: 'reports' }),
      store: undefined as never,
      logger: undefined as never,
      generator: 'test',
    })
    const card = tool.presentResult?.({ code: FIXTURE_CODE }, { meta: { kind: 'sealed', reportPath: 'x/report.md' } } as never)
    expect(card?.card).toBe('generic')
    expect(card?.title).toContain('x/report.md')
    expect(tool.presentResult?.({ code: FIXTURE_CODE }, { meta: { kind: 'background', jobId: 'j' } } as never)).toBeUndefined()
  })

  it('fails loud when background mode has no jobs service', async () => {
    const bare = new Context()
    const tool = buildResearchTool({
      ctx: bare,
      config: resolveConfig({ reportRoot: 'reports' }),
      store: undefined as never,
      logger: undefined as never,
      generator: 'test',
    })
    await expect(tool.execute({ code: FIXTURE_CODE, background: true }, { agent: {} as never, signal: new AbortController().signal } as never))
      .rejects.toThrowError(/ctx\.jobs service/u)
  })

  it('fails loud when background mode has no agent owner', async () => {
    const base = await mountOfflinePlugin()
    const tool = buildResearchTool({
      ctx: base.ctx,
      config: resolveConfig({ reportRoot: 'reports' }),
      store: undefined as never,
      logger: undefined as never,
      generator: 'test',
    })
    await expect(tool.execute({ code: FIXTURE_CODE, background: true }, { agent: undefined, signal: new AbortController().signal } as never))
      .rejects.toThrowError(/agent-owned execution/u)
  })
})

describe('fund_snapshot card edges', () => {
  it('renders a null scale, empty top-3, and declared gaps from a gapped snapshot', async () => {
    const fixture = buildFixtureSnapshot(await loadFixtures())
    const gapped: FundSnapshot = {
      ...fixture,
      raw: { ...fixture.raw, holdings: null, scaleHistory: { dates: [], values: [] } },
      gaps: ['holdings', 'quotes'],
    }
    const base = await mountOfflinePlugin({}, { '000001': gapped })
    const result = await callTool(base, 'fund_snapshot', { code: '000001', offline: true })
    expect(result.isError).toBe(false)
    const value = result.value as Record<string, unknown>
    expect(value.latestScaleYi).toBeNull()
    expect(value.top3).toEqual([])
    expect(value.gaps).toEqual(['holdings', 'quotes'])
    expect(value.offline).toBe(true)
    const card = await readFile(path.join(base.workspace, String(value.cardPath)), 'utf8')
    expect(card).toContain('数据缺口：holdings、quotes')
  })
})

describe('audit', () => {
  it('never throws when the session append fails', () => {
    const broken = { session: { append: () => { throw new Error('session down') } } }
    expect(() => audit(broken as never, SNAPSHOT_EVENT, { code: '161725' })).not.toThrow()
  })

  it('skips appending when there is no session', () => {
    expect(() => audit(undefined, SNAPSHOT_EVENT, { code: '161725' })).not.toThrow()
  })
})
