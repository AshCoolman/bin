import { describe, it, expect } from 'vitest'
import { renderSnippets } from './snippets.js'
import type { SelectionResult } from '../query/result.js'

const base: SelectionResult = {
  query: { selection: { type: 'ext', extensions: ['ts'] } },
  repoRoot: '/tmp/repo',
  files: [],
  sections: [],
  diffs: [],
  stats: { fileCount: 0, sectionCount: 0, diffCount: 0, totalLines: 0, estimatedChars: 0 },
}

describe('renderSnippets', () => {
  it('renders SectionHit blocks with line anchors and language hint', () => {
    const out = renderSnippets({
      ...base,
      sections: [
        {
          path: 'src/a.ts',
          startLine: 10,
          endLine: 15,
          tag: 'auth',
          reasons: [],
          content: 'const x = 1',
        },
      ],
    })
    expect(out).toContain('## src/a.ts#L10-L15')
    expect(out).toContain('```typescript')
    expect(out).toContain('const x = 1')
  })

  it('joins multiple sections with blank line separators', () => {
    const out = renderSnippets({
      ...base,
      sections: [
        { path: 'a.ts', startLine: 1, endLine: 2, reasons: [], content: 'a' },
        { path: 'b.py', startLine: 1, endLine: 2, reasons: [], content: 'b' },
      ],
    })
    expect(out).toMatch(/## a\.ts[\s\S]*## b\.py/)
    expect(out).toContain('```python')
  })

  it('falls back to full FileHit content when no sections', () => {
    const out = renderSnippets({
      ...base,
      files: [{ path: 'a.rs', content: 'fn main(){}', lineCount: 1, reasons: [] }],
    })
    expect(out).toContain('## a.rs')
    expect(out).toContain('```rust')
    expect(out).toContain('fn main(){}')
  })

  it('uses empty language hint for unknown extensions', () => {
    const out = renderSnippets({
      ...base,
      files: [{ path: 'a.weird', content: 'x', lineCount: 1, reasons: [] }],
    })
    expect(out).toContain('```\nx\n```')
  })
})
