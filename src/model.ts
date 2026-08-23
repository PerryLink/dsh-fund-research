/**
 * Owned JSON data model for `dsh-fund-research`: the extracted source snapshot
 * (raw sections), the deterministic computed metrics, and the report/seal
 * records. Everything here is plain lossless-JSON data — a `FundSnapshot` is
 * exactly what gets sealed as `snapshot.json` in a version directory and what
 * the citation checker reads back. No Cordis/Session reference crosses the
 * tool or the session-log boundary.
 * @module dsh-fund-research/model
 */

/** Schema marker stamped on every sealed snapshot. */
export const SNAPSHOT_SCHEMA = 'dsh-fund-research/snapshot@v1' as const

/** One provenance record for a fetched source document. */
export interface SourceProvenance {
  /** The exact URL fetched. */
  url: string
  /** SHA-256 (hex) of the raw response text. */
  sha256: string
  /** Epoch milliseconds of the fetch. */
  fetchedAt: number
  /** Whether the fetch+parse succeeded; a failed source contributes a gap. */
  ok: boolean
  /** Failure detail when `ok` is false. */
  error?: string | undefined
}

/** Fee and subscription facts from the pingzhongdata block (rate strings as published). */
export interface FundFees {
  /** Published original subscription rate (%). */
  sourceRate: string
  /** Published current subscription rate (%). */
  rate: string
  /** Minimum subscription amount (yuan). */
  minSubscription: string
}

/** Published stage returns (percent strings) from the pingzhongdata block. */
export interface FundStageReturns {
  /** 近1月 (%). */
  month1: string
  /** 近3月 (%). */
  month3: string
  /** 近6月 (%). */
  month6: string
  /** 近1年 (%). */
  year1: string
}

/** One daily unit-NAV point from `Data_netWorthTrend`. */
export interface NavPoint {
  /** Epoch milliseconds (UTC midnight of the trading day). */
  t: number
  /** Unit net asset value. */
  nav: number
  /** Published daily return (%); may be 0 on the first point. */
  dailyReturn: number
}

/** Current-manager summary from `Data_currentFundManager`. */
export interface ManagerSummary {
  name: string
  /** Published star rating (0-5). */
  star: number
  /** Published tenure text, e.g. "8年又364天". */
  workTime: string
  /** Published aggregate fund size text, e.g. "440.89亿(21只基金)". */
  fundSize: string
  /** Composite manager score (string as published). */
  powerAvr: string
  /** Score dimension labels (经验值/收益率/跟踪误差/超额收益/管理规模). */
  powerCategories: string[]
  /** Score values aligned with {@link ManagerSummary.powerCategories}. */
  powerData: number[]
  /** Score as-of date (YYYY-MM-DD). */
  powerAsOf: string
  /** Profit-comparison labels (任期收益/同类平均/沪深300). */
  profitCategories: string[]
  /** Profit-comparison values (%) aligned with {@link ManagerSummary.profitCategories}. */
  profitValues: number[]
  /** Profit-comparison as-of date (YYYY-MM-DD). */
  profitAsOf: string
}

/** Fund-level performance evaluation from `Data_performanceEvaluation`. */
export interface PerformanceEvaluation {
  /** Composite score (string as published). */
  avr: string
  /** Dimension labels (选证能力/收益率/跟踪误差/超额收益/管理规模). */
  categories: string[]
  /** Dimension scores aligned with {@link PerformanceEvaluation.categories}. */
  data: number[]
}

/** Quarterly fund scale history from `Data_fluctuationScale` (亿元). */
export interface ScaleHistory {
  /** Quarter dates (YYYY-MM-DD), oldest first. */
  dates: string[]
  /** Scale values in 亿元 aligned with {@link ScaleHistory.dates}. */
  values: number[]
}

/** Quarterly asset allocation from `Data_assetAllocation`. */
export interface AssetAllocation {
  /** Quarter dates (YYYY-MM-DD), oldest first. */
  dates: string[]
  /** 股票占净比 (%) per quarter. */
  stockPct: number[]
  /** 债券占净比 (%) per quarter. */
  bondPct: number[]
  /** 现金占净比 (%) per quarter. */
  cashPct: number[]
  /** 净资产 (亿元) per quarter. */
  netAsset: number[]
}

/** One holding row from the F10 持仓 table. */
export interface HoldingRow {
  rank: number
  /** Six-digit stock code. */
  code: string
  /** Stock name. */
  name: string
  /** Percentage of fund NAV (%). */
  navPct: number
  /** Shares held, in 万股. */
  shares10k: number
  /** Market value of the position, in 万元. */
  marketValue10k: number
}

/** Current and previous-quarter top holdings from the F10 `jjcc` page. */
export interface HoldingsDetail {
  /** Current-quarter as-of date (YYYY-MM-DD). */
  asOf: string
  /** Current-quarter top-N rows. */
  rows: HoldingRow[]
  /** Previous-quarter as-of date; empty when the page carries one quarter only. */
  previousAsOf: string | null
  /** Previous-quarter top-N rows; empty when unavailable. */
  previousRows: HoldingRow[]
}

/** One tenure row from the F10 基金经理 page (历任基金经理 table). */
export interface TenureRow {
  /** Tenure start (YYYY-MM-DD). */
  start: string
  /** Tenure end (YYYY-MM-DD); `null` for the incumbent ("至今"). */
  end: string | null
  /** Manager name(s) of the tenure. */
  managers: string[]
  /** Published tenure duration text, e.g. "8年又350天". */
  durationText: string
  /** Published tenure return (%). */
  returnPct: number
}

/** One fund row from the 现任经理历任基金 table. */
export interface ManagedFundRow {
  code: string
  name: string
  /** Published fund type, e.g. "指数-股票". */
  fundType: string
  start: string
  /** `null` while still managed. */
  end: string | null
  /** Published tenure duration text. */
  durationText: string
  /** Published tenure return (%). */
  returnPct: number
  /** Peer-group average return over the same window (%). */
  peerAvgPct: number
  /** Peer-group rank (1-based). */
  peerRank: number
  /** Peer-group size. */
  peerTotal: number
}

/** Manager history from the F10 `jjjl` page. */
export interface ManagerHistory {
  /** Tenure rows, newest first. */
  tenures: TenureRow[]
  /** Funds the incumbent manages or managed, as published. */
  managedFunds: ManagedFundRow[]
}

/** Per-stock valuation quote from the push2 endpoint. */
export interface StockQuote {
  /** Six-digit stock code. */
  code: string
  name: string
  /** Total market capitalization (yuan). */
  totalMarketCap: number
  /** Dynamic price/earnings ratio. */
  peDynamic: number
  /** Price/book ratio. */
  pb: number
}

/** Valuation quotes keyed by secid (`1.600519` / `0.000568`). */
export interface QuoteMap {
  /** Epoch milliseconds the quotes were fetched at. */
  fetchedAt: number
  /** Quotes keyed by secid; a holding without a quote is a per-stock gap. */
  rows: Record<string, StockQuote>
}

/** Raw extracted sections of one fund snapshot (pre-computation). */
export interface FundRawData {
  fees: FundFees
  returns: FundStageReturns
  /** Daily unit-NAV series, oldest first. */
  navTrend: NavPoint[]
  manager: ManagerSummary
  performanceEvaluation: PerformanceEvaluation
  scaleHistory: ScaleHistory
  assetAllocation: AssetAllocation
  /** `null` when the holdings source failed (gap). */
  holdings: HoldingsDetail | null
  /** `null` when the manager-history source failed (gap). */
  managerHistory: ManagerHistory | null
  /** `null` when quotes are disabled or every quote fetch failed (gap). */
  quotes: QuoteMap | null
}

/** Metrics of one computation window of the NAV series. */
export interface WindowMetrics {
  /** Window label, e.g. "近1年". */
  label: string
  /** Window start date (YYYY-MM-DD). */
  start: string
  /** Window end date (YYYY-MM-DD). */
  end: string
  /** Trading days in the window. */
  days: number
  /** Period return (%). */
  periodReturnPct: number
  /** Annualized return (%). */
  annualizedReturnPct: number
  /** Annualized volatility of daily returns (%). */
  volatilityPct: number
  /** Maximum peak-to-trough drawdown (%). */
  maxDrawdownPct: number
  /** Drawdown peak date (YYYY-MM-DD). */
  maxDrawdownPeak: string
  /** Drawdown trough date (YYYY-MM-DD). */
  maxDrawdownTrough: string
  /** Sharpe ratio against the configured risk-free rate. */
  sharpe: number
}

/** Computed performance decomposition. */
export interface PerformanceMetrics {
  /** Latest NAV point. */
  latestNav: number
  /** Latest NAV date (YYYY-MM-DD). */
  latestDate: string
  /** Per-window metrics (成立以来 / 近3年 / 近1年). */
  windows: WindowMetrics[]
}

/** Computed holdings-penetration metrics. */
export interface HoldingsMetrics {
  /** Top-3 aggregate NAV share (%). */
  top3Pct: number
  /** Top-10 aggregate NAV share (%). */
  top10Pct: number
  /** Herfindahl-Hirschman index over the top-10 weights (0-10000, weights in %). */
  hhi: number
  /** Industry distribution over top-10: industry → aggregate NAV share (%). */
  industryPct: Record<string, number>
  /** Quarter-over-quarter comparison; `null` when the previous quarter is unavailable. */
  quarterCompare: {
    /** Stock codes present in both quarters. */
    kept: string[]
    /** Stock codes new this quarter. */
    added: string[]
    /** Stock codes dropped since last quarter. */
    removed: string[]
  } | null
}

/** One holding's style classification. */
export interface StyleRow {
  code: string
  name: string
  navPct: number
  /** Total market cap (亿元). */
  marketCapYi: number
  /** Absolute size band: 大盘 / 中盘 / 小盘. */
  sizeBand: string
  /** Within-holdings size quintile (1 = largest). */
  sizeQuintile: number
  /** Valuation band by dynamic PE: 深度价值 / 价值 / 均衡 / 成长. */
  valueBand: string
  peDynamic: number
  pb: number
}

/** Computed size-value style attribution (估算口径 — fixed bands, see the report appendix). */
export interface StyleMetrics {
  rows: StyleRow[]
  /** NAV-weighted size-band distribution (%). */
  sizeDistribution: Record<string, number>
  /** NAV-weighted valuation-band distribution (%). */
  valueDistribution: Record<string, number>
  /** Holdings covered by quotes / total top-10 holdings. */
  coverage: string
}

/** Computed manager-profile metrics. */
export interface ManagerMetrics {
  /** Incumbent tenure start (YYYY-MM-DD); `null` when the history source is a gap. */
  tenureStart: string | null
  /** Published incumbent tenure duration text. */
  tenureDurationText: string | null
  /** Published incumbent tenure return on this fund (%). */
  tenureReturnPct: number | null
  /** Number of managed-fund rows published. */
  managedFundCount: number | null
  /** Managed funds whose tenure return beat the peer average. */
  beatPeerCount: number | null
  /** Profit-comparison triple from the pingzhongdata block. */
  profitComparison: { label: string; valuePct: number }[]
}

/** All deterministic computations over one snapshot. */
export interface ComputedMetrics {
  performance: PerformanceMetrics
  /** `null` when holdings are a gap. */
  holdings: HoldingsMetrics | null
  /** `null` when quotes are a gap. */
  style: StyleMetrics | null
  manager: ManagerMetrics
}

/** Computation parameters recorded for reproduction. */
export interface ComputationParameters {
  riskFreeRate: number
  tradingDaysPerYear: number
  calendarDaysPerYear: number
}

/** The canonical fund snapshot: raw extracted data + deterministic computations + provenance. */
export interface FundSnapshot {
  schema: typeof SNAPSHOT_SCHEMA
  code: string
  name: string
  /** Epoch milliseconds the acquisition completed. */
  fetchedAt: number
  /** Per-source provenance (URL + SHA-256 + fetch time). */
  sources: {
    pingzhongdata: SourceProvenance
    holdings: SourceProvenance
    managerHistory: SourceProvenance
    quotes: SourceProvenance
  }
  raw: FundRawData
  computed: ComputedMetrics
  parameters: ComputationParameters
  /** Gap labels for sections whose sources failed or are disabled, e.g. "holdings". */
  gaps: string[]
  /**
   * asOf cutoff date (YYYY-MM-DD) applied to the NAV series; points strictly
   * after this date are excluded before computation. `undefined` = no cutoff.
   */
  asOf?: string | undefined
}

/** One row of the report's number-traceability table. */
export interface TraceRow {
  /** Stable citation id, e.g. "perf.y1.periodReturnPct". */
  id: string
  /** Human label of the number as it appears in the report. */
  label: string
  /** The value as cited in the report. */
  value: number | string
  /** JSON-path-ish locator into the sealed snapshot.json. */
  path: string
  /** Relative tolerance for numeric comparison. */
  tolerance: number
  /** Verification engine: `dsh-data-quality` or `builtin-fallback`. */
  engine?: string
  /** Verification verdict; filled before sealing. */
  verdict?: string
  /** Verifier evidence note. */
  note?: string
}

/** The sealed manifest beside every report. */
export interface ReportManifest {
  schema: 'dsh-fund-research/manifest@v1'
  code: string
  name: string
  /** Version directory name (YYYYMMDD-HHmmss). */
  version: string
  /** Epoch milliseconds of sealing. */
  sealedAt: number
  /** Snapshot provenance (per-source URL + SHA-256 + fetch time). */
  sources: FundSnapshot['sources']
  /** SHA-256 of the sealed snapshot.json. */
  snapshotSha256: string
  /** Computation parameters used. */
  parameters: ComputationParameters
  /** SHA-256 of report.md. */
  reportSha256: string
  /** Verification engine used for the traceability table. */
  verifyEngine: string
  /** Gap labels declared in this report. */
  gaps: string[]
  /** asOf cutoff date (YYYY-MM-DD) the snapshot was truncated to; `undefined` = no cutoff. */
  asOf?: string | undefined
  /** Plugin version that produced the report. */
  generator: string
}
