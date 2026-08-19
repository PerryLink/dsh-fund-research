/**
 * Deterministic holdings-penetration metrics over the F10 top-10 holdings:
 * aggregate concentration (top-3/top-10), the Herfindahl-Hirschman index,
 * industry distribution from a replaceable local code→industry mapping, and
 * the quarter-over-quarter top-10 comparison. Pure functions.
 * @module dsh-fund-research/metrics/holdings
 */

import type { HoldingRow, HoldingsMetrics } from '../model.ts'
import { round4 } from './performance.ts'

/**
 * Built-in stock-code → industry mapping for the liquor-sector sample and a
 * small set of common A-share names. The mapping is deliberately a plain
 * replaceable data table: extend or replace it via the plugin's data file.
 * Codes absent from the table classify as `未映射`.
 */
export const BUILTIN_INDUSTRY_MAP: Readonly<Record<string, string>> = {
  // 白酒（161725 样本持仓）
  '600519': '白酒', '600809': '白酒', '000568': '白酒', '000858': '白酒', '002304': '白酒',
  '000596': '白酒', '603369': '白酒', '603198': '白酒', '000799': '白酒', '600702': '白酒',
  '600559': '白酒', '603589': '白酒', '600779': '白酒', '000860': '白酒', '603919': '白酒',
  '600197': '白酒', '000752': '白酒', '600600': '啤酒', '600132': '啤酒', '000729': '啤酒',
  // 常见金融/消费/科技（占位小表，用户可整体替换）
  '601318': '保险', '600036': '银行', '601166': '银行', '600030': '证券', '300059': '证券',
  '000001': '银行', '601888': '旅游免税', '600276': '医药', '300760': '医疗器械',
  '000333': '家电', '600690': '家电', '002415': '电子', '300750': '电池', '601012': '光伏',
  '002594': '汽车', '600900': '电力', '601899': '有色金属', '600585': '建材',
}

/** The industry label used for unmapped codes. */
export const UNMAPPED_INDUSTRY = '未映射'

/**
 * Compute concentration and distribution metrics over the current top-10.
 * @param rows - current-quarter holding rows (any order).
 * @param previousRows - previous-quarter rows (empty when unavailable).
 * @param industryMap - code → industry mapping (defaults to {@link BUILTIN_INDUSTRY_MAP}).
 * @returns the holdings metrics.
 */
export function holdingsMetrics(
  rows: readonly HoldingRow[],
  previousRows: readonly HoldingRow[],
  industryMap: Readonly<Record<string, string>> = BUILTIN_INDUSTRY_MAP,
): HoldingsMetrics {
  if (rows.length === 0) throw new Error('holdings metrics need at least 1 holding row')
  const sorted = [...rows].sort((a, b) => a.rank - b.rank)
  const top3Pct = round4(sorted.slice(0, 3).reduce((sum, row) => sum + row.navPct, 0))
  const top10Pct = round4(sorted.reduce((sum, row) => sum + row.navPct, 0))
  const hhi = round4(sorted.reduce((sum, row) => sum + row.navPct ** 2, 0))

  const industryPct: Record<string, number> = {}
  for (const row of sorted) {
    const industry = industryMap[row.code] ?? UNMAPPED_INDUSTRY
    industryPct[industry] = round4((industryPct[industry] ?? 0) + row.navPct)
  }

  const quarterCompare = previousRows.length === 0
    ? null
    : (() => {
        const current = new Set(sorted.map(row => row.code))
        const previous = new Set(previousRows.map(row => row.code))
        return {
          kept: [...current].filter(code => previous.has(code)).sort(),
          added: [...current].filter(code => !previous.has(code)).sort(),
          removed: [...previous].filter(code => !current.has(code)).sort(),
        }
      })()

  return { top3Pct, top10Pct, hhi, industryPct, quarterCompare }
}
