import { describe, it, expect } from 'vitest'
import { evalCommitMessage } from './commit-message.js'
import type { FileFacts, GitFacts } from '../../query/result.js'

const factsWith = (git?: Partial<GitFacts>): FileFacts => ({
  path: 'f.ts',
  content: '',
  lineCount: 0,
  extension: 'ts',
  mtime: new Date(0),
  ...(git !== undefined ? { gitFacts: { inCurrentDiff: false, ...git } as GitFacts } : {}),
})

describe('evalCommitMessage', () => {
  it('returns null when gitFacts missing', () => {
    expect(evalCommitMessage({ type: 'commit_message', term: 'fix' }, factsWith())).toBeNull()
  })

  it('returns null when lastCommitMessage absent', () => {
    // gitFacts is present but has no lastCommitMessage field
    expect(evalCommitMessage({ type: 'commit_message', term: 'fix' }, factsWith({ inCurrentDiff: false })))
      .toBeNull()
  })

  it('matches case-insensitive substring', () => {
    const facts = factsWith({ lastCommitMessage: 'Fix the thing' })
    expect(evalCommitMessage({ type: 'commit_message', term: 'FIX' }, facts))
      .toEqual({ predicate: 'commit_message', detail: 'FIX' })
  })

  it('returns null when term is absent from message', () => {
    const facts = factsWith({ lastCommitMessage: 'something unrelated' })
    expect(evalCommitMessage({ type: 'commit_message', term: 'checkout' }, facts)).toBeNull()
  })
})
