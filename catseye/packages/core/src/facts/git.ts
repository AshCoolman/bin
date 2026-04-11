import { simpleGit } from 'simple-git'
import type { GitFacts } from '../query/result.js'

/**
 * Collect git facts for a list of relative paths.
 * Returns an empty Map if git is unavailable or the directory is not a repo.
 * Never throws — always degrades gracefully.
 */
export async function collectGitFacts(
  repoRoot: string,
  paths: readonly string[],
): Promise<Map<string, GitFacts>> {
  const result = new Map<string, GitFacts>()

  let git
  try {
    git = simpleGit(repoRoot)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) return result
  } catch {
    return result
  }

  // Collect diff paths (files in current diff: staged + unstaged)
  const diffPaths = new Set<string>()
  const diffPatches = new Map<string, string>()
  try {
    const stagedStatus = await git.diff(['--name-only', '--cached'])
    const unstagedStatus = await git.diff(['--name-only'])
    for (const p of stagedStatus.trim().split('\n').filter(Boolean)) {
      diffPaths.add(p)
    }
    for (const p of unstagedStatus.trim().split('\n').filter(Boolean)) {
      diffPaths.add(p)
    }

    // Get patches for diff files
    for (const p of diffPaths) {
      try {
        const patch = await git.diff([p])
        if (patch) diffPatches.set(p, patch)
      } catch {
        // ignore per-file patch errors
      }
    }
  } catch {
    // diff not available (e.g., no commits yet) — continue
  }

  // Collect per-file log facts
  for (const filePath of paths) {
    try {
      const log = await git.log({ file: filePath, maxCount: 1 })
      const latest = log.latest
      if (!latest) continue

      const patch = diffPatches.get(filePath)
      result.set(filePath, {
        lastAuthor: latest.author_name,
        lastAuthorEmail: latest.author_email,
        lastCommitDate: new Date(latest.date),
        lastCommitMessage: latest.message,
        inCurrentDiff: diffPaths.has(filePath),
        ...(patch !== undefined ? { diffPatch: patch } : {}),
      })
    } catch {
      // skip files with no log entries
    }
  }

  return result
}
