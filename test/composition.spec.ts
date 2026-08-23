/**
 * Real Loader composition suite (C3): an independent process mounts the Loader
 * over a cordis.yml with the real harness service rows (session/system-prompt/
 * tools) plus the real storage seam (dsh-storage + JSON backend +
 * dsh-storage-domain), then the plugin row with config. The plugin row points
 * at the built `lib/index.js`, so the suite also carries the plain-Node built
 * entry smoke (A1). The invalid-config negative is here too: an out-of-bounds
 * `requestIntervalMs` must fail loud for the expected reason (U4).
 * @module dsh-fund-research/test/composition.spec
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runner = join(repositoryRoot, 'scripts', 'loader-runner.mjs')
const builtEntry = join(repositoryRoot, 'lib', 'index.js')

const temporaryRoot = mkdtempSync(join(tmpdir(), 'dsh-fund-research-loader-'))
const storageRoot = join(temporaryRoot, 'storage')
mkdirSync(storageRoot, { recursive: true })

/** One cordis.yml: real harness + storage service rows, then the plugin row. */
function configFor(pluginRow: string, configLines: string[] = []): string {
  return [
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-storage'",
    "- name: '@deepseek-ai/dsh-storage-json'",
    '  config:',
    `    root: ${JSON.stringify(storageRoot)}`,
    "- name: '@deepseek-ai/dsh-storage-domain'",
    '  config:',
    '    backend: json',
    `- name: ${JSON.stringify(pluginRow)}`,
    ...(configLines.length > 0 ? ['  config:', ...configLines.map(line => `    ${line}`)] : []),
    '',
  ].join('\n')
}

function runRunner(configPath: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [runner, configPath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env },
    timeout: 120_000,
  })
  if (result.error !== undefined) throw result.error
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

beforeAll(() => {
  const build = spawnSync('pnpm', ['run', 'build'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env },
    timeout: 120_000,
  })
  if (build.status !== 0) {
    throw new Error(`build failed (${String(build.status)}):\n${build.stdout}\n${build.stderr}`)
  }
}, 120_000)

describe('Loader composition (built entry)', () => {
  it('mounts the plugin through the real Loader and registers both tools', () => {
    const configPath = join(temporaryRoot, 'valid.yml')
    writeFileSync(configPath, configFor(pathToFileURL(builtEntry).href, ['offline: true']))
    const evidence = runRunner(configPath)
    expect(evidence.status, `stdout:\n${evidence.stdout}\nstderr:\n${evidence.stderr}`).toBe(0)
    const marker = evidence.stdout.match(/DSH_LOADER_RESULT (.+)$/mu)
    expect(marker).not.toBeNull()
    const summary = JSON.parse(marker![1]!) as { tools: string[] }
    for (const name of ['fund_snapshot', 'fund_research']) {
      expect(summary.tools).toContain(name)
    }
  })

  it('rejects invalid config through the Loader for the expected reason', () => {
    const entryUrl = pathToFileURL(builtEntry).href
    const configPath = join(temporaryRoot, 'invalid.yml')
    writeFileSync(configPath, configFor(entryUrl, ['requestIntervalMs: -1']))
    const evidence = runRunner(configPath)
    expect(evidence.status, `invalid config unexpectedly mounted:\n${evidence.stdout}\n${evidence.stderr}`).not.toBe(0)
    expect(evidence.stderr, `failed for the wrong reason:\n${evidence.stderr}`).toMatch(/requestIntervalMs/u)
  })
})

afterAll(() => {
  rmSync(temporaryRoot, { recursive: true, force: true })
})
