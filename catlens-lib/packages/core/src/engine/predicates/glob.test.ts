import { describe, it, expect } from 'vitest'
import { evalGlob } from './glob.js'
import type { FileFacts } from '../../query/result.js'

const facts = (p: string): FileFacts => ({
  path: p,
  content: '',
  lineCount: 0,
  extension: '',
  mtime: new Date(0),
})

describe('evalGlob', () => {
  it('matches **/* star patterns', () => {
    expect(evalGlob({ type: 'glob', pattern: 'src/**/*.ts' }, facts('src/a/b/c.ts')))
      .toEqual({ predicate: 'glob', detail: 'src/**/*.ts' })
  })

  it('returns null when the pattern does not match', () => {
    expect(evalGlob({ type: 'glob', pattern: 'src/**/*.ts' }, facts('lib/a.ts'))).toBeNull()
  })

  it('matches dotfiles (dot:true)', () => {
    expect(evalGlob({ type: 'glob', pattern: '**/.env' }, facts('.env')))
      .toEqual({ predicate: 'glob', detail: '**/.env' })
  })
})
