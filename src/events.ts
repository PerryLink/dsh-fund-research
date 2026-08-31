/**
 * Session audit events for `dsh-fund-research` (model-visible 鉄?logged) and
 * the adaptive append gate. Both events are log-only records of facts the
 * tool results already carry: the snapshot acquisition
 * (`fund-research/snapshot`) and the sealed report (`fund-research/report`).
 *
 * The gate appends only when the host can carry the events safely:
 * - hosts whose known-type set covers the vocabulary append plainly;
 * - hosts with an `ignorable` append option (pre-0.1.2 master builds) append
 *   with the marker, so builds that do not know the type skip it on restore;
 * - envelope-less hosts (0.1.0-rc.6/rc.8, 0.1.1-rc.2, and 0.1.2-alpha.1,
 *   which removed the envelope and fails closed on unknown types at read)
 *   get no append 鈥?the tool results and the sealed snapshot/report remain
 *   the reconstructable audit trail. On 0.1.2-alpha.2 the envelope field is restored for stored-log read compatibility only - its Session.append still cannot stamp the marker, so the gate behavior is unchanged.
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

/** Loose append shape probed at runtime (envelope-less hosts take no options; pre-0.1.2 master builds took `ignorable`). */
type AppendProbe = (type: string, data: unknown, options?: { ignorable: true }) => unknown

/**
 * Append one fund-research audit event when the host can carry it safely;
 * skip silently otherwise (see the module doc for the three host classes).
 * @param session - the calling session.
 * @param type - the audit event type.
 * @param data - the audit payload.
 */
export function appendAuditEvent(
  session: Session,
  type: typeof SNAPSHOT_EVENT | typeof REPORT_EVENT,
  data: SnapshotAuditData | ReportAuditData,
): void {
  if (KNOWN_SESSION_EVENT_TYPES.has(type)) {
    if (type === SNAPSHOT_EVENT) session.append(type, data as SnapshotAuditData)
    else session.append(type, data as ReportAuditData)
    return
  }
  const append = session.append as AppendProbe
  if (Function.prototype.toString.call(append).includes('ignorable')) {
    append.call(session, type, data, { ignorable: true })
  }
}
