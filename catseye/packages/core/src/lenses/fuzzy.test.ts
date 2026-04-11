import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PassThrough } from 'node:stream'
import { disambiguate } from './fuzzy.js'

// child_process and readline are mocked inline per test using vi.doMock,
// which applies to dynamic imports that re-evaluate fuzzy.ts.

describe('disambiguate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.doUnmock('node:child_process')
    vi.doUnmock('node:readline')
  })

  it('throws on empty match list', async () => {
    await expect(disambiguate([])).rejects.toThrow(/No matches/)
  })

  it('returns the single match without prompting', async () => {
    expect(await disambiguate(['only'])).toBe('only')
  })

  it('returns fzf selection when fzf succeeds', async () => {
    vi.doMock('node:child_process', () => ({
      spawnSync: () => ({ status: 0, stdout: 'chosen\n', stderr: '' }),
    }))
    const { disambiguate: fresh } = await import('./fuzzy.js')
    expect(await fresh(['a', 'chosen', 'b'])).toBe('chosen')
  })

  it('falls back to readline when fzf status is non-zero', async () => {
    vi.doMock('node:child_process', () => ({
      spawnSync: () => ({ status: 1, stdout: '', stderr: 'cancelled' }),
    }))
    const fakeStderr = new PassThrough()
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    vi.doMock('node:readline', () => ({
      createInterface: () => ({
        question: (_: string, cb: (answer: string) => void) => cb('2'),
        close: () => {},
        on: () => {},
      }),
    }))
    const { disambiguate: fresh } = await import('./fuzzy.js')
    expect(await fresh(['x', 'y', 'z'])).toBe('y')
    fakeStderr.end()
  })

  it('falls back to readline when fzf throws (not available)', async () => {
    vi.doMock('node:child_process', () => ({
      spawnSync: () => { throw new Error('ENOENT') },
    }))
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    vi.doMock('node:readline', () => ({
      createInterface: () => ({
        question: (_: string, cb: (answer: string) => void) => cb('1'),
        close: () => {},
        on: () => {},
      }),
    }))
    const { disambiguate: fresh } = await import('./fuzzy.js')
    expect(await fresh(['first', 'second'])).toBe('first')
  })

  it('re-prompts on invalid readline answer until a valid one is given', async () => {
    vi.doMock('node:child_process', () => ({
      spawnSync: () => ({ status: 1, stdout: '', stderr: '' }),
    }))
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const answers = ['bogus', '99', '2']
    vi.doMock('node:readline', () => ({
      createInterface: () => ({
        question: (_: string, cb: (answer: string) => void) => cb(answers.shift() ?? ''),
        close: () => {},
        on: () => {},
      }),
    }))
    const { disambiguate: fresh } = await import('./fuzzy.js')
    expect(await fresh(['x', 'y'])).toBe('y')
  })

  it('rejects when readline emits close before a valid answer', async () => {
    vi.doMock('node:child_process', () => ({
      spawnSync: () => ({ status: 1, stdout: '', stderr: '' }),
    }))
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    vi.doMock('node:readline', () => ({
      createInterface: () => ({
        question: () => {}, // never answers
        close: () => {},
        on: (event: string, cb: () => void) => {
          if (event === 'close') setImmediate(cb)
        },
      }),
    }))
    const { disambiguate: fresh } = await import('./fuzzy.js')
    await expect(fresh(['a', 'b'])).rejects.toThrow(/cancelled/)
  })
})
