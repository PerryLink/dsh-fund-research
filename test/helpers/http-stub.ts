/**
 * Shared HTTP stub for tests that must exercise the collector's fetch layer:
 * a routing `fetch` implementation serving canned bodies per URL substring,
 * plus a minimal `Response`-shaped object. The network itself is never
 * touched — only `PoliteFetcher.fetchText` consumes this seam.
 * @module dsh-fund-research/test/helpers/http-stub
 */

/** One route: URLs containing `match` get the route's outcome. */
export interface StubRoute {
  match: string
  /** Body to serve (200). */
  body?: string
  /** Thrown by the fetch stub (transport failure). */
  fail?: Error
  /** Non-2xx status to serve. */
  httpStatus?: number
}

/** A minimal `Response`-shaped object for the collector. */
export function textResponse(body: string): {
  ok: true
  status: 200
  arrayBuffer(): Promise<ArrayBuffer>
} {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
  }
}

/** A routing `fetch` implementation; unmatched URLs throw. */
export function stubFetch(routes: StubRoute[]): typeof fetch {
  return (async (url: string) => {
    const route = routes.find(candidate => url.includes(candidate.match))
    if (route === undefined) throw new Error(`unexpected URL in stub: ${url}`)
    if (route.fail !== undefined) throw route.fail
    if (route.httpStatus !== undefined) {
      return { ok: false, status: route.httpStatus } as never
    }
    return textResponse(route.body ?? '')
  }) as unknown as typeof fetch
}