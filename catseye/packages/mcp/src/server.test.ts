import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from './server.js'

let tmp: string
let client: Client

const getText = (r: unknown): string => {
  const content = (r as { content: Array<{ text: string }> }).content
  return content[0]!.text
}

const isError = (r: unknown): boolean =>
  Boolean((r as { isError?: boolean }).isError)

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'catlens-mcp-'))
  await mkdir(join(tmp, 'src'), { recursive: true })
  await writeFile(join(tmp, 'src/a.ts'), 'export const x = 1\nawait checkout()\n')
  await writeFile(join(tmp, 'src/b.ts'), 'export const y = 2\n')

  const server = createMcpServer(tmp)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
}, 15_000)

afterAll(async () => {
  await client.close()
  await rm(tmp, { recursive: true, force: true })
})

describe('MCP server tools', () => {
  describe('parse_query', () => {
    it('returns AST JSON for a valid DSL', async () => {
      const r = await client.callTool({ name: 'parse_query', arguments: { dsl: 'ext(ts)' } })
      expect(JSON.parse(getText(r)).selection.type).toBe('ext')
    })

    it('returns error for invalid DSL', async () => {
      const r = await client.callTool({ name: 'parse_query', arguments: { dsl: 'bad(((' } })
      expect(isError(r)).toBe(true)
      expect(getText(r)).toMatch(/Parse error/)
    })
  })

  describe('format_query', () => {
    it('returns canonical DSL', async () => {
      const r = await client.callTool({ name: 'format_query', arguments: { dsl: 'and(ext(tsx,ts), keyword("api"))' } })
      expect(getText(r)).toBe('and(ext(ts, tsx), keyword("api"))')
    })

    it('returns error for invalid DSL', async () => {
      const r = await client.callTool({ name: 'format_query', arguments: { dsl: 'nope(' } })
      expect(isError(r)).toBe(true)
    })
  })

  describe('run_query output formats', () => {
    it('markdown (default)', async () => {
      const r = await client.callTool({ name: 'run_query', arguments: { query: 'ext(ts)' } })
      expect(getText(r)).toMatch(/^##/)
    })

    it('file-list', async () => {
      const r = await client.callTool({ name: 'run_query', arguments: { query: 'ext(ts)', output_format: 'file-list' } })
      expect(getText(r).split('\n').sort()).toEqual(['src/a.ts', 'src/b.ts'])
    })

    it('json', async () => {
      const r = await client.callTool({ name: 'run_query', arguments: { query: 'ext(ts)', output_format: 'json' } })
      expect(JSON.parse(getText(r)).stats.fileCount).toBe(2)
    })

    it('preview', async () => {
      const r = await client.callTool({ name: 'run_query', arguments: { query: 'ext(ts)', output_format: 'preview' } })
      expect(getText(r)).toMatch(/Matched:/)
    })
  })

  describe('run_query edge cases', () => {
    it('accepts JSON AST input with valid selection', async () => {
      const ast = JSON.stringify({ selection: { type: 'ext', extensions: ['ts'] } })
      const r = await client.callTool({ name: 'run_query', arguments: { query: ast, output_format: 'file-list' } })
      expect(getText(r)).toContain('src/a.ts')
    })

    it('rejects JSON AST with invalid structure', async () => {
      const ast = JSON.stringify({ selection: { type: 'and', children: [] } })
      const r = await client.callTool({ name: 'run_query', arguments: { query: ast } })
      expect(isError(r)).toBe(true)
      expect(getText(r)).toMatch(/Invalid query AST/)
    })

    it('falls back to DSL parse when JSON input is not a Query object', async () => {
      const r = await client.callTool({ name: 'run_query', arguments: { query: '{"something": "else"}', output_format: 'file-list' } })
      // Not a Query shape, falls back to parsing as DSL — which fails
      expect(isError(r)).toBe(true)
      expect(getText(r)).toMatch(/Parse error/)
    })

    it('returns parse error for bad DSL', async () => {
      const r = await client.callTool({ name: 'run_query', arguments: { query: 'bad(((' } })
      expect(isError(r)).toBe(true)
    })
  })

  describe('list_lenses', () => {
    it('returns "No saved lenses." when empty', async () => {
      const r = await client.callTool({ name: 'list_lenses', arguments: {} })
      expect(getText(r)).toBe('No saved lenses.')
    })

    it('returns lenses after save_lens', async () => {
      await client.callTool({
        name: 'save_lens',
        arguments: { name: 'list-test', dsl: 'ext(ts)', description: 'desc-hello' },
      })
      const r = await client.callTool({ name: 'list_lenses', arguments: {} })
      expect(getText(r)).toContain('list-test')
      expect(getText(r)).toContain('desc-hello')
    })
  })

  describe('run_lens', () => {
    it('runs a saved lens and returns output in requested format', async () => {
      await client.callTool({ name: 'save_lens', arguments: { name: 'run-test', dsl: 'ext(ts)' } })
      const r = await client.callTool({ name: 'run_lens', arguments: { name: 'run-test', output_format: 'file-list' } })
      expect(getText(r)).toContain('src/a.ts')
    })

    it('returns error when lens does not exist', async () => {
      const r = await client.callTool({ name: 'run_lens', arguments: { name: 'nonexistent' } })
      expect(isError(r)).toBe(true)
    })
  })

  describe('preview_lens', () => {
    it('returns JSON with files and stats', async () => {
      await client.callTool({ name: 'save_lens', arguments: { name: 'preview-test', dsl: 'ext(ts)' } })
      const r = await client.callTool({ name: 'preview_lens', arguments: { name: 'preview-test' } })
      const parsed = JSON.parse(getText(r))
      expect(Array.isArray(parsed.files)).toBe(true)
      expect(parsed.stats).toBeDefined()
    })

    it('returns error for missing lens', async () => {
      const r = await client.callTool({ name: 'preview_lens', arguments: { name: 'nope' } })
      expect(isError(r)).toBe(true)
    })
  })

  describe('render_selection', () => {
    const selection = {
      query: { selection: { type: 'ext', extensions: ['ts'] } },
      repoRoot: '/x',
      files: [{ path: 'a.ts', reasons: [], lineCount: 1, content: 'x' }],
      sections: [],
      diffs: [],
      stats: { fileCount: 1, sectionCount: 0, diffCount: 0, totalLines: 1, estimatedChars: 1 },
    }

    it('renders a SelectionResult as markdown', async () => {
      const r = await client.callTool({
        name: 'render_selection',
        arguments: { selection: JSON.stringify(selection), output_format: 'markdown' },
      })
      expect(getText(r)).toContain('## a.ts')
    })

    it('returns error on malformed JSON', async () => {
      const r = await client.callTool({
        name: 'render_selection',
        arguments: { selection: '{ not json', output_format: 'markdown' },
      })
      expect(isError(r)).toBe(true)
    })
  })

  describe('save_lens', () => {
    it('persists a new lens and confirms', async () => {
      const r = await client.callTool({
        name: 'save_lens',
        arguments: { name: 'save-test', dsl: 'ext(ts)' },
      })
      expect(getText(r)).toContain('save-test')
    })

    it('returns parse error for bad DSL', async () => {
      const r = await client.callTool({
        name: 'save_lens',
        arguments: { name: 'bad-lens', dsl: 'bad(((' },
      })
      expect(isError(r)).toBe(true)
    })
  })
})

describe('startServer', () => {
  it('instantiates a stdio transport and connects the server', async () => {
    const { vi } = await import('vitest')
    vi.resetModules()

    let constructed = false
    // A transport stub that satisfies the McpServer.connect() contract.
    class StdioStub {
      // These are assigned by the server when it connects.
      onclose?: () => void
      onmessage?: (msg: unknown) => void
      onerror?: (err: Error) => void
      constructor() {
        constructed = true
      }
      async start(): Promise<void> {
        /* no-op */
      }
      async send(_: unknown): Promise<void> {
        /* no-op */
      }
      async close(): Promise<void> {
        this.onclose?.()
      }
    }

    vi.doMock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
      StdioServerTransport: StdioStub,
    }))

    const { startServer: freshStart } = await import('./server.js')
    const freshTmp = await mkdtemp(join(tmpdir(), 'catlens-mcp-start-'))
    try {
      await freshStart(freshTmp)
      expect(constructed).toBe(true)
    } finally {
      await rm(freshTmp, { recursive: true, force: true })
      vi.doUnmock('@modelcontextprotocol/sdk/server/stdio.js')
      vi.resetModules()
    }
  })
})
