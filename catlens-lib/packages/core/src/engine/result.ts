import type { Query } from '../query/ast.js'
import type { SelectionResult, FileFacts, FileHit, SectionHit, DiffHit, Stats } from '../query/result.js'
import { evaluate } from './evaluate.js'
import { discover } from '../repo/discover.js'
import { collectFacts } from '../facts/collect.js'
import { collectGitFacts } from '../facts/git.js'
import { validate } from '../query/validator.js'

/**
 * Run the full pipeline: validate → discover → collect facts → evaluate → SelectionResult.
 * This is the single entry point for all frontends (CLI and MCP).
 */
export async function buildResult(
  query: Query,
  repoRoot: string,
): Promise<SelectionResult> {
  const validation = validate(query)
  if (!validation.valid) {
    const msg = validation.errors.map(e => e.message).join('; ')
    throw new Error(`Invalid query: ${msg}`)
  }

  const paths = await discover(repoRoot)
  const allFacts = await collectFacts(paths, repoRoot)

  // Collect git facts only if query uses git predicates
  const needsGit = queryUsesGit(query)
  let gitFactsMap = new Map<string, import('../query/result.js').GitFacts>()
  if (needsGit) {
    gitFactsMap = await collectGitFacts(repoRoot, paths)
  }

  // Merge git facts into FileFacts
  const factsWithGit: FileFacts[] = allFacts.map(f => {
    const git = gitFactsMap.get(f.path)
    return git ? { ...f, gitFacts: git } : f
  })

  const files: FileHit[] = []
  const sections: SectionHit[] = []

  for (const facts of factsWithGit) {
    const result = evaluate(query.selection, facts)
    if (result.matched) {
      files.push({
        path: facts.path,
        reasons: result.reasons,
        lineCount: facts.lineCount,
        content: facts.content,
      })
      if (result.sections && result.sections.length > 0) {
        sections.push(...result.sections)
      }
    }
  }

  // Collect diff hits from git-diff-matched files
  const diffs: DiffHit[] = []
  for (const file of files) {
    const git = gitFactsMap.get(file.path)
    if (git?.inCurrentDiff && git.diffPatch) {
      diffs.push({
        path: file.path,
        patch: git.diffPatch,
        reasons: file.reasons,
      })
    }
  }

  const stats = computeStats(files, sections, diffs)

  return { query, repoRoot, files, sections, diffs, stats }
}

function computeStats(
  files: readonly FileHit[],
  sections: readonly SectionHit[],
  diffs: readonly DiffHit[],
): Stats {
  const totalLines = files.reduce((sum, f) => sum + f.lineCount, 0)
  const estimatedChars = files.reduce((sum, f) => sum + f.content.length, 0)
  return {
    fileCount: files.length,
    sectionCount: sections.length,
    diffCount: diffs.length,
    totalLines,
    estimatedChars,
  }
}

function queryUsesGit(query: Query): boolean {
  return nodeUsesGit(query.selection)
}

function nodeUsesGit(node: import('../query/ast.js').SelectionNode): boolean {
  switch (node.type) {
    case 'authored_by':
    case 'older_than':
    case 'newer_than':
    case 'diff':
    case 'commit_message':
      return true
    case 'and':
    case 'or':
      return node.children.some(nodeUsesGit)
    case 'not':
      return nodeUsesGit(node.child)
    case 'unless':
      return nodeUsesGit(node.selection) || nodeUsesGit(node.exclusion)
    default:
      return false
  }
}
