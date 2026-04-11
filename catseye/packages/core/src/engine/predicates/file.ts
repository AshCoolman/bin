import type { FilePathPredicate } from '../../query/ast.js'
import type { FileFacts, Reason } from '../../query/result.js'

export function evalFile(predicate: FilePathPredicate, facts: FileFacts): Reason | null {
  const norm = facts.path.replace(/\\/g, '/')
  for (const p of predicate.paths) {
    if (norm === p.replace(/\\/g, '/')) {
      return { predicate: 'file', detail: p }
    }
  }
  return null
}
