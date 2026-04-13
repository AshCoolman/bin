import { describe, it, expect } from 'vitest'
import { renderDiff } from './diff.js'
import type { SelectionResult } from '../query/result.js'

const base: SelectionResult = {
  query: { selection: { type: 'diff' } },
  repoRoot: '/tmp/repo',
  files: [],
  sections: [],
  diffs: [],
  stats: { fileCount: 0, sectionCount: 0, diffCount: 0, totalLines: 0, estimatedChars: 0 },
}

describe('renderDiff', () => {
  it('renders unified patches with file-name headers', () => {
    const out = renderDiff({
      ...base,
      diffs: [
        { path: 'a.ts', patch: '-old\n+new', reasons: [] },
        { path: 'b.ts', patch: '-x\n+y', reasons: [] },
      ],
    })
    expect(out).toContain('--- a.ts')
    expect(out).toContain('-old\n+new')
    expect(out).toContain('--- b.ts')
  })

  it('falls back to matched file list when no diffs but files are present', () => {
    const out = renderDiff({
      ...base,
      files: [
        { path: 'a.ts', content: '', lineCount: 0, reasons: [] },
        { path: 'b.ts', content: '', lineCount: 0, reasons: [] },
      ],
    })
    expect(out).toBe('a.ts\nb.ts')
  })

  it('returns empty string when neither diffs nor files', () => {
    expect(renderDiff(base)).toBe('')
  })
})
