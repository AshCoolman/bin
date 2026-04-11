import { describe, it, expect } from 'vitest'
import { renderPreview } from './preview.js'
import type { SelectionResult } from '../query/result.js'

const make = (files: { path: string; lineCount: number; reasons?: { predicate: string; detail?: string }[] }[], statsOver: Partial<SelectionResult['stats']> = {}): SelectionResult => ({
  query: { selection: { type: 'ext', extensions: ['ts'] } },
  repoRoot: '/tmp/repo',
  files: files.map(f => ({ path: f.path, lineCount: f.lineCount, reasons: f.reasons ?? [], content: '' })),
  sections: [],
  diffs: [],
  stats: {
    fileCount: files.length,
    sectionCount: 0,
    diffCount: 0,
    totalLines: files.reduce((n, f) => n + f.lineCount, 0),
    estimatedChars: 2048,
    ...statsOver,
  },
})

describe('renderPreview', () => {
  it('shows "files" plural and path summary', () => {
    const out = renderPreview(make([
      { path: 'a.ts', lineCount: 10 },
      { path: 'b.ts', lineCount: 5 },
    ]))
    expect(out).toMatch(/Matched: 2 files/)
    expect(out).toContain('a.ts')
    expect(out).toContain('b.ts')
  })

  it('shows "file" singular when exactly one match', () => {
    expect(renderPreview(make([{ path: 'a.ts', lineCount: 1 }]))).toMatch(/Matched: 1 file /)
  })

  it('excludes file list when no matches', () => {
    const out = renderPreview(make([], { estimatedChars: 0 }))
    expect(out).toMatch(/Matched: 0 files/)
    expect(out.split('\n')).toHaveLength(1)
  })

  it('shows reasons when showReasons is true', () => {
    const out = renderPreview(
      make([{ path: 'a.ts', lineCount: 1, reasons: [{ predicate: 'ext', detail: 'ts' }] }]),
      { showReasons: true },
    )
    expect(out).toContain('[ts]')
  })

  it('uses bare predicate name when reason has no detail', () => {
    const out = renderPreview(
      make([{ path: 'a.ts', lineCount: 1, reasons: [{ predicate: 'not' }] }]),
      { showReasons: true },
    )
    expect(out).toContain('[not]')
  })

  it('formats kb from estimatedChars', () => {
    const out = renderPreview(make([{ path: 'a.ts', lineCount: 1 }], { estimatedChars: 2048 }))
    expect(out).toMatch(/~2\.0 KB/)
  })
})
