import { describe, it, expect } from 'vitest'
import { evalFile } from './file.js'
import type { FileFacts } from '../../query/result.js'

const facts = (p: string): FileFacts => ({
  path: p,
  content: '',
  lineCount: 0,
  extension: '',
  mtime: new Date(0),
})

describe('evalFile', () => {
  it('matches when path equals one of the predicate paths', () => {
    expect(evalFile({ type: 'file', paths: ['src/a.ts', 'src/b.ts'] }, facts('src/b.ts')))
      .toEqual({ predicate: 'file', detail: 'src/b.ts' })
  })

  it('returns null when no path matches', () => {
    expect(evalFile({ type: 'file', paths: ['src/a.ts'] }, facts('src/b.ts'))).toBeNull()
  })

  it('normalises Windows backslashes on both sides before comparing', () => {
    expect(evalFile({ type: 'file', paths: ['src\\a.ts'] }, facts('src\\a.ts')))
      .toEqual({ predicate: 'file', detail: 'src\\a.ts' })
  })
})
