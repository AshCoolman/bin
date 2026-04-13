import { describe, it, expect } from 'vitest'
import { evalAuthoredBy } from './authored-by.js'
import type { FileFacts, GitFacts } from '../../query/result.js'

const factsWith = (git?: Partial<GitFacts>): FileFacts => ({
  path: 'f.ts',
  content: '',
  lineCount: 0,
  extension: 'ts',
  mtime: new Date(0),
  ...(git !== undefined ? { gitFacts: { inCurrentDiff: false, ...git } as GitFacts } : {}),
})

describe('evalAuthoredBy', () => {
  it('returns null when facts have no gitFacts', () => {
    expect(evalAuthoredBy({ type: 'authored_by', author: 'alice' }, factsWith())).toBeNull()
  })

  it('matches on author name substring (case-insensitive)', () => {
    const facts = factsWith({ lastAuthor: 'Alice Smith', lastAuthorEmail: 'alice@example.com' })
    expect(evalAuthoredBy({ type: 'authored_by', author: 'alice' }, facts))
      .toEqual({ predicate: 'authored_by', detail: 'Alice Smith' })
  })

  it('matches on email substring when name does not match', () => {
    const facts = factsWith({ lastAuthor: 'Bob', lastAuthorEmail: 'alice@example.com' })
    expect(evalAuthoredBy({ type: 'authored_by', author: 'alice' }, facts))
      .toEqual({ predicate: 'authored_by', detail: 'Bob' })
  })

  it('falls back to email as detail when name absent', () => {
    const facts = factsWith({ lastAuthorEmail: 'alice@example.com' })
    expect(evalAuthoredBy({ type: 'authored_by', author: 'alice' }, facts))
      .toEqual({ predicate: 'authored_by', detail: 'alice@example.com' })
  })

  it('returns null when neither author name nor email is set on gitFacts', () => {
    // With both lastAuthor and lastAuthorEmail absent, nameMatch and emailMatch are both false.
    const facts = factsWith({ inCurrentDiff: false })
    expect(evalAuthoredBy({ type: 'authored_by', author: 'alice' }, facts)).toBeNull()
  })

  it('returns null when neither name nor email matches', () => {
    const facts = factsWith({ lastAuthor: 'Bob', lastAuthorEmail: 'bob@example.com' })
    expect(evalAuthoredBy({ type: 'authored_by', author: 'alice' }, facts)).toBeNull()
  })
})
