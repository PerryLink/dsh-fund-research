// scripts/check-endpoints.mjs — M3 external-endpoint liveness probe
// (Claude Code check-mcp-urls pattern): 401/403/405/5xx = alive (the expected
// unauthenticated response), only 404/410/DNS/TLS/timeout = failure. dsh-fund-research
// declares four public Tiantian Fund / Eastmoney endpoints (no key, no login).
// Run locally with `node scripts/check-endpoints.mjs` or on the monthly
// `.github/workflows/check-endpoints.yml` schedule.
import { request } from 'node:https'

const ENDPOINTS = [
  { name: 'pingzhongdata', url: 'https://fund.eastmoney.com/pingzhongdata/161725.js' },
  { name: 'f10-holdings', url: 'https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=161725&topline=10&year=&month=' },
  { name: 'f10-manager', url: 'https://fundf10.eastmoney.com/jjjl_161725.html' },
  { name: 'push2-quote', url: 'https://push2.eastmoney.com/api/qt/stock/get?secid=1.600519&fields=f57,f58,f116,f117,f162,f167' },
]

const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 15000)

function probe(url) {
  return new Promise((resolve) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const req = request(url, { method: 'GET', headers: { 'user-agent': 'dsh-endpoint-liveness/1.0' }, signal: controller.signal }, (res) => {
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
  const result = await probe(endpoint.url)
  const status = result.status
  const alive = status === 200 || (status !== null && status >= 400 && status !== 404 && status !== 410)
  const verdict = alive ? 'ALIVE' : 'FAIL'
  console.log(`${verdict} ${String(status ?? result.error)} ${endpoint.name} ${endpoint.url}`)
  if (!alive) failures.push(`${endpoint.name}: ${String(status ?? result.error)}`)
}

if (failures.length > 0) {
  console.error(`\nendpoint liveness failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nendpoint liveness passed: ${ENDPOINTS.length} endpoint(s) alive`)
