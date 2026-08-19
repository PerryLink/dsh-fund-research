/**
 * Deterministic performance decomposition over the daily unit-NAV series:
 * period return, annualized return, annualized volatility, maximum drawdown,
 * and the Sharpe ratio. Pure functions — the model never computes these by
 * hand. Windows are calendar-day based (成立以来 / 近3年 / 近1年); returns
 * compound over daily NAV ratios, volatility annualizes with
 * `√tradingDaysPerYear`, and annualized return uses calendar days.
 * @module dsh-fund-research/metrics/performance
 */

import type { NavPoint, WindowMetrics } from '../model.ts'

/** Trading days per year used to annualize volatility (A-share convention). */
export const TRADING_DAYS_PER_YEAR = 250
/** Calendar days per year used to annualize returns. */
export const CALENDAR_DAYS_PER_YEAR = 365
/** One calendar day in milliseconds. */
const DAY_MS = 86_400_000

/** Format epoch milliseconds as a YYYY-MM-DD (UTC) date. */
export function dateOf(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

/** Round to 4 decimal places for stable, reproducible report numbers. */
export function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

/**
 * Compute the metrics of one NAV window.
 * @param points - daily NAV points inside the window, oldest first (≥2).
 * @param label - window label for the report.
 * @param riskFreeRate - annual risk-free rate (fraction, e.g. 0.02).
 * @returns the window metrics.
 */
export function windowMetrics(points: readonly NavPoint[], label: string, riskFreeRate: number): WindowMetrics {
  if (points.length < 2) throw new Error(`window ${label} needs at least 2 NAV points, got ${points.length}`)
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined) throw new Error(`window ${label} is empty`)
  if (first.nav <= 0) throw new Error(`window ${label} has a non-positive first NAV ${first.nav}`)

  const periodReturn = last.nav / first.nav - 1
  const calendarDays = Math.max(1, Math.round((last.t - first.t) / DAY_MS))
  const annualizedReturn = (1 + periodReturn) ** (CALENDAR_DAYS_PER_YEAR / calendarDays) - 1

  const dailyReturns: number[] = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    if (prev === undefined || curr === undefined || prev.nav <= 0) continue
    dailyReturns.push(curr.nav / prev.nav - 1)
  }
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / dailyReturns.length
  const volatility = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR)

  // Maximum drawdown: deepest peak-to-trough decline.
  let peak = points[0]?.nav ?? 0
  let peakT = points[0]?.t ?? 0
  let maxDd = 0
  let ddPeakT = peakT
  let ddTroughT = peakT
  for (const point of points) {
    if (point.nav > peak) {
      peak = point.nav
      peakT = point.t
    }
    const dd = peak > 0 ? (peak - point.nav) / peak : 0
    if (dd > maxDd) {
      maxDd = dd
      ddPeakT = peakT
      ddTroughT = point.t
    }
  }

  const sharpe = volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0
  return {
    label,
    start: dateOf(first.t),
    end: dateOf(last.t),
    days: points.length,
    periodReturnPct: round4(periodReturn * 100),
    annualizedReturnPct: round4(annualizedReturn * 100),
    volatilityPct: round4(volatility * 100),
    maxDrawdownPct: round4(maxDd * 100),
    maxDrawdownPeak: dateOf(ddPeakT),
    maxDrawdownTrough: dateOf(ddTroughT),
    sharpe: round4(sharpe),
  }
}

/** A named computation window: 成立以来 / 近3年 / 近1年. */
export interface WindowSpec {
  label: string
  /** Calendar days back from the latest point; `null` means full history. */
  lookbackDays: number | null
}

/** The standard decomposition windows. */
export const STANDARD_WINDOWS: readonly WindowSpec[] = [
  { label: '成立以来', lookbackDays: null },
  { label: '近3年', lookbackDays: 3 * CALENDAR_DAYS_PER_YEAR },
  { label: '近1年', lookbackDays: CALENDAR_DAYS_PER_YEAR },
]

/**
 * Decompose one NAV series into the standard windows. A window whose lookback
 * covers the whole history collapses into the full-history window (no
 * duplicate rows); a window with fewer than 2 points is skipped.
 * @param navTrend - the full daily NAV series, oldest first.
 * @param riskFreeRate - annual risk-free rate (fraction).
 * @param windows - window specs (defaults to {@link STANDARD_WINDOWS}).
 * @returns the per-window metrics in spec order.
 */
export function decomposePerformance(
  navTrend: readonly NavPoint[],
  riskFreeRate: number,
  windows: readonly WindowSpec[] = STANDARD_WINDOWS,
): WindowMetrics[] {
  if (navTrend.length < 2) throw new Error(`performance decomposition needs at least 2 NAV points, got ${navTrend.length}`)
  const latest = navTrend[navTrend.length - 1]
  if (latest === undefined) throw new Error('empty NAV series')
  const results: WindowMetrics[] = []
  const seenRanges = new Set<string>()
  for (const spec of windows) {
    const points = spec.lookbackDays === null
      ? navTrend
      : navTrend.filter(point => point.t >= latest.t - spec.lookbackDays! * DAY_MS)
    if (points.length < 2) continue
    const first = points[0]
    if (first === undefined) continue
    const rangeKey = `${first.t}:${latest.t}`
    if (seenRanges.has(rangeKey)) continue
    seenRanges.add(rangeKey)
    results.push(windowMetrics(points, spec.label, riskFreeRate))
  }
  return results
}
