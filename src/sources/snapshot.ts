/**
 * Snapshot acquisition: fetch → extract → compute → store, and the offline /
 * cache-TTL read paths. A snapshot is the canonical {@link FundSnapshot} —
 * raw sections plus deterministic computations plus per-source provenance —
 * sealed to the storage domain so offline runs and reproductions never touch
 * the network. Offline reads fall back to the newest on-disk `snapshot.json`
 * under the report root when the domain holds none.
 * @module dsh-fund-research/sources/snapshot
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import type { ResolvedConfig } from '../config.ts'
import type { ComputationParameters, FundSnapshot } from '../model.ts'
import { SNAPSHOT_SCHEMA } from '../model.ts'
import { fundSnapshotSchema, fundResearchDomainSpec, type SnapshotRecord } from '../store.ts'
import { CALENDAR_DAYS_PER_YEAR, decomposePerformance, TRADING_DAYS_PER_YEAR, dateOf, round4 } from '../metrics/performance.ts'
import { holdingsMetrics } from '../metrics/holdings.ts'
import { styleMetrics } from '../metrics/style.ts'
import { managerMetrics } from '../metrics/manager.ts'
import { benchmarkMetrics } from '../metrics/benchmark.ts'
import { PoliteFetcher, collectFund, secidOf, sourceUrls, SourceParseError } from './eastmoney.ts'
import { buildSourcesDiscovery, type QuoteDiscoveryFacts, type SourcesDiscovery } from '../discovery.ts'

/** Dependencies one acquisition needs; assembled by the plugin entry. */
export interface SnapshotStore {
  /** The opened storage domain handle (`null` when persistence is unavailable). */
  domain: Domain<typeof fundResearchDomainSpec> | null
  /** The resolved plugin config. */
  config: ResolvedConfig
  /** The shared polite fetcher. */
  fetcher: PoliteFetcher
}

/** Error raised when an offline acquisition finds no stored snapshot. */
export class OfflineGapError extends Error {
  constructor(code: string, asOfDate?: string) {
    const cutoff = asOfDate === undefined ? '' : ` (asOf ${asOfDate})`
    super(`offline mode: no stored snapshot${cutoff} for fund ${code} in the storage domain or under the report root — run once online first`)
    this.name = 'OfflineGapError'
  }
}

/**
 * Compute the deterministic metrics over one collected raw snapshot.
 * @param raw - the collected raw sections.
 * @param riskFreeRate - annual risk-free rate (fraction).
 * @returns the computed metrics block.
 */
export function computeMetrics(raw: FundSnapshot['raw'], riskFreeRate: number): FundSnapshot['computed'] {
  const windows = decomposePerformance(raw.navTrend, riskFreeRate)
  const latest = raw.navTrend[raw.navTrend.length - 1]
  if (latest === undefined) throw new SourceParseError('snapshot', 'navTrend', 'empty NAV series')
  const manager = managerMetrics(raw.manager, raw.managerHistory)
  return {
    performance: {
      latestNav: latest.nav,
      latestDate: dateOf(latest.t),
      windows,
    },
    holdings: raw.holdings === null ? null : holdingsMetrics(raw.holdings.rows, raw.holdings.previousRows),
    style: raw.holdings === null || raw.quotes === null
      ? null
      : styleMetrics(raw.holdings.rows, raw.quotes, secidOf),
    manager,
    benchmark: benchmarkMetrics(raw.managerHistory, manager),
  }
}

/** The computation-parameter block stamped into every snapshot. */
export function computationParameters(riskFreeRate: number): ComputationParameters {
  return {
    riskFreeRate,
    tradingDaysPerYear: TRADING_DAYS_PER_YEAR,
    calendarDaysPerYear: CALENDAR_DAYS_PER_YEAR,
  }
}

/**
 * Read the newest on-disk snapshot for one fund under the report root.
 * Version directories sort lexicographically (YYYYMMDD-HHmmss), so the last
 * one holding a snapshot.json wins. Never throws on a missing root.
 * @param reportRoot - the resolved absolute report root.
 * @param code - the fund code.
 * @param asOf - when set, only snapshots carrying this exact cutoff are returned.
 * @returns the parsed snapshot, or `null` when none is on disk.
 */
export async function readDiskSnapshot(reportRoot: string, code: string, asOf?: string): Promise<FundSnapshot | null> {
  const fundDir = path.join(reportRoot, code)
  let entries: string[]
  try {
    entries = await readdir(fundDir)
  } catch {
    return null
  }
  for (const entry of [...entries].sort().reverse()) {
    try {
      const text = await readFile(path.join(fundDir, entry, 'snapshot.json'), 'utf8')
      const parsed = fundSnapshotSchema.parse(JSON.parse(text)) as FundSnapshot
      if (asOf !== undefined && parsed.asOf !== asOf) continue
      return parsed
    } catch {
      // A version directory without a valid snapshot.json is skipped, not fatal.
    }
  }
  return null
}

/** Read the stored domain snapshot for one fund (`null` when absent). */
export function readDomainSnapshot(store: SnapshotStore, code: string): SnapshotRecord | null {
  if (store.domain === null) return null
  return store.domain.table('snapshots').get(code) ?? null
}

/**
 * Persist one snapshot to the storage domain. Persistence failure is logged by
 * the caller's context, never silently dropped from the return value — the
 * snapshot itself is always returned either way.
 * @param store - the acquisition dependencies.
 * @param snapshot - the snapshot to store.
 */
export async function storeSnapshot(store: SnapshotStore, snapshot: FundSnapshot): Promise<void> {
  if (store.domain === null) return
  await store.domain.table('snapshots').put(snapshot.code, {
    code: snapshot.code,
    storedAt: Date.now(),
    snapshot,
  })
}

/** Options controlling one acquisition. */
export interface AcquireOptions {
  /** Per-call offline override; falls back to the configured value. */
  offline?: boolean
  /** Workspace-absolute report root for the on-disk offline fallback. */
  reportRootAbs?: string
  /** Caller cancellation. */
  signal?: AbortSignal
  /** asOf cutoff date (ISO YYYY-MM-DD); data strictly after it is excluded. */
  asOfDate?: string
}

/** One acquisition's result: the snapshot, its liveness, and the discovery record. */
export interface AcquireResult {
  snapshot: FundSnapshot
  live: boolean
  discovery: SourcesDiscovery
}

/**
 * Validate an asOf cutoff date and reject future dates loudly. Returns the
 * normalized YYYY-MM-DD date, or `undefined` for an empty/unset cutoff.
 * @param input - the raw asOfDate argument (ISO 8601 date, or empty).
 * @param now - the reference clock for the future-date check (tests inject it).
 * @returns the normalized date, or `undefined` for no cutoff.
 */
export function parseAsOfDate(input: string | undefined, now: number = Date.now()): string | undefined {
  if (input === undefined || input.trim() === '') return undefined
  const value = input.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new TypeError(`asOfDate must be an ISO 8601 date (YYYY-MM-DD), got ${JSON.stringify(input)}`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== (month ?? 0) - 1 || date.getUTCDate() !== day) {
    throw new TypeError(`asOfDate must be a real calendar date, got ${JSON.stringify(input)}`)
  }
  const today = new Date(now).toISOString().slice(0, 10)
  if (value > today) {
    throw new TypeError(`asOfDate must not be in the future, got ${JSON.stringify(input)} (today is ${today})`)
  }
  return value
}

/**
 * Truncate the NAV series to points on or before the asOf cutoff. The sealed
 * snapshot then only carries data the report is allowed to use, and every
 * computed number traces to it.
 * @param raw - the collected raw sections.
 * @param asOfDate - normalized YYYY-MM-DD cutoff.
 * @returns the raw sections with the NAV series truncated.
 */
export function applyAsOfCutoff(raw: FundSnapshot['raw'], asOfDate: string): FundSnapshot['raw'] {
  const navTrend = raw.navTrend.filter(point => dateOf(point.t) <= asOfDate)
  if (navTrend.length < 2) {
    throw new Error(`asOfDate ${asOfDate} leaves fewer than 2 NAV points (${navTrend.length}); cannot compute performance`)
  }
  return { ...raw, navTrend }
}

/** Quote facts for a live collection (collector-reported fallback and coverage). */
function quoteFactsOfLive(urls: ReturnType<typeof sourceUrls>, collected: Awaited<ReturnType<typeof collectFund>>): QuoteDiscoveryFacts {
  return {
    primaryUrl: urls.quoteBase,
    fallbackUrl: urls.quoteFallbackBase === '' ? null : urls.quoteFallbackBase,
    fallbackUsed: collected.quoteFallbackUsed,
    requested: collected.quoteCoverage.requested,
    succeeded: collected.quoteCoverage.succeeded,
  }
}

/** Quote facts for a reuse path (configured hosts; coverage derived from the snapshot). */
function quoteFactsOfReuse(store: SnapshotStore, snapshot: FundSnapshot): QuoteDiscoveryFacts {
  return {
    primaryUrl: store.config.quoteBaseUrl,
    fallbackUrl: store.config.quoteFallbackBaseUrl === '' ? null : store.config.quoteFallbackBaseUrl,
    fallbackUsed: false,
    requested: snapshot.raw.holdings?.rows.length ?? 0,
    succeeded: Object.keys(snapshot.raw.quotes?.rows ?? {}).length,
  }
}

/**
 * Acquire the snapshot for one fund. Offline mode reads the storage domain
 * first, then the newest on-disk version snapshot, and fails loud when both
 * are empty. Online mode reuses a domain snapshot inside the TTL window and
 * otherwise collects every source, computes the metrics, and stores the
 * result.
 * @param store - the acquisition dependencies.
 * @param code - six-digit fund code.
 * @param options - offline override, disk fallback root, cancellation, asOf cutoff.
 * @returns the snapshot, whether it came from a live fetch, and the discovery record.
 */
export async function acquireSnapshot(
  store: SnapshotStore,
  code: string,
  options: AcquireOptions = {},
): Promise<AcquireResult> {
  const offline = options.offline ?? store.config.offline
  const asOfDate = parseAsOfDate(options.asOfDate)
  const record = readDomainSnapshot(store, code)

  /** Build a reuse result for one already-stored snapshot. */
  const reuse = (snapshot: FundSnapshot): AcquireResult => ({
    snapshot,
    live: false,
    discovery: buildSourcesDiscovery(snapshot, quoteFactsOfReuse(store, snapshot), Date.now(), false),
  })

  /** A stored snapshot satisfies the asOf cutoff only when it was produced under the same one. */
  const matchesAsOf = (snapshot: FundSnapshot): boolean => asOfDate === undefined || snapshot.asOf === asOfDate

  if (offline) {
    if (record !== null && matchesAsOf(record.snapshot)) return reuse(record.snapshot)
    if (options.reportRootAbs !== undefined) {
      const disk = await readDiskSnapshot(options.reportRootAbs, code, asOfDate)
      if (disk !== null) return reuse(disk)
    }
    throw new OfflineGapError(code, asOfDate)
  }

  const ttlMs = store.config.cacheTtlHours * 3_600_000
  if (record !== null && Date.now() - record.storedAt < ttlMs && matchesAsOf(record.snapshot)) {
    return reuse(record.snapshot)
  }

  const urls = sourceUrls(store.config, code)
  const collected = await collectFund(store.fetcher, urls, code, {
    styleQuotes: store.config.styleQuotes,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  })
  const raw = asOfDate === undefined ? collected.raw : applyAsOfCutoff(collected.raw, asOfDate)
  const snapshot: FundSnapshot = {
    schema: SNAPSHOT_SCHEMA,
    code,
    name: collected.name,
    fetchedAt: collected.fetchedAt,
    sources: collected.sources,
    raw,
    computed: computeMetrics(raw, store.config.riskFreeRate),
    parameters: computationParameters(store.config.riskFreeRate),
    gaps: collected.gaps,
    ...(asOfDate === undefined ? {} : { asOf: asOfDate }),
  }
  await storeSnapshot(store, snapshot)
  return {
    snapshot,
    live: true,
    discovery: buildSourcesDiscovery(snapshot, quoteFactsOfLive(urls, collected), Date.now(), true),
  }
}

/** Round one number for stable report output (re-exported for the tools). */
export { round4 }
