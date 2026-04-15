import type { Query, SelectionNode, PredicateNode } from './ast.js'
import type { ValidationResult, ValidationError } from './result.js'

export function validate(query: Query): ValidationResult {
  const errors: ValidationError[] = []
  validateNode(query.selection, errors)
  return { valid: errors.length === 0, errors }
}

function validateNode(node: SelectionNode, errors: ValidationError[]): void {
  switch (node.type) {
    case 'and':
    case 'or':
      if (node.children.length < 2) {
        const op = node.type === 'and' ? '&&' : '||'
        errors.push({ message: `${op} requires at least 2 children, got ${node.children.length}` })
      }
      for (const child of node.children) {
        validateNode(child, errors)
      }
      break
    case 'not':
      validateNode(node.child, errors)
      break
    case 'unless':
      validateNode(node.selection, errors)
      validateNode(node.exclusion, errors)
      break
    default:
      validatePredicate(node as PredicateNode, errors)
  }
}

function validatePredicate(pred: PredicateNode, errors: ValidationError[]): void {
  switch (pred.type) {
    case 'ext':
      if (pred.extensions.length === 0) {
        errors.push({ message: 'ext: requires at least one extension' })
      }
      break
    case 'keyword':
      if (!pred.term) {
        errors.push({ message: 'keyword: requires a non-empty search term' })
      }
      break
    case 'file':
      if (pred.paths.length === 0) {
        errors.push({ message: 'file: requires at least one path' })
      }
      break
    case 'glob':
      if (!pred.pattern) {
        errors.push({ message: 'path: requires a non-empty pattern' })
      }
      break
    case 'tag':
      if (!pred.tag) {
        errors.push({ message: 'tag requires a non-empty tag string' })
      }
      break
    case 'tagged_section':
      if (!pred.openTag) {
        errors.push({ message: 'tagged_section requires a non-empty openTag' })
      }
      break
    case 'authored_by':
      if (!pred.author) {
        errors.push({ message: 'authored_by requires a non-empty author string' })
      }
      break
    case 'commit_message':
      if (!pred.term) {
        errors.push({ message: 'commit_message requires a non-empty search term' })
      }
      break
    case 'older_than':
    case 'newer_than':
      if (pred.duration.value <= 0) {
        errors.push({ message: `${pred.type === 'older_than' ? 'older' : 'newer'}: duration must be positive, got ${pred.duration.value}` })
      }
      break
    case 'diff':
      // ref is optional — no validation needed
      break
  }
}
