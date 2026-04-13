import { describe, it, expect } from 'vitest'
import { renderJson } from './json.js'
import type { SelectionResult } from '../query/result.js'

const baseResult: SelectionResult = {
  query: { selection: { type: 'ext', extensions: ['ts'] } },
  repoRoot: '/tmp/repo',
  files: [{ path: 'a.ts', reasons: [{ predicate: 'ext' }], lineCount: 1, content: 'x' }],
  sections: [],
  diffs: [],
  stats: { fileCount: 1, sectionCount: 0, diffCount: 0, totalLines: 1, estimatedChars: 1 },
}

describe('renderJson', () => {
  it('returns valid JSON that roundtrips to the same shape', () => {
    const out = renderJson(baseResult)
    const parsed = JSON.parse(out)
    expect(parsed.files).toHaveLength(1)
    expect(parsed.stats.fileCount).toBe(1)
  })
})
