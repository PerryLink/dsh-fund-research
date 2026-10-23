/**
 * Prompt-section gating: the fund persona is opt-in and, when enabled, is a
 * plugin-owned global section whose text is conditional on the fund tools being
 * visible in the assembling scope (issue #17).
 * @module dsh-fund-research/test/prompt.spec
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import * as plugin from '../src/index.ts'
import { mountBase, unmountBase, type BaseHarness } from './harness.ts'

const bases: BaseHarness[] = []
afterEach(async () => {
  await Promise.all(bases.splice(0).map(base => unmountBase(base)))
})

/** Mount the plugin over the real harness services with a spied systemPrompt stub. */
async function mount(config: Record<string, unknown>) {
  const base = await mountBase(`prompt-${Math.random().toString(36).slice(2)}`)
  bases.push(base)
  const stub = base.ctx.get('systemPrompt') as { section: (section: unknown) => () => void }
  const section = vi.spyOn(stub, 'section')
  const fiber = await base.ctx.plugin(plugin as never, config as never)
  return { base, section, fiber }
}

describe('promptSection', () => {
  it('registers no global section by default', async () => {
    const { section, fiber } = await mount({})
    expect(section).not.toHaveBeenCalled()
    await fiber.dispose()
  })

  it('registers the opt-in global section with tool-conditional text', async () => {
    const disposer = vi.fn()
    const base = await mountBase('prompt-enabled')
    bases.push(base)
    const stub = base.ctx.get('systemPrompt') as { section: (section: unknown) => () => void }
    const section = vi.spyOn(stub, 'section').mockReturnValue(disposer)
    const fiber = await base.ctx.plugin(plugin as never, { promptSection: true } as never)
    expect(section).toHaveBeenCalledTimes(1)
    const registered = section.mock.calls[0]?.[0] as { name: string; order: number; text: unknown }
    expect(registered.name).toBe('fund-research')
    expect(registered.order).toBe(1900)
    expect(typeof registered.text).toBe('function')
    const text = (registered.text as (context: { scope?: unknown }) => string)({})
    expect(text).toContain('fund_snapshot')
    expect(text).toContain('不构成投资建议')
    expect(text).not.toContain('你是基金研究助手')
    await fiber.dispose()
    expect(disposer).toHaveBeenCalledTimes(1)
  })

  it('does not register when the plugin is disabled', async () => {
    const { section, fiber } = await mount({ enabled: false, promptSection: true })
    expect(section).not.toHaveBeenCalled()
    await fiber.dispose()
  })
})
