import { describe, it, expect } from 'vitest'
import { serializeLens, deserializeLens } from './format.js'
import type { Lens } from './types.js'

const sampleLens: Lens = {
  name: 'checkout-ts',
  description: 'TS files touching checkout',
  createdAt: new Date('2026-04-01T00:00:00Z'),
  updatedAt: new Date('2026-04-11T00:00:00Z'),
  query: { selection: { type: 'ext', extensions: ['ts'] } },
}

describe('lens format', () => {
  it('serialize → deserialize roundtrip preserves all fields', () => {
    const json = serializeLens(sampleLens)
    const back = deserializeLens(json)
    expect(back.name).toBe(sampleLens.name)
    expect(back.description).toBe(sampleLens.description)
    expect(back.createdAt.toISOString()).toBe(sampleLens.createdAt.toISOString())
    expect(back.updatedAt.toISOString()).toBe(sampleLens.updatedAt.toISOString())
    expect(back.query).toEqual(sampleLens.query)
  })

  it('serializes without description when undefined', () => {
    const lens: Lens = { ...sampleLens }
    const withoutDesc = { ...lens } as Partial<Lens>
    delete (withoutDesc as { description?: string }).description
    const json = serializeLens(withoutDesc as Lens)
    expect(json).not.toContain('description')
  })

  it('includes $schema field', () => {
    expect(serializeLens(sampleLens)).toContain('$schema')
  })

  it('rejects invalid JSON', () => {
    expect(() => deserializeLens('not json')).toThrow(/Invalid JSON/)
  })

  it('rejects non-object top level', () => {
    expect(() => deserializeLens('42')).toThrow(/must be a JSON object/)
    expect(() => deserializeLens('null')).toThrow(/must be a JSON object/)
  })

  it('rejects missing required fields', () => {
    const base = { $schema: 'x', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z', query: {} }
    expect(() => deserializeLens(JSON.stringify(base))).toThrow(/name/)
    expect(() => deserializeLens(JSON.stringify({ ...base, name: 'x', createdAt: undefined })))
      .toThrow(/createdAt/)
    expect(() => deserializeLens(JSON.stringify({ ...base, name: 'x', updatedAt: undefined })))
      .toThrow(/updatedAt/)
    expect(() => deserializeLens(JSON.stringify({ ...base, name: 'x', query: undefined })))
      .toThrow(/query/)
  })

  it('drops description on deserialization when absent', () => {
    const json = JSON.stringify({
      name: 'foo',
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
      query: { selection: { type: 'ext', extensions: ['ts'] } },
    })
    const back = deserializeLens(json)
    expect(back.description).toBeUndefined()
  })
})
