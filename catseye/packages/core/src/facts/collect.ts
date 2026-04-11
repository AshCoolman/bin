import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { FileFacts } from '../query/result.js'

/**
 * Collect basic facts about a set of files.
 * Returns FileFacts[] with path, content, lineCount, and extension.
 * Git facts are not collected here — see facts/git.ts (Phase 7).
 */
export async function collectFacts(
  paths: string[],
  repoRoot: string,
): Promise<FileFacts[]> {
  const results = await Promise.all(
    paths.map(p => collectFileFacts(p, repoRoot)),
  )
  return results.filter((f): f is FileFacts => f !== null)
}

async function collectFileFacts(
  relativePath: string,
  repoRoot: string,
): Promise<FileFacts | null> {
  const absolutePath = path.join(repoRoot, relativePath)
  const ext = path.extname(relativePath).replace(/^\./, '')

  let content: string
  let mtime: Date
  try {
    ;[content, { mtime }] = await Promise.all([
      readFile(absolutePath, 'utf8'),
      stat(absolutePath),
    ])
  } catch {
    return null
  }

  const lineCount = content.split('\n').length

  return {
    path: relativePath,
    content,
    lineCount,
    extension: ext,
    mtime,
  }
}
