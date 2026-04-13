import type { DiffPredicate } from '../../query/ast.js'
import type { FileFacts, Reason } from '../../query/result.js'

export function evalDiff(predicate: DiffPredicate, facts: FileFacts): Reason | null {
  const git = facts.gitFacts
  if (!git) return null

  // Without a ref, match files in the current working diff
  if (!predicate.ref) {
    if (git.inCurrentDiff) {
      return { predicate: 'diff' }
    }
    return null
  }

  // With a ref, we'd need to compare against that ref.
  // For now, fall back to current diff behaviour (Phase 7 basic implementation).
  // Full ref-based diffing would require additional git calls in the facts collector.
  if (git.inCurrentDiff) {
    return { predicate: 'diff', detail: predicate.ref }
  }
  return null
}
