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
// regression case in test/composition.spec.ts).

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
