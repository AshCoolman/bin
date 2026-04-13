import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './markdown.js'
import type { SelectionResult } from '../query/result.js'

const make = (files: { path: string; content: string }[]): SelectionResult => ({
  query: { selection: { type: 'ext', extensions: ['ts'] } },
  repoRoot: '/tmp/repo',
  files: files.map(f => ({ ...f, reasons: [], lineCount: f.content.split('\n').length })),
  sections: [],
  diffs: [],
  stats: { fileCount: files.length, sectionCount: 0, diffCount: 0, totalLines: 0, estimatedChars: 0 },
})

describe('renderMarkdown', () => {
  it('outputs fenced code blocks with language hint from extension', () => {
    const out = renderMarkdown(make([{ path: 'src/a.ts', content: 'const x = 1' }]))
    expect(out).toContain('## src/a.ts')
    expect(out).toContain('```typescript')
  })

  it('adds line numbers by default', () => {
    const out = renderMarkdown(make([{ path: 'a.ts', content: 'line1\nline2' }]))
    expect(out).toContain('   1 line1')
    expect(out).toContain('   2 line2')
  })

  it('omits line numbers when option false', () => {
    const out = renderMarkdown(make([{ path: 'a.ts', content: 'line1\nline2' }]), { lineNumbers: false })
    expect(out).not.toContain('   1 ')
  })

  it('uses empty language for unknown extensions', () => {
    const out = renderMarkdown(make([{ path: 'a.weird', content: 'x' }]), { lineNumbers: false })
    expect(out).toContain('```\nx\n```')
  })

  it('uses empty language when file has no extension at all', () => {
    // A path that split('.').pop() treats as a single segment with no dot — path is the whole string
    // "Makefile".split('.').pop() returns "Makefile", but LANG_MAP has no entry → empty string
    const out = renderMarkdown(make([{ path: 'Makefile', content: 'all:' }]), { lineNumbers: false })
    expect(out).toContain('```\nall:\n```')
  })

  it('joins multiple files with blank line separators', () => {
    const out = renderMarkdown(make([
      { path: 'a.ts', content: 'a' },
      { path: 'b.ts', content: 'b' },
    ]), { lineNumbers: false })
    expect(out).toMatch(/## a\.ts[\s\S]*## b\.ts/)
  })
})
