import type { AuthoredByPredicate } from '../../query/ast.js'
import type { FileFacts, Reason } from '../../query/result.js'

export function evalAuthoredBy(predicate: AuthoredByPredicate, facts: FileFacts): Reason | null {
  const git = facts.gitFacts
  if (!git) return null

  const term = predicate.author.toLowerCase()
  const nameMatch = git.lastAuthor?.toLowerCase().includes(term) ?? false
  const emailMatch = git.lastAuthorEmail?.toLowerCase().includes(term) ?? false

  if (nameMatch || emailMatch) {
    const detail = git.lastAuthor ?? git.lastAuthorEmail ?? predicate.author
    return { predicate: 'authored_by', detail }
  }
  return null
}
