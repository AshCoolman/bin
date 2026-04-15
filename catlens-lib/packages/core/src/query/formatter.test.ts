import { describe, it, expect } from 'vitest'
import { format, formatSelection } from './formatter.js'
import { parse } from './parser.js'
import type { Query } from './ast.js'

const roundtrip = (dsl: string): string => format(parse(dsl))

describe('format', () => {
  describe('idempotent roundtrips', () => {
    const cases = [
      'ext:ts',
      'ext:js,ts,tsx && keyword:checkout',
      'ext:ts || ext:js',
      '!keyword:foo',
      'file:a.ts,b.ts',
      'path:src/**/*.ts',
      'diff:',
      'diff:main',
      'older:30d',
      'newer:2w',
      'ext:ts && !keyword:foo',
      'ext:ts && (keyword:a || keyword:b)',
    ]
    it.each(cases)('roundtrip: %s', (dsl) => {
      const once = roundtrip(dsl)
      const twice = roundtrip(once)
      expect(twice).toBe(once)
    })
  })

  it('sorts ext extensions alphabetically', () => {
    expect(format(parse('ext:tsx,ts,js'))).toBe('ext:js,ts,tsx')
  })

  it('or child of and gets parens', () => {
    expect(format(parse('(ext:ts || ext:js) && keyword:checkout')))
      .toBe('(ext:ts || ext:js) && keyword:checkout')
  })

  it('and child of not gets parens', () => {
    expect(format(parse('!(ext:ts && keyword:foo)'))).toBe('!(ext:ts && keyword:foo)')
  })

  it('or child of not gets parens', () => {
    expect(format(parse('!(ext:ts || ext:js)'))).toBe('!(ext:ts || ext:js)')
  })

  it('keyword with spaces gets quoted', () => {
    const q: Query = { selection: { type: 'keyword', term: 'my checkout' } }
    expect(format(q)).toBe('keyword:"my checkout"')
  })

  it('keyword with special chars escapes and roundtrips', () => {
    const q: Query = { selection: { type: 'keyword', term: 'a\\b"c' } }
    const formatted = format(q)
    expect(parse(formatted).selection).toEqual(q.selection)
  })

  it('unless node (stored lens compat) formats as && !()', () => {
    const node: Query['selection'] = {
      type: 'unless',
      selection: { type: 'keyword', term: 'foo' },
      exclusion: { type: 'keyword', term: 'bar' },
    }
    expect(formatSelection(node)).toBe('keyword:foo && !(keyword:bar)')
  })
})
