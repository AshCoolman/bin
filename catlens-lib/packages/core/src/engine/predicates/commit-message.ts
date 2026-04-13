import type { CommitMessagePredicate } from '../../query/ast.js'
import type { FileFacts, Reason } from '../../query/result.js'

export function evalCommitMessage(predicate: CommitMessagePredicate, facts: FileFacts): Reason | null {
  const message = facts.gitFacts?.lastCommitMessage
  if (!message) return null

  if (message.toLowerCase().includes(predicate.term.toLowerCase())) {
    return { predicate: 'commit_message', detail: predicate.term }
  }
  return null
}
