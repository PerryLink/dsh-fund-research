/**
 * Deterministic benchmark/peer comparison: fold the source-published
 * profit-comparison triple (任期收益 / 同类平均 / 沪深300) and the manager's
 * managed-funds scoreboard into one benchmark block. Pure functions — the
 * model never computes a ranking by hand, and every number traces to
 * `raw.manager.*` in the sealed snapshot.
 * @module dsh-fund-research/metrics/benchmark
 */

import { round4 } from './performance.ts'
import type { ManagerHistory, ManagerMetrics } from '../model.ts'

/** One benchmark comparison row: a peer/index reference vs the fund's tenure return. */
export interface BenchmarkRow {
  /** Reference label as published (e.g. 同类平均 / 沪深300). */
  label: string
  /** Benchmark return over the same window (%). */
  valuePct: number
  /** Fund's return over the same window (%). */
  fundPct: number
  /** Excess return (fund − benchmark), in percentage points. */
  excessPct: number
}

/** Peer-rank summary over the manager's published managed-funds scoreboard. */
export interface PeerRankSummary {
  /** Number of managed-fund rows published. */
  managedFundCount: number
  /** Managed funds whose tenure return beat their peer average. */
  beatPeerCount: number
  /** Average peer rank (1-based) over funds that publish a rank; `null` when none do. */
  avgRank: number | null
  /** Average peer-group size over funds that publish a rank; `null` when none do. */
  avgTotal: number | null
}

/** The benchmark/peer comparison computed over one snapshot. */
export interface BenchmarkMetrics {
  /** Fund's tenure return (%), the baseline for every comparison row; `null` when a gap. */
  tenureReturnPct: number | null
  /** Comparison rows vs peer average and index benchmarks. */
  rows: BenchmarkRow[]
  /** Peer-rank summary; `null` when the manager-history source is a gap. */
  peerRank: PeerRankSummary | null
}

/** The published label of the fund's own tenure return in the profit comparison. */
const TENURE_LABEL = '任期收益'

/**
 * Build the benchmark/peer comparison from the already-computed manager
 * metrics and the manager-history source. The fund's tenure return is the
 * baseline; every other profit-comparison entry (同类平均, 沪深300, …) becomes a
 * row with the fund's excess return. Peer-rank stats aggregate the published
 * per-fund `peerRank`/`peerTotal` values.
 * @param history - the F10 manager history (`null` when a gap).
 * @param manager - the computed manager metrics.
 * @returns the benchmark comparison (rows are empty and peerRank null when sources gap).
 */
export function benchmarkMetrics(history: ManagerHistory | null, manager: ManagerMetrics): BenchmarkMetrics {
  const tenureReturnPct = manager.tenureReturnPct
  const rows: BenchmarkRow[] = []
  for (const entry of manager.profitComparison) {
    if (entry.label === TENURE_LABEL || tenureReturnPct === null) continue
    rows.push({
      label: entry.label,
      valuePct: entry.valuePct,
      fundPct: tenureReturnPct,
      excessPct: round4(tenureReturnPct - entry.valuePct),
    })
  }

  const managedFunds = history?.managedFunds ?? []
  let peerRank: PeerRankSummary | null = null
  if (manager.managedFundCount !== null) {
    const ranked = managedFunds.filter(fund => fund.peerRank > 0 && fund.peerTotal > 0)
    const avgRank = ranked.length > 0 ? round4(ranked.reduce((sum, fund) => sum + fund.peerRank, 0) / ranked.length) : null
    const avgTotal = ranked.length > 0 ? round4(ranked.reduce((sum, fund) => sum + fund.peerTotal, 0) / ranked.length) : null
    peerRank = {
      managedFundCount: manager.managedFundCount,
      beatPeerCount: manager.beatPeerCount ?? 0,
      avgRank,
      avgTotal,
    }
  }

  return { tenureReturnPct, rows, peerRank }
}
