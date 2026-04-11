import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveLens, loadLens, listLenses, deleteLens, findByPrefix } from './store.js'
import type { Query } from '../query/ast.js'

const query: Query = { selection: { type: 'ext', extensions: ['ts'] } }

let tmp: string

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'catlens-store-'))
})

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
})

describe('lens store', () => {
  describe('saveLens', () => {
    it('creates a new lens in .catlens', async () => {
      const saved = await saveLens(tmp, 'my-lens', query, 'a description')
      expect(saved.name).toBe('my-lens')
      expect(saved.description).toBe('a description')
      expect(saved.createdAt).toEqual(saved.updatedAt)
    })

    it('preserves createdAt and description when updating an existing lens', async () => {
      const first = await saveLens(tmp, 'my-lens', query, 'original')
      await new Promise(r => setTimeout(r, 5))
      const second = await saveLens(tmp, 'my-lens', { selection: { type: 'ext', extensions: ['js'] } })
      expect(second.createdAt.toISOString()).toBe(first.createdAt.toISOString())
      expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime())
      expect(second.description).toBe('original')
    })

    it('replaces description when explicitly passed on update', async () => {
      await saveLens(tmp, 'my-lens', query, 'original')
      const updated = await saveLens(tmp, 'my-lens', query, 'new desc')
      expect(updated.description).toBe('new desc')
    })

    it('rejects invalid names', async () => {
      await expect(saveLens(tmp, 'Bad_Name', query)).rejects.toThrow(/Invalid lens name/)
      await expect(saveLens(tmp, '-leading', query)).rejects.toThrow(/Invalid lens name/)
    })
  })

  describe('loadLens', () => {
    it('returns a previously saved lens', async () => {
      await saveLens(tmp, 'my-lens', query)
      const loaded = await loadLens(tmp, 'my-lens')
      expect(loaded.name).toBe('my-lens')
      expect(loaded.query).toEqual(query)
    })

    it('throws when lens does not exist', async () => {
      await expect(loadLens(tmp, 'missing')).rejects.toThrow(/Lens not found/)
    })

    it('rejects invalid names', async () => {
      await expect(loadLens(tmp, 'Bad_Name')).rejects.toThrow(/Invalid lens name/)
    })
  })

  describe('listLenses', () => {
    it('returns empty array when .catlens does not exist', async () => {
      expect(await listLenses(tmp)).toEqual([])
    })

    it('returns all saved lenses sorted by name', async () => {
      await saveLens(tmp, 'beta', query)
      await saveLens(tmp, 'alpha', query)
      const lenses = await listLenses(tmp)
      expect(lenses.map(l => l.name)).toEqual(['alpha', 'beta'])
    })

    it('skips non-json and invalid-name files', async () => {
      await saveLens(tmp, 'valid', query)
      await mkdir(join(tmp, '.catlens'), { recursive: true })
      await writeFile(join(tmp, '.catlens', 'NOT_JSON.txt'), 'x')
      await writeFile(join(tmp, '.catlens', 'Invalid_Name.json'), '{}')
      const lenses = await listLenses(tmp)
      expect(lenses.map(l => l.name)).toEqual(['valid'])
    })

    it('silently drops corrupt JSON files', async () => {
      await saveLens(tmp, 'good', query)
      await writeFile(join(tmp, '.catlens', 'corrupt.json'), '{ not valid json')
      const lenses = await listLenses(tmp)
      expect(lenses.map(l => l.name)).toEqual(['good'])
    })
  })

  describe('deleteLens', () => {
    it('removes an existing lens', async () => {
      await saveLens(tmp, 'my-lens', query)
      await deleteLens(tmp, 'my-lens')
      await expect(loadLens(tmp, 'my-lens')).rejects.toThrow(/Lens not found/)
    })

    it('throws when target does not exist', async () => {
      await expect(deleteLens(tmp, 'nope')).rejects.toThrow(/Lens not found/)
    })

    it('rejects invalid names', async () => {
      await expect(deleteLens(tmp, 'Bad_Name')).rejects.toThrow(/Invalid lens name/)
    })
  })

  describe('findByPrefix', () => {
    it('returns lenses matching a prefix', async () => {
      await saveLens(tmp, 'check-a', query)
      await saveLens(tmp, 'check-b', query)
      await saveLens(tmp, 'other', query)
      expect((await findByPrefix(tmp, 'check')).sort()).toEqual(['check-a', 'check-b'])
    })

    it('returns an empty array when nothing matches', async () => {
      await saveLens(tmp, 'a', query)
      expect(await findByPrefix(tmp, 'z')).toEqual([])
    })

    it('returns empty when no lenses exist at all', async () => {
      expect(await findByPrefix(tmp, 'x')).toEqual([])
    })
  })
})
