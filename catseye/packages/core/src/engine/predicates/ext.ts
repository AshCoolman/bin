import type { ExtPredicate } from '../../query/ast.js'
import type { FileFacts, Reason } from '../../query/result.js'

export function evalExt(predicate: ExtPredicate, facts: FileFacts): Reason | null {
  if (predicate.extensions.includes(facts.extension)) {
    return { predicate: 'ext', detail: facts.extension }
  }
  return null
}
