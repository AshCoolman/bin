import type { TaggedSectionPredicate } from '../../query/ast.js'
import type { FileFacts, SectionHit, Reason } from '../../query/result.js'

export type TaggedSectionResult = {
  readonly matched: boolean
  readonly sections: readonly SectionHit[]
  readonly reason: Reason | null
}

export function evalTaggedSection(
  predicate: TaggedSectionPredicate,
  facts: FileFacts,
): TaggedSectionResult {
  const openTag = predicate.openTag
  const closeTag = predicate.closeTag ?? openTag.replace(/start/i, 'end').replace(/begin/i, 'end')
  const lines = facts.content.split('\n')
  const sections: SectionHit[] = []

  let startLine: number | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (startLine === null) {
      if (line.includes(openTag)) {
        startLine = i + 1 // 1-indexed
      }
    } else {
      if (line.includes(closeTag)) {
        const endLine = i + 1
        const content = lines.slice(startLine, i).join('\n')
        sections.push({
          path: facts.path,
          startLine,
          endLine,
          tag: openTag,
          reasons: [{ predicate: 'tagged_section', detail: openTag }],
          content,
        })
        startLine = null
      }
    }
  }

  if (sections.length === 0) return { matched: false, sections: [], reason: null }
  return {
    matched: true,
    sections,
    reason: { predicate: 'tagged_section', detail: openTag },
  }
}
