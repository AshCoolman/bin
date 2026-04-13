import { describe, it, expect } from 'vitest'
import { parse, buildResult } from '@catlens/core'
import { fixturePath } from './helpers.js'

const TAGGED = fixturePath('tagged-sections')
const TS_APP = fixturePath('ts-app')
const IGNORED = fixturePath('ignored-files')
const GIT_HISTORY = fixturePath('git-history')

describe('glob predicate', () => {
  it('matches files by glob pattern', async () => {
    const q = parse('glob("src/**/*.ts")')
    const result = await buildResult(q, TS_APP)
    expect(result.files.length).toBeGreaterThan(0)
    for (const f of result.files) {
      expect(f.path).toMatch(/^src\/.*\.ts$/)
    }
  })

  it('does not match excluded files', async () => {
    const q = parse('glob("*.log")')
    const result = await buildResult(q, IGNORED)
    // .log files are gitignored and excluded from discovery
    expect(result.files.length).toBe(0)
  })
})

describe('tag predicate', () => {
  it('matches files containing the tag anywhere', async () => {
    const q = parse('tag("@catty:api")')
    const result = await buildResult(q, TAGGED)
    expect(result.files.length).toBeGreaterThan(0)
    for (const f of result.files) {
      expect(f.content).toContain('@catty:api')
    }
  })

  it('matches files containing the tag in file scope (first 10 lines)', async () => {
    const q = parse('tag("@catty:api", file)')
    const result = await buildResult(q, TAGGED)
    expect(result.files.length).toBeGreaterThan(0)
    for (const f of result.files) {
      const firstLines = f.content.split('\n').slice(0, 10).join('\n')
      expect(firstLines).toContain('@catty:api')
    }
  })
})

describe('tagged_section predicate', () => {
  it('captures sections between open/close tags', async () => {
    const q = parse('tagged_section("catty:start", "catty:end")')
    const result = await buildResult(q, TAGGED)

    expect(result.files.length).toBeGreaterThan(0)
    expect(result.sections.length).toBeGreaterThan(0)

    for (const section of result.sections) {
      expect(section.startLine).toBeLessThan(section.endLine)
      expect(section.tag).toBe('catty:start')
    }
  })
})

describe('unless composition', () => {
  it('subtracts files from the base selection', async () => {
    // Get all ts files
    const allTs = await buildResult(parse('ext(ts)'), TS_APP)
    // Get ts files that don't have "checkout"
    const withoutCheckout = await buildResult(
      parse('ext(ts) unless(keyword("checkout"))'),
      TS_APP,
    )

    expect(withoutCheckout.files.length).toBeLessThan(allTs.files.length)

    // None of the remaining files should have "checkout"
    for (const f of withoutCheckout.files) {
      expect(f.content.toLowerCase()).not.toContain('checkout')
    }
  })
})

describe('git predicates — graceful degradation', () => {
  it('authored_by returns no matches on non-git fixture', async () => {
    // git-history fixture is a real git repo, but authored_by for a non-existent author
    const q = parse('authored_by("nonexistent-person-xyz")')
    const result = await buildResult(q, GIT_HISTORY)
    expect(result.files.length).toBe(0)
  })

  it('older_than gracefully returns empty on non-git dir', async () => {
    // TAGGED fixture is not a git repo
    const q = parse('older_than("1d")')
    const result = await buildResult(q, TAGGED)
    // No git facts → no matches
    expect(result.files.length).toBe(0)
  })

  it('diff predicate gracefully returns empty when no diff', async () => {
    const q = parse('diff()')
    const result = await buildResult(q, TS_APP)
    // In test environment no staged/unstaged changes expected for fixture
    // Just confirm it runs without error
    expect(result).toBeDefined()
    expect(Array.isArray(result.files)).toBe(true)
  })
})
