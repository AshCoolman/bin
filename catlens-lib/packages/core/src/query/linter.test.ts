import { describe, it, expect } from 'vitest'
import { lint } from './linter.js'
import { parse } from './parser.js'

describe('lint', () => {
  it('reports no diagnostics for a clean query', () => {
    expect(lint(parse('ext:ts && keyword:checkout')).diagnostics).toEqual([])
  })

  it('warns on top-level ! (likely-zero-match)', () => {
    const d = lint(parse('!keyword:foo')).diagnostics
    expect(d).toHaveLength(1)
    expect(d[0]!.rule).toBe('likely-zero-match')
    expect(d[0]!.severity).toBe('warning')
  })

  it('warns on bare top-level ext: (suspiciously-broad)', () => {
    const d = lint(parse('ext:ts')).diagnostics
    expect(d.some(x => x.rule === 'suspiciously-broad' && x.severity === 'warning')).toBe(true)
  })

  it('warns on duplicate predicates within &&', () => {
    const d = lint(parse('ext:ts && ext:ts')).diagnostics
    expect(d.some(x => x.rule === 'duplicate-predicate')).toBe(true)
  })

  it('flags contradictory branches as error', () => {
    const d = lint(parse('keyword:foo && !keyword:foo')).diagnostics
    expect(d.some(x => x.rule === 'contradictory-branches' && x.severity === 'error')).toBe(true)
  })

  it('strict mode promotes warnings to errors', () => {
    const d = lint(parse('ext:ts && ext:ts'), { strict: true }).diagnostics
    expect(d.find(x => x.rule === 'duplicate-predicate')!.severity).toBe('error')
  })

  it('recurses into ! children', () => {
    const d = lint(parse('!(ext:ts && ext:ts)')).diagnostics
    expect(d.some(x => x.rule === 'duplicate-predicate')).toBe(true)
  })

  it('recurses into nested && groups', () => {
    const d = lint(parse('(ext:ts && ext:ts) && !(ext:js && ext:js)')).diagnostics
    expect(d.filter(x => x.rule === 'duplicate-predicate')).toHaveLength(2)
  })

  it('empty-group is an error (reachable only via AST input)', () => {
    const d = lint({ selection: { type: 'and', children: [] } }).diagnostics
    expect(d.some(x => x.rule === 'empty-group' && x.severity === 'error')).toBe(true)
  })

  it('strict mode leaves pre-existing errors unchanged', () => {
    const d = lint({ selection: { type: 'and', children: [] } }, { strict: true }).diagnostics
    const empty = d.find(x => x.rule === 'empty-group')!
    expect(empty.severity).toBe('error')
  })

  it('|| with duplicates also warns', () => {
    const d = lint(parse('ext:ts || ext:ts')).diagnostics
    expect(d.some(x => x.rule === 'duplicate-predicate')).toBe(true)
  })
})
