import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { buildResult } from './result.js'
import { parse } from '../query/parser.js'

let tmp: string
let gitTmp: string

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'catlens-result-'))
  await mkdir(join(tmp, 'src'), { recursive: true })
  await writeFile(join(tmp, 'src/a.ts'), 'export const foo = 1\nawait checkout()\n')
  await writeFile(join(tmp, 'src/b.ts'), 'export const bar = 2\n')
  await writeFile(join(tmp, 'src/c.py'), 'print("hello")\n')
  await writeFile(join(tmp, 'README.md'), '# hi\n')

  gitTmp = await mkdtemp(join(tmpdir(), 'catlens-result-git-'))
  await writeFile(join(gitTmp, 'a.ts'), 'original\n')
  const env = { GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'dev@ex.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'dev@ex.com' }
  await execa('git', ['init', '-q', '-b', 'main'], { cwd: gitTmp })
  await execa('git', ['config', 'user.email', 'dev@ex.com'], { cwd: gitTmp })
  await execa('git', ['config', 'user.name', 'Dev'], { cwd: gitTmp })
  await execa('git', ['add', '.'], { cwd: gitTmp })
  await execa('git', ['commit', '-q', '-m', 'initial'], { cwd: gitTmp, env })
  await writeFile(join(gitTmp, 'a.ts'), 'modified\n')
}, 30_000)

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true })
  await rm(gitTmp, { recursive: true, force: true })
})

describe('buildResult', () => {
  it('returns a SelectionResult with stats and files for a valid query', async () => {
    const r = await buildResult(parse('ext(ts)'), tmp)
    expect(r.files.map(f => f.path).sort()).toEqual(['src/a.ts', 'src/b.ts'])
    expect(r.stats.fileCount).toBe(2)
    expect(r.stats.totalLines).toBeGreaterThan(0)
    expect(r.stats.estimatedChars).toBeGreaterThan(0)
    expect(r.diffs).toEqual([])
    expect(r.sections).toEqual([])
  })

  it('combines predicates with and()', async () => {
    const r = await buildResult(parse('and(ext(ts), keyword("checkout"))'), tmp)
    expect(r.files.map(f => f.path)).toEqual(['src/a.ts'])
  })

  it('throws on invalid query', async () => {
    await expect(buildResult({ selection: { type: 'and', children: [] } }, tmp))
      .rejects.toThrow(/Invalid query/)
  })

  it('does not touch git when query has no git predicates', async () => {
    // Using a non-git temp dir — buildResult should complete without error
    const r = await buildResult(parse('ext(py)'), tmp)
    expect(r.files.map(f => f.path)).toEqual(['src/c.py'])
  })

  it('gracefully handles git predicates on a non-git dir (returns empty)', async () => {
    const r = await buildResult(parse('authored_by("nobody")'), tmp)
    expect(r.files).toEqual([])
  })

  it('traverses nested and/or/not/unless for git detection', async () => {
    // Wraps a git predicate deep inside nested nodes; this exercises nodeUsesGit's recursion.
    const query = parse('and(ext(ts), or(keyword("foo"), and(not(authored_by("alice")), keyword("checkout")))) unless(ext(py))')
    const r = await buildResult(query, tmp)
    // Should complete without error and return some result
    expect(Array.isArray(r.files)).toBe(true)
  })

  it('collects DiffHit entries for matched files that are in the working diff', async () => {
    const r = await buildResult(parse('diff()'), gitTmp)
    expect(r.files.map(f => f.path)).toContain('a.ts')
    expect(r.diffs).toHaveLength(1)
    expect(r.diffs[0]!.path).toBe('a.ts')
    expect(r.diffs[0]!.patch).toContain('modified')
    expect(r.stats.diffCount).toBe(1)
  })
})
