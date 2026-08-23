/**
 * Tiantian Fund (Eastmoney) public data source: polite HTTP collection plus
 * strict parsers for the `pingzhongdata` JS assignment block, the F10 holdings
 * (`jjcc`) and manager (`jjjl`) pages, and the push2 per-stock quote endpoint.
 * Parsers extract `var Data_*` assignments with a depth-aware scanner — remote
 * code is never evaluated — and fail loud naming the source and the field when
 * the upstream structure drifts.
 * @module dsh-fund-research/sources/eastmoney
 */

import { createHash } from 'node:crypto'
import type {
  FundRawData,
  FundFees,
  FundStageReturns,
  HoldingRow,
  HoldingsDetail,
  ManagedFundRow,
  ManagerHistory,
  ManagerSummary,
  NavPoint,
  PerformanceEvaluation,
  QuoteMap,
  ScaleHistory,
  AssetAllocation,
  SourceProvenance,
  StockQuote,
  TenureRow,
} from '../model.ts'

/** Browser identity required by the Tiantian Fund endpoints. */
export const COLLECTOR_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Referer: 'https://fund.eastmoney.com/',
} as const

/** HTTP pacing/timeout/retry policy for the collector. */
export interface FetchPolicy {
  /** Minimum gap between outbound requests in milliseconds. */
  requestIntervalMs: number
  /** Per-request timeout in milliseconds. */
  timeoutMs: number
  /** Retries per request with exponential backoff. */
  retries: number
}

/** A fetch failure that names the URL and the attempt budget. */
export class SourceFetchError extends Error {
  constructor(
    /** The URL that failed. */
    readonly url: string,
    message: string,
  ) {
    super(`source fetch failed for ${url}: ${message}`)
    this.name = 'SourceFetchError'
  }
}

/** A parser failure that names the source document and the missing/drifted field. */
export class SourceParseError extends Error {
  constructor(
    /** Logical source name (e.g. `pingzhongdata`). */
    readonly source: string,
    /** The field whose extraction failed. */
    readonly field: string,
    message: string,
  ) {
    super(`${source}: field ${field}: ${message}`)
    this.name = 'SourceParseError'
  }
}

/** SHA-256 (hex) of one text payload. */
export function sha256Of(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * Rate-limited fetch with timeout and exponential-backoff retries. The pacing
 * clock is module-level so every caller shares one polite schedule.
 */
export class PoliteFetcher {
  private nextSlotAt = 0

  /**
   * @param policy - pacing, timeout, and retry budget.
   * @param fetchImpl - fetch implementation (tests inject a stub).
   */
  constructor(
    private readonly policy: FetchPolicy,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /**
   * Fetch one URL as UTF-8 text, waiting out the shared pacing slot first.
   * @param url - the URL to fetch.
   * @param referer - the Referer header the endpoint expects.
   * @param signal - caller cancellation.
   * @returns the response text.
   */
  async fetchText(url: string, referer: string, signal?: AbortSignal): Promise<string> {
    const wait = this.nextSlotAt - Date.now()
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
    this.nextSlotAt = Date.now() + this.policy.requestIntervalMs

    let lastError: unknown
    for (let attempt = 0; attempt <= this.policy.retries; attempt++) {
      if (signal?.aborted === true) throw new SourceFetchError(url, 'cancelled by caller')
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** (attempt - 1)))
      try {
        const response = await this.fetchImpl(url, {
          headers: { ...COLLECTOR_HEADERS, Referer: referer },
          signal: signal ?? AbortSignal.timeout(this.policy.timeoutMs),
        })
        if (!response.ok) throw new SourceFetchError(url, `HTTP ${response.status}`)
        const buffer = Buffer.from(await response.arrayBuffer())
        return buffer.toString('utf8')
      } catch (error) {
        lastError = error
        if (error instanceof SourceFetchError && /cancelled/u.test(error.message)) throw error
      }
    }
    const detail = lastError instanceof Error ? lastError.message : String(lastError)
    throw new SourceFetchError(url, `exhausted ${this.policy.retries + 1} attempt(s): ${detail}`)
  }
}

/**
 * Extract the right-hand side of one `var NAME = ...;` assignment with a
 * depth-aware, string-aware scan. Never evaluates remote code.
 * @param src - the pingzhongdata payload text.
 * @param name - the variable name.
 * @returns the raw assignment text, or `null` when absent.
 */
export function extractVar(src: string, name: string): string | null {
  const start = src.indexOf(`var ${name}`)
  if (start === -1) return null
  const after = start + `var ${name}`.length
  // Tolerate `var NAME =` with arbitrary spacing.
  const eq = src.indexOf('=', after)
  if (eq === -1 || eq > after + 8) return null
  let depth = 0
  let inString = false
  let quote = ''
  for (let i = eq + 1; i < src.length; i++) {
    const ch = src[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === quote) inString = false
      continue
    }
    if (ch === '"' || ch === "'") { inString = true; quote = ch; continue }
    if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') depth--
    else if (ch === ';' && depth === 0) return src.slice(eq + 1, i).trim()
  }
  return null
}

/** Parse one extracted assignment as JSON, failing loud with source and field. */
function parseJsonVar<T>(source: string, field: string, raw: string | null): T {
  if (raw === null) throw new SourceParseError(source, field, 'assignment not found (upstream structure drift?)')
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    throw new SourceParseError(source, field, `not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Parse a required string-valued assignment (e.g. `var syl_1n = "5.58";`). */
function parseStringVar(source: string, field: string, raw: string | null): string {
  const value = parseJsonVar<unknown>(source, field, raw)
  if (typeof value !== 'string') throw new SourceParseError(source, field, `expected a string, got ${typeof value}`)
  return value
}

/** Shape of one `Data_netWorthTrend` entry as published. */
interface RawNavPoint { x: number, y: number, equityReturn: number }

/** Shape of `Data_currentFundManager[0]` as published. */
interface RawManager {
  name: string
  star: number
  workTime: string
  fundSize: string
  power: { avr: string, categories: string[], data: number[], jzrq: string }
  profit: { categories: string[], series: { data: { y: number }[] }[], jzrq: string }
}

/**
 * Parse the pingzhongdata payload into the raw snapshot sections.
 * @param text - the full `pingzhongdata/{code}.js` response text.
 * @param code - the fund code (used in error messages).
 * @returns the raw sections this source owns.
 */
export function parsePingzhongdata(text: string, code: string): {
  name: string
  fees: FundFees
  returns: FundStageReturns
  navTrend: NavPoint[]
  manager: ManagerSummary
  performanceEvaluation: PerformanceEvaluation
  scaleHistory: ScaleHistory
  assetAllocation: AssetAllocation
} {
  const source = `pingzhongdata(${code})`
  const name = parseStringVar(source, 'fS_name', extractVar(text, 'fS_name'))
  const fees: FundFees = {
    sourceRate: parseStringVar(source, 'fund_sourceRate', extractVar(text, 'fund_sourceRate')),
    rate: parseStringVar(source, 'fund_Rate', extractVar(text, 'fund_Rate')),
    minSubscription: parseStringVar(source, 'fund_minsg', extractVar(text, 'fund_minsg')),
  }
  const returns: FundStageReturns = {
    month1: parseStringVar(source, 'syl_1y', extractVar(text, 'syl_1y')),
    month3: parseStringVar(source, 'syl_3y', extractVar(text, 'syl_3y')),
    month6: parseStringVar(source, 'syl_6y', extractVar(text, 'syl_6y')),
    year1: parseStringVar(source, 'syl_1n', extractVar(text, 'syl_1n')),
  }
  const navRaw = parseJsonVar<RawNavPoint[]>(source, 'Data_netWorthTrend', extractVar(text, 'Data_netWorthTrend'))
  if (!Array.isArray(navRaw) || navRaw.length === 0) {
    throw new SourceParseError(source, 'Data_netWorthTrend', 'expected a non-empty array')
  }
  const navTrend: NavPoint[] = navRaw.map(point => ({
    t: point.x,
    nav: point.y,
    dailyReturn: typeof point.equityReturn === 'number' ? point.equityReturn : 0,
  }))

  const managers = parseJsonVar<RawManager[]>(source, 'Data_currentFundManager', extractVar(text, 'Data_currentFundManager'))
  const first = managers[0]
  if (first === undefined) throw new SourceParseError(source, 'Data_currentFundManager', 'no current manager entry')
  const manager: ManagerSummary = {
    name: first.name,
    star: first.star,
    workTime: first.workTime,
    fundSize: first.fundSize,
    powerAvr: first.power.avr,
    powerCategories: first.power.categories,
    powerData: first.power.data,
    powerAsOf: first.power.jzrq,
    profitCategories: first.profit.categories,
    profitValues: first.profit.series[0]?.data.map(entry => entry.y) ?? [],
    profitAsOf: first.profit.jzrq,
  }

  const evaluation = parseJsonVar<{ avr: string, categories: string[], data: number[] }>(
    source, 'Data_performanceEvaluation', extractVar(text, 'Data_performanceEvaluation'))
  const performanceEvaluation: PerformanceEvaluation = {
    avr: evaluation.avr,
    categories: evaluation.categories,
    data: evaluation.data,
  }

  const scale = parseJsonVar<{ categories: string[], series: { y: number }[] }>(
    source, 'Data_fluctuationScale', extractVar(text, 'Data_fluctuationScale'))
  const scaleHistory: ScaleHistory = {
    dates: scale.categories,
    values: scale.series.map(entry => entry.y),
  }

  const allocation = parseJsonVar<{ categories: string[], series: { name: string, data: number[] }[] }>(
    source, 'Data_assetAllocation', extractVar(text, 'Data_assetAllocation'))
  const seriesOf = (label: string): number[] => {
    const found = allocation.series.find(entry => entry.name === label)
    if (found === undefined) throw new SourceParseError(source, 'Data_assetAllocation', `series ${label} not found`)
    return found.data
  }
  const assetAllocation: AssetAllocation = {
    dates: allocation.categories,
    stockPct: seriesOf('股票占净比'),
    bondPct: seriesOf('债券占净比'),
    cashPct: seriesOf('现金占净比'),
    netAsset: seriesOf('净资产'),
  }

  return { name, fees, returns, navTrend, manager, performanceEvaluation, scaleHistory, assetAllocation }
}

/** Strip HTML tags and collapse whitespace; decode the entities these pages use. */
export function htmlText(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** Parse the percent text of a holdings/tenure cell ("17.28%") into a number. */
function parsePercent(text: string, source: string, field: string): number {
  const match = /^(-?\d+(?:\.\d+)?)%$/u.exec(text.trim())
  if (match === null) throw new SourceParseError(source, field, `expected a percent cell, got ${JSON.stringify(text)}`)
  return Number(match[1])
}

/** Parse a comma-grouped number cell ("540,874.95"). */
function parseGroupedNumber(text: string, source: string, field: string): number {
  const cleaned = text.trim().replace(/,/gu, '')
  if (!/^-?\d+(?:\.\d+)?$/u.test(cleaned)) {
    throw new SourceParseError(source, field, `expected a number cell, got ${JSON.stringify(text)}`)
  }
  return Number(cleaned)
}

/**
 * Parse the F10 `jjcc` holdings payload (`var apidata={ content:"..." }`).
 * The embedded HTML carries one section per quarter; the first is current.
 * @param text - the full response text.
 * @param code - the fund code (used in error messages).
 * @returns current and previous-quarter top holdings.
 */
export function parseHoldingsPage(text: string, code: string): HoldingsDetail {
  const source = `f10-jjcc(${code})`
  const contentMatch = /content:"([\s\S]*?)",arryear/u.exec(text)
  if (contentMatch === null || contentMatch[1] === undefined) {
    throw new SourceParseError(source, 'content', 'apidata content string not found (upstream structure drift?)')
  }
  const html = contentMatch[1].replace(/\\'/gu, "'").replace(/\\"/gu, '"').replace(/\\\//gu, '/')

  // Split into per-quarter boxes; each box starts with an <h4> header.
  const boxes = html.split(/<h4 class='t'>/u).slice(1)
  if (boxes.length === 0) throw new SourceParseError(source, 'sections', 'no quarterly holdings section found')

  const parseBox = (box: string): { asOf: string, rows: HoldingRow[] } => {
    const headerEnd = box.indexOf('</h4>')
    const header = htmlText(headerEnd === -1 ? box.slice(0, 400) : box.slice(0, headerEnd))
    const dateMatch = /(\d{4}-\d{2}-\d{2})/u.exec(header)
    if (dateMatch === null || dateMatch[1] === undefined) {
      throw new SourceParseError(source, 'asOf', `no 截止至 date in section header ${JSON.stringify(header.slice(0, 80))}`)
    }
    // Column layouts drift between quarters (the current quarter carries
    // 最新价/涨跌幅 span columns, earlier quarters do not), so map the columns
    // from this table's own thead instead of using fixed indices.
    const theadMatch = /<thead>([\s\S]*?)<\/thead>/u.exec(box)
    if (theadMatch === null || theadMatch[1] === undefined) {
      throw new SourceParseError(source, 'thead', 'holdings table header not found')
    }
    const headCells = [...theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gu)].map(cell => htmlText(cell[1] ?? ''))
    const columnOf = (label: string): number => {
      const index = headCells.findIndex(cell => cell.includes(label))
      if (index === -1) throw new SourceParseError(source, 'thead', `column ${label} not found in ${JSON.stringify(headCells)}`)
      return index
    }
    const codeCol = columnOf('股票代码')
    const nameCol = columnOf('股票名称')
    const pctCol = columnOf('占净值')
    const sharesCol = columnOf('持股数')
    const valueCol = columnOf('持仓市值')

    const rows: HoldingRow[] = []
    for (const rowMatch of box.matchAll(/<tr>([\s\S]*?)<\/tr>/gu)) {
      const cells = [...(rowMatch[1]?.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu) ?? [])].map(cell => cell[1] ?? '')
      if (cells.length < headCells.length) continue
      const rank = Number(htmlText(cells[0] ?? ''))
      if (!Number.isSafeInteger(rank) || rank <= 0) continue
      rows.push({
        rank,
        code: htmlText(cells[codeCol] ?? ''),
        name: htmlText(cells[nameCol] ?? ''),
        navPct: parsePercent(htmlText(cells[pctCol] ?? ''), source, `row ${rank} navPct`),
        shares10k: parseGroupedNumber(htmlText(cells[sharesCol] ?? ''), source, `row ${rank} shares`),
        marketValue10k: parseGroupedNumber(htmlText(cells[valueCol] ?? ''), source, `row ${rank} marketValue`),
      })
    }
    rows.sort((a, b) => a.rank - b.rank)
    return { asOf: dateMatch[1], rows }
  }

  const current = parseBox(boxes[0] ?? '')
  if (current.rows.length === 0) throw new SourceParseError(source, 'rows', 'current-quarter holdings table is empty')
  const previous = boxes.length > 1 ? parseBox(boxes[1] ?? '') : null
  return {
    asOf: current.asOf,
    rows: current.rows,
    previousAsOf: previous?.asOf ?? null,
    previousRows: previous?.rows ?? [],
  }
}

/** Parse one F10 manager-page table into rows of plain-text cells. */
function tableRows(tableHtml: string): string[][] {
  const rows: string[][] = []
  for (const rowMatch of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gu)) {
    const cells = [...(rowMatch[1]?.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gu) ?? [])].map(cell => htmlText(cell[1] ?? ''))
    if (cells.length > 0) rows.push(cells)
  }
  return rows
}

/** Split manager-name cells that contain several linked names. */
function splitManagers(cell: string): string[] {
  return cell.split(/\s+/u).map(name => name.trim()).filter(name => name !== '')
}

/**
 * Parse the F10 `jjjl` manager page: the tenure table (历任基金经理) and the
 * incumbent's managed-funds table (历任基金).
 * @param text - the full HTML page.
 * @param code - the fund code (used in error messages).
 * @returns tenure rows (newest first) and managed-fund rows.
 */
export function parseManagerPage(text: string, code: string): ManagerHistory {
  const source = `f10-jjjl(${code})`
  const tables = [...text.matchAll(/<table[\s\S]*?<\/table>/gu)].map(match => match[0])
  const tenureTable = tables.find(table => table.includes('任职期间') && table.includes('任职回报'))
  if (tenureTable === undefined) throw new SourceParseError(source, 'tenures', '历任基金经理 table not found')
  const managedTable = tables.find(table => table.includes('任职天数') && table.includes('同类排名'))

  const tenures: TenureRow[] = []
  for (const cells of tableRows(tenureTable).slice(1)) {
    // Expected cells: 起始期 截止期 基金经理 任职期间 任职回报
    if (cells.length < 5) continue
    const [start, end, managersCell, durationText, returnCell] = cells
    if (start === undefined || !/^\d{4}-\d{2}-\d{2}$/u.test(start)) continue
    tenures.push({
      start,
      end: end === '至今' || end === undefined || end === '' ? null : end,
      managers: splitManagers(managersCell ?? ''),
      durationText: durationText ?? '',
      returnPct: parsePercent(returnCell ?? '', source, `tenure ${start} returnPct`),
    })
  }
  if (tenures.length === 0) throw new SourceParseError(source, 'tenures', 'no tenure rows parsed')

  const managedFunds: ManagedFundRow[] = []
  if (managedTable !== undefined) {
    for (const cells of tableRows(managedTable).slice(1)) {
      // Expected cells: 基金代码 基金名称 基金类型 起始时间 截止时间 任职天数 任职回报 同类平均 同类排名
      if (cells.length < 9) continue
      const [fundCode, fundName, fundType, start, end, durationText, returnCell, peerAvgCell, rankCell] = cells
      if (fundCode === undefined || !/^\d{6}$/u.test(fundCode)) continue
      const rankParts = (rankCell ?? '').split(/[|/]/u).map(part => part.trim()).filter(part => part !== '')
      managedFunds.push({
        code: fundCode,
        name: fundName ?? '',
        fundType: fundType ?? '',
        start: start ?? '',
        end: end === '至今' || end === undefined || end === '' ? null : end,
        durationText: durationText ?? '',
        returnPct: parsePercent(returnCell ?? '', source, `managed ${fundCode} returnPct`),
        peerAvgPct: parsePercent(peerAvgCell ?? '', source, `managed ${fundCode} peerAvgPct`),
        peerRank: Number(rankParts[0] ?? NaN),
        peerTotal: Number(rankParts[1] ?? NaN),
      })
    }
  }
  return { tenures, managedFunds }
}

/**
 * Parse one push2 quote response into a {@link StockQuote}. PE/PB are
 * published scaled by 100 and are descaled here.
 * @param text - the response text.
 * @param secid - the requested secid (used in error messages).
 * @returns the quote.
 */
export function parseQuote(text: string, secid: string): StockQuote {
  const source = `push2-quote(${secid})`
  let json: { rc?: number, data?: { f57?: string, f58?: string, f116?: number, f162?: number, f167?: number } }
  try {
    json = JSON.parse(text) as typeof json
  } catch (error) {
    throw new SourceParseError(source, 'body', `not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  const data = json.data
  if (json.rc !== 0 || data === undefined || typeof data.f116 !== 'number') {
    throw new SourceParseError(source, 'data', `quote payload missing market cap (rc=${String(json.rc)})`)
  }
  if (typeof data.f162 !== 'number' || typeof data.f167 !== 'number') {
    throw new SourceParseError(source, 'data', 'quote payload missing PE/PB fields')
  }
  return {
    code: data.f57 ?? secid.split('.')[1] ?? secid,
    name: data.f58 ?? '',
    totalMarketCap: data.f116,
    peDynamic: data.f162 / 100,
    pb: data.f167 / 100,
  }
}

/** Endpoint URLs for one fund, derived from the configured base URLs. */
export interface SourceUrls {
  pingzhongdata: string
  holdings: string
  managerHistory: string
  quoteReferer: string
  quoteBase: string
  /** Fallback quote host ('' = disabled). */
  quoteFallbackBase: string
}

/** Build the endpoint set for one fund code from configured base URLs. */
export function sourceUrls(
  bases: { eastmoneyBaseUrl: string, f10BaseUrl: string, quoteBaseUrl: string, quoteFallbackBaseUrl?: string },
  code: string,
): SourceUrls {
  return {
    pingzhongdata: `${bases.eastmoneyBaseUrl}/pingzhongdata/${code}.js`,
    holdings: `${bases.f10BaseUrl}/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10&year=&month=`,
    managerHistory: `${bases.f10BaseUrl}/jjjl_${code}.html`,
    quoteReferer: 'https://quote.eastmoney.com/',
    quoteBase: bases.quoteBaseUrl,
    quoteFallbackBase: bases.quoteFallbackBaseUrl ?? '',
  }
}

/** Provenance helper: build a successful {@link SourceProvenance}. */
export function provenanceOk(url: string, rawText: string, fetchedAt: number): SourceProvenance {
  return { url, sha256: sha256Of(rawText), fetchedAt, ok: true }
}

/** Provenance helper: build a failed {@link SourceProvenance}. */
export function provenanceFail(url: string, error: unknown, fetchedAt: number): SourceProvenance {
  return {
    url,
    sha256: '',
    fetchedAt,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }
}

/** The quote endpoint URL for one secid. */
export function quoteUrl(quoteBase: string, secid: string): string {
  return `${quoteBase}/api/qt/stock/get?secid=${secid}&fields=f57,f58,f116,f117,f162,f167`
}

/** Collected raw payloads for one acquisition pass. */
export interface CollectedSources {
  name: string
  fetchedAt: number
  sources: {
    pingzhongdata: SourceProvenance
    holdings: SourceProvenance
    managerHistory: SourceProvenance
    quotes: SourceProvenance
  }
  raw: FundRawData
  gaps: string[]
  /** Whether at least one per-stock quote was rescued by the fallback host. */
  quoteFallbackUsed: boolean
  /** Quote-layer coverage: holdings attempted vs quotes succeeded. */
  quoteCoverage: { requested: number, succeeded: number }
}

/** Collect one error into the per-stock failure text. */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Acquire one fund from every configured source, collecting raw sections and
 * per-source provenance. The pingzhongdata block is required — its failure
 * aborts the acquisition loudly; the F10/quote layers degrade into declared
 * gaps instead.
 * @param fetcher - the shared polite fetcher.
 * @param urls - endpoint set for the fund.
 * @param code - six-digit fund code.
 * @param options.styleQuotes - whether to fetch per-stock valuation quotes.
 * @param options.stockSecids - secids (`1.600519`) to quote; defaults to the holdings rows.
 * @param options.signal - caller cancellation.
 * @returns the collected raw sections plus provenance and gap labels.
 */
export async function collectFund(
  fetcher: PoliteFetcher,
  urls: SourceUrls,
  code: string,
  options: { styleQuotes: boolean, signal?: AbortSignal },
): Promise<CollectedSources> {
  const fetchedAt = Date.now()
  const gaps: string[] = []

  // Core block: required. A failure here aborts the acquisition.
  const coreText = await fetcher.fetchText(urls.pingzhongdata, 'https://fund.eastmoney.com/', options.signal)
  const core = parsePingzhongdata(coreText, code)
  const coreProv = provenanceOk(urls.pingzhongdata, coreText, fetchedAt)

  // Holdings detail (F10 jjcc): degradable.
  let holdings: FundRawData['holdings'] = null
  let holdingsProv: SourceProvenance
  try {
    const text = await fetcher.fetchText(urls.holdings, 'https://fundf10.eastmoney.com/', options.signal)
    holdings = parseHoldingsPage(text, code)
    holdingsProv = provenanceOk(urls.holdings, text, fetchedAt)
  } catch (error) {
    holdingsProv = provenanceFail(urls.holdings, error, fetchedAt)
    gaps.push('holdings')
  }

  // Manager history (F10 jjjl): degradable.
  let managerHistory: FundRawData['managerHistory'] = null
  let managerProv: SourceProvenance
  try {
    const text = await fetcher.fetchText(urls.managerHistory, 'https://fundf10.eastmoney.com/', options.signal)
    managerHistory = parseManagerPage(text, code)
    managerProv = provenanceOk(urls.managerHistory, text, fetchedAt)
  } catch (error) {
    managerProv = provenanceFail(urls.managerHistory, error, fetchedAt)
    gaps.push('managerHistory')
  }

  // Per-stock valuation quotes: degradable per stock; the layer is a gap when
  // disabled or when every quote fails.
  let quotes: QuoteMap | null = null
  let quotesProv: SourceProvenance
  let quoteFallbackUsed = false
  let quoteRequested = 0
  let quoteSucceeded = 0
  const quoteSummaryUrl = `${urls.quoteBase}/api/qt/stock/get (per-holding)`
  if (!options.styleQuotes) {
    quotesProv = { url: quoteSummaryUrl, sha256: '', fetchedAt, ok: false, error: 'disabled by config (styleQuotes: false)' }
    gaps.push('quotes')
  } else {
    const secids = (holdings?.rows ?? []).map(row => secidOf(row.code))
    quoteRequested = secids.length
    const rows: Record<string, StockQuote> = {}
    const failures: string[] = []
    let quotesText = ''
    for (const secid of secids) {
      try {
        const url = quoteUrl(urls.quoteBase, secid)
        const text = await fetcher.fetchText(url, urls.quoteReferer, options.signal)
        quotesText += text
        rows[secid] = parseQuote(text, secid)
      } catch (primaryError) {
        // Degradable per stock: retry on the fallback host (Eastmoney's own
        // delayed-quote endpoint) when configured, then give up with a gap.
        if (urls.quoteFallbackBase !== '' && urls.quoteFallbackBase !== urls.quoteBase) {
          try {
            const fallbackUrl = quoteUrl(urls.quoteFallbackBase, secid)
            const text = await fetcher.fetchText(fallbackUrl, urls.quoteReferer, options.signal)
            quotesText += text
            rows[secid] = parseQuote(text, secid)
            quoteFallbackUsed = true
            continue
          } catch (fallbackError) {
            failures.push(`${secid}: primary: ${errorText(primaryError)}; fallback: ${errorText(fallbackError)}`)
            continue
          }
        }
        failures.push(`${secid}: ${errorText(primaryError)}`)
      }
    }
    quoteSucceeded = Object.keys(rows).length
    if (secids.length === 0) {
      quotesProv = { url: quoteSummaryUrl, sha256: '', fetchedAt, ok: false, error: 'no holdings to quote' }
      gaps.push('quotes')
    } else if (Object.keys(rows).length === 0) {
      quotesProv = provenanceFail(quoteSummaryUrl, new Error(failures.join('; ')), fetchedAt)
      gaps.push('quotes')
    } else {
      quotes = { fetchedAt, rows }
      quotesProv = {
        url: quoteSummaryUrl,
        sha256: sha256Of(quotesText),
        fetchedAt,
        ok: failures.length === 0,
        ...(failures.length > 0 ? { error: `partial: ${failures.join('; ')}` } : {}),
      }
    }
  }

  return {
    name: core.name,
    fetchedAt,
    sources: { pingzhongdata: coreProv, holdings: holdingsProv, managerHistory: managerProv, quotes: quotesProv },
    raw: {
      fees: core.fees,
      returns: core.returns,
      navTrend: core.navTrend,
      manager: core.manager,
      performanceEvaluation: core.performanceEvaluation,
      scaleHistory: core.scaleHistory,
      assetAllocation: core.assetAllocation,
      holdings,
      managerHistory,
      quotes,
    },
    gaps,
    quoteFallbackUsed,
    quoteCoverage: { requested: quoteRequested, succeeded: quoteSucceeded },
  }
}

/** Derive the Eastmoney secid (`1.600519` Shanghai / `0.000568` Shenzhen) from a six-digit code. */
export function secidOf(code: string): string {
  // 6xxxxx/9xxxxx are Shanghai; 0/1/2/3xxxxx are Shenzhen.
  return /^[69]/u.test(code) ? `1.${code}` : `0.${code}`
}
