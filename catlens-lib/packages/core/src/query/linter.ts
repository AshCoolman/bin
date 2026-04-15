import type { Query, SelectionNode, AndNode, OrNode } from './ast.js'
import type { LintResult, LintDiagnostic } from './result.js'
import { formatSelection } from './formatter.js'

export type LintOptions = {
  /**
   * In strict mode, all warnings are promoted to errors.
   * Saved lenses always use strict mode.
   * Ad hoc queries default to non-strict (warnings stay as warnings).
   */
  readonly strict?: boolean
}

export function lint(query: Query, options: LintOptions = {}): LintResult {
  const diagnostics: LintDiagnostic[] = []
  lintTopLevel(query, diagnostics)
  lintNode(query.selection, diagnostics)

  if (options.strict) {
    return {
      diagnostics: diagnostics.map(d =>
        d.severity === 'warning' ? { ...d, severity: 'error' as const } : d,
      ),
    }
  }
  return { diagnostics }
}

function lintTopLevel(query: Query, diagnostics: LintDiagnostic[]): void {
  const node = query.selection

  // likely-zero-match: selection is not() at top level — always empty
  if (node.type === 'not') {
    diagnostics.push({
      severity: 'warning',
      rule: 'likely-zero-match',
      message: 'Top-level ! always matches nothing — use with && to narrow',
    })
  }

  // suspiciously-broad: single ext: at top level with no other narrowing
  if (node.type === 'ext') {
    diagnostics.push({
      severity: 'warning',
      rule: 'suspiciously-broad',
      message: `ext: alone matches every file with those extensions — use && keyword: or other predicates to narrow`,
    })
  }
}

function lintNode(node: SelectionNode, diagnostics: LintDiagnostic[]): void {
  switch (node.type) {
    case 'and':
      lintGroup('and', node, diagnostics)
      break
    case 'or':
      lintGroup('or', node, diagnostics)
      break
    case 'not':
      lintNode(node.child, diagnostics)
      break
    case 'unless':
      lintNode(node.selection, diagnostics)
      lintNode(node.exclusion, diagnostics)
      break
    // predicate leaves: no nested structure to lint
  }
}

function lintGroup(op: 'and' | 'or', node: AndNode | OrNode, diagnostics: LintDiagnostic[]): void {
  const formatted = node.children.map(c => formatSelection(c))

  // empty-group
  if (node.children.length === 0) {
    diagnostics.push({
      severity: 'error',
      rule: 'empty-group',
      message: `${op === 'and' ? '&&' : '||'} has no children`,
    })
    return
  }

  // duplicate-predicate
  const seen = new Set<string>()
  for (const f of formatted) {
    if (seen.has(f)) {
      diagnostics.push({
        severity: 'warning',
        rule: 'duplicate-predicate',
        message: `Duplicate predicate in ${op === 'and' ? '&&' : '||'}: ${f}`,
      })
    }
    seen.add(f)
  }

  // contradictory-branches / always-empty (and only)
  if (op === 'and') {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!
      if (child.type === 'not') {
        const negatedFmt = formatSelection(child.child)
        if (formatted.some((f, j) => j !== i && f === negatedFmt)) {
          diagnostics.push({
            severity: 'error',
            rule: 'contradictory-branches',
            message: `&& contains both ${negatedFmt} and !(${negatedFmt}) — always empty`,
          })
        }
      }
    }
  }

  // recurse into children
  for (const child of node.children) {
    lintNode(child, diagnostics)
  }
}
