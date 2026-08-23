/**
 * Config suite: defaults, overrides, and loud failure on invalid values.
 * @module dsh-fund-research/test/config.spec
 */

import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.ts'

describe('resolveConfig', () => {
  it('fills the documented defaults', () => {
    const resolved = resolveConfig({})
    expect(resolved).toEqual({
      enabled: true,
      eastmoneyBaseUrl: 'https://fund.eastmoney.com',
      f10BaseUrl: 'https://fundf10.eastmoney.com',
      quoteBaseUrl: 'https://push2.eastmoney.com',
      quoteFallbackBaseUrl: 'https://push2delay.eastmoney.com',
      requestIntervalMs: 1000,
      timeoutMs: 15_000,
      retries: 2,
      cacheTtlHours: 12,
      riskFreeRate: 0.02,
      offline: false,
      reportRoot: 'fund-reports',
      styleQuotes: true,
    })
  })

  it('honors overrides', () => {
    const resolved = resolveConfig({ requestIntervalMs: 2000, riskFreeRate: 0.03, offline: true, reportRoot: 'reports' })
    expect(resolved.requestIntervalMs).toBe(2000)
    expect(resolved.riskFreeRate).toBe(0.03)
    expect(resolved.offline).toBe(true)
    expect(resolved.reportRoot).toBe('reports')
  })

  it('accepts an empty quote fallback (disabled) but rejects a malformed one', () => {
    expect(resolveConfig({ quoteFallbackBaseUrl: '' }).quoteFallbackBaseUrl).toBe('')
    expect(() => resolveConfig({ quoteFallbackBaseUrl: 'not-a-url' })).toThrow(/quoteFallbackBaseUrl/u)
    expect(() => resolveConfig({ quoteFallbackBaseUrl: 'https://push2delay.eastmoney.com/' })).toThrow(/quoteFallbackBaseUrl/u)
  })

  it('fails loud on invalid values', () => {
    expect(() => resolveConfig({ requestIntervalMs: -1 })).toThrow(/requestIntervalMs/u)
    expect(() => resolveConfig({ requestIntervalMs: 1.5 })).toThrow(/requestIntervalMs/u)
    expect(() => resolveConfig({ timeoutMs: 0 })).toThrow(/timeoutMs/u)
    expect(() => resolveConfig({ timeoutMs: -100 })).toThrow(/timeoutMs/u)
    expect(() => resolveConfig({ retries: -1 })).toThrow(/retries/u)
    expect(() => resolveConfig({ retries: 0.5 })).toThrow(/retries/u)
    expect(() => resolveConfig({ riskFreeRate: 1.5 })).toThrow(/riskFreeRate/u)
    expect(() => resolveConfig({ riskFreeRate: -0.1 })).toThrow(/riskFreeRate/u)
    expect(() => resolveConfig({ eastmoneyBaseUrl: 'not-a-url' })).toThrow(/eastmoneyBaseUrl/u)
    expect(() => resolveConfig({ eastmoneyBaseUrl: 'https://fund.eastmoney.com/' })).toThrow(/eastmoneyBaseUrl/u)
    expect(() => resolveConfig({ reportRoot: '  ' })).toThrow(/reportRoot/u)
    expect(() => resolveConfig({ cacheTtlHours: 0 })).toThrow(/cacheTtlHours/u)
  })
})
