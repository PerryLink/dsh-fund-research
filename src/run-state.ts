/**
 * Durable run-state for the `fund-report` pipeline: a `<reportRoot>/.run-state.json`
 * map recording, per fund code, the input fingerprint, the version directory,
 * and which pipeline stages have completed (with timestamps). `resume: true`
 * continues from the first incomplete stage, reusing the sealed artifacts of
 * completed stages; a fingerprint mismatch rejects the resume loudly so a
 * changed input never silently reuses a stale report.
 * @module dsh-fund-research/run-state
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** The frozen run-state schema marker. */
export const RUN_STATE_SCHEMA = 'dsh-fund-research/run-state@v1' as const

/** The two pipeline stages in seal order. */
export const PIPELINE_STAGES = ['snapshot', 'report'] as const

/** One pipeline stage. */
export type PipelineStage = typeof PIPELINE_STAGES[number]

/** Progress of one stage. */
export interface StageRecord {
  status: 'pending' | 'done'
  /** Epoch milliseconds the stage completed (`null` while pending). */
  at: number | null
}

/** Report-stage facts persisted so an idempotent resume needs no re-verification. */
export interface ReportStageFacts {
  engine: string
  verdicts: { verified: number, mismatch: number, notFound: number, unverifiable: number }
  reportSha256: string
  manifestSha256: string
  snapshotSha256: string
}

/** One fund's recorded run state. */
export interface RunState {
  schema: typeof RUN_STATE_SCHEMA
  code: string
  /** SHA-256 of the canonical input fingerprint. */
  fingerprint: string
  /** Version directory name (YYYYMMDD-HHmmss) reused across resume attempts. */
  version: string
  startedAt: number
  updatedAt: number
  stages: Record<PipelineStage, StageRecord>
  /** Present once the report stage completes; powers idempotent resume. */
  report?: ReportStageFacts | undefined
  /** Review-stage disposition recorded after sealing (e.g. `queued(...)` / `skipped(jobs unavailable)`). */
  review?: string | undefined
}

/** The run-state file holds one entry per fund code. */
export type RunStateMap = Record<string, RunState>

/** Inputs whose change invalidates a recorded run (a resume then fails loud). */
export interface RunFingerprintInput {
  code: string
  sections: readonly string[] | undefined
  asOfDate: string | null
  offline: boolean
  riskFreeRate: number
  styleQuotes: boolean
  includeComparison: boolean
  includeWalkForward: boolean
}

/**
 * Compute the SHA-256 input fingerprint for one run. Key order is fixed by the
 * object literal, so two equivalent runs always share a fingerprint.
 * @param input - the run inputs.
 * @returns hex fingerprint.
 */
export function runFingerprint(input: RunFingerprintInput): string {
  const canonical = {
    code: input.code,
    sections: input.sections === undefined ? null : [...input.sections].sort(),
    asOfDate: input.asOfDate,
    offline: input.offline,
    riskFreeRate: input.riskFreeRate,
    styleQuotes: input.styleQuotes,
    includeComparison: input.includeComparison,
    includeWalkForward: input.includeWalkForward,
  }
  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex')
}

/** The run-state file path under the report root. */
export function runStatePath(reportRootAbs: string): string {
  return path.join(reportRootAbs, '.run-state.json')
}

/**
 * Read the run-state map. A missing or unreadable file yields an empty map
 * (nothing recorded yet); resume then runs fresh and overwrites the file.
 * @param reportRootAbs - absolute report root.
 * @returns the per-code map.
 */
export async function readRunStateMap(reportRootAbs: string): Promise<RunStateMap> {
  try {
    const text = await readFile(runStatePath(reportRootAbs), 'utf8')
    const parsed: unknown = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const map: RunStateMap = {}
    for (const [code, state] of Object.entries(parsed as Record<string, unknown>)) {
      if (state === null || typeof state !== 'object') continue
      const candidate = state as Partial<RunState>
      if (typeof candidate.fingerprint !== 'string' || candidate.stages === null || typeof candidate.stages !== 'object') continue
      map[code] = state as RunState
    }
    return map
  } catch {
    return {}
  }
}

/** Create a fresh pending state for one code. */
export function newRunState(code: string, fingerprint: string, version: string, now: number): RunState {
  return {
    schema: RUN_STATE_SCHEMA,
    code,
    fingerprint,
    version,
    startedAt: now,
    updatedAt: now,
    stages: {
      snapshot: { status: 'pending', at: null },
      report: { status: 'pending', at: null },
    },
  }
}

/** Mark one stage done and persist the updated map (best-effort write). */
export async function markStageDone(
  reportRootAbs: string,
  state: RunState,
  stage: PipelineStage,
  now: number,
  report?: ReportStageFacts,
): Promise<void> {
  state.stages[stage] = { status: 'done', at: now }
  state.updatedAt = now
  if (report !== undefined) state.report = report
  const map = await readRunStateMap(reportRootAbs)
  map[state.code] = state
  await writeRunStateMap(reportRootAbs, map)
}

/** Write the full run-state map (best-effort; never fails the pipeline). */
export async function writeRunStateMap(reportRootAbs: string, map: RunStateMap): Promise<void> {
  try {
    await mkdir(reportRootAbs, { recursive: true })
    await writeFile(runStatePath(reportRootAbs), JSON.stringify(map, null, 2), 'utf8')
  } catch {
    // A failed state write must not change the pipeline outcome; resume simply
    // has nothing to reuse next time.
  }
}

/** Error raised when a resume targets a recorded run with a different input. */
export class ResumeFingerprintMismatchError extends Error {
  constructor(code: string) {
    super(`resume rejected: .run-state.json fingerprint mismatch for fund ${code} (the inputs changed since the recorded run)`)
    this.name = 'ResumeFingerprintMismatchError'
  }
}
