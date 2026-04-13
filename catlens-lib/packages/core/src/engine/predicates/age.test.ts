import { describe, it, expect, vi, afterEach } from 'vitest'
import { evalOlderThan, evalNewerThan } from './age.js'
import type { FileFacts, GitFacts } from '../../query/result.js'

const NOW = new Date('2026-04-11T00:00:00Z')

const DAY = 86_400_000

const file = (mtime: Date, git?: Partial<GitFacts>): FileFacts => ({
  path: 'f.ts',
  content: '',
  lineCount: 0,
  extension: 'ts',
  mtime,
  ...(git !== undefined ? { gitFacts: { inCurrentDiff: false, ...git } as GitFacts } : {}),
})

describe('age predicates', () => {
  afterEach(() => vi.useRealTimers())

  describe('evalOlderThan', () => {
    it('matches files with mtime older than the threshold', () => {
      vi.setSystemTime(NOW)
      const old = new Date(NOW.getTime() - 60 * DAY)
      expect(evalOlderThan({ type: 'older_than', duration: { value: 30, unit: 'd' } }, file(old)))
        .toEqual({ predicate: 'older_than', detail: '30d' })
    })

    it('returns null when file is newer than threshold', () => {
      vi.setSystemTime(NOW)
      const fresh = new Date(NOW.getTime() - 5 * DAY)
      expect(evalOlderThan({ type: 'older_than', duration: { value: 30, unit: 'd' } }, file(fresh))).toBeNull()
    })

    it('prefers gitFacts.lastCommitDate over mtime when both present', () => {
      vi.setSystemTime(NOW)
      const ancientMtime = new Date(NOW.getTime() - 365 * DAY)
      const recentCommit = new Date(NOW.getTime() - 1 * DAY)
      const f = file(ancientMtime, { lastCommitDate: recentCommit })
      expect(evalOlderThan({ type: 'older_than', duration: { value: 30, unit: 'd' } }, f)).toBeNull()
    })

    it('supports w / m / y duration units', () => {
      vi.setSystemTime(NOW)
      const elevenMonthsAgo = new Date(NOW.getTime() - 330 * DAY)
      expect(evalOlderThan({ type: 'older_than', duration: { value: 1, unit: 'y' } }, file(elevenMonthsAgo))).toBeNull()
      expect(evalOlderThan({ type: 'older_than', duration: { value: 6, unit: 'm' } }, file(elevenMonthsAgo))).not.toBeNull()
      expect(evalOlderThan({ type: 'older_than', duration: { value: 1, unit: 'w' } }, file(elevenMonthsAgo))).not.toBeNull()
    })
  })

  describe('evalNewerThan', () => {
    it('matches files younger than the threshold', () => {
      vi.setSystemTime(NOW)
      const fresh = new Date(NOW.getTime() - 2 * DAY)
      expect(evalNewerThan({ type: 'newer_than', duration: { value: 7, unit: 'd' } }, file(fresh)))
        .toEqual({ predicate: 'newer_than', detail: '7d' })
    })

    it('returns null when file is older than threshold', () => {
      vi.setSystemTime(NOW)
      const old = new Date(NOW.getTime() - 30 * DAY)
      expect(evalNewerThan({ type: 'newer_than', duration: { value: 7, unit: 'd' } }, file(old))).toBeNull()
    })

    it('prefers gitFacts.lastCommitDate over mtime', () => {
      vi.setSystemTime(NOW)
      const staleMtime = new Date(NOW.getTime() - 100 * DAY)
      const recentCommit = new Date(NOW.getTime() - 1 * DAY)
      const f = file(staleMtime, { lastCommitDate: recentCommit })
      expect(evalNewerThan({ type: 'newer_than', duration: { value: 7, unit: 'd' } }, f)).not.toBeNull()
    })
  })
})
