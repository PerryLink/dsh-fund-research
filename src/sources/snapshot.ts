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
import { PoliteFetcher, collectFund, secidOf, sourceUrls, SourceParseError } from './eastmoney.ts'

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
  constructor(code: string) {
    super(`offline mode: no stored snapshot for fund ${code} in the storage domain or under the report root — run once online first`)
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
    manager: managerMetrics(raw.manager, raw.managerHistory),
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
 * @returns the parsed snapshot, or `null` when none is on disk.
 */
export async function readDiskSnapshot(reportRoot: string, code: string): Promise<FundSnapshot | null> {
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
      const parsed = fundSnapshotSchema.parse(JSON.parse(text))
      return parsed as FundSnapshot
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
}

/**
 * Acquire the snapshot for one fund. Offline mode reads the storage domain
 * first, then the newest on-disk version snapshot, and fails loud when both
 * are empty. Online mode reuses a domain snapshot inside the TTL window and
 * otherwise collects every source, computes the metrics, and stores the
 * result.
 * @param store - the acquisition dependencies.
 * @param code - six-digit fund code.
 * @param options - offline override, disk fallback root, cancellation.
 * @returns the snapshot and whether it came from a live fetch.
 */
export async function acquireSnapshot(
  store: SnapshotStore,
  code: string,
  options: AcquireOptions = {},
): Promise<{ snapshot: FundSnapshot, live: boolean }> {
  const offline = options.offline ?? store.config.offline
  const record = readDomainSnapshot(store, code)

  if (offline) {
    if (record !== null) return { snapshot: record.snapshot, live: false }
    if (options.reportRootAbs !== undefined) {
      const disk = await readDiskSnapshot(options.reportRootAbs, code)
      if (disk !== null) return { snapshot: disk, live: false }
    }
    throw new OfflineGapError(code)
  }

  const ttlMs = store.config.cacheTtlHours * 3_600_000
  if (record !== null && Date.now() - record.storedAt < ttlMs) {
    return { snapshot: record.snapshot, live: false }
  }

  const urls = sourceUrls(store.config, code)
  const collected = await collectFund(store.fetcher, urls, code, {
    styleQuotes: store.config.styleQuotes,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  })
  const snapshot: FundSnapshot = {
    schema: SNAPSHOT_SCHEMA,
    code,
    name: collected.name,
    fetchedAt: collected.fetchedAt,
    sources: collected.sources,
    raw: collected.raw,
    computed: computeMetrics(collected.raw, store.config.riskFreeRate),
    parameters: computationParameters(store.config.riskFreeRate),
    gaps: collected.gaps,
  }
  await storeSnapshot(store, snapshot)
  return { snapshot, live: true }
}

/** Round one number for stable report output (re-exported for the tools). */
export { round4 }
