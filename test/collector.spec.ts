/**
 * Collector suite over the real fetch seam: `PoliteFetcher` pacing/timeout/
 * retry/cancellation behavior, the strict parser error paths, and
 * `collectFund`'s degradation policy (required core, degradable F10/quote
 * layers, disabled/partial/no-holdings quote modes). The network is replaced
 * by a routing stub at the fetch boundary; payloads are the saved real
 * fixtures.
 * @module dsh-fund-research/test/collector.spec
 */

import { describe, expect, it } from 'vitest'
import {
  collectFund,
  extractVar,
  parseHoldingsPage,
  parsePingzhongdata,
  parseQuote,
  PoliteFetcher,
  sourceUrls,
  SourceFetchError,
  SourceParseError,
} from '../src/sources/eastmoney.ts'
import { FIXTURE_CODE, loadFixtures } from './fixtures.ts'
import { stubFetch, textResponse, type StubRoute } from './helpers/http-stub.ts'

const BASES = {
  eastmoneyBaseUrl: 'https://fund.eastmoney.com',
  f10BaseUrl: 'https://fundf10.eastmoney.com',
  quoteBaseUrl: 'https://push2.eastmoney.com',
}

/** Build happy-path routes over the real fixtures. */
async function fixtureRoutes(): Promise<StubRoute[]> {
  const fixtures = await loadFixtures()
  const quoteRoutes = Object.entries(fixtures.quotes).map(([secid, body]) => ({ match: `secid=${secid}`, body }))
  return [
    { match: '/pingzhongdata/', body: fixtures.pingzhongdata },
    { match: 'type=jjcc', body: fixtures.holdings },
    { match: '/jjjl_', body: fixtures.managerPage },
    ...quoteRoutes,
  ]
}

describe('PoliteFetcher', () => {
  it('paces requests on a shared slot and decodes UTF-8', async () => {
    const calls: string[] = []
    const fetcher = new PoliteFetcher({ requestIntervalMs: 20, timeoutMs: 1000, retries: 0 },
      (async (url: string) => { calls.push(url); return textResponse('你好') }) as unknown as typeof fetch)
    expect(await fetcher.fetchText('u1', 'r')).toBe('你好')
    expect(await fetcher.fetchText('u2', 'r')).toBe('你好')
    expect(calls).toEqual(['u1', 'u2'])
  })

  it('fails loud after exhausting the retry budget', async () => {
    let calls = 0
    const fetcher = new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 1 },
      (async () => { calls += 1; return { ok: false, status: 503 } as never }) as unknown as typeof fetch)
    await expect(fetcher.fetchText('u', 'r')).rejects.toThrowError(/exhausted 2 attempt\(s\): source fetch failed for u: HTTP 503/u)
    expect(calls).toBe(2)
  })

  it('retries a transient failure and succeeds', async () => {
    let calls = 0
    const fetcher = new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 1 },
      (async () => {
        calls += 1
        return calls === 1 ? ({ ok: false, status: 500 }) as never : textResponse('ok')
      }) as unknown as typeof fetch)
    expect(await fetcher.fetchText('u', 'r')).toBe('ok')
    expect(calls).toBe(2)
  })

  it('honours caller cancellation before fetching', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetcher = new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 2 },
      (async () => { throw new Error('must not fetch') }) as unknown as typeof fetch)
    await expect(fetcher.fetchText('u', 'r', controller.signal)).rejects.toThrowError(/cancelled by caller/u)
  })

  it('rethrows a cancelled fetch immediately without retrying', async () => {
    let calls = 0
    const fetcher = new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 2 },
      (async () => {
        calls += 1
        throw new SourceFetchError('u', 'cancelled by caller')
      }) as unknown as typeof fetch)
    await expect(fetcher.fetchText('u', 'r')).rejects.toThrowError(/cancelled by caller/u)
    expect(calls).toBe(1)
  })
})

describe('extractVar edge cases', () => {
  it('returns null for a malformed or unterminated assignment', () => {
    expect(extractVar('var aaaaaaaaaa          = 2;', 'aaaaaaaaaa')).toBeNull()
    expect(extractVar('var a = "unclosed', 'a')).toBeNull()
  })
})

describe('parsePingzhongdata edge cases', () => {
  it('rejects a non-array NAV trend loudly', async () => {
    const fixtures = await loadFixtures()
    const broken = `var Data_netWorthTrend = {};${fixtures.pingzhongdata}`
    expect(() => parsePingzhongdata(broken, FIXTURE_CODE)).toThrowError(SourceParseError)
    expect(() => parsePingzhongdata(broken, FIXTURE_CODE)).toThrowError(/non-empty array/u)
  })
})

/** Wrap one holdings-box HTML into the `apidata` envelope the parser expects. */
function jjccPayload(html: string): string {
  return `var apidata={ content:"${html}",arryear:"2026" };`
}

/** A minimal six-column holdings table header (the layout 161725 publishes). */
const SIX_COL_HEAD = "<thead><tr><th>序号</th><th>股票代码</th><th>股票名称</th><th>占净值比例</th><th>持股数（万股）</th><th>持仓市值（万元）</th></tr></thead>"

describe('parseHoldingsPage edge cases', () => {
  it('fails loud on a malformed number cell', () => {
    const html = `<h4 class='t'>截止至 2026-06-30</h4><table>${SIX_COL_HEAD}<tbody><tr><td>1</td><td>600519</td><td>贵州茅台</td><td>17.28%</td><td>1,000</td><td>bad</td></tr></tbody></table>`
    expect(() => parseHoldingsPage(jjccPayload(html), FIXTURE_CODE)).toThrowError(/number cell/u)
  })

  it('fails loud when a section header carries no date', () => {
    const html = `<h4 class='t'>持仓明细</h4><table>${SIX_COL_HEAD}<tbody></tbody></table>`
    expect(() => parseHoldingsPage(jjccPayload(html), FIXTURE_CODE)).toThrowError(/asOf/u)
  })

  it('fails loud when the holdings table has no thead', () => {
    const html = `<h4 class='t'>截止至 2026-06-30</h4><table><tbody><tr><td>1</td></tr></tbody></table>`
    expect(() => parseHoldingsPage(jjccPayload(html), FIXTURE_CODE)).toThrowError(/thead/u)
  })
})

describe('parseQuote edge cases', () => {
  it('fails loud on a non-JSON quote body', () => {
    expect(() => parseQuote('not json', '1.600519')).toThrowError(/not valid JSON/u)
  })

  it('fails loud when the PE/PB fields are absent', () => {
    expect(() => parseQuote('{"rc":0,"data":{"f116":123}}', '1.600519')).toThrowError(/PE\/PB/u)
  })

  it('falls back to the secid when code/name fields are absent', () => {
    const quote = parseQuote('{"rc":0,"data":{"f116":123,"f162":100,"f167":200}}', '1.600519')
    expect(quote.code).toBe('600519')
    expect(quote.name).toBe('')
  })
})

describe('sourceUrls', () => {
  it('derives every endpoint from the configured base URLs', () => {
    const urls = sourceUrls({ eastmoneyBaseUrl: 'https://e.example', f10BaseUrl: 'https://f.example', quoteBaseUrl: 'https://q.example' }, FIXTURE_CODE)
    expect(urls.pingzhongdata).toBe(`https://e.example/pingzhongdata/${FIXTURE_CODE}.js`)
    expect(urls.holdings).toContain('type=jjcc')
    expect(urls.holdings).toContain(FIXTURE_CODE)
    expect(urls.managerHistory).toBe(`https://f.example/jjjl_${FIXTURE_CODE}.html`)
    expect(urls.quoteReferer).toBe('https://quote.eastmoney.com/')
    expect(urls.quoteBase).toBe('https://q.example')
  })
})

describe('collectFund', () => {
  it('collects every source; the quote layer is partial because the saved fixture set omits the flaky 600809 quote', async () => {
    const routes = await fixtureRoutes()
    const fetcher = new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, stubFetch(routes))
    const collected = await collectFund(fetcher, sourceUrls(BASES, FIXTURE_CODE), FIXTURE_CODE, { styleQuotes: true })
    expect(collected.gaps).toEqual([])
    expect(collected.name).toContain('招商中证白酒')
    expect(collected.raw.holdings?.rows).toHaveLength(10)
    expect(Object.keys(collected.raw.quotes?.rows ?? {}).length).toBe(Object.keys((await loadFixtures()).quotes).length)
    expect(collected.sources.pingzhongdata.ok).toBe(true)
    expect(collected.sources.pingzhongdata.sha256).toMatch(/^[0-9a-f]{64}$/u)
    expect(collected.sources.holdings.ok).toBe(true)
    expect(collected.sources.managerHistory.ok).toBe(true)
    expect(collected.sources.quotes.ok).toBe(false)
    expect(collected.sources.quotes.error).toContain('partial:')
  })

  it('degrades the holdings layer into a declared gap', async () => {
    const routes = await fixtureRoutes()
    routes.splice(routes.findIndex(route => route.match === 'type=jjcc'), 1, { match: 'type=jjcc', fail: new Error('holdings down') })
    const fetcher = new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, stubFetch(routes))
    const collected = await collectFund(fetcher, sourceUrls(BASES, FIXTURE_CODE), FIXTURE_CODE, { styleQuotes: true })
    expect(collected.gaps).toContain('holdings')
    expect(collected.raw.holdings).toBeNull()
    expect(collected.sources.holdings.ok).toBe(false)
    expect(collected.sources.holdings.error).toContain('holdings down')
  })

  it('degrades the manager-history layer into a declared gap', async () => {
    const routes = await fixtureRoutes()
    routes.splice(routes.findIndex(route => route.match === '/jjjl_'), 1, { match: '/jjjl_', fail: new Error('jjjl down') })
    const fetcher = new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, stubFetch(routes))
    const collected = await collectFund(fetcher, sourceUrls(BASES, FIXTURE_CODE), FIXTURE_CODE, { styleQuotes: true })
    expect(collected.gaps).toContain('managerHistory')
    expect(collected.raw.managerHistory).toBeNull()
    expect(collected.sources.managerHistory.ok).toBe(false)
  })

  it('declares a quotes gap when styleQuotes is disabled', async () => {
    const routes = await fixtureRoutes()
    const fetcher = new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, stubFetch(routes))
    const collected = await collectFund(fetcher, sourceUrls(BASES, FIXTURE_CODE), FIXTURE_CODE, { styleQuotes: false })
    expect(collected.gaps).toContain('quotes')
    expect(collected.raw.quotes).toBeNull()
    expect(collected.sources.quotes.ok).toBe(false)
    expect(collected.sources.quotes.error).toContain('disabled by config')
  })

  it('declares a quotes gap when there are no holdings to quote', async () => {
    const routes = await fixtureRoutes()
    routes.splice(routes.findIndex(route => route.match === 'type=jjcc'), 1, { match: 'type=jjcc', fail: new Error('holdings down') })
    const fetcher = new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, stubFetch(routes))
    const collected = await collectFund(fetcher, sourceUrls(BASES, FIXTURE_CODE), FIXTURE_CODE, { styleQuotes: true })
    expect(collected.gaps).toEqual(expect.arrayContaining(['holdings', 'quotes']))
    expect(collected.sources.quotes.error).toContain('no holdings to quote')
  })

  it('declares a quotes gap when every quote fails', async () => {
    const routes = await fixtureRoutes()
    const fixtures = await loadFixtures()
    const quoteMatches = Object.keys(fixtures.quotes).map(secid => `secid=${secid}`)
    routes.splice(
      routes.findIndex(route => route.match.startsWith('secid=')),
      quoteMatches.length,
      ...quoteMatches.map(match => ({ match, fail: new Error('quote down') })),
    )
    const fetcher = new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, stubFetch(routes))
    const collected = await collectFund(fetcher, sourceUrls(BASES, FIXTURE_CODE), FIXTURE_CODE, { styleQuotes: true })
    expect(collected.gaps).toContain('quotes')
    expect(collected.raw.quotes).toBeNull()
    expect(collected.sources.quotes.ok).toBe(false)
    expect(collected.sources.quotes.error).toContain('quote down')
  })

  it('keeps successful quotes and marks the layer partial when some fail', async () => {
    const routes = await fixtureRoutes()
    const fixtures = await loadFixtures()
    const quoteKeys = Object.keys(fixtures.quotes)
    const failing = quoteKeys[0]
    if (failing === undefined) throw new Error('fixtures carry no quotes')
    routes.splice(routes.findIndex(route => route.match === `secid=${failing}`), 1, { match: `secid=${failing}`, fail: new Error('one quote down') })
    const fetcher = new PoliteFetcher({ requestIntervalMs: 0, timeoutMs: 1000, retries: 0 }, stubFetch(routes))
    const collected = await collectFund(fetcher, sourceUrls(BASES, FIXTURE_CODE), FIXTURE_CODE, { styleQuotes: true })
    expect(collected.gaps).toEqual([])
    expect(Object.keys(collected.raw.quotes?.rows ?? {}).length).toBe(quoteKeys.length - 1)
    expect(collected.sources.quotes.ok).toBe(false)
    expect(collected.sources.quotes.error).toContain('partial:')
  })
})