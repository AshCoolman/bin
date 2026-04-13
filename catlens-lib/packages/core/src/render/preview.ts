import type { SelectionResult } from '../query/result.js'

export type PreviewOptions = {
  readonly showReasons?: boolean
}

/**
 * Render a SelectionResult as a compact terminal preview.
 * Does not include file contents.
 */
export function renderPreview(
  result: SelectionResult,
  options: PreviewOptions = {},
): string {
  const { stats, files } = result
  const kb = (stats.estimatedChars / 1024).toFixed(1)

  const lines: string[] = []
  lines.push(
    `Matched: ${stats.fileCount} ${stats.fileCount === 1 ? 'file' : 'files'}  |  ${stats.totalLines} lines  |  ~${kb} KB`,
  )

  if (files.length > 0) {
    const maxPathLen = Math.max(...files.map(f => f.path.length))
    const col = maxPathLen + 4
    lines.push('')
    for (const file of files) {
      const reasonStr = options.showReasons && file.reasons.length > 0
        ? `  [${file.reasons.map(r => r.detail ?? r.predicate).join(', ')}]`
        : ''
      lines.push(`  ${file.path.padEnd(col)}(${file.lineCount} lines)${reasonStr}`)
    }
  }

  return lines.join('\n')
}
