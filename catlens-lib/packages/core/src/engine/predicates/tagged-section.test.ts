import { describe, it, expect } from 'vitest'
import { evalTaggedSection } from './tagged-section.js'
import type { FileFacts } from '../../query/result.js'

const facts = (content: string): FileFacts => ({
  path: 'f.ts',
  content,
  lineCount: content.split('\n').length,
  extension: 'ts',
  mtime: new Date(0),
})

describe('evalTaggedSection', () => {
  it('captures a single section with explicit close tag', () => {
    const content = [
      'above',
      '// catty:start auth',
      'const foo = 1',
      'const bar = 2',
      '// catty:end auth',
      'below',
    ].join('\n')
    const r = evalTaggedSection(
      { type: 'tagged_section', openTag: 'catty:start auth', closeTag: 'catty:end auth' },
      facts(content),
    )
    expect(r.matched).toBe(true)
    expect(r.sections).toHaveLength(1)
    expect(r.sections[0]!.startLine).toBe(2)
    expect(r.sections[0]!.endLine).toBe(5)
    expect(r.sections[0]!.content).toBe('const foo = 1\nconst bar = 2')
    expect(r.reason).toEqual({ predicate: 'tagged_section', detail: 'catty:start auth' })
  })

  it('captures multiple sections in one file', () => {
    const content = [
      '// catty:start a',
      'x',
      '// catty:end a',
      '// catty:start a',
      'y',
      '// catty:end a',
    ].join('\n')
    const r = evalTaggedSection(
      { type: 'tagged_section', openTag: 'catty:start a', closeTag: 'catty:end a' },
      facts(content),
    )
    expect(r.sections).toHaveLength(2)
  })

  it('derives close tag by replacing start → end when none given', () => {
    const content = [
      '// catty:start foo',
      'body',
      '// catty:end foo',
    ].join('\n')
    const r = evalTaggedSection(
      { type: 'tagged_section', openTag: 'catty:start foo' },
      facts(content),
    )
    expect(r.matched).toBe(true)
  })

  it('derives close tag by replacing begin → end (regex is case-insensitive, replacement is lowercase)', () => {
    // openTag "BEGIN block" → closeTag becomes "end block" (lowercased replacement)
    const content = [
      '// BEGIN block',
      'body',
      '// end block',
    ].join('\n')
    const r = evalTaggedSection(
      { type: 'tagged_section', openTag: 'BEGIN block' },
      facts(content),
    )
    expect(r.matched).toBe(true)
  })

  it('returns unmatched result when no open tag found', () => {
    const r = evalTaggedSection(
      { type: 'tagged_section', openTag: 'catty:start', closeTag: 'catty:end' },
      facts('no tags here'),
    )
    expect(r).toEqual({ matched: false, sections: [], reason: null })
  })

  it('drops unclosed sections silently', () => {
    const content = ['// catty:start a', 'line', 'line'].join('\n')
    const r = evalTaggedSection(
      { type: 'tagged_section', openTag: 'catty:start a', closeTag: 'catty:end a' },
      facts(content),
    )
    expect(r.matched).toBe(false)
  })
})
