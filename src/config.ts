/**
 * Config schema and resolution for `dsh-fund-research`. Every tunable is a
 * validated {@link Config} field changeable from cordis.yml — data-source base
 * URLs, polite-collection pacing, retry budget, snapshot TTL, the risk-free
 * rate, offline mode, and the report root — so no deployment-varying choice is
 * hardcoded. The resolution step validates bounds so misconfiguration fails
 * loud at mount.
 * @module dsh-fund-research/config
 */

import z from '@deepseek-ai/schemastery'

/** Raw plugin config — every field optional; {@link resolveConfig} supplies the defaults. */
export interface Config {
  /** Master switch. `false` mounts nothing at all. Default true. */
  enabled?: boolean
  /** Base URL of the Tiantian Fund pingzhongdata endpoint host. */
  eastmoneyBaseUrl?: string
  /** Base URL of the Tiantian Fund F10 host (fundf10). */
  f10BaseUrl?: string
  /** Base URL of the Eastmoney quote host (push2) used for per-stock valuation snapshots. */
  quoteBaseUrl?: string
  /** Minimum gap between outbound requests in milliseconds (polite collection). Default 1000. */
  requestIntervalMs?: number
  /** Per-request timeout in milliseconds. Default 15000. */
  timeoutMs?: number
  /** Retries per request with exponential backoff. Default 2. */
  retries?: number
  /** Storage-domain snapshot reuse window in hours; older snapshots are refetched. Default 12. */
  cacheTtlHours?: number
  /** Annual risk-free rate for the Sharpe ratio (0..0.2). Default 0.02. */
  riskFreeRate?: number
  /** Offline mode: never send requests; read the snapshot layer only. Default false. */
  offline?: boolean
  /** Workspace-relative (or absolute) directory the versioned report tree is sealed into. Default `fund-reports`. */
  reportRoot?: string
  /** Fetch per-stock valuation quotes for style attribution. Default true. */
  styleQuotes?: boolean
}

/** Fully resolved config handed to the runtime. */
export interface ResolvedConfig {
  readonly enabled: boolean
  readonly eastmoneyBaseUrl: string
  readonly f10BaseUrl: string
  readonly quoteBaseUrl: string
  readonly requestIntervalMs: number
  readonly timeoutMs: number
  readonly retries: number
  readonly cacheTtlHours: number
  readonly riskFreeRate: number
  readonly offline: boolean
  readonly reportRoot: string
  readonly styleQuotes: boolean
}

/** Schemastery schema: the loader validates and fills defaults before `apply`. */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  eastmoneyBaseUrl: z.string().default('https://fund.eastmoney.com'),
  f10BaseUrl: z.string().default('https://fundf10.eastmoney.com'),
  quoteBaseUrl: z.string().default('https://push2.eastmoney.com'),
  requestIntervalMs: z.number().default(1000),
  timeoutMs: z.number().default(15_000),
  retries: z.number().default(2),
  cacheTtlHours: z.number().default(12),
  riskFreeRate: z.number().default(0.02),
  offline: z.boolean().default(false),
  reportRoot: z.string().default('fund-reports'),
  styleQuotes: z.boolean().default(true),
})

/** Throw unless `value` is a positive safe integer. */
function assertPositiveInt(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive safe integer, got ${String(value)}`)
  }
}

/** Throw unless `value` is a non-negative safe integer. */
function assertNonNegativeInt(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer, got ${String(value)}`)
  }
}

/** Throw unless `value` is a finite number in `[min, max]`. */
function assertFiniteRange(name: string, value: number, min: number, max: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new TypeError(`${name} must be a finite number in [${min}, ${max}], got ${String(value)}`)
  }
}

/** Throw unless `value` is a non-empty http(s) URL without a trailing slash. */
function assertBaseUrl(name: string, value: string): void {
  if (!/^https?:\/\/[^/\s]+(?:\/[^/\s]+)*$/u.test(value)) {
    throw new TypeError(`${name} must be an http(s) base URL without a trailing slash, got ${JSON.stringify(value)}`)
  }
}

/**
 * Validate raw values and fill explicit defaults. Invalid bounds throw here —
 * misconfiguration fails loud at mount even without the Schemastery loader.
 * @param config - raw (possibly partial) plugin config.
 * @returns the fully resolved config.
 */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  const eastmoneyBaseUrl = config.eastmoneyBaseUrl ?? 'https://fund.eastmoney.com'
  const f10BaseUrl = config.f10BaseUrl ?? 'https://fundf10.eastmoney.com'
  const quoteBaseUrl = config.quoteBaseUrl ?? 'https://push2.eastmoney.com'
  assertBaseUrl('eastmoneyBaseUrl', eastmoneyBaseUrl)
  assertBaseUrl('f10BaseUrl', f10BaseUrl)
  assertBaseUrl('quoteBaseUrl', quoteBaseUrl)

  const requestIntervalMs = config.requestIntervalMs ?? 1000
  assertNonNegativeInt('requestIntervalMs', requestIntervalMs)
  const timeoutMs = config.timeoutMs ?? 15_000
  assertPositiveInt('timeoutMs', timeoutMs)
  const retries = config.retries ?? 2
  assertNonNegativeInt('retries', retries)
  const cacheTtlHours = config.cacheTtlHours ?? 12
  assertPositiveInt('cacheTtlHours', cacheTtlHours)
  const riskFreeRate = config.riskFreeRate ?? 0.02
  assertFiniteRange('riskFreeRate', riskFreeRate, 0, 0.2)

  const reportRoot = config.reportRoot ?? 'fund-reports'
  if (typeof reportRoot !== 'string' || reportRoot.trim() === '') {
    throw new TypeError(`reportRoot must be a non-empty path, got ${JSON.stringify(reportRoot)}`)
  }

  return {
    enabled: config.enabled ?? true,
    eastmoneyBaseUrl,
    f10BaseUrl,
    quoteBaseUrl,
    requestIntervalMs,
    timeoutMs,
    retries,
    cacheTtlHours,
    riskFreeRate,
    offline: config.offline ?? false,
    reportRoot: reportRoot.trim(),
    styleQuotes: config.styleQuotes ?? true,
  }
}
