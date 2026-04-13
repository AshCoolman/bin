import { describe, it, expect } from 'vitest'
import { evaluate } from './evaluate.js'
import type { FileFacts } from '../query/result.js'
import type { SelectionNode } from '../query/ast.js'

const facts = (over: Partial<FileFacts> = {}): FileFacts => ({
  path: 'src/checkout.ts',
  content: 'await checkout()\n// @tag:api\n// catty:start auth\nconst foo = 1\n// catty:end auth',
  lineCount: 5,
  extension: 'ts',
  mtime: new Date(0),
  ...over,
})

const ext = (...es: string[]): SelectionNode => ({ type: 'ext', extensions: es })
const kw = (term: string): SelectionNode => ({ type: 'keyword', term })
const glob = (pattern: string): SelectionNode => ({ type: 'glob', pattern })
const tag = (t: string, scope: 'file' | 'anywhere' = 'anywhere'): SelectionNode => ({ type: 'tag', tag: t, scope })
const taggedSection = (openTag: string, closeTag?: string): SelectionNode =>
  ({ type: 'tagged_section', openTag, ...(closeTag !== undefined ? { closeTag } : {}) })

describe('evaluate', () => {
  describe('and()', () => {
    it('returns matched with combined reasons when all children match', () => {
      const r = evaluate({ type: 'and', children: [ext('ts'), kw('checkout')] }, facts())
      expect(r.matched).toBe(true)
      expect(r.reasons.map(x => x.predicate)).toEqual(['ext', 'keyword'])
    })

    it('short-circuits on first non-match with empty reasons', () => {
      const r = evaluate({ type: 'and', children: [ext('js'), kw('checkout')] }, facts())
      expect(r).toEqual({ matched: false, reasons: [] })
    })

    it('accumulates sections from tagged_section children', () => {
      const r = evaluate(
        { type: 'and', children: [ext('ts'), taggedSection('catty:start auth', 'catty:end auth')] },
        facts(),
      )
      expect(r.matched).toBe(true)
      expect(r.sections).toHaveLength(1)
    })
  })

  describe('or()', () => {
    it('returns the first matching child result', () => {
      const r = evaluate({ type: 'or', children: [ext('js'), kw('checkout')] }, facts())
      expect(r.matched).toBe(true)
      expect(r.reasons[0]!.predicate).toBe('keyword')
    })

    it('returns unmatched when no child matches', () => {
      const r = evaluate({ type: 'or', children: [ext('py'), kw('nonexistent')] }, facts())
      expect(r).toEqual({ matched: false, reasons: [] })
    })
  })

  describe('not()', () => {
    it('inverts the child match result and records a synthetic reason', () => {
      const r = evaluate({ type: 'not', child: kw('nonexistent') }, facts())
      expect(r.matched).toBe(true)
      expect(r.reasons).toEqual([{ predicate: 'not' }])
    })

    it('reports unmatched with empty reasons when child matches', () => {
      const r = evaluate({ type: 'not', child: kw('checkout') }, facts())
      expect(r).toEqual({ matched: false, reasons: [] })
    })
  })

  describe('unless()', () => {
    it('returns the base result when exclusion does not match', () => {
      const r = evaluate(
        { type: 'unless', selection: ext('ts'), exclusion: kw('nonexistent') },
        facts(),
      )
      expect(r.matched).toBe(true)
    })

    it('returns unmatched when exclusion matches', () => {
      const r = evaluate(
        { type: 'unless', selection: ext('ts'), exclusion: kw('checkout') },
        facts(),
      )
      expect(r).toEqual({ matched: false, reasons: [] })
    })

    it('short-circuits when base does not match', () => {
      const r = evaluate(
        { type: 'unless', selection: ext('js'), exclusion: kw('anything') },
        facts(),
      )
      expect(r).toEqual({ matched: false, reasons: [] })
    })
  })

  describe('predicate dispatch', () => {
    it('handles file predicate', () => {
      expect(evaluate({ type: 'file', paths: ['src/checkout.ts'] }, facts()).matched).toBe(true)
      expect(evaluate({ type: 'file', paths: ['src/other.ts'] }, facts()).matched).toBe(false)
    })

    it('handles glob predicate', () => {
      expect(evaluate(glob('src/**/*.ts'), facts()).matched).toBe(true)
      expect(evaluate(glob('lib/**/*.ts'), facts()).matched).toBe(false)
    })

    it('handles tag predicate', () => {
      expect(evaluate(tag('@tag:api'), facts()).matched).toBe(true)
      expect(evaluate(tag('@tag:nope'), facts()).matched).toBe(false)
    })

    it('handles tagged_section matched and unmatched', () => {
      expect(evaluate(taggedSection('catty:start auth', 'catty:end auth'), facts()).matched).toBe(true)
      expect(evaluate(taggedSection('catty:nope'), facts()).matched).toBe(false)
    })

    it('handles authored_by', () => {
      const f = facts({ gitFacts: { inCurrentDiff: false, lastAuthor: 'Alice' } })
      expect(evaluate({ type: 'authored_by', author: 'alice' }, f).matched).toBe(true)
      expect(evaluate({ type: 'authored_by', author: 'bob' }, f).matched).toBe(false)
    })

    it('handles older_than / newer_than', () => {
      const ancient = facts({ mtime: new Date(0) })
      expect(evaluate({ type: 'older_than', duration: { value: 1, unit: 'y' } }, ancient).matched).toBe(true)
      expect(evaluate({ type: 'newer_than', duration: { value: 1, unit: 'y' } }, ancient).matched).toBe(false)
    })

    it('handles diff', () => {
      const f = facts({ gitFacts: { inCurrentDiff: true } })
      expect(evaluate({ type: 'diff' }, f).matched).toBe(true)
      expect(evaluate({ type: 'diff' }, facts()).matched).toBe(false)
    })

    it('handles commit_message', () => {
      const f = facts({ gitFacts: { inCurrentDiff: false, lastCommitMessage: 'fix checkout' } })
      expect(evaluate({ type: 'commit_message', term: 'checkout' }, f).matched).toBe(true)
      expect(evaluate({ type: 'commit_message', term: 'nope' }, f).matched).toBe(false)
    })
  })
})
