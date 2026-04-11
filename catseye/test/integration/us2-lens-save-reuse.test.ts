import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parse,
  saveLens,
  loadLens,
  listLenses,
  deleteLens,
  findByPrefix,
  buildResult,
} from '@catlens/core'
import { fixturePath, runCLI } from './helpers.js'

const TS_APP = fixturePath('ts-app')

let tempRoot: string

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), 'catlens-test-'))
})

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true })
})

describe('lens save/load roundtrip', () => {
  it('saved lens produces identical SelectionResult as inline query', async () => {
    const dsl = 'and(ext(ts), keyword("checkout"))'
    const query = parse(dsl)

    await saveLens(tempRoot, 'checkout-ts', query)
    const lens = await loadLens(tempRoot, 'checkout-ts')

    // Run engine with original query and saved lens query against same fixture
    const [direct, fromLens] = await Promise.all([
      buildResult(query, TS_APP),
      buildResult(lens.query, TS_APP),
    ])

    expect(fromLens.files.map(f => f.path)).toEqual(direct.files.map(f => f.path))
    expect(fromLens.stats.fileCount).toBe(direct.stats.fileCount)
  })

  it('roundtrip preserves query structure', async () => {
    const query = parse('and(ext(ts, tsx), keyword("api"))')
    await saveLens(tempRoot, 'api-files', query)
    const lens = await loadLens(tempRoot, 'api-files')

    expect(lens.query.selection.type).toBe('and')
    expect(lens.name).toBe('api-files')
    expect(lens.createdAt).toBeInstanceOf(Date)
  })

  it('updating a lens preserves createdAt', async () => {
    const q1 = parse('ext(ts)')
    const q2 = parse('ext(tsx)')

    await saveLens(tempRoot, 'my-lens', q1)
    const first = await loadLens(tempRoot, 'my-lens')
    await saveLens(tempRoot, 'my-lens', q2)
    const second = await loadLens(tempRoot, 'my-lens')

    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime())
    expect(second.query.selection.type).toBe('ext')
  })
})

describe('prefix resolution', () => {
  it('findByPrefix returns exact match', async () => {
    const query = parse('ext(ts)')
    await saveLens(tempRoot, 'checkout-ts', query)
    await saveLens(tempRoot, 'checkout-api', query)

    const matches = await findByPrefix(tempRoot, 'checkout-ts')
    expect(matches).toEqual(['checkout-ts'])
  })

  it('findByPrefix returns multiple when ambiguous', async () => {
    const query = parse('ext(ts)')
    await saveLens(tempRoot, 'checkout-ts', query)
    await saveLens(tempRoot, 'checkout-api', query)

    const matches = await findByPrefix(tempRoot, 'checkout')
    expect(matches.length).toBe(2)
    expect(matches).toContain('checkout-ts')
    expect(matches).toContain('checkout-api')
  })

  it('findByPrefix returns empty array when no match', async () => {
    const matches = await findByPrefix(tempRoot, 'nonexistent')
    expect(matches).toHaveLength(0)
  })
})

describe('lens list and delete', () => {
  it('listLenses returns all saved lenses', async () => {
    const query = parse('ext(ts)')
    await saveLens(tempRoot, 'alpha', query)
    await saveLens(tempRoot, 'beta', query)

    const lenses = await listLenses(tempRoot)
    expect(lenses.map(l => l.name)).toEqual(['alpha', 'beta'])
  })

  it('listLenses returns empty array when none saved', async () => {
    const lenses = await listLenses(tempRoot)
    expect(lenses).toHaveLength(0)
  })

  it('deleteLens removes the file', async () => {
    const query = parse('ext(ts)')
    await saveLens(tempRoot, 'to-delete', query)
    await deleteLens(tempRoot, 'to-delete')

    const lenses = await listLenses(tempRoot)
    expect(lenses.map(l => l.name)).not.toContain('to-delete')
  })

  it('deleteLens throws for nonexistent lens', async () => {
    await expect(deleteLens(tempRoot, 'not-here')).rejects.toThrow('Lens not found')
  })
})

describe('invalid lens names', () => {
  it('rejects uppercase names', async () => {
    const query = parse('ext(ts)')
    await expect(saveLens(tempRoot, 'BadName', query)).rejects.toThrow('Invalid lens name')
  })

  it('rejects names starting with hyphen', async () => {
    const query = parse('ext(ts)')
    await expect(saveLens(tempRoot, '-bad', query)).rejects.toThrow('Invalid lens name')
  })
})

describe('CLI lens integration', () => {
  it('--save saves lens and run by name produces same output', async () => {
    // Run with --save in a temp root that has the fixture files accessible
    // We test via the CLI using the ts-app fixture as root
    // First run the query with --save
    const saveResult = await runCLI(
      ['and(ext(ts), keyword("checkout"))', '--save', 'checkout-ts', '--output', 'file-list'],
      { root: TS_APP },
    )

    // The lens is saved in the TS_APP dir; clean up after
    try {
      expect(saveResult.exitCode).toBe(0)

      // Now run by lens name
      const lensResult = await runCLI(['checkout-ts', '--output', 'file-list'], { root: TS_APP })
      expect(lensResult.exitCode).toBe(0)
      expect(lensResult.stdout).toBe(saveResult.stdout)
    } finally {
      // Clean up the lens saved in TS_APP
      await deleteLens(TS_APP, 'checkout-ts').catch(() => {})
    }
  })

  it('lens list subcommand shows saved lenses', async () => {
    const query = parse('ext(ts)')
    await saveLens(TS_APP, 'test-list-lens', query)

    try {
      const result = await runCLI(['lens', 'list'], { root: TS_APP })
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('test-list-lens')
    } finally {
      await deleteLens(TS_APP, 'test-list-lens').catch(() => {})
    }
  })

  it('lens rm subcommand removes lens', async () => {
    const query = parse('ext(ts)')
    await saveLens(TS_APP, 'to-rm', query)

    try {
      const result = await runCLI(['lens', 'rm', 'to-rm', '--yes'], { root: TS_APP })
      expect(result.exitCode).toBe(0)

      const lenses = await listLenses(TS_APP)
      expect(lenses.map(l => l.name)).not.toContain('to-rm')
    } finally {
      await deleteLens(TS_APP, 'to-rm').catch(() => {})
    }
  })

  it('lens rm exits 4 for nonexistent lens', async () => {
    const result = await runCLI(['lens', 'rm', 'nope', '--yes'], { root: TS_APP })
    expect(result.exitCode).toBe(4)
  })

  it('lens show prints formatted DSL', async () => {
    const query = parse('and(ext(tsx, ts), keyword("checkout"))')
    await saveLens(TS_APP, 'show-test', query)

    try {
      const result = await runCLI(['lens', 'show', 'show-test'], { root: TS_APP })
      expect(result.exitCode).toBe(0)
      // Formatted: extensions sorted alphabetically
      expect(result.stdout).toContain('ext(ts, tsx)')
    } finally {
      await deleteLens(TS_APP, 'show-test').catch(() => {})
    }
  })
})
