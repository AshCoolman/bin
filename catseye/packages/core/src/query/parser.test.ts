import { describe, it, expect } from 'vitest'
import { parse, ParseError } from './parser.js'

describe('parse', () => {
  describe('predicates', () => {
    it('ext with single bare extension', () => {
      expect(parse('ext(ts)').selection).toEqual({ type: 'ext', extensions: ['ts'] })
    })

    it('ext strips leading dot', () => {
      expect(parse('ext(.ts)').selection).toEqual({ type: 'ext', extensions: ['ts'] })
    })

    it('ext with comma list', () => {
      expect(parse('ext(ts, tsx, js)').selection).toEqual({ type: 'ext', extensions: ['ts', 'tsx', 'js'] })
    })

    it('keyword with quoted string', () => {
      expect(parse('keyword("checkout")').selection).toEqual({ type: 'keyword', term: 'checkout' })
    })

    it('keyword with escaped quote inside', () => {
      expect(parse('keyword("say \\"hi\\"")').selection).toEqual({ type: 'keyword', term: 'say "hi"' })
    })

    it('file with multiple paths', () => {
      expect(parse('file("a/b.ts", "c/d.ts")').selection)
        .toEqual({ type: 'file', paths: ['a/b.ts', 'c/d.ts'] })
    })

    it('glob', () => {
      expect(parse('glob("src/**/*.ts")').selection)
        .toEqual({ type: 'glob', pattern: 'src/**/*.ts' })
    })

    it('tag defaults to anywhere scope', () => {
      expect(parse('tag("@feat:auth")').selection)
        .toEqual({ type: 'tag', tag: '@feat:auth', scope: 'anywhere' })
    })

    it('tag with explicit file scope', () => {
      expect(parse('tag("@feat:auth", file)').selection)
        .toEqual({ type: 'tag', tag: '@feat:auth', scope: 'file' })
    })

    it('tag with explicit anywhere scope', () => {
      expect(parse('tag("@feat:auth", anywhere)').selection.type).toBe('tag')
    })

    it('tagged_section with only open tag', () => {
      expect(parse('tagged_section("catty:start")').selection)
        .toEqual({ type: 'tagged_section', openTag: 'catty:start' })
    })

    it('tagged_section with open and close tags', () => {
      expect(parse('tagged_section("catty:start", "catty:end")').selection)
        .toEqual({ type: 'tagged_section', openTag: 'catty:start', closeTag: 'catty:end' })
    })

    it('authored_by', () => {
      expect(parse('authored_by("alice")').selection)
        .toEqual({ type: 'authored_by', author: 'alice' })
    })

    it('commit_message', () => {
      expect(parse('commit_message("fix")').selection)
        .toEqual({ type: 'commit_message', term: 'fix' })
    })

    it('diff with no argument', () => {
      expect(parse('diff()').selection).toEqual({ type: 'diff' })
    })

    it('diff with ref string', () => {
      expect(parse('diff("main")').selection).toEqual({ type: 'diff', ref: 'main' })
    })

    it('older_than / newer_than with duration string', () => {
      expect(parse('older_than("365d")').selection)
        .toEqual({ type: 'older_than', duration: { value: 365, unit: 'd' } })
      expect(parse('newer_than("2w")').selection)
        .toEqual({ type: 'newer_than', duration: { value: 2, unit: 'w' } })
    })
  })

  describe('operators', () => {
    it('and() with 2 children', () => {
      const q = parse('and(ext(ts), keyword("checkout"))')
      expect(q.selection).toMatchObject({ type: 'and', children: [{ type: 'ext' }, { type: 'keyword' }] })
    })

    it('or() / any() are equivalent', () => {
      expect(parse('or(ext(ts), ext(js))').selection.type).toBe('or')
      expect(parse('any(ext(ts), ext(js))').selection.type).toBe('or')
    })

    it('not()', () => {
      expect(parse('not(keyword("foo"))').selection)
        .toEqual({ type: 'not', child: { type: 'keyword', term: 'foo' } })
    })

    it('top-level unless()', () => {
      const q = parse('ext(ts) unless(keyword(".test."))')
      expect(q.selection).toMatchObject({ type: 'unless', selection: { type: 'ext' }, exclusion: { type: 'keyword' } })
    })

    it('nested and/or/not', () => {
      const q = parse('and(ext(ts), or(keyword("a"), not(keyword("b"))))')
      expect(q.selection).toMatchObject({
        type: 'and',
        children: [
          { type: 'ext' },
          { type: 'or', children: [{ type: 'keyword' }, { type: 'not' }] },
        ],
      })
    })
  })

  describe('errors', () => {
    it('unterminated string', () => {
      expect(() => parse('keyword("foo')).toThrow(ParseError)
    })

    it('unexpected character', () => {
      expect(() => parse('ext(ts) !')).toThrow(/Unexpected character/)
    })

    it('unknown predicate', () => {
      expect(() => parse('nope(ts)')).toThrow(/Unknown predicate/)
    })

    it('missing rparen', () => {
      expect(() => parse('ext(ts')).toThrow(ParseError)
    })

    it('expected string literal', () => {
      expect(() => parse('keyword(ts)')).toThrow(/Expected string/)
    })

    it('expected identifier', () => {
      expect(() => parse('ext("ts")')).toThrow(/Expected identifier/)
    })

    it('and requires at least 2 children', () => {
      expect(() => parse('and(ext(ts))')).toThrow(/at least 2 children/)
    })

    it('or requires at least 2 children', () => {
      expect(() => parse('or(ext(ts))')).toThrow(/at least 2 children/)
    })

    it('duration invalid format', () => {
      expect(() => parse('older_than("bogus")')).toThrow(/Invalid duration/)
    })

    it('empty input is a parse error', () => {
      expect(() => parse('')).toThrow()
    })

    it('tag scope must be file or anywhere', () => {
      expect(() => parse('tag("@foo", bogus)')).toThrow(/scope must be/)
    })

    it('ParseError carries offset', () => {
      try {
        parse('ext')
      } catch (err) {
        expect(err).toBeInstanceOf(ParseError)
        expect((err as ParseError).offset).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
