import { describe, it, expect } from 'vitest'
import { evalDiff } from './diff.js'
import type { FileFacts, GitFacts } from '../../query/result.js'

const factsWith = (git?: Partial<GitFacts>): FileFacts => ({
  path: 'f.ts',
  content: '',
  lineCount: 0,
  extension: 'ts',
  mtime: new Date(0),
  ...(git !== undefined ? { gitFacts: { inCurrentDiff: false, ...git } as GitFacts } : {}),
})

describe('evalDiff', () => {
  it('returns null when gitFacts absent', () => {
    expect(evalDiff({ type: 'diff' }, factsWith())).toBeNull()
  })

  it('matches when file is in current working diff (no ref)', () => {
    expect(evalDiff({ type: 'diff' }, factsWith({ inCurrentDiff: true })))
      .toEqual({ predicate: 'diff' })
  })

  it('returns null when file is not in current diff (no ref)', () => {
    expect(evalDiff({ type: 'diff' }, factsWith({ inCurrentDiff: false }))).toBeNull()
  })

  it('falls back to current-diff behaviour when ref is provided', () => {
    expect(evalDiff({ type: 'diff', ref: 'main' }, factsWith({ inCurrentDiff: true })))
      .toEqual({ predicate: 'diff', detail: 'main' })
  })

  it('returns null with ref when file is not in current diff', () => {
    expect(evalDiff({ type: 'diff', ref: 'main' }, factsWith({ inCurrentDiff: false }))).toBeNull()
  })
})
