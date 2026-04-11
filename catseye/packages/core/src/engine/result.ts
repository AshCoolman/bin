import type { Query } from '../query/ast.js'
import type { SelectionResult, FileFacts, FileHit, Stats } from '../query/result.js'
import { evaluate } from './evaluate.js'
import { discover } from '../repo/discover.js'
import { collectFacts } from '../facts/collect.js'

/**
 * Run the full pipeline: discover → collect facts → evaluate → SelectionResult.
 * This is the single entry point for all frontends (CLI and MCP).
 */
export async function buildResult(
  query: Query,
  repoRoot: string,
): Promise<SelectionResult> {
  const paths = await discover(repoRoot)
  const allFacts = await collectFacts(paths, repoRoot)

  const files: FileHit[] = []

  for (const facts of allFacts) {
    const result = evaluate(query.selection, facts)
    if (result.matched) {
      files.push({
        path: facts.path,
        reasons: result.reasons,
        lineCount: facts.lineCount,
        content: facts.content,
      })
    }
  }

  const stats = computeStats(files)

  return {
    query,
    repoRoot,
    files,
    sections: [],
    diffs: [],
    stats,
  }
}

function computeStats(files: readonly FileHit[]): Stats {
  const totalLines = files.reduce((sum, f) => sum + f.lineCount, 0)
  const estimatedChars = files.reduce((sum, f) => sum + f.content.length, 0)
  return {
    fileCount: files.length,
    sectionCount: 0,
    diffCount: 0,
    totalLines,
    estimatedChars,
  }
}
