import type { Query, SelectionNode, PredicateNode } from './ast.js'

/**
 * Format a Query AST into canonical DSL form.
 * Idempotent: format(parse(format(q))) === format(q)
 */
export function format(query: Query): string {
  return formatSelection(query.selection)
}

/**
 * Format a SelectionNode to its canonical DSL string.
 * Exported for use by linter and other internal consumers.
 */
export function formatSelection(node: SelectionNode): string {
  switch (node.type) {
    case 'and':
      return node.children.map(c =>
        c.type === 'or' ? `(${formatSelection(c)})` : formatSelection(c),
      ).join(' && ')
    case 'or':
      return node.children.map(formatSelection).join(' || ')
    case 'not': {
      const inner = formatSelection(node.child)
      return (node.child.type === 'and' || node.child.type === 'or')
        ? `!(${inner})`
        : `!${inner}`
    }
    case 'unless':
      // Backward compat: unless nodes from stored lenses render as && !()
      return `${formatSelection(node.selection)} && !(${formatSelection(node.exclusion)})`
    default:
      return formatPredicate(node as PredicateNode)
  }
}

function formatPredicate(pred: PredicateNode): string {
  switch (pred.type) {
    case 'ext':
      return `ext:${[...pred.extensions].sort().join(',')}`
    case 'keyword':
      return needsQuoting(pred.term)
        ? `keyword:"${escapeStr(pred.term)}"`
        : `keyword:${pred.term}`
    case 'glob':
      return `path:${pred.pattern}`
    case 'file':
      return `file:${pred.paths.join(',')}`
    case 'diff':
      return pred.ref !== undefined ? `diff:${pred.ref}` : `diff:`
    case 'older_than':
      return `older:${fmtDur(pred.duration)}`
    case 'newer_than':
      return `newer:${fmtDur(pred.duration)}`
    // Legacy predicates from stored lenses — render as best-effort strings
    case 'tag':
      return pred.scope === 'file'
        ? `tag:"${pred.tag}",file`
        : `tag:${pred.tag}`
    case 'tagged_section':
      return pred.closeTag !== undefined
        ? `tagged_section:"${pred.openTag}","${pred.closeTag}"`
        : `tagged_section:"${pred.openTag}"`
    case 'commit_message':
      return `commit_message:"${escapeStr(pred.term)}"`
    case 'authored_by':
      return `authored_by:"${escapeStr(pred.author)}"`
  }
}

function needsQuoting(s: string): boolean {
  return !s || /[\s&|!()]/.test(s)
}

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function fmtDur(d: { value: number; unit: string }): string {
  return `${d.value}${d.unit}`
}
