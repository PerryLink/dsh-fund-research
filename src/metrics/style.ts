/**
 * Simplified size-value style attribution over the top-10 holdings. Size uses
 * total market capitalization against fixed bands plus a within-holdings
 * quintile rank (1 = largest); valuation uses the dynamic PE against fixed
 * bands. Both band systems are fixed estimation口径 (no full-market
 * distribution is consulted) and the report labels them as such. Pure
 * functions.
 * @module dsh-fund-research/metrics/style
 */

import type { HoldingRow, QuoteMap, StyleMetrics, StyleRow } from '../model.ts'
import { round4 } from './performance.ts'

/** Absolute size bands on total market cap (亿元): 大盘 ≥ 1000, 中盘 300-1000, 小盘 < 300. */
export const SIZE_BANDS = [
  { label: '大盘', minYi: 1000 },
  { label: '中盘', minYi: 300 },
  { label: '小盘', minYi: 0 },
] as const

/** Valuation bands on dynamic PE: 深度价值 < 15, 价值 15-25, 均衡 25-40, 成长 ≥ 40. */
export const VALUE_BANDS = [
  { label: '深度价值', maxPe: 15 },
  { label: '价值', maxPe: 25 },
  { label: '均衡', maxPe: 40 },
  { label: '成长', maxPe: Number.POSITIVE_INFINITY },
] as const

/** One hundred million yuan — the market-cap display unit (亿元). */
export const YI_YUAN = 100_000_000

/** Classify one market cap (yuan) into an absolute size band. */
export function sizeBandOf(totalMarketCap: number): string {
  const yi = totalMarketCap / YI_YUAN
  for (const band of SIZE_BANDS) {
    if (yi >= band.minYi) return band.label
  }
  return SIZE_BANDS[SIZE_BANDS.length - 1]?.label ?? '小盘'
}

/** Classify one dynamic PE into a valuation band. */
export function valueBandOf(peDynamic: number): string {
  for (const band of VALUE_BANDS) {
    if (peDynamic < band.maxPe) return band.label
  }
  return VALUE_BANDS[VALUE_BANDS.length - 1]?.label ?? '成长'
}

/**
 * Attribute the fund's style over the quoted top-10 holdings. Holdings without
 * a quote are excluded from the rows and counted in the coverage string.
 * @param holdings - current-quarter top-10 rows.
 * @param quotes - per-stock valuation quotes keyed by secid.
 * @param secidOf - code → secid mapping (injected for tests).
 * @returns the style metrics.
 */
export function styleMetrics(
  holdings: readonly HoldingRow[],
  quotes: QuoteMap,
  secidOf: (code: string) => string,
): StyleMetrics {
  const quoted: { holding: HoldingRow, quote: QuoteMap['rows'][string] }[] = []
  for (const holding of holdings) {
    const quote = quotes.rows[secidOf(holding.code)]
    if (quote !== undefined) quoted.push({ holding, quote })
  }

  // Within-holdings size quintiles: rank by market cap descending, then bucket
  // the ranking into five slices (ties share the lower quintile by rank).
  const byCapDesc = [...quoted].sort((a, b) => b.quote.totalMarketCap - a.quote.totalMarketCap)
  const quintileOf = new Map<string, number>()
  byCapDesc.forEach((entry, index) => {
    const quintile = Math.min(5, Math.floor((index * 5) / Math.max(1, byCapDesc.length)) + 1)
    quintileOf.set(entry.holding.code, quintile)
  })

  const rows: StyleRow[] = quoted.map(({ holding, quote }) => ({
    code: holding.code,
    name: holding.name,
    navPct: holding.navPct,
    marketCapYi: round4(quote.totalMarketCap / YI_YUAN),
    sizeBand: sizeBandOf(quote.totalMarketCap),
    sizeQuintile: quintileOf.get(holding.code) ?? 5,
    valueBand: valueBandOf(quote.peDynamic),
    peDynamic: round4(quote.peDynamic),
    pb: round4(quote.pb),
  }))

  const sizeDistribution: Record<string, number> = {}
  const valueDistribution: Record<string, number> = {}
  for (const row of rows) {
    sizeDistribution[row.sizeBand] = round4((sizeDistribution[row.sizeBand] ?? 0) + row.navPct)
    valueDistribution[row.valueBand] = round4((valueDistribution[row.valueBand] ?? 0) + row.navPct)
  }

  return {
    rows,
    sizeDistribution,
    valueDistribution,
    coverage: `${rows.length}/${holdings.length}`,
  }
}
