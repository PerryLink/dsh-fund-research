/**
 * Optional consumption bridge for the frozen `dsh-data-quality` contract. The
 * service is looked up per call through `ctx.get('dataQuality')` — never
 * injected — so the plugin activates with or without it. When the service is
 * absent, a built-in fallback checker resolves each citation path against the
 * sealed snapshot JSON and compares numbers within a relative tolerance,
 * producing the same verdict shape tagged `builtin-fallback`.
 *
 * The request/result interfaces below mirror the frozen cross-plugin contract
 * byte-for-byte; they are declared locally on purpose (no package import).
 * @module dsh-fund-research/verify-bridge
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

/** Frozen contract: one citation-check request. */
export interface CitationCheckRequest {
  /** Workspace-relative path of the source dataset snapshot (CSV/JSON). */
  dataset: string
  /** Citations to verify against the dataset. */
  citations: Array<{
    /** Stable id chosen by the caller, echoed back in results. */
    id: string
    /** JSON-path-ish locator, e.g. "rows[3].nav" or "summary.annualReturn". */
    path: string
    /** The value as cited in the document. */
    value: number | string
    /** Optional relative tolerance for numeric comparison, e.g. 0.01 = 1%. */
    tolerance?: number
  }>
}

/** Frozen contract: one citation-check result set. */
export interface CitationCheckResult {
  results: Array<{
    id: string
    status: 'verified' | 'mismatch' | 'not-found' | 'unverifiable'
    /** Actual value found at path, when found. */
    actual?: number | string
    /** Human-readable evidence note. */
    note?: string
  }>
}

/** The structural surface of the optional `ctx.dataQuality` service. */
export interface DataQualityLike {
  /** Verify one request against its dataset; may be sync or async. */
  verifyCitations(request: CitationCheckRequest): CitationCheckResult | Promise<CitationCheckResult>
}

/** The minimal context surface the bridge reads (the optional service lookup). */
export interface DataQualityLookup {
  /** Cordis optional-service lookup. */
  get(key: 'dataQuality'): unknown
}

/**
 * Resolve one JSON-path-ish locator (`a.b[3].c`) against a decoded JSON value.
 * @param root - the decoded JSON document.
 * @param path - the locator.
 * @returns the value at the path, or `undefined` when any segment misses.
 */
export function resolvePath(root: unknown, path: string): unknown {
  const segments = path.replace(/\[(\d+)\]/gu, '.$1').split('.').filter(segment => segment !== '')
  let current: unknown = root
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isSafeInteger(index) || index < 0 || index >= current.length) return undefined
      current = current[index]
    } else {
      current = (current as Record<string, unknown>)[segment]
    }
  }
  return current
}

/** Compare one cited value against the actual value with a relative tolerance for numbers. */
function compareValues(cited: number | string, actual: unknown, tolerance: number): 'verified' | 'mismatch' | 'unverifiable' {
  if (typeof cited === 'number') {
    if (typeof actual !== 'number' || !Number.isFinite(actual)) return 'unverifiable'
    if (cited === 0) return actual === 0 ? 'verified' : 'mismatch'
    return Math.abs(actual - cited) / Math.abs(cited) <= tolerance ? 'verified' : 'mismatch'
  }
  if (typeof actual !== 'string') return 'unverifiable'
  return actual === cited ? 'verified' : 'mismatch'
}

/**
 * The built-in fallback checker: reads the dataset JSON, resolves each
 * citation path, and compares values within tolerance. A citation whose path
 * resolves to a non-scalar (object/array) or an incomparable type is
 * `unverifiable`, never silently verified.
 * @param request - the check request; `dataset` stays workspace-relative per the frozen contract.
 * @param resolveDataset - maps the workspace-relative dataset path to a readable absolute path.
 * @returns the verdict set, in request order.
 */
export async function builtinVerifyCitations(
  request: CitationCheckRequest,
  resolveDataset: (dataset: string) => string = dataset => path.resolve(dataset),
): Promise<CitationCheckResult> {
  let root: unknown
  try {
    root = JSON.parse(await readFile(resolveDataset(request.dataset), 'utf8'))
  } catch (error) {
    return {
      results: request.citations.map(citation => ({
        id: citation.id,
        status: 'unverifiable' as const,
        note: `dataset unreadable: ${error instanceof Error ? error.message : String(error)}`,
      })),
    }
  }
  return {
    results: request.citations.map((citation) => {
      const actual = resolvePath(root, citation.path)
      if (actual === undefined) return { id: citation.id, status: 'not-found' as const, note: `no value at ${citation.path}` }
      if (actual !== null && typeof actual === 'object') {
        return { id: citation.id, status: 'unverifiable' as const, note: `path ${citation.path} resolves to a non-scalar` }
      }
      const status = compareValues(citation.value, actual, citation.tolerance ?? 0)
      return {
        id: citation.id,
        status,
        actual: actual as number | string,
        note: status === 'verified' ? `matches ${citation.path}` : `cited ${String(citation.value)} vs actual ${String(actual)} at ${citation.path}`,
      }
    }),
  }
}

/** The verification outcome handed back to the report assembler. */
export interface VerifyOutcome {
  /** Which engine produced the verdicts. */
  engine: 'dsh-data-quality' | 'builtin-fallback'
  /** The verdict set (frozen-contract shape). */
  result: CitationCheckResult
}

/**
 * Verify one citation batch through the optional `dsh-data-quality` service,
 * falling back to the built-in checker when the service is absent or fails.
 * A service failure degrades to the fallback with the error recorded in each
 * note — verification never blocks a report seal. The request's `dataset`
 * stays workspace-relative per the frozen contract; `resolveDataset` maps it
 * to an absolute path for the built-in reader only.
 * @param ctx - the lookup surface (plugin context).
 * @param request - the check request.
 * @param options - optional dataset-path resolver for the built-in reader.
 * @returns the engine tag plus the verdict set.
 */
export async function verifyCitations(
  ctx: DataQualityLookup,
  request: CitationCheckRequest,
  options: { resolveDataset?: (dataset: string) => string } = {},
): Promise<VerifyOutcome> {
  const service = ctx.get('dataQuality') as unknown as DataQualityLike | undefined
  if (service !== undefined && typeof service.verifyCitations === 'function') {
    try {
      const result = await service.verifyCitations(request)
      if (result !== null && typeof result === 'object' && Array.isArray(result.results)) {
        return { engine: 'dsh-data-quality', result }
      }
    } catch {
      // Fall through to the built-in checker; a broken optional service never blocks a seal.
    }
  }
  return {
    engine: 'builtin-fallback',
    result: await builtinVerifyCitations(request, options.resolveDataset ?? (dataset => path.resolve(dataset))),
  }
}
