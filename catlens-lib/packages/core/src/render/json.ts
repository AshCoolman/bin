import type { SelectionResult } from '../query/result.js'

/**
 * Render a SelectionResult as structured JSON.
 * The content field of each FileHit is included.
 */
export function renderJson(result: SelectionResult): string {
  return JSON.stringify(result, null, 2)
}
