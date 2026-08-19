/**
 * Parser suite over the saved real-response fixtures: the pingzhongdata JS
 * block, the F10 holdings (jjcc) and manager (jjjl) pages, and the push2 quote
 * payload — plus loud-failure behavior on structural drift. No network.
 * @module dsh-fund-research/test/parser.spec
 */

import { describe, expect, it } from 'vitest'
import {
  extractVar,
  parseHoldingsPage,
  parseManagerPage,
  parsePingzhongdata,
  parseQuote,
  secidOf,
  sha256Of,
  SourceParseError,
} from '../src/sources/eastmoney.ts'
import { FIXTURE_CODE, loadFixtures } from './fixtures.ts'

describe('extractVar', () => {
  it('extracts scalar, array, and object assignments without evaluating code', () => {
    const src = 'var a = "x;y";var b=[1,2,{"k":"v;"}];var c = {"n":[1;2]};'
    // The malformed `c` assignment is intentionally absent from assertions.
    expect(extractVar(src, 'a')).toBe('"x;y"')
    expect(extractVar(src, 'b')).toBe('[1,2,{"k":"v;"}]')
  })

  it('returns null for an absent variable', () => {
    expect(extractVar('var a=1;', 'missing')).toBeNull()
  })
})

describe('parsePingzhongdata', () => {
  it('parses the real 161725 payload into the raw sections', async () => {
    const fixtures = await loadFixtures()
    const parsed = parsePingzhongdata(fixtures.pingzhongdata, FIXTURE_CODE)
    expect(parsed.name).toContain('招商中证白酒')
    expect(parsed.fees.rate).toBe('0.10')
    expect(parsed.returns.year1).toBe('-27.27')
    expect(parsed.returns.month1).toBe('5.58')
    expect(parsed.returns.month6).toBe('-20.18')
    expect(parsed.navTrend.length).toBeGreaterThan(2000)
    const first = parsed.navTrend[0]
    expect(first).toMatchObject({ nav: 1.0 })
    const last = parsed.navTrend[parsed.navTrend.length - 1]
    expect(last?.nav).toBeGreaterThan(0)
    expect(parsed.manager.name).toBe('侯昊')
    expect(parsed.manager.star).toBe(5)
    expect(parsed.manager.profitCategories).toEqual(['任期收益', '同类平均', '沪深300'])
    expect(parsed.manager.profitValues).toHaveLength(3)
    expect(parsed.performanceEvaluation.categories).toContain('收益率')
    expect(parsed.scaleHistory.dates.length).toBeGreaterThan(0)
    expect(parsed.scaleHistory.values.length).toBe(parsed.scaleHistory.dates.length)
    expect(parsed.assetAllocation.stockPct.length).toBeGreaterThan(0)
  })

  it('fails loud naming the field when a required variable is missing', async () => {
    const fixtures = await loadFixtures()
    const broken = fixtures.pingzhongdata.replace('var Data_netWorthTrend', 'var Data_netWorthTrend_RENAMED')
    expect(() => parsePingzhongdata(broken, FIXTURE_CODE)).toThrowError(SourceParseError)
    expect(() => parsePingzhongdata(broken, FIXTURE_CODE)).toThrowError(/Data_netWorthTrend/u)
  })

  it('never evaluates remote code: a payload with an expression is rejected as non-JSON', () => {
    expect(() => parsePingzhongdata('var fS_name = (()=>{throw 1})();', '000000')).toThrowError(SourceParseError)
  })
})

describe('parseHoldingsPage', () => {
  it('parses current and previous quarter top-10 rows', async () => {
    const fixtures = await loadFixtures()
    const detail = parseHoldingsPage(fixtures.holdings, FIXTURE_CODE)
    expect(detail.asOf).toBe('2026-06-30')
    expect(detail.rows).toHaveLength(10)
    const first = detail.rows[0]
    expect(first).toMatchObject({ rank: 1, code: '600519', name: '贵州茅台', navPct: 17.28 })
    expect(detail.previousAsOf).toBe('2026-03-31')
    expect(detail.previousRows.length).toBeGreaterThan(0)
  })

  it('fails loud when the content wrapper drifts', () => {
    expect(() => parseHoldingsPage('var apidata={ contentx:"" }', FIXTURE_CODE)).toThrowError(/content/u)
  })
})

describe('parseManagerPage', () => {
  it('parses tenure rows and managed funds', async () => {
    const fixtures = await loadFixtures()
    const history = parseManagerPage(fixtures.managerPage, FIXTURE_CODE)
    expect(history.tenures.length).toBeGreaterThan(0)
    const current = history.tenures[0]
    expect(current?.end).toBeNull()
    expect(current?.managers).toContain('侯昊')
    expect(current?.returnPct).toBeCloseTo(56.04, 2)
    expect(history.managedFunds.length).toBeGreaterThan(5)
    const fund = history.managedFunds[0]
    expect(fund?.peerTotal).toBeGreaterThan(0)
    expect(fund?.peerRank).toBeGreaterThan(0)
  })
})

describe('parseQuote', () => {
  it('descales PE/PB by 100 and keeps the market cap in yuan', async () => {
    const fixtures = await loadFixtures()
    const quote = parseQuote(fixtures.quotes['1.600519'] ?? '', '1.600519')
    expect(quote.name).toBe('贵州茅台')
    expect(quote.totalMarketCap).toBeGreaterThan(1e12)
    expect(quote.peDynamic).toBeCloseTo(18.36, 2)
    expect(quote.pb).toBeCloseTo(6.51, 2)
  })

  it('fails loud on a missing market cap', () => {
    expect(() => parseQuote('{"rc":0,"data":{}}', '1.600519')).toThrowError(/market cap/u)
  })
})

describe('secidOf', () => {
  it('maps Shanghai and Shenzhen codes', () => {
    expect(secidOf('600519')).toBe('1.600519')
    expect(secidOf('000568')).toBe('0.000568')
    expect(secidOf('300750')).toBe('0.300750')
  })
})

describe('sha256Of', () => {
  it('is stable for identical bytes', () => {
    expect(sha256Of('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
