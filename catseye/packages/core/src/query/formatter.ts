import type { Query, SelectionNode, PredicateNode } from './ast.js'

/**
 * Format a Query AST into canonical DSL form.
 * - Canonical operator names: `or` not `any`
 * - Extensions: sorted, unquoted
 * - Strings: double-quoted
 * - Idempotent: format(parse(format(q))) === format(q)
 */
export function format(query: Query): string {
  const node = query.selection
  if (node.type === 'unless') {
    // unless is a top-level suffix modifier in the DSL
    return `${formatSelection(node.selection)} unless(${formatSelection(node.exclusion)})`
  }
  return formatSelection(node)
}

/**
 * Format a SelectionNode to its canonical DSL string.
 * Exported for use by linter and other internal consumers.
 */
export function formatSelection(node: SelectionNode): string {
  switch (node.type) {
    case 'and':
      return `and(${node.children.map(formatSelection).join(', ')})`
    case 'or':
      return `or(${node.children.map(formatSelection).join(', ')})`
    case 'not':
      return `not(${formatSelection(node.child)})`
    case 'unless':
      // Nested unless (from MCP AST input): format inline
      return `${formatSelection(node.selection)} unless(${formatSelection(node.exclusion)})`
    default:
      return formatPredicate(node as PredicateNode)
  }
}

function formatPredicate(pred: PredicateNode): string {
  switch (pred.type) {
    case 'ext': {
      const exts = [...pred.extensions].sort().join(', ')
      return `ext(${exts})`
    }
    case 'keyword':
      return `keyword(${q(pred.term)})`
    case 'file':
      return `file(${pred.paths.map(q).join(', ')})`
    case 'glob':
      return `glob(${q(pred.pattern)})`
    case 'tag':
      return pred.scope === 'file'
        ? `tag(${q(pred.tag)}, file)`
        : `tag(${q(pred.tag)})`
    case 'tagged_section':
      return pred.closeTag !== undefined
        ? `tagged_section(${q(pred.openTag)}, ${q(pred.closeTag)})`
        : `tagged_section(${q(pred.openTag)})`
    case 'diff':
      return pred.ref !== undefined ? `diff(${q(pred.ref)})` : `diff()`
    case 'commit_message':
      return `commit_message(${q(pred.term)})`
    case 'authored_by':
      return `authored_by(${q(pred.author)})`
    case 'older_than':
      return `older_than(${q(fmtDur(pred.duration))})`
    case 'newer_than':
      return `newer_than(${q(fmtDur(pred.duration))})`
  }
}

function q(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function fmtDur(d: { value: number; unit: string }): string {
  return `${d.value}${d.unit}`
}
