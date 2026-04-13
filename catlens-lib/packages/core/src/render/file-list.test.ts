import { describe, it, expect } from 'vitest'
import { renderFileList } from './file-list.js'
import type { SelectionResult } from '../query/result.js'

const make = (paths: string[]): SelectionResult => ({
  query: { selection: { type: 'ext', extensions: ['ts'] } },
  repoRoot: '/tmp/repo',
  files: paths.map(p => ({ path: p, reasons: [], lineCount: 0, content: '' })),
  sections: [],
  diffs: [],
  stats: { fileCount: paths.length, sectionCount: 0, diffCount: 0, totalLines: 0, estimatedChars: 0 },
})

describe('renderFileList', () => {
  it('returns newline-separated paths', () => {
    expect(renderFileList(make(['a.ts', 'b.ts', 'c.ts']))).toBe('a.ts\nb.ts\nc.ts')
  })

  it('returns empty string when no files', () => {
    expect(renderFileList(make([]))).toBe('')
  })
})
