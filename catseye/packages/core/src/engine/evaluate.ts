import type { SelectionNode, PredicateNode } from '../query/ast.js'
import type { FileFacts, SectionHit, Reason } from '../query/result.js'
import { evalExt } from './predicates/ext.js'
import { evalKeyword } from './predicates/keyword.js'
import { evalFile } from './predicates/file.js'
import { evalGlob } from './predicates/glob.js'
import { evalTag } from './predicates/tag.js'
import { evalTaggedSection } from './predicates/tagged-section.js'
import { evalAuthoredBy } from './predicates/authored-by.js'
import { evalOlderThan, evalNewerThan } from './predicates/age.js'
import { evalDiff } from './predicates/diff.js'
import { evalCommitMessage } from './predicates/commit-message.js'

export type EvalResult = {
  readonly matched: boolean
  readonly reasons: readonly Reason[]
  readonly sections?: readonly SectionHit[]
}

/**
 * Evaluate a SelectionNode against FileFacts.
 * Returns whether the file matches, the reasons why, and any section hits.
 */
export function evaluate(node: SelectionNode, facts: FileFacts): EvalResult {
  switch (node.type) {
    case 'and': {
      const allReasons: Reason[] = []
      const allSections: SectionHit[] = []
      for (const child of node.children) {
        const r = evaluate(child, facts)
        if (!r.matched) return { matched: false, reasons: [] }
        allReasons.push(...r.reasons)
        if (r.sections) allSections.push(...r.sections)
      }
      return { matched: true, reasons: allReasons, sections: allSections }
    }

    case 'or': {
      for (const child of node.children) {
        const r = evaluate(child, facts)
        if (r.matched) return r
      }
      return { matched: false, reasons: [] }
    }

    case 'not': {
      const r = evaluate(node.child, facts)
      return { matched: !r.matched, reasons: r.matched ? [] : [{ predicate: 'not' }] }
    }

    case 'unless': {
      const base = evaluate(node.selection, facts)
      if (!base.matched) return { matched: false, reasons: [] }
      const excl = evaluate(node.exclusion, facts)
      if (excl.matched) return { matched: false, reasons: [] }
      return base
    }

    default:
      return evaluatePredicate(node as PredicateNode, facts)
  }
}

function evaluatePredicate(predicate: PredicateNode, facts: FileFacts): EvalResult {
  switch (predicate.type) {
    case 'ext': {
      const r = evalExt(predicate, facts)
      return r ? { matched: true, reasons: [r] } : { matched: false, reasons: [] }
    }
    case 'keyword': {
      const r = evalKeyword(predicate, facts)
      return r ? { matched: true, reasons: [r] } : { matched: false, reasons: [] }
    }
    case 'file': {
      const r = evalFile(predicate, facts)
      return r ? { matched: true, reasons: [r] } : { matched: false, reasons: [] }
    }
    case 'glob': {
      const r = evalGlob(predicate, facts)
      return r ? { matched: true, reasons: [r] } : { matched: false, reasons: [] }
    }
    case 'tag': {
      const r = evalTag(predicate, facts)
      return r ? { matched: true, reasons: [r] } : { matched: false, reasons: [] }
    }
    case 'tagged_section': {
      const r = evalTaggedSection(predicate, facts)
      if (!r.matched) return { matched: false, reasons: [] }
      return { matched: true, reasons: r.reason ? [r.reason] : [], sections: r.sections }
    }
    case 'authored_by': {
      const r = evalAuthoredBy(predicate, facts)
      return r ? { matched: true, reasons: [r] } : { matched: false, reasons: [] }
    }
    case 'older_than': {
      const r = evalOlderThan(predicate, facts)
      return r ? { matched: true, reasons: [r] } : { matched: false, reasons: [] }
    }
    case 'newer_than': {
      const r = evalNewerThan(predicate, facts)
      return r ? { matched: true, reasons: [r] } : { matched: false, reasons: [] }
    }
    case 'diff': {
      const r = evalDiff(predicate, facts)
      return r ? { matched: true, reasons: [r] } : { matched: false, reasons: [] }
    }
    case 'commit_message': {
      const r = evalCommitMessage(predicate, facts)
      return r ? { matched: true, reasons: [r] } : { matched: false, reasons: [] }
    }
  }
}
