/**
 * Walk-forward stability suite: the pure rolling-window math (window count,
 * sign persistence, mean/std), the insufficient-series gap, the all-positive /
 * all-negative boundary cases, and the statistical-description disclaimer in
 * the rendered section. No network, no harness — pure functions over synthetic
 * NAV series.
 * @module dsh-fund-research/test/walkforward.spec
 */

import { describe, expect, it } from 'vitest'
import type { NavPoint } from '../src/model.ts'
import { renderWalkForwardSection, walkForwardSummary, WALK_FORWARD_WINDOW_DAYS } from '../src/walkforward.ts'

const DAY = 86_400_000

/** Build a daily NAV series from per-day returns (fractions). */
function series(dailyReturns: readonly number[], startT = 1_700_000_000_000): NavPoint[] {
  const points: NavPoint[] = [{ t: startT, nav: 1, dailyReturn: 0 }]
  for (const r of dailyReturns) {
    const prev = points[points.length - 1]
    if (prev === undefined) break
    points.push({ t: prev.t + DAY, nav: prev.nav * (1 + r), dailyReturn: r * 100 })
  }
  return points
}

describe('walkForwardSummary', () => {
  it('returns null (a gap) when the series is shorter than the window', () => {
    const navTrend = series(Array.from({ length: WALK_FORWARD_WINDOW_DAYS - 2 }, () => 0.001))
    expect(walkForwardSummary(navTrend, 0.02)).toBeNull()
  })

  it('computes full positive sign persistence for an up-trending series', () => {
    const navTrend = series(Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 0.01 : 0.02)))
    const summary = walkForwardSummary(navTrend, 0.02)
    expect(summary).not.toBeNull()
    expect(summary?.windowCount).toBe(navTrend.length - WALK_FORWARD_WINDOW_DAYS + 1)
    expect(summary?.windowSize).toBe(WALK_FORWARD_WINDOW_DAYS)
    expect(summary?.returnSignPersistence).toBe(1)
    expect(summary?.sharpeSignPersistence).toBe(1)
  })

  it('computes zero sign persistence for a down-trending series', () => {
    const navTrend = series(Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? -0.01 : -0.02)))
    const summary = walkForwardSummary(navTrend, 0.02)
    expect(summary?.returnSignPersistence).toBe(0)
    expect(summary?.sharpeSignPersistence).toBe(0)
    expect(summary?.returnMeanPct).toBeLessThan(0)
  })
})

describe('renderWalkForwardSection', () => {
  it('declares a gap and the disclaimer when the summary is null', () => {
    const markdown = renderWalkForwardSection(null)
    expect(markdown).toContain('## 样本外稳定性摘要')
    expect(markdown).toContain('数据缺口')
    expect(markdown).toContain('不构成投资建议')
  })

  it('renders the stats with the statistical-description (non-prediction) disclaimer', () => {
    const summary = walkForwardSummary(series(Array.from({ length: 40 }, () => 0.01)), 0.02)
    expect(summary).not.toBeNull()
    const markdown = renderWalkForwardSection(summary)
    expect(markdown).toContain('符号持续率')
    expect(markdown).toContain('均值')
    expect(markdown).toContain('不构成对未来的任何预测')
    expect(markdown).toContain('不构成投资建议')
  })
})
