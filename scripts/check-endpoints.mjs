// scripts/check-endpoints.mjs — M3 external-endpoint liveness probe
// (Claude Code check-mcp-urls pattern): 401/403/405/5xx = alive (the expected
// unauthenticated response), only 404/410/DNS/TLS/timeout = failure. dsh-fund-research
// declares four public Tiantian Fund / Eastmoney endpoints (no key, no login).
// Run locally with `node scripts/check-endpoints.mjs` or on the monthly
// `.github/workflows/check-endpoints.yml` schedule.
//
// The probe MUST send the same browser identity the collector sends
// (`COLLECTOR_HEADERS` in src/sources/eastmoney.ts) and the same per-endpoint
// Referer: the F10 archive endpoints answer 404 to a bare request and 200 to a
// browser-identified one, so a probe without them reports a false outage.
import { request } from 'node:https'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const ENDPOINTS = [
  { name: 'pingzhongdata', url: 'https://fund.eastmoney.com/pingzhongdata/161725.js', referer: 'https://fund.eastmoney.com/' },
  { name: 'f10-holdings', url: 'https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=161725&topline=10&year=&month=', referer: 'https://fundf10.eastmoney.com/' },
  { name: 'f10-manager', url: 'https://fundf10.eastmoney.com/jjjl_161725.html', referer: 'https://fundf10.eastmoney.com/' },
  {
    name: 'push2-quote',
    url: 'https://push2.eastmoney.com/api/qt/stock/get?secid=1.600519&fields=f57,f58,f116,f117,f162,f167',
    // The collector falls back to the delay host when the primary quote host fails
    // (config `quoteFallbackBaseUrl`). The primary refuses connections from some
    // vantage points while the fallback answers 200, so the source counts as alive
    // when either host answers - mirroring how the plugin actually collects.
    fallback: 'https://push2delay.eastmoney.com/api/qt/stock/get?secid=1.600519&fields=f57,f58,f116,f117,f162,f167',
    referer: 'https://quote.eastmoney.com/',
  },
]

const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 15000)

function probe(url, referer) {
  return new Promise((resolve) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const req = request(url, { method: 'GET', headers: { 'user-agent': BROWSER_UA, ...(referer ? { Referer: referer } : {}) }, signal: controller.signal }, (res) => {
      res.resume()
      clearTimeout(timer)
      resolve({ status: res.statusCode })
    })
    req.on('error', (error) => {
      clearTimeout(timer)
      const message = String(error?.message ?? error)
      if (controller.signal.aborted) return resolve({ status: null, error: 'timeout' })
      if (message.includes('ENOTFOUND')) return resolve({ status: null, error: 'DNS' })
      if (/certificate|TLS|SSL|EPROTO/u.test(message)) return resolve({ status: null, error: 'TLS' })
      resolve({ status: null, error: message })
    })
    req.end()
  })
}

const failures = []
for (const endpoint of ENDPOINTS) {
  const primary = await probe(endpoint.url, endpoint.referer)
  let result = primary
  let usedFallback = false
  // Alive = the host answered: 2xx, any 3xx redirect (a redirect still proves the
  // endpoint is serving), and 4xx/5xx other than 404/410 (the expected
  // unauthenticated reply). Only 404/410/DNS/TLS/timeout are failures.
  const isAlive = (r) => r.status !== null && (r.status < 400 || (r.status >= 400 && r.status !== 404 && r.status !== 410))
  if (!isAlive(primary) && endpoint.fallback) {
    const fb = await probe(endpoint.fallback, endpoint.referer)
    if (isAlive(fb)) { result = fb; usedFallback = true }
  }
  const alive = isAlive(result)
  const verdict = alive ? 'ALIVE' : 'FAIL'
  const suffix = usedFallback ? ` (via fallback host; primary was ${String(primary.status ?? primary.error)})` : ''
  console.log(`${verdict} ${String(result.status ?? result.error)} ${endpoint.name} ${usedFallback ? endpoint.fallback : endpoint.url}${suffix}`)
  if (!alive) failures.push(`${endpoint.name}: ${String(result.status ?? result.error)}`)
}

if (failures.length > 0) {
  console.error(`\nendpoint liveness failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nendpoint liveness passed: ${ENDPOINTS.length} endpoint(s) alive`)
