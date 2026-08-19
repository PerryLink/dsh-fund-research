/**
 * Citation-verification suite: the built-in fallback checker (path resolution,
 * tolerance comparison, unverifiable/not-found honesty) and the isomorphism
 * between the frozen `dsh-data-quality` contract path and the fallback — same
 * request, same verdict shape.
 * @module dsh-fund-research/test/verify.spec
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { builtinVerifyCitations, resolvePath, verifyCitations, type CitationCheckRequest, type DataQualityLike } from '../src/verify-bridge.ts'

/** A temp dataset file factory. */
async function withDataset<T>(data: unknown, run: (dataset: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'fund-verify-'))
  try {
    const file = path.join(dir, 'snapshot.json')
    await writeFile(file, JSON.stringify(data), 'utf8')
    return await run(file)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('resolvePath', () => {
  it('resolves nested and indexed paths', () => {
    const root = { a: { b: [10, 20, { c: 'x' }] } }
    expect(resolvePath(root, 'a.b[0]')).toBe(10)
    expect(resolvePath(root, 'a.b[2].c')).toBe('x')
    expect(resolvePath(root, 'a.missing')).toBeUndefined()
    expect(resolvePath(root, 'a.b[9]')).toBeUndefined()
  })
})

describe('builtinVerifyCitations', () => {
  it('verifies numbers within tolerance and strings exactly', async () => {
    await withDataset({ nav: 1.2345, name: '招商', nested: { pct: 10 } }, async (dataset) => {
      const result = await builtinVerifyCitations({
        dataset,
        citations: [
          { id: 'a', path: 'nav', value: 1.2345 },
          { id: 'b', path: 'name', value: '招商' },
          { id: 'c', path: 'nested.pct', value: 10.0001, tolerance: 0.001 },
        ],
      })
      expect(result.results.map(r => [r.id, r.status])).toEqual([['a', 'verified'], ['b', 'verified'], ['c', 'verified']])
    })
  })

  it('reports mismatch, not-found, and unverifiable honestly', async () => {
    await withDataset({ nav: 1.5, arr: [1], obj: { x: 1 } }, async (dataset) => {
      const result = await builtinVerifyCitations({
        dataset,
        citations: [
          { id: 'm', path: 'nav', value: 2.0 },
          { id: 'n', path: 'missing.path', value: 1 },
          { id: 'u1', path: 'arr', value: 1 },
          { id: 'u2', path: 'obj', value: 1 },
        ],
      })
      const byId = new Map(result.results.map(r => [r.id, r]))
      expect(byId.get('m')?.status).toBe('mismatch')
      expect(byId.get('m')?.actual).toBe(1.5)
      expect(byId.get('n')?.status).toBe('not-found')
      expect(byId.get('u1')?.status).toBe('unverifiable')
      expect(byId.get('u2')?.status).toBe('unverifiable')
    })
  })

  it('marks every citation unverifiable when the dataset is unreadable', async () => {
    const result = await builtinVerifyCitations({
      dataset: path.join(tmpdir(), 'fund-verify-does-not-exist.json'),
      citations: [{ id: 'a', path: 'x', value: 1 }],
    })
    expect(result.results[0]?.status).toBe('unverifiable')
  })
})

describe('verifyCitations (bridge)', () => {
  const request: CitationCheckRequest = {
    dataset: 'ignored-by-stub.json',
    citations: [{ id: 'a', path: 'nav', value: 1.0 }],
  }

  it('uses the dsh-data-quality service when present and returns its engine tag', async () => {
    const service: DataQualityLike = {
      verifyCitations: req => ({ results: req.citations.map(c => ({ id: c.id, status: 'verified' as const, note: 'stub' })) }),
    }
    const ctx = { get: (key: 'dataQuality') => key === 'dataQuality' ? service : undefined }
    const outcome = await verifyCitations(ctx, request)
    expect(outcome.engine).toBe('dsh-data-quality')
    expect(outcome.result.results[0]?.status).toBe('verified')
  })

  it('falls back to the builtin checker when the service is absent', async () => {
    await withDataset({ nav: 1.0 }, async (dataset) => {
      const ctx = { get: () => undefined }
      const outcome = await verifyCitations(ctx, { dataset, citations: [{ id: 'a', path: 'nav', value: 1.0 }] })
      expect(outcome.engine).toBe('builtin-fallback')
      expect(outcome.result.results[0]?.status).toBe('verified')
    })
  })

  it('falls back when the service throws, never blocking the seal', async () => {
    await withDataset({ nav: 1.0 }, async (dataset) => {
      const broken: DataQualityLike = { verifyCitations: () => { throw new Error('service down') } }
      const ctx = { get: () => broken }
      const outcome = await verifyCitations(ctx, { dataset, citations: [{ id: 'a', path: 'nav', value: 1.0 }] })
      expect(outcome.engine).toBe('builtin-fallback')
      expect(outcome.result.results[0]?.status).toBe('verified')
    })
  })

  it('produces isomorphic verdict shapes on both paths', async () => {
    await withDataset({ nav: 1.0, extra: 'x' }, async (dataset) => {
      const citations = [
        { id: 'ok', path: 'nav', value: 1.0 },
        { id: 'bad', path: 'nav', value: 2.0 },
        { id: 'gone', path: 'nope', value: 1 },
      ]
      const service: DataQualityLike = {
        // A contract-shaped stub implementing the same semantics as the fallback.
        verifyCitations: req => ({
          results: req.citations.map(c => {
            const table: Record<string, unknown> = { nav: 1.0 }
            const actual = table[c.path]
            if (actual === undefined) return { id: c.id, status: 'not-found' as const }
            return actual === c.value
              ? { id: c.id, status: 'verified' as const, actual: actual as number }
              : { id: c.id, status: 'mismatch' as const, actual: actual as number }
          }),
        }),
      }
      const viaService = await verifyCitations({ get: () => service }, { dataset, citations })
      const viaFallback = await verifyCitations({ get: () => undefined }, { dataset, citations })
      expect(viaService.result.results.map(r => [r.id, r.status]))
        .toEqual(viaFallback.result.results.map(r => [r.id, r.status]))
    })
  })
})
