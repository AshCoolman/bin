import { describe, it, expect } from 'vitest'
import { fixturePath, runQuery, runCLI } from './helpers.js'

const TS_APP = fixturePath('ts-app')

describe('US1 — Ad Hoc Query and Render', () => {
  describe('keyword predicate', () => {
    it('matches files containing the keyword', async () => {
      const result = await runQuery(TS_APP, 'keyword:checkout')
      const paths = result.files.map(f => f.path)
      expect(paths.some(p => p.includes('checkout'))).toBe(true)
    })

    it('does not match files without the keyword', async () => {
      const result = await runQuery(TS_APP, 'keyword:checkout')
      const paths = result.files.map(f => f.path)
      expect(paths.some(p => p.includes('helpers'))).toBe(false)
    })

    it('is case-insensitive by default', async () => {
      const lower = await runQuery(TS_APP, 'keyword:checkout')
      const upper = await runQuery(TS_APP, 'keyword:CHECKOUT')
      expect(lower.stats.fileCount).toBe(upper.stats.fileCount)
    })
  })

  describe('ext predicate', () => {
    it('matches files with the given extension', async () => {
      const result = await runQuery(TS_APP, 'ext:ts')
      expect(result.files.every(f => f.path.endsWith('.ts'))).toBe(true)
    })

    it('matches multiple extensions', async () => {
      const result = await runQuery(TS_APP, 'ext:ts,tsx')
      expect(result.files.every(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))).toBe(true)
      expect(result.files.some(f => f.path.endsWith('.tsx'))).toBe(true)
    })
  })

  describe('boolean composition', () => {
    it('&&: requires all children to match', async () => {
      const result = await runQuery(TS_APP, 'ext:ts,tsx && keyword:checkout')
      expect(result.files.length).toBeGreaterThan(0)
      expect(result.files.every(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))).toBe(true)
      expect(result.files.every(f => f.content.toLowerCase().includes('checkout'))).toBe(true)
    })

    it('||: matches if any child matches', async () => {
      const andResult = await runQuery(TS_APP, 'ext:ts,tsx && keyword:checkout')
      const orResult = await runQuery(TS_APP, 'keyword:checkout || keyword:api')
      expect(orResult.stats.fileCount).toBeGreaterThanOrEqual(andResult.stats.fileCount)
    })

    it('!: excludes matching files', async () => {
      const all = await runQuery(TS_APP, 'ext:ts')
      const withKeyword = await runQuery(TS_APP, 'ext:ts && keyword:checkout')
      const withoutKeyword = await runQuery(TS_APP, 'ext:ts && !keyword:checkout')
      expect(withoutKeyword.stats.fileCount).toBe(all.stats.fileCount - withKeyword.stats.fileCount)
    })
  })

  describe('file predicate', () => {
    it('matches an explicit file path', async () => {
      const result = await runQuery(TS_APP, 'file:src/utils/helpers.ts')
      expect(result.files).toHaveLength(1)
      expect(result.files[0]?.path).toBe('src/utils/helpers.ts')
    })
  })

  describe('SelectionResult structure', () => {
    it('includes correct stats', async () => {
      const result = await runQuery(TS_APP, 'keyword:checkout')
      expect(result.stats.fileCount).toBe(result.files.length)
      expect(result.stats.totalLines).toBeGreaterThan(0)
    })

    it('all files have non-empty content', async () => {
      const result = await runQuery(TS_APP, 'ext:ts')
      expect(result.files.every(f => f.content.length > 0)).toBe(true)
    })

    it('reasons are populated', async () => {
      const result = await runQuery(TS_APP, 'keyword:checkout')
      expect(result.files.every(f => f.reasons.length > 0)).toBe(true)
    })
  })

  describe('zero-match query', () => {
    it('returns empty files array', async () => {
      const result = await runQuery(TS_APP, 'keyword:xyzzy_no_match_zzzz')
      expect(result.files).toHaveLength(0)
    })
  })

  describe('CLI --preview', () => {
    it('outputs file list summary', async () => {
      const r = await runCLI(['ext:ts,tsx && keyword:checkout', '--preview'], { root: TS_APP })
      expect(r.exitCode).toBe(0)
      expect(r.stdout).toContain('Matched:')
    })

    it('exits 3 when no matches', async () => {
      const r = await runCLI(['keyword:xyzzy_no_match_zzzz', '--preview'], { root: TS_APP })
      expect(r.exitCode).toBe(3)
    })
  })

  describe('CLI markdown render', () => {
    it('outputs fenced code blocks with file paths', async () => {
      const r = await runCLI(['keyword:checkout'], { root: TS_APP })
      expect(r.exitCode).toBe(0)
      expect(r.stdout).toContain('## ')
      expect(r.stdout).toContain('```')
    })
  })

  describe('CLI parse subcommand', () => {
    it('prints AST as JSON', async () => {
      const r = await runCLI(['parse', 'ext:ts'], { root: TS_APP })
      expect(r.exitCode).toBe(0)
      const ast = JSON.parse(r.stdout) as unknown
      expect(ast).toMatchObject({ selection: { type: 'ext', extensions: ['ts'] } })
    })

    it('exits 1 on bad DSL', async () => {
      const r = await runCLI(['parse', 'ext('], { root: TS_APP })
      expect(r.exitCode).toBe(1)
    })
  })
})
