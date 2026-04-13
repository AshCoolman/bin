import { describe, it, expect } from 'vitest'
import { format, formatSelection } from './formatter.js'
import { parse } from './parser.js'
import type { Query } from './ast.js'

const roundtrip = (dsl: string): string => format(parse(dsl))

describe('format', () => {
  describe('idempotent roundtrips', () => {
    const cases = [
      'ext(ts)',
      'and(ext(ts, tsx), keyword("checkout"))',
      'or(ext(ts), ext(js))',
      'not(keyword("foo"))',
      'file("a.ts", "b.ts")',
      'glob("src/**/*.ts")',
      'tag("@feat:auth")',
      'tag("@feat:auth", file)',
      'tagged_section("start")',
      'tagged_section("start", "end")',
      'diff()',
      'diff("main")',
      'commit_message("fix")',
      'authored_by("alice")',
      'older_than("30d")',
      'newer_than("2w")',
      'ext(ts) unless(keyword(".test."))',
    ]
    it.each(cases)('roundtrip: %s', (dsl) => {
      const once = roundtrip(dsl)
      const twice = roundtrip(once)
      expect(twice).toBe(once)
    })
  })

  it('sorts ext() extensions alphabetically', () => {
    expect(format(parse('ext(tsx, ts, js)'))).toBe('ext(js, ts, tsx)')
  })

  it('canonicalises any() → or() (preserving child order)', () => {
    expect(format(parse('any(ext(ts), ext(js))'))).toBe('or(ext(ts), ext(js))')
  })

  it('escapes backslashes and quotes in string args', () => {
    const q: Query = { selection: { type: 'keyword', term: 'a\\b"c' } }
    expect(format(q)).toBe('keyword("a\\\\b\\"c")')
  })

  it('formatSelection handles nested unless (from MCP AST input)', () => {
    const node: Query['selection'] = {
      type: 'and',
      children: [
        { type: 'ext', extensions: ['ts'] },
        {
          type: 'unless',
          selection: { type: 'keyword', term: 'foo' },
          exclusion: { type: 'keyword', term: 'bar' },
        },
      ],
    }
    expect(formatSelection(node)).toBe('and(ext(ts), keyword("foo") unless(keyword("bar")))')
  })
})
