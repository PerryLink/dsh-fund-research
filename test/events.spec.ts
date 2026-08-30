/**
 * The adaptive audit gate: plain append on known-type hosts, marked append on
 * `ignorable`-envelope hosts, and a silent skip on envelope-less hosts
 * (0.1.0-rc.6/rc.8, 0.1.1-rc.2, 0.1.2-alpha.1).
 * @module dsh-fund-research/test/events.spec
 */

import { describe, expect, it } from 'vitest'
import { KNOWN_SESSION_EVENT_TYPES, type Session } from '@deepseek-ai/dsh-session'
import { appendAuditEvent, SNAPSHOT_EVENT, type SnapshotAuditData } from '../src/events.ts'

const payload: SnapshotAuditData = {
  code: '161725',
  name: 'Test Fund',
  fetchedAt: 1,
  live: false,
  sourceHashes: { pingzhongdata: 'a' },
  gaps: [],
}

describe('appendAuditEvent', () => {
  it('appends plainly when the host knows the vocabulary', () => {
    ;(KNOWN_SESSION_EVENT_TYPES as Set<string>).add(SNAPSHOT_EVENT)
    try {
      const calls: unknown[][] = []
      const append = function (type: string, data: unknown) {
        calls.push([type, data])
        return {}
      }
      appendAuditEvent({ append } as unknown as Session, SNAPSHOT_EVENT, payload)
      expect(calls).toEqual([[SNAPSHOT_EVENT, payload]])
    } finally {
      ;(KNOWN_SESSION_EVENT_TYPES as Set<string>).delete(SNAPSHOT_EVENT)
    }
  })

  it('appends with the marker on envelope hosts', () => {
    const calls: unknown[][] = []
    const append = function (type: string, data: unknown, options?: unknown) {
      // The `ignorable` marker rides the options bag on envelope hosts.
      calls.push(options === undefined ? [type, data] : [type, data, options])
      return { ignorable: (options as { ignorable?: boolean } | undefined)?.ignorable === true }
    }
    appendAuditEvent({ append } as unknown as Session, SNAPSHOT_EVENT, payload)
    expect(calls).toEqual([[SNAPSHOT_EVENT, payload, { ignorable: true }]])
  })

  it('skips the append on envelope-less hosts', () => {
    const calls: unknown[][] = []
    const append = function (type: string, data: unknown, surface?: unknown) {
      calls.push(surface === undefined ? [type, data] : [type, data, surface])
      return { surface }
    }
    appendAuditEvent({ append } as unknown as Session, SNAPSHOT_EVENT, payload)
    expect(calls).toHaveLength(0)
  })
})
