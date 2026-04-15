import { describe, it, expect } from 'vitest'
import { parse, ParseError } from './parser.js'

describe('parse', () => {
  describe('predicates', () => {
    it('ext single', () => {
      expect(parse('ext:ts').selection).toEqual({ type: 'ext', extensions: ['ts'] })
    })

    it('ext strips leading dot', () => {
      expect(parse('ext:.ts').selection).toEqual({ type: 'ext', extensions: ['ts'] })
    })

    it('ext comma list', () => {
      expect(parse('ext:ts,tsx,js').selection).toEqual({ type: 'ext', extensions: ['ts', 'tsx', 'js'] })
    })

    it('keyword bare', () => {
      expect(parse('keyword:checkout').selection).toEqual({ type: 'keyword', term: 'checkout' })
    })

    it('keyword quoted', () => {
      expect(parse('keyword:"my checkout"').selection).toEqual({ type: 'keyword', term: 'my checkout' })
    })

    it('keyword escaped quote inside', () => {
      expect(parse('keyword:"say \\"hi\\""').selection).toEqual({ type: 'keyword', term: 'say "hi"' })
    })

    it('path glob', () => {
      expect(parse('path:src/**/*.ts').selection)
        .toEqual({ type: 'glob', pattern: 'src/**/*.ts' })
    })

    it('file single', () => {
      expect(parse('file:a/b.ts').selection)
        .toEqual({ type: 'file', paths: ['a/b.ts'] })
    })

    it('file comma list', () => {
      expect(parse('file:a/b.ts,c/d.ts').selection)
        .toEqual({ type: 'file', paths: ['a/b.ts', 'c/d.ts'] })
    })

    it('diff no ref', () => {
      expect(parse('diff:').selection).toEqual({ type: 'diff' })
    })

    it('diff with ref', () => {
      expect(parse('diff:HEAD~3').selection).toEqual({ type: 'diff', ref: 'HEAD~3' })
    })

    it('older', () => {
      expect(parse('older:365d').selection)
        .toEqual({ type: 'older_than', duration: { value: 365, unit: 'd' } })
    })

    it('newer', () => {
      expect(parse('newer:2w').selection)
        .toEqual({ type: 'newer_than', duration: { value: 2, unit: 'w' } })
    })
  })

  describe('operators', () => {
    it('&&', () => {
      const q = parse('ext:ts && keyword:checkout')
      expect(q.selection).toMatchObject({ type: 'and', children: [{ type: 'ext' }, { type: 'keyword' }] })
    })

    it('||', () => {
      expect(parse('ext:ts || ext:js').selection.type).toBe('or')
    })

    it('!', () => {
      expect(parse('!keyword:foo').selection)
        .toEqual({ type: 'not', child: { type: 'keyword', term: 'foo' } })
    })

    it('grouping', () => {
      expect(parse('(ext:ts || ext:js) && keyword:checkout').selection).toMatchObject({
        type: 'and',
        children: [{ type: 'or' }, { type: 'keyword' }],
      })
    })

    it('&& binds tighter than ||', () => {
      const q = parse('ext:ts || ext:js && keyword:checkout')
      expect(q.selection).toMatchObject({
        type: 'or',
        children: [
          { type: 'ext' },
          { type: 'and', children: [{ type: 'ext' }, { type: 'keyword' }] },
        ],
      })
    })

    it('flattens chained &&', () => {
      const q = parse('ext:ts && keyword:a && keyword:b')
      expect(q.selection).toMatchObject({
        type: 'and',
        children: [{ type: 'ext' }, { type: 'keyword' }, { type: 'keyword' }],
      })
    })

    it('!! chains', () => {
      expect(parse('!!keyword:foo').selection).toMatchObject({ type: 'not', child: { type: 'not' } })
    })

    it('nested and/or/not', () => {
      const q = parse('ext:ts && (keyword:a || !keyword:b)')
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
    it('unknown predicate key', () => {
      expect(() => parse('nope:ts')).toThrow(/Unknown predicate/)
    })

    it('unterminated string', () => {
      expect(() => parse('keyword:"foo')).toThrow(ParseError)
    })

    it('missing colon after key', () => {
      expect(() => parse('ext ts')).toThrow(ParseError)
    })

    it('invalid duration', () => {
      expect(() => parse('older:bogus')).toThrow(/Invalid duration/)
    })

    it('empty input', () => {
      expect(() => parse('')).toThrow()
    })

    it('unmatched open paren', () => {
      expect(() => parse('(ext:ts')).toThrow(ParseError)
    })

    it('unexpected close paren', () => {
      expect(() => parse('ext:ts )')).toThrow(ParseError)
    })

    it('ParseError carries offset', () => {
      try {
        parse('nope:ts')
      } catch (err) {
        expect(err).toBeInstanceOf(ParseError)
        expect((err as ParseError).offset).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
