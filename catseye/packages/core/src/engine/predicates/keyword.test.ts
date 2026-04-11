import { describe, it, expect } from 'vitest'
import { evalKeyword } from './keyword.js'
import type { FileFacts } from '../../query/result.js'

const facts = (content: string): FileFacts => ({
  path: 'f.ts',
  content,
  lineCount: content.split('\n').length,
  extension: 'ts',
  mtime: new Date(0),
})

describe('evalKeyword', () => {
  it('matches case-insensitively by default', () => {
    expect(evalKeyword({ type: 'keyword', term: 'CheckOut' }, facts('await Checkout()')))
      .toEqual({ predicate: 'keyword', detail: 'matched "CheckOut"' })
  })

  it('returns null when term is absent', () => {
    expect(evalKeyword({ type: 'keyword', term: 'nope' }, facts('something else'))).toBeNull()
  })

  it('respects caseSensitive:true', () => {
    const pred = { type: 'keyword' as const, term: 'Foo', caseSensitive: true }
    expect(evalKeyword(pred, facts('Foo bar'))).not.toBeNull()
    expect(evalKeyword(pred, facts('foo bar'))).toBeNull()
  })
})
