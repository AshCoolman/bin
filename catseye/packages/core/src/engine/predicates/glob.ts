import { minimatch } from 'minimatch'
import type { GlobPredicate } from '../../query/ast.js'
import type { FileFacts, Reason } from '../../query/result.js'

export function evalGlob(predicate: GlobPredicate, facts: FileFacts): Reason | null {
  const matched = minimatch(facts.path, predicate.pattern, { dot: true })
  if (!matched) return null
  return { predicate: 'glob', detail: predicate.pattern }
}
