/**
 * Minimal walk-forward out-of-sample stability summary over the daily NAV
 * series: deterministic rolling-window statistics (window count, sign
 * persistence of in-window return and Sharpe, and the mean/std of both) — pure
 * math over the sealed snapshot, zero network and zero model. The rendered
 * section declares it is statistical description only, never a prediction.
 * @module dsh-fund-research/walkforward
 */

import type { NavPoint } from './model.ts'
import { CALENDAR_DAYS_PER_YEAR, round4, TRADING_DAYS_PER_YEAR } from './metrics/performance.ts'

/** Fixed rolling-window length in trading days (methodology constant, not a deployment tunable). */
export const WALK_FORWARD_WINDOW_DAYS = 20

/** One calendar day in milliseconds. */
const DAY_MS = 86_400_000

/** The walk-forward summary (minimal form). */
export interface WalkForwardSummary {
  /** Number of rolling windows evaluated. */
  windowCount: number
  /** Window length in trading days. */
  windowSize: number
  /** Fraction of windows with a positive in-window return (0..1). */
  returnSignPersistence: number
  /** Fraction of windows with a positive Sharpe ratio (0..1). */
  sharpeSignPersistence: number
  /** Mean of in-window returns (%). */
  returnMeanPct: number
  /** Standard deviation of in-window returns (%). */
  returnStdPct: number
  /** Mean of in-window Sharpe ratios. */
  sharpeMean: number
  /** Standard deviation of in-window Sharpe ratios. */
  sharpeStd: number
}

/** Mean over an array of numbers. */
function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Population standard deviation over an array of numbers. */
function std(values: readonly number[]): number {
  const average = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
}

/** Per-window return and Sharpe using the same conventions as the performance decomposition. */
function windowReturnSharpe(points: readonly NavPoint[], riskFreeRate: number): { periodReturn: number, sharpe: number } {
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined || first.nav <= 0) {
    return { periodReturn: 0, sharpe: 0 }
  }
  const periodReturn = last.nav / first.nav - 1
  const calendarDays = Math.max(1, Math.round((last.t - first.t) / DAY_MS))
  const annualizedReturn = (1 + periodReturn) ** (CALENDAR_DAYS_PER_YEAR / calendarDays) - 1

  const dailyReturns: number[] = []
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]
    const current = points[i]
    if (previous === undefined || current === undefined || previous.nav <= 0) continue
    dailyReturns.push(current.nav / previous.nav - 1)
  }
  const dailyMean = mean(dailyReturns)
  const variance = dailyReturns.reduce((sum, value) => sum + (value - dailyMean) ** 2, 0) / dailyReturns.length
  const volatility = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR)
  const sharpe = volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0
  return { periodReturn, sharpe }
}

/**
 * Compute the rolling walk-forward summary. Returns `null` (a gap) when the
 * series is shorter than the window.
 * @param navTrend - the daily NAV series, oldest first.
 * @param riskFreeRate - annual risk-free rate for the Sharpe ratio.
 * @param windowSize - rolling window length in trading days (defaults to {@link WALK_FORWARD_WINDOW_DAYS}).
 * @returns the summary, or `null` when insufficient.
 */
export function walkForwardSummary(
  navTrend: readonly NavPoint[],
  riskFreeRate: number,
  windowSize: number = WALK_FORWARD_WINDOW_DAYS,
): WalkForwardSummary | null {
  const windowCount = navTrend.length - windowSize + 1
  if (windowCount < 1) return null

  const returns: number[] = []
  const sharpes: number[] = []
  for (let start = 0; start < windowCount; start++) {
    const window = navTrend.slice(start, start + windowSize)
    const stats = windowReturnSharpe(window, riskFreeRate)
    returns.push(stats.periodReturn)
    sharpes.push(stats.sharpe)
  }

  const positive = (values: readonly number[]): number => values.filter(value => value > 0).length
  return {
    windowCount,
    windowSize,
    returnSignPersistence: round4(positive(returns) / returns.length),
    sharpeSignPersistence: round4(positive(sharpes) / sharpes.length),
    returnMeanPct: round4(mean(returns) * 100),
    returnStdPct: round4(std(returns) * 100),
    sharpeMean: round4(mean(sharpes)),
    sharpeStd: round4(std(sharpes)),
  }
}

/** Render the 样本外稳定性摘要 section; a `null` summary is a declared gap. */
export function renderWalkForwardSection(summary: WalkForwardSummary | null): string {
  const lines = ['## 样本外稳定性摘要（walk-forward，最小形态）', '']
  if (summary === null) {
    lines.push(`**数据缺口**：净值序列不足 ${WALK_FORWARD_WINDOW_DAYS} 个交易日，不足以构成滚动窗口，本版不产出样本外稳定性摘要，不编造。`)
    lines.push('', '> 仅供研究参考，不构成投资建议。')
    return lines.join('\n')
  }
  lines.push(
    `对净值序列做 ${summary.windowCount} 个滚动窗口（窗口 ${summary.windowSize} 个交易日、步长 1）的确定性统计：`,
    '',
    `- 区间收益符号持续率：**${summary.returnSignPersistence}**（正收益窗口占比，0–1）`,
    `- 夏普符号持续率：**${summary.sharpeSignPersistence}**（正夏普窗口占比，0–1）`,
    `- 窗口区间收益：均值 **${summary.returnMeanPct}%**，标准差 ${summary.returnStdPct}%`,
    `- 窗口夏普：均值 **${summary.sharpeMean}**，标准差 ${summary.sharpeStd}`,
    '',
    '> 本摘要仅为历史数据的确定性统计描述，不构成对未来的任何预测或收益保证。',
    '> 仅供研究参考，不构成投资建议。',
  )
  return lines.join('\n')
}
