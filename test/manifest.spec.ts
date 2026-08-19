import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')

/**
 * Row `name:` keys sit at the six-space indent directly under each `- id:`
 * list item of the bundle patch (config keys under `config:` nest deeper).
 */
function rowNames(patchText: string): string[] {
  const names: string[] = []
  for (const line of patchText.split('\n')) {
    const match = /^ {6}name:\s*(?:'([^']+)'|"([^"]+)"|(\S+))\s*$/.exec(line)
    if (match) names.push(match[1] ?? match[2] ?? match[3] ?? '')
  }
  return names
}

describe('cordis.patch.yml manifest consistency', () => {
  it('every external row name is declared in dependencies or peerDependencies', () => {
    const declared = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ])
    for (const name of rowNames(patch)) {
      const own = name === pkg.name || name.startsWith(`${pkg.name}/`)
      expect(own || declared.has(name), `patch row "${name}" must be declared`).toBe(true)
    }
  })

  it('inserts the full storage stack so a bare profile gets a storage domain', () => {
    const names = rowNames(patch)
    for (const storage of [
      '@deepseek-ai/dsh-storage',
      '@deepseek-ai/dsh-storage-json',
      '@deepseek-ai/dsh-storage-domain',
    ]) {
      expect(names, `patch must insert ${storage}`).toContain(storage)
    }
  })

  it('declares the dsh.bundle manifest and the workshop schema', () => {
    expect(pkg.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(pkg.dshWorkshop?.schema).toBe('omdsh-workshop-package/v1')
    expect(pkg.dshWorkshop?.capability?.id).toBe('fund-research')
  })
})
