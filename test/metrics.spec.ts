/**
 * Deterministic metrics suite: hand-computed positive and negative cases for
 * the performance decomposition, holdings penetration, style attribution, and
 * manager profile. Pure functions, no I/O.
 * @module dsh-fund-research/test/metrics.spec
 */

import { describe, expect, it } from 'vitest'
import type { HoldingRow, ManagerHistory, ManagerSummary, NavPoint, QuoteMap } from '../src/model.ts'
import { decomposePerformance, windowMetrics, TRADING_DAYS_PER_YEAR, CALENDAR_DAYS_PER_YEAR } from '../src/metrics/performance.ts'
import { holdingsMetrics, UNMAPPED_INDUSTRY } from '../src/metrics/holdings.ts'
import { sizeBandOf, styleMetrics, valueBandOf, YI_YUAN } from '../src/metrics/style.ts'
import { managerMetrics } from '../src/metrics/manager.ts'

const DAY = 86_400_000

/** Build a daily NAV series from per-day returns (fractions). */
function seriesFromReturns(returns: readonly number[], startT = 1_700_000_000_000): NavPoint[] {
  const points: NavPoint[] = [{ t: startT, nav: 1, dailyReturn: 0 }]
  for (const r of returns) {
    const prev = points[points.length - 1]
    if (prev === undefined) break
    points.push({ t: prev.t + DAY, nav: prev.nav * (1 + r), dailyReturn: r * 100 })
  }
  return points
}

describe('windowMetrics', () => {
  it('computes a simple up-then-down window by hand', () => {
    // +10% then -10%: period return = 1.1*0.9-1 = -1%.
    const points = seriesFromReturns([0.1, -0.1])
    const m = windowMetrics(points, 'test', 0.02)
    expect(m.periodReturnPct).toBeCloseTo(-1, 4)
    expect(m.days).toBe(3)
    // Max drawdown: from peak 1.1 to 0.99 → 10%.
    expect(m.maxDrawdownPct).toBeCloseTo(10, 4)
  })

  it('computes volatility by hand for a two-return window', () => {
    // returns +1% and -1%: mean 0, variance = (0.01^2+0.01^2)/2 = 1e-4, daily sd = 0.01.
    const points = seriesFromReturns([0.01, -0.01])
    const m = windowMetrics(points, 'vol', 0.02)
    expect(m.volatilityPct).toBeCloseTo(0.01 * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100, 4)
  })

  it('annualizes with calendar days', () => {
    // One day +1%: annualized = 1.01^365 - 1.
    const points = seriesFromReturns([0.01])
    const m = windowMetrics(points, 'ann', 0.02)
    expect(m.annualizedReturnPct).toBeCloseTo(((1.01 ** CALENDAR_DAYS_PER_YEAR) - 1) * 100, 2)
  })

  it('throws on fewer than two points', () => {
    expect(() => windowMetrics([{ t: 1, nav: 1, dailyReturn: 0 }], 'x', 0.02)).toThrow(/at least 2/u)
  })

  it('tracks drawdown peak and trough dates', () => {
    const points = seriesFromReturns([0.2, -0.3, 0.05])
    const m = windowMetrics(points, 'dd', 0.02)
    expect(m.maxDrawdownPeak < m.maxDrawdownTrough).toBe(true)
    expect(m.maxDrawdownPct).toBeCloseTo(30, 4)
  })
})

describe('decomposePerformance', () => {
  it('collapses windows shorter than the history into distinct rows', () => {
    // 1200 days of +0.05%/day: 近1年 ⊂ 近3年 ⊂ 成立以来 — three distinct ranges.
    const points = seriesFromReturns(Array.from({ length: 1200 }, () => 0.0005))
    const windows = decomposePerformance(points, 0.02)
    expect(windows.map(w => w.label)).toEqual(['成立以来', '近3年', '近1年'])
    const y1 = windows.find(w => w.label === '近1年')
    expect(y1?.days).toBeLessThanOrEqual(367)
    expect(y1?.periodReturnPct).toBeGreaterThan(0)
  })

  it('skips duplicate ranges when history is shorter than a lookback', () => {
    // 400 days: the 近3年 range equals 成立以来 → collapsed; 近1年 is distinct.
    const points = seriesFromReturns(Array.from({ length: 400 }, () => 0.001))
    const windows = decomposePerformance(points, 0.02)
    expect(windows.map(w => w.label)).toEqual(['成立以来', '近1年'])
  })

  it('collapses every lookback when history is shorter than 近1年', () => {
    // 100 days: 近3年 and 近1年 both cover the full history → only 成立以来 remains.
    const points = seriesFromReturns(Array.from({ length: 100 }, () => 0.001))
    const windows = decomposePerformance(points, 0.02)
    expect(windows.map(w => w.label)).toEqual(['成立以来'])
  })

  it('throws on an empty series', () => {
    expect(() => decomposePerformance([], 0.02)).toThrow(/at least 2/u)
  })
})

/** One holding row factory. */
function holding(rank: number, code: string, navPct: number): HoldingRow {
  return { rank, code, name: `S${code}`, navPct, shares10k: 1, marketValue10k: 1 }
}

describe('holdingsMetrics', () => {
  it('computes top-3/top-10 concentration and HHI by hand', () => {
    const rows = [holding(1, '600519', 20), holding(2, '600809', 15), holding(3, '000568', 10), holding(4, '999999', 5)]
    const m = holdingsMetrics(rows, [])
    expect(m.top3Pct).toBe(45)
    expect(m.top10Pct).toBe(50)
    expect(m.hhi).toBe(20 * 20 + 15 * 15 + 10 * 10 + 5 * 5)
    expect(m.industryPct['白酒']).toBe(45)
    expect(m.industryPct[UNMAPPED_INDUSTRY]).toBe(5)
    expect(m.quarterCompare).toBeNull()
  })

  it('computes the quarter-over-quarter comparison', () => {
    const current = [holding(1, '600519', 20), holding(2, '600809', 15)]
    const previous = [holding(1, '600519', 18), holding(2, '000568', 12)]
    const m = holdingsMetrics(current, previous)
    expect(m.quarterCompare).toEqual({ kept: ['600519'], added: ['600809'], removed: ['000568'] })
  })

  it('throws on empty holdings', () => {
    expect(() => holdingsMetrics([], [])).toThrow(/at least 1/u)
  })
})

describe('style bands', () => {
  it('classifies size bands on fixed thresholds', () => {
    expect(sizeBandOf(2000 * YI_YUAN)).toBe('大盘')
    expect(sizeBandOf(500 * YI_YUAN)).toBe('中盘')
    expect(sizeBandOf(100 * YI_YUAN)).toBe('小盘')
  })

  it('classifies valuation bands on dynamic PE', () => {
    expect(valueBandOf(10)).toBe('深度价值')
    expect(valueBandOf(20)).toBe('价值')
    expect(valueBandOf(30)).toBe('均衡')
    expect(valueBandOf(50)).toBe('成长')
  })
})

describe('styleMetrics', () => {
  it('weights distributions by navPct and ranks quintiles within holdings', () => {
    const rows = [holding(1, '600519', 30), holding(2, '600809', 10)]
    const quotes: QuoteMap = {
      fetchedAt: 0,
      rows: {
        '1.600519': { code: '600519', name: 'S600519', totalMarketCap: 2000 * YI_YUAN, peDynamic: 18, pb: 6 },
        '1.600809': { code: '600809', name: 'S600809', totalMarketCap: 100 * YI_YUAN, peDynamic: 45, pb: 2 },
      },
    }
    const m = styleMetrics(rows, quotes, code => `1.${code}`)
    expect(m.coverage).toBe('2/2')
    expect(m.sizeDistribution).toEqual({ 大盘: 30, 小盘: 10 })
    expect(m.valueDistribution).toEqual({ 价值: 30, 成长: 10 })
    const big = m.rows.find(row => row.code === '600519')
    expect(big?.sizeQuintile).toBe(1)
    const small = m.rows.find(row => row.code === '600809')
    expect(small?.sizeQuintile).toBe(3)
  })

  it('excludes unquoted holdings from rows but keeps them in coverage', () => {
    const rows = [holding(1, '600519', 30), holding(2, '600809', 10)]
    const quotes: QuoteMap = {
      fetchedAt: 0,
      rows: {
        '1.600519': { code: '600519', name: 'S600519', totalMarketCap: 2000 * YI_YUAN, peDynamic: 18, pb: 6 },
      },
    }
    const m = styleMetrics(rows, quotes, code => `1.${code}`)
    expect(m.rows).toHaveLength(1)
    expect(m.coverage).toBe('1/2')
  })
})

/** One manager summary factory. */
function summary(): ManagerSummary {
  return {
    name: 'M', star: 5, workTime: '8年', fundSize: '100亿(2只基金)',
    powerAvr: '80.0', powerCategories: ['经验值'], powerData: [88], powerAsOf: '2026-08-18',
    profitCategories: ['任期收益', '同类平均'], profitValues: [55, 87], profitAsOf: '2026-08-18',
  }
}

describe('managerMetrics', () => {
  it('folds tenure facts and the beat-peer count', () => {
    const history: ManagerHistory = {
      tenures: [{ start: '2017-09-05', end: null, managers: ['M'], durationText: '8年又350天', returnPct: 56.04 }],
      managedFunds: [
        { code: '000001', name: 'A', fundType: '指数-股票', start: '2020-01-01', end: null, durationText: '1年', returnPct: 10, peerAvgPct: 5, peerRank: 1, peerTotal: 100 },
        { code: '000002', name: 'B', fundType: '指数-股票', start: '2020-01-01', end: null, durationText: '1年', returnPct: 1, peerAvgPct: 5, peerRank: 90, peerTotal: 100 },
      ],
    }
    const m = managerMetrics(summary(), history)
    expect(m.tenureStart).toBe('2017-09-05')
    expect(m.tenureReturnPct).toBe(56.04)
    expect(m.managedFundCount).toBe(2)
    expect(m.beatPeerCount).toBe(1)
    expect(m.profitComparison).toEqual([{ label: '任期收益', valuePct: 55 }, { label: '同类平均', valuePct: 87 }])
  })

  it('keeps history fields null when the history source is a gap', () => {
    const m = managerMetrics(summary(), null)
    expect(m.tenureStart).toBeNull()
    expect(m.tenureReturnPct).toBeNull()
    expect(m.managedFundCount).toBeNull()
    expect(m.beatPeerCount).toBeNull()
    expect(m.profitComparison).toHaveLength(2)
  })
})
