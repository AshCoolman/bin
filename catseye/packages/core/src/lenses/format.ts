import type { Lens } from './types.js'
import type { Query } from '../query/ast.js'

type SerializedLens = {
  $schema: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  query: Query
}

export function serializeLens(lens: Lens): string {
  const obj: SerializedLens = {
    $schema: 'https://catlens.local/lens-schema/v1',
    name: lens.name,
    ...(lens.description !== undefined ? { description: lens.description } : {}),
    createdAt: lens.createdAt.toISOString(),
    updatedAt: lens.updatedAt.toISOString(),
    query: lens.query,
  }
  return JSON.stringify(obj, null, 2)
}

export function deserializeLens(json: string): Lens {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON in lens file')
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('Lens file must be a JSON object')
  }

  const d = data as Record<string, unknown>

  if (typeof d['name'] !== 'string') throw new Error('Lens missing field: name')
  if (typeof d['createdAt'] !== 'string') throw new Error('Lens missing field: createdAt')
  if (typeof d['updatedAt'] !== 'string') throw new Error('Lens missing field: updatedAt')
  if (typeof d['query'] !== 'object' || d['query'] === null) throw new Error('Lens missing field: query')

  return {
    name: d['name'],
    ...(typeof d['description'] === 'string' ? { description: d['description'] } : {}),
    createdAt: new Date(d['createdAt']),
    updatedAt: new Date(d['updatedAt']),
    query: d['query'] as Query,
  }
}
