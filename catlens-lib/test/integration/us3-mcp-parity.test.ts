import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from '../../packages/mcp/src/server.js'
import { parse, buildResult, saveLens, deleteLens } from '@catlens/core'
import { fixturePath } from './helpers.js'

const TS_APP = fixturePath('ts-app')

let client: Client

beforeAll(async () => {
  const server = createMcpServer(TS_APP)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} })

  await server.connect(serverTransport)
  await client.connect(clientTransport)
})

afterAll(async () => {
  await client.close()
})

describe('run_query parity with CLI', () => {
  it('returns same file paths as direct engine call', async () => {
    const dsl = 'ext:ts && keyword:checkout'
    const query = parse(dsl)
    const direct = await buildResult(query, TS_APP)

    const toolResult = await client.callTool({
      name: 'run_query',
      arguments: { query: dsl, output_format: 'json' },
    })

    const content = toolResult.content as Array<{ type: string; text: string }>
    expect(content[0]?.type).toBe('text')
    const mcpResult = JSON.parse(content[0]!.text)

    const directPaths = direct.files.map(f => f.path).sort()
    const mcpPaths = (mcpResult.files as Array<{ path: string }>).map(f => f.path).sort()
    expect(mcpPaths).toEqual(directPaths)
  })

  it('accepts JSON AST input and returns same result as DSL input', async () => {
    const dsl = 'ext:ts && keyword:api'
    const astJson = JSON.stringify(parse(dsl))

    const [dslResult, astResult] = await Promise.all([
      client.callTool({ name: 'run_query', arguments: { query: dsl, output_format: 'json' } }),
      client.callTool({ name: 'run_query', arguments: { query: astJson, output_format: 'json' } }),
    ])

    const getText = (r: unknown): string => {
      const content = (r as { content: Array<{ text: string }> }).content
      return content[0]!.text
    }

    expect(getText(astResult)).toBe(getText(dslResult))
  })

  it('returns markdown output by default', async () => {
    const toolResult = await client.callTool({
      name: 'run_query',
      arguments: { query: 'ext:ts' },
    })
    const content = toolResult.content as Array<{ type: string; text: string }>
    expect(content[0]?.text).toMatch(/^##/)
  })
})

describe('parse_query', () => {
  it('returns Query AST as JSON', async () => {
    const result = await client.callTool({
      name: 'parse_query',
      arguments: { dsl: 'ext:ts && keyword:checkout' },
    })
    const content = result.content as Array<{ type: string; text: string }>
    const ast = JSON.parse(content[0]!.text)
    expect(ast.selection.type).toBe('and')
  })

  it('returns error for invalid DSL', async () => {
    const result = await client.callTool({
      name: 'parse_query',
      arguments: { dsl: 'bad(((' },
    })
    expect(result.isError).toBe(true)
  })
})

describe('format_query', () => {
  it('returns canonical DSL', async () => {
    const result = await client.callTool({
      name: 'format_query',
      arguments: { dsl: 'ext:tsx,ts && keyword:api' },
    })
    const content = result.content as Array<{ type: string; text: string }>
    expect(content[0]!.text).toBe('ext:ts,tsx && keyword:api')
  })
})

describe('list_lenses and run_lens parity', () => {
  it('list_lenses returns saved lens after save', async () => {
    const query = parse('ext:ts && keyword:checkout')
    await saveLens(TS_APP, 'mcp-test-lens', query)

    try {
      const result = await client.callTool({ name: 'list_lenses', arguments: {} })
      const content = result.content as Array<{ type: string; text: string }>
      expect(content[0]!.text).toContain('mcp-test-lens')
    } finally {
      await deleteLens(TS_APP, 'mcp-test-lens').catch(() => {})
    }
  })

  it('run_lens returns same result as run_query for the same query', async () => {
    const dsl = 'ext:ts && keyword:checkout'
    const query = parse(dsl)
    await saveLens(TS_APP, 'mcp-parity-lens', query)

    try {
      const [lensResult, queryResult] = await Promise.all([
        client.callTool({ name: 'run_lens', arguments: { name: 'mcp-parity-lens', output_format: 'json' } }),
        client.callTool({ name: 'run_query', arguments: { query: dsl, output_format: 'json' } }),
      ])

      const getText = (r: unknown): string => {
        const content = (r as { content: Array<{ text: string }> }).content
        return content[0]!.text
      }

      const lensJson = JSON.parse(getText(lensResult))
      const queryJson = JSON.parse(getText(queryResult))

      const lensPaths = (lensJson.files as Array<{ path: string }>).map(f => f.path).sort()
      const queryPaths = (queryJson.files as Array<{ path: string }>).map(f => f.path).sort()
      expect(lensPaths).toEqual(queryPaths)
    } finally {
      await deleteLens(TS_APP, 'mcp-parity-lens').catch(() => {})
    }
  })
})
