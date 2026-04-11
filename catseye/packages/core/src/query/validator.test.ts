import { describe, it, expect } from 'vitest'
import { validate } from './validator.js'
import type { Query } from './ast.js'

const q = (selection: Query['selection']): Query => ({ selection })

describe('validate', () => {
  it('returns valid:true for a well-formed query', () => {
    const r = validate(q({ type: 'ext', extensions: ['ts'] }))
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('ext with empty list is invalid', () => {
    const r = validate(q({ type: 'ext', extensions: [] }))
    expect(r.valid).toBe(false)
    expect(r.errors[0]!.message).toMatch(/at least one extension/)
  })

  it('keyword with empty term is invalid', () => {
    const r = validate(q({ type: 'keyword', term: '' }))
    expect(r.valid).toBe(false)
  })

  it('file with no paths is invalid', () => {
    const r = validate(q({ type: 'file', paths: [] }))
    expect(r.valid).toBe(false)
  })

  it('glob with empty pattern is invalid', () => {
    const r = validate(q({ type: 'glob', pattern: '' }))
    expect(r.valid).toBe(false)
  })

  it('tag with empty tag string is invalid', () => {
    const r = validate(q({ type: 'tag', tag: '', scope: 'anywhere' }))
    expect(r.valid).toBe(false)
  })

  it('tagged_section with empty openTag is invalid', () => {
    const r = validate(q({ type: 'tagged_section', openTag: '' }))
    expect(r.valid).toBe(false)
  })

  it('authored_by with empty author is invalid', () => {
    const r = validate(q({ type: 'authored_by', author: '' }))
    expect(r.valid).toBe(false)
  })

  it('commit_message with empty term is invalid', () => {
    const r = validate(q({ type: 'commit_message', term: '' }))
    expect(r.valid).toBe(false)
  })

  it('older_than / newer_than with zero or negative duration is invalid', () => {
    expect(validate(q({ type: 'older_than', duration: { value: 0, unit: 'd' } })).valid).toBe(false)
    expect(validate(q({ type: 'newer_than', duration: { value: -1, unit: 'd' } })).valid).toBe(false)
  })

  it('diff is always valid (with and without ref)', () => {
    expect(validate(q({ type: 'diff' })).valid).toBe(true)
    expect(validate(q({ type: 'diff', ref: 'main' })).valid).toBe(true)
  })

  it('and/or with fewer than 2 children is invalid', () => {
    const r = validate(q({ type: 'and', children: [{ type: 'ext', extensions: ['ts'] }] }))
    expect(r.valid).toBe(false)
    expect(r.errors[0]!.message).toMatch(/at least 2 children/)
  })

  it('recurses into and/or children', () => {
    const r = validate(q({
      type: 'and',
      children: [
        { type: 'ext', extensions: ['ts'] },
        { type: 'keyword', term: '' },
      ],
    }))
    expect(r.valid).toBe(false)
  })

  it('recurses into not', () => {
    const r = validate(q({ type: 'not', child: { type: 'keyword', term: '' } }))
    expect(r.valid).toBe(false)
  })

  it('recurses into unless selection and exclusion', () => {
    const r = validate(q({
      type: 'unless',
      selection: { type: 'ext', extensions: ['ts'] },
      exclusion: { type: 'keyword', term: '' },
    }))
    expect(r.valid).toBe(false)
  })
})
