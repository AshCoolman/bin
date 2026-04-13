import type { KeywordPredicate } from '../../query/ast.js'
import type { FileFacts, Reason } from '../../query/result.js'

export function evalKeyword(predicate: KeywordPredicate, facts: FileFacts): Reason | null {
  const haystack = predicate.caseSensitive === true
    ? facts.content
    : facts.content.toLowerCase()
  const needle = predicate.caseSensitive === true
    ? predicate.term
    : predicate.term.toLowerCase()

  if (haystack.includes(needle)) {
    return { predicate: 'keyword', detail: `matched "${predicate.term}"` }
  }
  return null
}
