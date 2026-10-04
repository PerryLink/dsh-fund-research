// scripts/loader-runner.mjs — real Loader composition runner (C3). An
// independent process boots a real Context, mounts the vendored Loader with
// the Include builtin, reads the given cordis.yml (real harness service rows +
// storage seam + the plugin row + config), then asserts the plugin's
// contributions through the authoritative tools registry. dsh-fund-research
// injects `tools` and `storageDomain`, so the composition carries the real
// storage seam (dsh-storage + the JSON backend + dsh-storage-domain) alongside
// the harness services.
//
// Usage: node scripts/loader-runner.mjs <cordis.yml>
// Exit 0 prints `DSH_LOADER_RESULT <json>`; any assertion or load failure
// exits non-zero with the reason on stderr (used by the invalid-config
// regression case in test/composition.spec.ts). A row whose `apply` threw is
// re-checked through `rethrowFirstFailedRow()`, because `loader.await()` no
// longer rejects on it (see that helper).

import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const configArgument = process.argv[2]
if (configArgument === undefined) {
  console.error('usage: loader-runner.mjs <cordis.yml>')
  process.exit(2)
}

const configPath = resolve(configArgument)
// Resolve bare package rows from this repository's dependency tree so the
// composition works with config files written anywhere (e.g. a temp dir).
const configRequire = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'))

const ctx = new Context()
try {
  ctx.baseUrl = `${pathToFileURL(dirname(configPath)).href}/`
  await ctx.plugin(Loader)
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier) {
      if (specifier.startsWith('file:')) return import(specifier)
      if (specifier.startsWith('node:')) return import(specifier)
      const absolute = /^([a-zA-Z]:)?[\\/]/u.test(specifier)
      return import(pathToFileURL(absolute ? specifier : configRequire.resolve(specifier)).href)
    },
  }
  ctx.loader.builtins.include = Include
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()
  await rethrowFirstFailedRow()

  // Authoritative registry carries the plugin's two tools.
  const names = ctx.tools.schemas().map(schema => schema.name)
  for (const expected of ['fund_snapshot', 'fund_research']) {
    if (!names.includes(expected)) {
      throw new Error(`Loader composition: ${expected} tool is missing from the tools registry`)
    }
  }

  process.stdout.write(`DSH_LOADER_RESULT ${JSON.stringify({ tools: names })}\n`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await ctx.fiber.dispose()
}

/**
 * Re-throw the first FAILED loader row's own reason.
 *
 * `cordis-plugin-loader` 1.0.6 dropped the failure surface `await()` had in
 * 1.0.4: the old body collected `entry._await()` outcomes and threw the single
 * failure (or an AggregateError), while 1.0.6's body only loops over
 * `entry._initTask || entry.fiber?.inertia` and returns as soon as no task is
 * pending. `Entry._reload()` resolves `fiber.inertia` in the same turn it
 * swallows the throw into `fiber._error`, so by the time `loader.await()`
 * returns, a row whose `apply` threw (invalid config, missing inject) has
 * already lost both its `_initTask` and its `inertia` — the await cannot see
 * it and resolves cleanly. The negative regressions below would then fail on
 * the downstream symptom ("tool is missing from the tools registry") instead
 * of the real cause, which is a silently weaker test.
 *
 * `Fiber.await()` still rethrows that stored error, and a row keeps its fiber
 * for the life of the entry, so walking the tree restores the reason without
 * depending on the resurrected 1.0.4 API. Calling it on a healthy row is a
 * no-op, which keeps this runner correct on both loader lines.
 *
 * `DSH_LOADER_RUNNER_NO_RETHROW=1` disables the walk for re-measurement only.
 */
async function rethrowFirstFailedRow() {
  if (process.env.DSH_LOADER_RUNNER_NO_RETHROW === '1') return
  const failures = []
  for (const entry of ctx.loader.entries()) {
    const fiber = entry.fiber
    // FiberState.FAILED === 3 (const enum, erased at runtime): the row did not
    // activate, so it contributed no tools. Re-awaiting it surfaces why.
    if (!fiber || fiber.state !== 3) continue
    try {
      await fiber.await()
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, 'loader rows failed')
}
