/**
 * Session audit events for `dsh-fund-research` (model-visible ⟺ logged) and
 * the append gate. Both events are log-only records of facts the tool results
 * already carry: the snapshot acquisition (`fund-research/snapshot`) and the
 * sealed report (`fund-research/report`).
 *
 * The gate appends only when the host's known-type set covers the vocabulary
 * (a future harness that adopts these events) and otherwise does nothing — the
 * tool results and the sealed snapshot/report remain the reconstructable audit
 * trail.
 *
 * HARD RULE (measured on the 0.1.6-alpha.2 line): `Session.append`'s third
 * parameter carries a `SurfaceIntent`, and only for surface-eligible event
 * types; it is never an `ignorable` envelope. An out-of-repo non-surface type
 * therefore cannot be stamped, and an unmarked unknown event makes a 0.1.5+
 * reader refuse the whole stored log. Do not reintroduce any form of marked or
 * unconditional append here — the source-text probe that used to look for an
 * `ignorable` option was removed for exactly that reason.
 * @module dsh-fund-research/events
 */

import { KNOWN_SESSION_EVENT_TYPES, type Session } from '@deepseek-ai/dsh-session'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * One fund snapshot acquisition: which sources fed it, their hashes, and
     * the declared gaps. Log-only audit; the tool result carries the same facts.
     * @param code - six-digit fund code.
     * @param name - fund name.
     * @param fetchedAt - epoch milliseconds of the acquisition.
     * @param live - whether the snapshot came from live fetches (vs cache/offline).
     * @param sourceHashes - per-source SHA-256 provenance.
     * @param gaps - declared data-gap labels.
     */
    'fund-research/snapshot': {
      code: string
      name: string
      fetchedAt: number
      live: boolean
      sourceHashes: Record<string, string>
      gaps: string[]
    }
    /**
     * One sealed research report version. Log-only audit; the tool result
     * carries the same facts.
     * @param code - six-digit fund code.
     * @param name - fund name.
     * @param version - version directory name (YYYYMMDD-HHmmss).
     * @param reportPath - workspace-relative report path.
     * @param manifestSha256 - SHA-256 of manifest.json.
     * @param reportSha256 - SHA-256 of report.md.
     * @param verifyEngine - citation-verification engine used.
     * @param gaps - declared data-gap labels.
     */
    'fund-research/report': {
      code: string
      name: string
      version: string
      reportPath: string
      manifestSha256: string
      reportSha256: string
      verifyEngine: string
      gaps: string[]
    }
  }
}

/** The snapshot audit event type. */
export const SNAPSHOT_EVENT = 'fund-research/snapshot' as const

/** The report audit event type. */
export const REPORT_EVENT = 'fund-research/report' as const

/** Snapshot audit payload. */
export interface SnapshotAuditData {
  code: string
  name: string
  fetchedAt: number
  live: boolean
  sourceHashes: Record<string, string>
  gaps: string[]
}

/** Report audit payload. */
export interface ReportAuditData {
  code: string
  name: string
  version: string
  reportPath: string
  manifestSha256: string
  reportSha256: string
  verifyEngine: string
  gaps: string[]
}

/**
 * Append one fund-research audit event when the host's known-type set covers
 * the vocabulary; do nothing otherwise (the tool results and the sealed
 * snapshot/report stay the reconstructive audit trail). There is deliberately
 * no probe path: `Session.append` cannot stamp an `ignorable` marker on a
 * non-surface type on any supported line, and writing an unmarked unknown
 * event would make a 0.1.5+ reader refuse the stored log.
 * @param session - the calling session.
 * @param type - the audit event type.
 * @param data - the audit payload.
 */
export function appendAuditEvent(
  session: Session,
  type: typeof SNAPSHOT_EVENT | typeof REPORT_EVENT,
  data: SnapshotAuditData | ReportAuditData,
): void {
  if (!KNOWN_SESSION_EVENT_TYPES.has(type)) return
  if (type === SNAPSHOT_EVENT) session.append(type, data as SnapshotAuditData)
  else session.append(type, data as ReportAuditData)
}
