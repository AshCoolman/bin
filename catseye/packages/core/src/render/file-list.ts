import type { SelectionResult } from '../query/result.js'

/**
 * Render a SelectionResult as a plain file list (one path per line).
 */
export function renderFileList(result: SelectionResult): string {
  return result.files.map(f => f.path).join('\n')
}
