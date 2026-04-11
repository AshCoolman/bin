import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import {
  parse,
  ParseError,
  format,
  validate,
  buildResult,
  listLenses,
  loadLens,
  saveLens,
  renderMarkdown,
  renderFileList,
  renderJson,
  renderPreview,
} from '@catlens/core'
import type { SelectionResult, RenderFormat } from '@catlens/core'
import { resolve } from 'node:path'

export function createMcpServer(repoRoot: string): McpServer {
  const root = resolve(repoRoot)
  const server = new McpServer(
    { name: 'catlens', version: '0.1.0' },
    { instructions: `CatLens MCP server. Repo root: ${root}. Use run_query to search files, list_lenses to see saved queries.` },
  )

  // ── parse_query ──────────────────────────────────────────────────────────
  server.registerTool(
    'parse_query',
    {
      description: 'Parse a DSL query string and return the Query AST as JSON',
      inputSchema: {
        dsl: z.string().describe('CatLens DSL query string, e.g. and(ext(ts), keyword("checkout"))'),
      },
    },
    ({ dsl }) => {
      try {
        const ast = parse(dsl)
        return { content: [{ type: 'text' as const, text: JSON.stringify(ast, null, 2) }] }
      } catch (err) {
        return mcpError(err instanceof ParseError ? `Parse error: ${err.message}` : String(err))
      }
    },
  )

  // ── format_query ─────────────────────────────────────────────────────────
  server.registerTool(
    'format_query',
    {
      description: 'Parse a DSL query and return canonical formatted DSL',
      inputSchema: {
        dsl: z.string().describe('DSL query string to format'),
      },
    },
    ({ dsl }) => {
      try {
        const ast = parse(dsl)
        return { content: [{ type: 'text' as const, text: format(ast) }] }
      } catch (err) {
        return mcpError(err instanceof ParseError ? `Parse error: ${err.message}` : String(err))
      }
    },
  )

  // ── run_query ─────────────────────────────────────────────────────────────
  server.registerTool(
    'run_query',
    {
      description: 'Run a CatLens query. Accepts either a DSL string or a Query AST JSON string.',
      inputSchema: {
        query: z.string().describe('DSL string or JSON-encoded Query AST'),
        output_format: z.enum(['markdown', 'file-list', 'json', 'preview']).optional().describe('Output format (default: markdown)'),
      },
    },
    async ({ query: queryInput, output_format }) => {
      try {
        // Try JSON AST first, fall back to DSL parse
        let queryObj
        try {
          const parsed = JSON.parse(queryInput)
          if (typeof parsed === 'object' && parsed !== null && 'selection' in parsed) {
            const vr = validate(parsed)
            if (!vr.valid) {
              return mcpError(`Invalid query AST: ${vr.errors.map(e => e.message).join('; ')}`)
            }
            queryObj = parsed
          } else {
            queryObj = parse(queryInput)
          }
        } catch {
          queryObj = parse(queryInput)
        }

        const result = await buildResult(queryObj, root)
        const fmt = (output_format ?? 'markdown') as RenderFormat | 'preview'
        const text = renderResult(result, fmt)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return mcpError(err instanceof ParseError ? `Parse error: ${err.message}` : String(err))
      }
    },
  )

  // ── list_lenses ───────────────────────────────────────────────────────────
  server.registerTool(
    'list_lenses',
    {
      description: 'List all saved lenses in the repo',
      inputSchema: {},
    },
    async () => {
      const lenses = await listLenses(root)
      if (lenses.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No saved lenses.' }] }
      }
      const lines = lenses.map(l => {
        const date = l.createdAt.toISOString().slice(0, 10)
        const desc = l.description ? ` — ${l.description}` : ''
        return `${l.name}  (${date})${desc}`
      })
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    },
  )

  // ── run_lens ──────────────────────────────────────────────────────────────
  server.registerTool(
    'run_lens',
    {
      description: 'Load a saved lens by name and run it against the repo',
      inputSchema: {
        name: z.string().describe('Lens name'),
        output_format: z.enum(['markdown', 'file-list', 'json', 'preview']).optional(),
      },
    },
    async ({ name, output_format }) => {
      try {
        const lens = await loadLens(root, name)
        const result = await buildResult(lens.query, root)
        const fmt = (output_format ?? 'markdown') as RenderFormat | 'preview'
        return { content: [{ type: 'text' as const, text: renderResult(result, fmt) }] }
      } catch (err) {
        return mcpError(String(err))
      }
    },
  )

  // ── preview_lens ──────────────────────────────────────────────────────────
  server.registerTool(
    'preview_lens',
    {
      description: 'Load a saved lens and return matched file paths and stats (no full content)',
      inputSchema: {
        name: z.string().describe('Lens name'),
      },
    },
    async ({ name }) => {
      try {
        const lens = await loadLens(root, name)
        const result = await buildResult(lens.query, root)
        const preview = {
          files: result.files.map(f => ({ path: f.path, lineCount: f.lineCount, reasons: f.reasons })),
          stats: result.stats,
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(preview, null, 2) }] }
      } catch (err) {
        return mcpError(String(err))
      }
    },
  )

  // ── render_selection ──────────────────────────────────────────────────────
  server.registerTool(
    'render_selection',
    {
      description: 'Render a SelectionResult JSON with the specified format',
      inputSchema: {
        selection: z.string().describe('JSON-encoded SelectionResult'),
        output_format: z.enum(['markdown', 'file-list', 'json', 'preview']).describe('Output format'),
      },
    },
    ({ selection, output_format }) => {
      try {
        const result = JSON.parse(selection) as SelectionResult
        const fmt = output_format as RenderFormat | 'preview'
        return { content: [{ type: 'text' as const, text: renderResult(result, fmt) }] }
      } catch (err) {
        return mcpError(`Failed to render selection: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  )

  // ── save_lens ─────────────────────────────────────────────────────────────
  server.registerTool(
    'save_lens',
    {
      description: 'Save a DSL query as a named lens',
      inputSchema: {
        name: z.string().describe('Lens name (lowercase, alphanumeric and hyphens)'),
        dsl: z.string().describe('DSL query string to save'),
        description: z.string().optional().describe('Optional description'),
      },
    },
    async ({ name, dsl, description }) => {
      try {
        const query = parse(dsl)
        const lens = await saveLens(root, name, query, description)
        return { content: [{ type: 'text' as const, text: `Saved lens "${lens.name}"` }] }
      } catch (err) {
        return mcpError(err instanceof ParseError ? `Parse error: ${err.message}` : String(err))
      }
    },
  )

  return server
}

export async function startServer(repoRoot: string): Promise<void> {
  const server = createMcpServer(repoRoot)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// ── helpers ────────────────────────────────────────────────────────────────

function renderResult(result: SelectionResult, fmt: RenderFormat | 'preview'): string {
  switch (fmt) {
    case 'markdown':
      return renderMarkdown(result, {})
    case 'file-list':
      return renderFileList(result)
    case 'json':
      return renderJson(result)
    case 'preview':
      return renderPreview(result, {})
    default:
      return renderMarkdown(result, {})
  }
}

function mcpError(message: string): { isError: true; content: [{ type: 'text'; text: string }] } {
  return { isError: true, content: [{ type: 'text' as const, text: message }] }
}
