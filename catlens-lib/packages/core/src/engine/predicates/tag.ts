import type { TagPredicate } from '../../query/ast.js'
import type { FileFacts, Reason } from '../../query/result.js'

const FILE_SCOPE_LINES = 10

export function evalTag(predicate: TagPredicate, facts: FileFacts): Reason | null {
  const searchIn =
    predicate.scope === 'file'
      ? facts.content.split('\n').slice(0, FILE_SCOPE_LINES).join('\n')
      : facts.content

  if (searchIn.includes(predicate.tag)) {
    return { predicate: 'tag', detail: predicate.tag }
  }
  return null
}
