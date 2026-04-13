import { describe, it, expect } from 'vitest'
import { evalTag } from './tag.js'
import type { FileFacts } from '../../query/result.js'

const facts = (content: string): FileFacts => ({
  path: 'f.ts',
  content,
  lineCount: content.split('\n').length,
  extension: 'ts',
  mtime: new Date(0),
})

describe('evalTag', () => {
  it("file-scope only checks the first 10 lines", () => {
    const content = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n').replace('line 15', '@tag:api')
    expect(evalTag({ type: 'tag', tag: '@tag:api', scope: 'file' }, facts(content))).toBeNull()
  })

  it('file-scope matches when tag is within the first 10 lines', () => {
    const content = ['line 0', '// @tag:api', 'line 2'].join('\n')
    expect(evalTag({ type: 'tag', tag: '@tag:api', scope: 'file' }, facts(content)))
      .toEqual({ predicate: 'tag', detail: '@tag:api' })
  })

  it('anywhere-scope searches the entire file', () => {
    const content = Array.from({ length: 30 }, () => 'xx').join('\n') + '\n// @tag:api'
    expect(evalTag({ type: 'tag', tag: '@tag:api', scope: 'anywhere' }, facts(content)))
      .toEqual({ predicate: 'tag', detail: '@tag:api' })
  })

  it('returns null when tag absent', () => {
    expect(evalTag({ type: 'tag', tag: '@tag:nope', scope: 'anywhere' }, facts('hello'))).toBeNull()
  })
})
