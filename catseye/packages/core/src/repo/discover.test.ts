import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discover } from './discover.js'

describe('discover', () => {
  describe('basic discovery', () => {
    let tmp: string

    beforeAll(async () => {
      tmp = await mkdtemp(join(tmpdir(), 'catlens-discover-'))
      await mkdir(join(tmp, 'src/nested'), { recursive: true })
      await writeFile(join(tmp, 'src/a.ts'), 'x')
      await writeFile(join(tmp, 'src/nested/b.ts'), 'y')
      await writeFile(join(tmp, 'README.md'), 'z')
    })

    afterAll(async () => {
      await rm(tmp, { recursive: true, force: true })
    })

    it('returns all non-ignored files sorted', async () => {
      const result = await discover(tmp)
      expect(result).toEqual(['README.md', 'src/a.ts', 'src/nested/b.ts'])
    })
  })

  describe('respects .gitignore', () => {
    let tmp: string

    beforeAll(async () => {
      tmp = await mkdtemp(join(tmpdir(), 'catlens-discover-ignore-'))
      await writeFile(join(tmp, '.gitignore'), 'skipme.ts\n*.log\n')
      await writeFile(join(tmp, 'keep.ts'), 'x')
      await writeFile(join(tmp, 'skipme.ts'), 'y')
      await writeFile(join(tmp, 'noise.log'), 'z')
    })

    afterAll(async () => {
      await rm(tmp, { recursive: true, force: true })
    })

    it('filters .gitignore-listed files', async () => {
      const result = await discover(tmp)
      expect(result).toEqual(['keep.ts'])
    })
  })

  describe('always excludes node_modules and .git', () => {
    let tmp: string

    beforeAll(async () => {
      tmp = await mkdtemp(join(tmpdir(), 'catlens-discover-node-'))
      await mkdir(join(tmp, 'node_modules/foo'), { recursive: true })
      await mkdir(join(tmp, '.git'), { recursive: true })
      await writeFile(join(tmp, 'node_modules/foo/index.js'), 'x')
      await writeFile(join(tmp, '.git/config'), 'y')
      await writeFile(join(tmp, 'real.ts'), 'z')
    })

    afterAll(async () => {
      await rm(tmp, { recursive: true, force: true })
    })

    it('hides node_modules and .git regardless of gitignore', async () => {
      const result = await discover(tmp)
      expect(result).toEqual(['real.ts'])
    })
  })

  describe('handles missing .gitignore', () => {
    let tmp: string

    beforeAll(async () => {
      tmp = await mkdtemp(join(tmpdir(), 'catlens-discover-nogit-'))
      await writeFile(join(tmp, 'only.ts'), 'x')
    })

    afterAll(async () => {
      await rm(tmp, { recursive: true, force: true })
    })

    it('returns files when no .gitignore is present', async () => {
      const result = await discover(tmp)
      expect(result).toEqual(['only.ts'])
    })
  })
})
