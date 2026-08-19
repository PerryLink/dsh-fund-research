/**
 * Deterministic manager-profile metrics: the incumbent's tenure facts from the
 * F10 history page plus the managed-funds scoreboard (funds beating their peer
 * average) and the pingzhongdata profit comparison. Pure functions.
 * @module dsh-fund-research/metrics/manager
 */

import type { ManagerHistory, ManagerMetrics, ManagerSummary } from '../model.ts'

/**
 * Fold the manager sources into the profile metrics. History fields stay
 * `null` when the F10 manager page is a declared gap — the report section
 * renders the gap instead of inventing tenure facts.
 * @param summary - the pingzhongdata manager block.
 * @param history - the F10 manager history (`null` when a gap).
 * @returns the manager metrics.
 */
export function managerMetrics(summary: ManagerSummary, history: ManagerHistory | null): ManagerMetrics {
  const current = history?.tenures.find(tenure => tenure.end === null) ?? history?.tenures[0] ?? null
  const managedFunds = history?.managedFunds ?? []
  const beatPeerCount = history === null
    ? null
    : managedFunds.filter(fund => fund.returnPct > fund.peerAvgPct).length

  const profitComparison = summary.profitCategories.map((label, index) => ({
    label,
    valuePct: summary.profitValues[index] ?? 0,
  }))

  return {
    tenureStart: current?.start ?? null,
    tenureDurationText: current?.durationText ?? null,
    tenureReturnPct: current?.returnPct ?? null,
    managedFundCount: history === null ? null : managedFunds.length,
    beatPeerCount,
    profitComparison,
  }
}
