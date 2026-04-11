import { describe, it, expect } from 'vitest'
import { evalExt } from './ext.js'
import type { FileFacts } from '../../query/result.js'

const facts = (extension: string): FileFacts => ({
  path: 'src/foo' + (extension ? '.' + extension : ''),
  content: '',
  lineCount: 0,
  extension,
  mtime: new Date(0),
})

describe('evalExt', () => {
  it('matches when file extension is in the predicate list', () => {
    expect(evalExt({ type: 'ext', extensions: ['ts', 'tsx'] }, facts('ts')))
      .toEqual({ predicate: 'ext', detail: 'ts' })
  })

  it('returns null when extension is not in the list', () => {
    expect(evalExt({ type: 'ext', extensions: ['ts'] }, facts('js'))).toBeNull()
  })

  it('returns null for files with no extension when list is non-empty', () => {
    expect(evalExt({ type: 'ext', extensions: ['ts'] }, facts(''))).toBeNull()
  })
})
