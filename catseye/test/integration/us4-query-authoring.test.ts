import { describe, it, expect } from 'vitest'
import { parse, validate, format, lint } from '@catlens/core'
import { runCLI } from './helpers.js'

describe('validator', () => {
  it('accepts a valid and() query', () => {
    const q = parse('and(ext(ts), keyword("foo"))')
    const result = validate(q)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects and() with one child', () => {
    // Bypass the parser since it already enforces ≥2 children
    const q = {
      selection: {
        type: 'and' as const,
        children: [{ type: 'ext' as const, extensions: ['ts'] }],
      },
    }
    const result = validate(q)
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.message).toMatch(/and\(\) requires at least 2/)
  })

  it('rejects or() with zero children', () => {
    const q = {
      selection: {
        type: 'or' as const,
        children: [],
      },
    }
    const result = validate(q)
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.message).toMatch(/or\(\) requires at least 2/)
  })

  it('rejects ext() with no extensions', () => {
    const q = { selection: { type: 'ext' as const, extensions: [] as readonly string[] } }
    const result = validate(q)
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.message).toMatch(/ext\(\) requires/)
  })

  it('rejects keyword() with empty term', () => {
    const q = { selection: { type: 'keyword' as const, term: '' } }
    const result = validate(q)
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.message).toMatch(/keyword\(\) requires/)
  })
})

describe('formatter', () => {
  it('formats a simple query', () => {
    const q = parse('and(ext(ts), keyword("checkout"))')
    expect(format(q)).toBe('and(ext(ts), keyword("checkout"))')
  })

  it('normalises any() to or()', () => {
    const q = parse('any(ext(ts), ext(tsx))')
    expect(format(q)).toBe('or(ext(ts), ext(tsx))')
  })

  it('sorts extensions', () => {
    const q = parse('ext(tsx, ts)')
    expect(format(q)).toBe('ext(ts, tsx)')
  })

  it('is idempotent (3 iterations)', () => {
    const dsl = 'and(ext(tsx,ts),keyword("api"))'
    const q1 = parse(dsl)
    const s1 = format(q1)
    const s2 = format(parse(s1))
    const s3 = format(parse(s2))
    expect(s2).toBe(s1)
    expect(s3).toBe(s1)
  })
})

describe('linter', () => {
  it('no diagnostics for a clean query', () => {
    const q = parse('and(ext(ts), keyword("checkout"))')
    const result = lint(q)
    expect(result.diagnostics).toHaveLength(0)
  })

  it('reports contradictory-branches for not(x) and x in same and()', () => {
    const q = parse('and(ext(ts), not(ext(ts)))')
    const result = lint(q)
    const contradiction = result.diagnostics.find(d => d.rule === 'contradictory-branches')
    expect(contradiction).toBeDefined()
    expect(contradiction?.severity).toBe('error')
  })

  it('reports duplicate-predicate', () => {
    const q = parse('and(ext(ts), ext(ts))')
    const result = lint(q)
    const dup = result.diagnostics.find(d => d.rule === 'duplicate-predicate')
    expect(dup).toBeDefined()
    expect(dup?.severity).toBe('warning')
  })

  it('reports suspiciously-broad for bare ext()', () => {
    const q = parse('ext(ts)')
    const result = lint(q)
    const broad = result.diagnostics.find(d => d.rule === 'suspiciously-broad')
    expect(broad).toBeDefined()
  })

  it('reports likely-zero-match for top-level not()', () => {
    const q = parse('not(ext(ts))')
    const result = lint(q)
    const zero = result.diagnostics.find(d => d.rule === 'likely-zero-match')
    expect(zero).toBeDefined()
  })
})

describe('CLI fmt subcommand', () => {
  it('formats a query to stdout', async () => {
    const result = await runCLI(['fmt', 'and(ext(tsx,ts),keyword("api"))'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('and(ext(ts, tsx), keyword("api"))')
  })

  it('exits 1 on parse error', async () => {
    const result = await runCLI(['fmt', 'bad((('])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/parse error/i)
  })
})

describe('CLI lint subcommand', () => {
  it('exits 0 with no issues for clean query', async () => {
    const result = await runCLI(['lint', 'and(ext(ts), keyword("foo"))'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('No issues')
  })

  it('exits 2 for lint errors (contradictory-branches)', async () => {
    const result = await runCLI(['lint', 'and(ext(ts), not(ext(ts)))'])
    expect(result.exitCode).toBe(2)
    expect(result.stdout).toMatch(/contradictory-branches/)
  })

  it('exits 1 on parse failure', async () => {
    const result = await runCLI(['lint', 'bad((('])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/parse error/i)
  })
})

describe('CLI parse subcommand', () => {
  it('prints AST as JSON', async () => {
    const result = await runCLI(['parse', 'ext(ts)'])
    expect(result.exitCode).toBe(0)
    const ast = JSON.parse(result.stdout)
    expect(ast.selection.type).toBe('ext')
  })

  it('exits 1 on parse error', async () => {
    const result = await runCLI(['parse', 'bad((('])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/parse error/i)
  })
})
