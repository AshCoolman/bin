import type { SelectionNode, PredicateNode } from '../query/ast.js'
import type { FileFacts, Reason } from '../query/result.js'
import { evalExt } from './predicates/ext.js'
import { evalKeyword } from './predicates/keyword.js'
import { evalFile } from './predicates/file.js'

export type EvalResult = {
  readonly matched: boolean
  readonly reasons: readonly Reason[]
}

/**
 * Evaluate a SelectionNode against FileFacts.
 * Returns whether the file matches and the reasons why.
 */
export function evaluate(node: SelectionNode, facts: FileFacts): EvalResult {
  switch (node.type) {
    case 'and': {
      const allReasons: Reason[] = []
      for (const child of node.children) {
        const r = evaluate(child, facts)
        if (!r.matched) return { matched: false, reasons: [] }
        allReasons.push(...r.reasons)
      }
      return { matched: true, reasons: allReasons }
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
  let reason: Reason | null = null

  switch (predicate.type) {
    case 'ext':
      reason = evalExt(predicate, facts)
      break
    case 'keyword':
      reason = evalKeyword(predicate, facts)
      break
    case 'file':
      reason = evalFile(predicate, facts)
      break
    case 'glob':
    case 'tag':
    case 'tagged_section':
    case 'diff':
    case 'commit_message':
    case 'authored_by':
    case 'older_than':
    case 'newer_than':
      // Unimplemented predicates return no match (Phase 7)
      return { matched: false, reasons: [] }
  }

  if (reason !== null) {
    return { matched: true, reasons: [reason] }
  }
  return { matched: false, reasons: [] }
}
