/**
 * Lifecycle and export-contract suite: the default-export guard (module
 * namespace + Loader unwrap round-trip), HMR-safe disposal of every registry
 * contribution, and inert mounting when disabled.
 * @module dsh-fund-research/test/lifecycle.spec
 */

import Loader from '@deepseek-ai/cordis-plugin-loader'
import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index.ts'
import { mountBase, unmountBase } from './harness.ts'
import { buildFixtureSnapshot, FIXTURE_CODE, loadFixtures } from './fixtures.ts'
import { fundResearchDomainSpec } from '../src/store.ts'

describe('export contract', () => {
  it('carries no default export and Loader unwrap round-trips the namespace', () => {
    expect('default' in plugin).toBe(false)
    const unwrapped = Object.create(Loader.prototype).unwrapExports(plugin)
    expect(unwrapped).toBe(plugin)
    expect(unwrapped.name).toBe('dsh-fund-research')
    expect(unwrapped.inject).toEqual(['tools', 'storageDomain'])
    expect(unwrapped.Config).not.toBeUndefined()
    expect(typeof unwrapped.apply).toBe('function')
  })
})

describe('fiber disposal', () => {
  it('removes both tools when its fiber is disposed', async () => {
    const base = await mountBase('lifecycle-dispose')
    try {
      const fiber = await base.ctx.plugin(plugin as never, {} as never)
      expect(base.ctx.tools.get('fund_snapshot')).toBeDefined()
      expect(base.ctx.tools.get('fund_research')).toBeDefined()

      await fiber.dispose()

      expect(base.ctx.tools.get('fund_snapshot')).toBeUndefined()
      expect(base.ctx.tools.get('fund_research')).toBeUndefined()
    } finally {
      await unmountBase(base)
    }
  })

  it('stays inert when disabled', async () => {
    const base = await mountBase('lifecycle-disabled')
    try {
      const fiber = await base.ctx.plugin(plugin as never, { enabled: false } as never)
      expect(base.ctx.tools.get('fund_snapshot')).toBeUndefined()
      expect(base.ctx.tools.get('fund_research')).toBeUndefined()
      await fiber.dispose()
    } finally {
      await unmountBase(base)
    }
  })

  it('fails loud when the same storage domain is already open', async () => {
    const base = await mountBase('lifecycle-double-open')
    try {
      const domain = await base.ctx.storageDomain.open(fundResearchDomainSpec)
      const snapshot = buildFixtureSnapshot(await loadFixtures())
      await domain.table('snapshots').put(FIXTURE_CODE, { code: FIXTURE_CODE, storedAt: Date.now(), snapshot })
      // The domain is still open here: the plugin's open must fail loudly
      // rather than silently sharing the handle.
      await expect(base.ctx.plugin(plugin as never, {} as never)).rejects.toThrow()
      await domain.close()
    } finally {
      await unmountBase(base)
    }
  })
})
