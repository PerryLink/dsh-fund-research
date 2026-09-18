/**
 * The audit gate: plain append on known-type hosts and a silent skip on every
 * other host. The `ignorable`-envelope probe was removed with the P0 dead-code
 * step: `Session.append`'s third parameter carries a `SurfaceIntent` for
 * surface-eligible event types only, so no host admits an out-of-repo
 * non-surface type with a marker, and an unmarked append would make a 0.1.5+
 * reader refuse the stored log.
 * @module dsh-fund-research/test/events.spec
 */

import { describe, expect, it } from 'vitest'
import { KNOWN_SESSION_EVENT_TYPES, type Session } from '@deepseek-ai/dsh-session'
import { appendAuditEvent, SNAPSHOT_EVENT, type SnapshotAuditData } from '../src/events.ts'
import { mountBase } from './harness.ts'

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

  it('never appends when the host does not know the vocabulary, even with an ignorable-shaped body', () => {
    // A body that would have satisfied the removed source-text probe: the gate
    // must not resurrect the marked append (the marker cannot be stamped on a
    // non-surface type, and an unmarked unknown event breaks 0.1.5+ readers).
    const calls: unknown[][] = []
    const append = function (type: string, data: unknown, options?: unknown) {
      const ignorable = (options as { ignorable?: boolean } | undefined)?.ignorable
      void ignorable
      calls.push(options === undefined ? [type, data] : [type, data, options])
      return { ignorable: ignorable === true }
    }
    appendAuditEvent({ append } as unknown as Session, SNAPSHOT_EVENT, payload)
    expect(calls).toHaveLength(0)
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

  it('never calls append on a real session whose type set excludes the vocabulary', async () => {
    // Real Session from the installed peers: the vocabulary is out-of-repo, so
    // the known-type membership check fails and nothing is written.
    const base = await mountBase('fund-events-gate')
    appendAuditEvent(base.session, SNAPSHOT_EVENT, payload)
    expect(base.session.snapshotEvents().filter(event => event.type === SNAPSHOT_EVENT)).toHaveLength(0)
  })
})
