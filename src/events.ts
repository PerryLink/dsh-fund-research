/**
 * Session audit events for `dsh-fund-research` (model-visible ⟺ logged). Both
 * events are log-only records of facts the tool results already carry: the
 * snapshot acquisition (`fund-research/snapshot`) and the sealed report
 * (`fund-research/report`). The append stays two-argument: the pinned
 * 0.1.1-rc.2 peers have no append-envelope option, and the two-argument form
 * typechecks against both rc.2 and newer builds.
 * @module dsh-fund-research/events
 */

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
