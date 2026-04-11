import type { OlderThanPredicate, NewerThanPredicate, Duration } from '../../query/ast.js'
import type { FileFacts, Reason } from '../../query/result.js'

function durationToMs(d: Duration): number {
  const MS = {
    d: 86_400_000,
    w: 7 * 86_400_000,
    m: 30 * 86_400_000,
    y: 365 * 86_400_000,
  }
  return d.value * MS[d.unit]
}

export function evalOlderThan(predicate: OlderThanPredicate, facts: FileFacts): Reason | null {
  const date = facts.gitFacts?.lastCommitDate ?? facts.mtime
  const thresholdMs = durationToMs(predicate.duration)
  const ageMs = Date.now() - date.getTime()

  if (ageMs > thresholdMs) {
    return { predicate: 'older_than', detail: `${predicate.duration.value}${predicate.duration.unit}` }
  }
  return null
}

export function evalNewerThan(predicate: NewerThanPredicate, facts: FileFacts): Reason | null {
  const date = facts.gitFacts?.lastCommitDate ?? facts.mtime
  const thresholdMs = durationToMs(predicate.duration)
  const ageMs = Date.now() - date.getTime()

  if (ageMs < thresholdMs) {
    return { predicate: 'newer_than', detail: `${predicate.duration.value}${predicate.duration.unit}` }
  }
  return null
}
