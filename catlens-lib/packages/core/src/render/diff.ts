import type { SelectionResult } from '../query/result.js'

/**
 * Render unified diff patches from SelectionResult.diffs.
 * Falls back to file-list output if no diffs are present.
 */
export function renderDiff(result: SelectionResult): string {
  if (result.diffs.length === 0) {
    if (result.files.length === 0) return ''
    // No diffs available; list matched file paths instead
    return result.files.map(f => f.path).join('\n')
  }

  const parts: string[] = []
  for (const d of result.diffs) {
    parts.push(`--- ${d.path}`)
    parts.push(d.patch)
  }
  return parts.join('\n')
}
