/**
 * Multi-fund fan-out suite through the REAL ToolRuntime: array `codes` runs
 * the pipeline per fund with per-fund failure isolation (a failing fund becomes
 * a summary gap and never aborts the others), while single `code` stays a
 * sealed value for backward compatibility. Offline over the seeded domain.
 * @module dsh-fund-research/test/multi.spec
 */

import { CallId } from './call-id.ts'
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

async function callTool(base: BaseHarness, name: string, args: unknown): Promise<ToolExecutionResult> {
  callCounter += 1
  return base.ctx.tools.execute({
    callId: CallId(`fund-multi-spec-${callCounter}`),
    name,
    arguments: args,
    agent: base.agent,
    signal: new AbortController().signal,
  })
}

/** Mount the plugin offline, seeding only the fixture fund (000001 is a gap). */
async function mountOfflinePlugin(): Promise<BaseHarness> {
  const base = await mountBase(`fund-multi-${callCounter}`)
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
  return base
}

interface SummaryValueShape {
  kind: string
  funds: Array<{ code: string, error: string | null, snapshotSha256: string | null, name: string | null }>
  gaps: string[]
}

describe('fund_research fan-out', () => {
  it('seals each fund independently and isolates a failing fund into the summary gaps', async () => {
    const base = await mountOfflinePlugin()
    const result = await callTool(base, 'fund_research', { codes: [FIXTURE_CODE, '000001'] })
    expect(result.isError).toBe(false)
    const value = result.value as unknown as SummaryValueShape
    expect(value.kind).toBe('summary')
    expect(value.funds).toHaveLength(2)

    const ok = value.funds.find(fund => fund.code === FIXTURE_CODE)
    expect(ok?.error).toBeNull()
    expect(ok?.snapshotSha256).toMatch(/^[0-9a-f]{64}$/u)
    expect(ok?.name).toContain('招商中证白酒')

    const failed = value.funds.find(fund => fund.code === '000001')
    expect(failed?.error).not.toBeNull()
    expect(failed?.snapshotSha256).toBeNull()
    expect(value.gaps).toEqual(['000001'])
  })

  it('turns an invalid code in the array into an error entry, not a throw', async () => {
    const base = await mountOfflinePlugin()
    const result = await callTool(base, 'fund_research', { codes: [FIXTURE_CODE, 'abc'] })
    expect(result.isError).toBe(false)
    const value = result.value as unknown as SummaryValueShape
    expect(value.kind).toBe('summary')
    const failed = value.funds.find(fund => fund.code === 'abc')
    expect(failed?.error).toContain('fund code must be exactly six digits')
    expect(value.gaps).toEqual(['abc'])
  })

  it('keeps single `code` as a sealed value, and an explicit one-element `codes` array as a summary', async () => {
    const base = await mountOfflinePlugin()
    const sealed = await callTool(base, 'fund_research', { code: FIXTURE_CODE })
    expect(sealed.isError).toBe(false)
    expect((sealed.value as { kind: string }).kind).toBe('sealed')

    const summary = await callTool(base, 'fund_research', { codes: [FIXTURE_CODE] })
    expect(summary.isError).toBe(false)
    expect((summary.value as { kind: string }).kind).toBe('summary')
  })
})
