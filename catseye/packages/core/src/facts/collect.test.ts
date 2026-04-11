import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectFacts } from './collect.js'

let tmp: string

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'catlens-facts-'))
  await writeFile(join(tmp, 'a.ts'), 'line1\nline2\nline3')
  await writeFile(join(tmp, 'noext'), 'one line')
})

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true })
})

describe('collectFacts', () => {
  it('returns FileFacts for readable files', async () => {
    const [a] = await collectFacts(['a.ts'], tmp)
    expect(a).toBeDefined()
    expect(a!.path).toBe('a.ts')
    expect(a!.content).toBe('line1\nline2\nline3')
    expect(a!.lineCount).toBe(3)
    expect(a!.extension).toBe('ts')
    expect(a!.mtime).toBeInstanceOf(Date)
  })

  it('reports empty extension for files without one', async () => {
    const [f] = await collectFacts(['noext'], tmp)
    expect(f!.extension).toBe('')
  })

  it('silently drops paths that do not exist', async () => {
    const results = await collectFacts(['a.ts', 'does-not-exist.ts'], tmp)
    expect(results).toHaveLength(1)
    expect(results[0]!.path).toBe('a.ts')
  })

  it('returns empty array for empty input', async () => {
    expect(await collectFacts([], tmp)).toEqual([])
  })
})
