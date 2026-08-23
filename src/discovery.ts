/**
 * Deterministic data-source discovery record: one acquisition's endpoint
 * roster, the primary/fallback resolution per source, per-source coverage and
 * declared gaps, the degradation reason, and per-source quality signals
 * (requested / succeeded / fieldsPresent / parseWarnings / degraded) — fully
 * code-generated, no model participation. The record is sealed as
 * `sources-discovery.json` beside the snapshot and folded into the report
 * appendix as the 数据源与缺口声明 section.
 * @module dsh-fund-research/discovery
 */

import type { FundSnapshot, SourceProvenance } from './model.ts'

/** The frozen discovery-record schema marker. */
export const SOURCES_DISCOVERY_SCHEMA = 'dsh-fund-research/sources-discovery@v1' as const

/** Deterministic per-source quality signals, derived from collection facts. */
export interface SourceQuality {
  /** Units requested (1 for a single document; the holdings count for quotes). */
  requested: number
  /** Units that succeeded. */
  succeeded: number
  /** Number of distinct data fields present in the extracted result. */
  fieldsPresent: number
  /** Deterministic parse/soft-degradation warnings (never model output). */
  parseWarnings: string[]
  /** Hard failure or partial coverage — downstream may downweight, never hard-filter. */
  degraded: boolean
}

/** One non-quote endpoint entry (single primary endpoint, no fallback). */
export interface SourceEndpointRecord {
  /** Logical source name. */
  source: 'pingzhongdata' | 'holdings' | 'managerHistory'
  role: 'primary'
  /** The exact endpoint URL fetched. */
  url: string
  ok: boolean
  /** SHA-256 of the response text (`''` on failure). */
  sha256: string
  /** Failure detail when `ok` is false. */
  error: string | null
  /** Quality signals for this source. */
  quality: SourceQuality
}

/** Quote-layer resolution facts supplied by the collector or derived on reuse. */
export interface QuoteDiscoveryFacts {
  primaryUrl: string
  fallbackUrl: string | null
  fallbackUsed: boolean
  requested: number
  succeeded: number
}

/** The canonical discovery record sealed beside every snapshot. */
export interface SourcesDiscovery {
  schema: typeof SOURCES_DISCOVERY_SCHEMA
  code: string
  name: string
  /** Epoch milliseconds the record was generated. */
  generatedAt: number
  /** asOf cutoff date applied; `null` = no cutoff. */
  asOf: string | null
  /** Whether this record documents a live collection or a snapshot reuse. */
  live: boolean
  /** Non-quote endpoints, one entry per source. */
  endpoints: SourceEndpointRecord[]
  /** The per-stock valuation (行情) layer resolution. */
  quotes: {
    primaryUrl: string
    fallbackUrl: string | null
    /** Which host actually served the quote layer. */
    used: 'primary' | 'fallback' | 'disabled' | 'none'
    requested: number
    succeeded: number
    ok: boolean
    error: string | null
    quality: SourceQuality
  }
  /** Declared data-gap labels for this acquisition. */
  gaps: string[]
}

/** Count how many of the given conditions hold. */
function countTrue(...conditions: boolean[]): number {
  return conditions.reduce((sum, condition) => sum + (condition ? 1 : 0), 0)
}

/** Whether a value is a non-empty array. */
function nonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

/** Present-field count for the pingzhongdata block (its seven owned sections). */
function pingzhongdataFields(snapshot: FundSnapshot): number {
  const raw = snapshot.raw
  return countTrue(
    raw.fees !== null,
    raw.returns !== null,
    nonEmptyArray(raw.navTrend),
    raw.manager !== null,
    raw.performanceEvaluation !== null,
    nonEmptyArray(raw.scaleHistory.dates),
    nonEmptyArray(raw.assetAllocation.stockPct),
  )
}

/** Present-field count plus warnings for the F10 holdings page. */
function holdingsQuality(snapshot: FundSnapshot): { fieldsPresent: number, parseWarnings: string[] } {
  const holdings = snapshot.raw.holdings
  if (holdings === null) return { fieldsPresent: 0, parseWarnings: [] }
  const fieldsPresent = countTrue(nonEmptyArray(holdings.rows), nonEmptyArray(holdings.previousRows))
  const parseWarnings = holdings.previousAsOf === null ? ['previous quarter unavailable'] : []
  return { fieldsPresent, parseWarnings }
}

/** Present-field count plus warnings for the F10 manager-history page. */
function managerQuality(snapshot: FundSnapshot): { fieldsPresent: number, parseWarnings: string[] } {
  const history = snapshot.raw.managerHistory
  if (history === null) return { fieldsPresent: 0, parseWarnings: [] }
  const fieldsPresent = countTrue(nonEmptyArray(history.tenures), nonEmptyArray(history.managedFunds))
  const parseWarnings = history.managedFunds.length === 0 ? ['no managed funds published'] : []
  return { fieldsPresent, parseWarnings }
}

/** Quote-layer quality signals from the snapshot and collector facts. */
function quotesQuality(snapshot: FundSnapshot, facts: QuoteDiscoveryFacts): SourceQuality {
  const error = snapshot.sources.quotes.error ?? ''
  const parseWarnings: string[] = []
  if (error.includes('disabled by config')) parseWarnings.push('disabled by config')
  else if (error.includes('no holdings to quote')) parseWarnings.push('no holdings to quote')
  else if (facts.succeeded < facts.requested) parseWarnings.push(`partial: ${facts.succeeded}/${facts.requested} quotes`)
  return {
    requested: facts.requested,
    succeeded: facts.succeeded,
    fieldsPresent: facts.succeeded,
    parseWarnings,
    degraded: !snapshot.sources.quotes.ok || facts.succeeded < facts.requested,
  }
}

/** Build the quality signal for one single-document endpoint. */
function endpointQuality(snapshot: FundSnapshot, source: SourceEndpointRecord['source'], ok: boolean): SourceQuality {
  let fieldsPresent = 0
  let parseWarnings: string[] = []
  if (source === 'pingzhongdata') {
    fieldsPresent = pingzhongdataFields(snapshot)
  } else if (source === 'holdings') {
    const quality = holdingsQuality(snapshot)
    fieldsPresent = quality.fieldsPresent
    parseWarnings = quality.parseWarnings
  } else {
    const quality = managerQuality(snapshot)
    fieldsPresent = quality.fieldsPresent
    parseWarnings = quality.parseWarnings
  }
  return {
    requested: 1,
    succeeded: ok ? 1 : 0,
    fieldsPresent,
    parseWarnings,
    degraded: !ok,
  }
}

/** Fold one provenance record into a discovery endpoint entry. */
function endpointOf(source: SourceEndpointRecord['source'], prov: SourceProvenance, snapshot: FundSnapshot): SourceEndpointRecord {
  return {
    source,
    role: 'primary',
    url: prov.url,
    ok: prov.ok,
    sha256: prov.sha256,
    error: prov.error ?? null,
    quality: endpointQuality(snapshot, source, prov.ok),
  }
}

/** Classify the quote layer's actual host from the snapshot and the collector facts. */
function quoteUsed(snapshot: FundSnapshot, facts: QuoteDiscoveryFacts): SourcesDiscovery['quotes']['used'] {
  if (snapshot.raw.quotes === null && snapshot.gaps.includes('quotes')) {
    const error = snapshot.sources.quotes.error ?? ''
    if (error.includes('disabled by config')) return 'disabled'
    if (error.includes('no holdings to quote')) return 'none'
  }
  return facts.fallbackUsed ? 'fallback' : 'primary'
}

/**
 * Build the deterministic discovery record for one acquisition. Every field
 * derives from the sealed snapshot's provenance plus the collector's quote
 * facts — never from model output.
 * @param snapshot - the acquired (or reused) snapshot.
 * @param facts - quote-layer resolution facts (collector on live; config-derived on reuse).
 * @param generatedAt - epoch milliseconds of record generation.
 * @param live - whether this records a live collection.
 * @returns the discovery record.
 */
export function buildSourcesDiscovery(
  snapshot: FundSnapshot,
  facts: QuoteDiscoveryFacts,
  generatedAt: number,
  live: boolean,
): SourcesDiscovery {
  return {
    schema: SOURCES_DISCOVERY_SCHEMA,
    code: snapshot.code,
    name: snapshot.name,
    generatedAt,
    asOf: snapshot.asOf ?? null,
    live,
    endpoints: [
      endpointOf('pingzhongdata', snapshot.sources.pingzhongdata, snapshot),
      endpointOf('holdings', snapshot.sources.holdings, snapshot),
      endpointOf('managerHistory', snapshot.sources.managerHistory, snapshot),
    ],
    quotes: {
      primaryUrl: facts.primaryUrl,
      fallbackUrl: facts.fallbackUrl,
      used: quoteUsed(snapshot, facts),
      requested: facts.requested,
      succeeded: facts.succeeded,
      ok: snapshot.sources.quotes.ok,
      error: snapshot.sources.quotes.error ?? null,
      quality: quotesQuality(snapshot, facts),
    },
    gaps: snapshot.gaps,
  }
}

/** One flattened quality entry (source name + its signals) for tool values. */
export interface SourceQualityEntry extends SourceQuality {
  source: string
}

/** Flatten a discovery record into per-source quality entries for tool values. */
export function sourceQualityOf(discovery: SourcesDiscovery): SourceQualityEntry[] {
  const result: SourceQualityEntry[] = []
  for (const endpoint of discovery.endpoints) {
    result.push({ source: endpoint.source, ...endpoint.quality })
  }
  result.push({ source: 'quotes', ...discovery.quotes.quality })
  return result
}

/** Render one quality block as the compact appendix table cell. */
function qualityCell(quality: SourceQuality): string {
  const warnings = quality.parseWarnings.length > 0 ? ` · 告警 ${quality.parseWarnings.join('、')}` : ''
  return `${quality.requested}/${quality.succeeded} · 字段 ${quality.fieldsPresent} · ${quality.degraded ? '降级' : '正常'}${warnings}`
}

/** Render the discovery record as the appendix 数据源与缺口声明 markdown section. */
export function renderSourcesDiscoverySection(discovery: SourcesDiscovery): string {
  const lines = [
    '### 数据源与缺口声明',
    '',
    '以下为代码生成的数据源发现记录（与同目录 sources-discovery.json 同源；逐源端点、覆盖、质量信号与降级原因）：',
    '',
    '| 源 | 端点 | 结果 | 质量信号 | 说明 |',
    '|---|---|---|---|---|',
  ]
  for (const endpoint of discovery.endpoints) {
    const status = endpoint.ok ? 'OK' : '失败'
    const note = endpoint.ok ? `sha256 ${endpoint.sha256.slice(0, 12)}…` : endpoint.error ?? ''
    lines.push(`| ${endpoint.source} | ${endpoint.url} | ${status} | ${qualityCell(endpoint.quality)} | ${note} |`)
  }
  const quote = discovery.quotes
  const quoteNote = quote.error ?? `${quote.succeeded}/${quote.requested}`
  lines.push(`| quotes | ${quote.primaryUrl} | ${quote.ok ? 'OK' : '缺口/部分'} | ${qualityCell(quote.quality)} | ${quoteNote} |`)

  const fallback = quote.fallbackUrl === null ? '无回退源' : quote.fallbackUrl
  const asOfLine = discovery.asOf === null ? '无截点' : `截点 asOf ${discovery.asOf}`
  lines.push(
    '',
    `- 行情层实际使用：${quote.used}（主源 ${quote.primaryUrl}；回退 ${fallback}；覆盖 ${quote.succeeded}/${quote.requested}）。`,
    `- 质量信号含义：requested/succeeded 为请求/成功单元数；fieldsPresent 为已提取字段数；degraded 标记硬失败或部分覆盖，供下游降权而非硬过滤。`,
    `- 截点：${asOfLine}。采集方式：${discovery.live ? '实时采集' : '快照复用'}。`,
    `- 数据缺口：${discovery.gaps.length === 0 ? '无' : discovery.gaps.join('、')}。`,
  )
  return lines.join('\n')
}
