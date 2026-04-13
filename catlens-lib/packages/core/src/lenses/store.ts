import { mkdir, readFile, writeFile, unlink, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Query } from '../query/ast.js'
import type { Lens } from './types.js'
import { serializeLens, deserializeLens } from './format.js'

const LENS_DIR = '.catlens'
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/

function lensDir(repoRoot: string): string {
  return join(repoRoot, LENS_DIR)
}

function lensPath(repoRoot: string, name: string): string {
  return join(lensDir(repoRoot), `${name}.json`)
}

function assertValidName(name: string): void {
  if (!NAME_RE.test(name)) {
    throw new Error(`Invalid lens name "${name}". Must match [a-z0-9][a-z0-9-]*`)
  }
}

export async function saveLens(
  repoRoot: string,
  name: string,
  query: Query,
  description?: string,
): Promise<Lens> {
  assertValidName(name)
  await mkdir(lensDir(repoRoot), { recursive: true })

  const now = new Date()
  let existing: Lens | null = null
  try {
    existing = await loadLens(repoRoot, name)
  } catch {
    // does not exist yet — that's fine
  }

  const lens: Lens = {
    name,
    ...(description !== undefined
      ? { description }
      : existing?.description !== undefined
        ? { description: existing.description }
        : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    query,
  }

  await writeFile(lensPath(repoRoot, name), serializeLens(lens), 'utf-8')
  return lens
}

export async function loadLens(repoRoot: string, name: string): Promise<Lens> {
  assertValidName(name)
  let json: string
  try {
    json = await readFile(lensPath(repoRoot, name), 'utf-8')
  } catch {
    throw new Error(`Lens not found: ${name}`)
  }
  return deserializeLens(json)
}

export async function listLenses(repoRoot: string): Promise<Lens[]> {
  let entries: string[]
  try {
    entries = await readdir(lensDir(repoRoot))
  } catch {
    return []
  }

  const lenses: Lens[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    const name = entry.slice(0, -5)
    if (!NAME_RE.test(name)) continue
    try {
      lenses.push(await loadLens(repoRoot, name))
    } catch {
      // skip corrupt files silently
    }
  }

  return lenses.sort((a, b) => a.name.localeCompare(b.name))
}

export async function deleteLens(repoRoot: string, name: string): Promise<void> {
  assertValidName(name)
  try {
    await unlink(lensPath(repoRoot, name))
  } catch {
    throw new Error(`Lens not found: ${name}`)
  }
}

/**
 * Find all lens names that start with `prefix`.
 * Returns an empty array if the .catlens dir doesn't exist.
 */
export async function findByPrefix(repoRoot: string, prefix: string): Promise<string[]> {
  const all = await listLenses(repoRoot)
  return all.filter(l => l.name.startsWith(prefix)).map(l => l.name)
}
