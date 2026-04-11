import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import ignore, { type Ignore } from 'ignore'

/**
 * Discover all candidate file paths in a repo, respecting .gitignore rules.
 * Returns paths relative to repoRoot, sorted alphabetically.
 */
export async function discover(repoRoot: string): Promise<string[]> {
  const ig = await loadIgnoreRules(repoRoot)

  const absolutePaths = await fg('**/*', {
    cwd: repoRoot,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
    ],
  })

  const relativePaths = absolutePaths
    .map(p => path.normalize(p))
    .filter(p => !ig.ignores(p))
    .sort()

  return relativePaths
}

async function loadIgnoreRules(repoRoot: string): Promise<Ignore> {
  const ig = ignore()
  const gitignorePath = path.join(repoRoot, '.gitignore')

  if (existsSync(gitignorePath)) {
    try {
      const content = await readFile(gitignorePath, 'utf8')
      ig.add(content)
    } catch {
      // ignore read errors
    }
  }

  return ig
}
