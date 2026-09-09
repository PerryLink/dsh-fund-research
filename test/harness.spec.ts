/**
 * Harness fixture contract: `mountBase` wires the real services plus a fake
 * Agent that satisfies the 0.1.5 `Inbox` interface — empty pending lists and
 * mutation methods that throw (the official agent-loop-testkit shape). Pinning
 * the shape here keeps the fixture from silently rotting back into a
 * value-imported, non-constructible type.
 * @module dsh-fund-research/test/harness.spec
 */

import { describe, expect, it } from 'vitest'
import { mountBase, unmountBase } from './harness.ts'

const MUTATIONS = ['clear', 'append', 'prepend', 'replace', 'remove', 'splice'] as const

describe('mountBase fake agent', () => {
  it('exposes the Inbox contract with empty pending lists', async () => {
    const base = await mountBase('harness-inbox-shape')
    try {
      expect(base.agent.inbox.nextTurn).toEqual([])
      expect(base.agent.inbox.nextStep).toEqual([])
      for (const method of MUTATIONS) {
        expect(typeof base.agent.inbox[method]).toBe('function')
      }
    } finally {
      await unmountBase(base)
    }
  })

  it('throws from every Inbox mutation instead of mutating silently', async () => {
    const base = await mountBase('harness-inbox-mutation')
    try {
      const { inbox } = base.agent
      expect(() => inbox.clear()).toThrow('does not support Inbox mutations')
      expect(() => inbox.append('next-turn' as never, {} as never)).toThrow('does not support Inbox mutations')
      expect(() => inbox.prepend('next-turn' as never, {} as never)).toThrow('does not support Inbox mutations')
      expect(() => inbox.replace('m1' as never, {} as never)).toThrow('does not support Inbox mutations')
      expect(() => inbox.remove('m1' as never)).toThrow('does not support Inbox mutations')
      expect(() => inbox.splice('next-turn' as never, 0, 0, [])).toThrow('does not support Inbox mutations')
    } finally {
      await unmountBase(base)
    }
  })
})
