#!/usr/bin/env tsx
import { Command } from 'commander'
import pc from 'picocolors'
import { parse, ParseError, buildResult, renderPreview, renderMarkdown, renderFileList, renderJson } from '@catlens/core'
import type { RenderFormat } from '@catlens/core'
import { resolve } from 'node:path'

const LARGE_RESULT_THRESHOLD = 200_000 // chars

const program = new Command()

program
  .name('catlens')
  .description('Gather the smallest correct code slice for the current task')
  .version('0.1.0')

// ── Main query command ────────────────────────────────────────────────────

program
  .argument('[query]', 'DSL query string or saved lens name')
  .option('-p, --preview', 'Preview matched files without rendering')
  .option('-o, --output <format>', 'Output format: markdown, file-list, json', 'markdown')
  .option('--root <path>', 'Repo root path', process.cwd())
  .option('--no-line-numbers', 'Suppress line numbers in rendered output')
  .option('-r, --reasons', 'Show inclusion reasons in preview')
  .option('--force', 'Bypass large-result threshold warning')
  .action(async (queryArg: string | undefined, opts: {
    preview: boolean
    output: string
    root: string
    lineNumbers: boolean
    reasons: boolean
    force: boolean
  }) => {
    if (!queryArg) {
      program.help()
      return
    }

    const repoRoot = resolve(opts.root)
    let query

    try {
      query = parse(queryArg)
    } catch (err) {
      if (err instanceof ParseError) {
        console.error(pc.red(`Parse error: ${err.message}`))
        process.exit(1)
      }
      throw err
    }

    let result
    try {
      result = await buildResult(query, repoRoot)
    } catch (err) {
      console.error(pc.red(`Engine error: ${err instanceof Error ? err.message : String(err)}`))
      process.exit(1)
    }

    if (result.files.length === 0) {
      console.error(pc.yellow('No matches found.'))
      process.exit(3)
    }

    if (!opts.force && result.stats.estimatedChars > LARGE_RESULT_THRESHOLD) {
      const kb = (result.stats.estimatedChars / 1024).toFixed(0)
      console.error(
        pc.yellow(
          `Warning: estimated output is ~${kb} KB (${result.stats.totalLines} lines across ${result.stats.fileCount} files).\n` +
          `Run with --force to proceed, or refine your query.`,
        ),
      )
      process.exit(5)
    }

    if (opts.preview) {
      console.log(renderPreview(result, { showReasons: opts.reasons }))
      return
    }

    const format = opts.output as RenderFormat
    let output: string

    switch (format) {
      case 'markdown':
        output = renderMarkdown(result, { lineNumbers: opts.lineNumbers })
        break
      case 'file-list':
        output = renderFileList(result)
        break
      case 'json':
        output = renderJson(result)
        break
      default:
        console.error(pc.red(`Unknown output format: ${format}`))
        process.exit(1)
    }

    console.log(output)
  })

// ── parse subcommand ──────────────────────────────────────────────────────

program
  .command('parse <query>')
  .description('Parse a DSL query and print the AST as JSON')
  .action((queryArg: string) => {
    try {
      const ast = parse(queryArg)
      console.log(JSON.stringify(ast, null, 2))
    } catch (err) {
      if (err instanceof ParseError) {
        console.error(pc.red(`Parse error: ${err.message}`))
        process.exit(1)
      }
      throw err
    }
  })

// ── fmt subcommand ────────────────────────────────────────────────────────

program
  .command('fmt <query>')
  .description('Format a DSL query into canonical form')
  .action((queryArg: string) => {
    try {
      // Parse to validate, then print placeholder until formatter is implemented (Phase 6)
      parse(queryArg)
      // Formatter is implemented in Phase 6 (T051).
      // For now, re-print the input as a placeholder.
      console.log(queryArg.trim())
    } catch (err) {
      if (err instanceof ParseError) {
        console.error(pc.red(`Parse error: ${err.message}`))
        process.exit(1)
      }
      throw err
    }
  })

// ── lint subcommand ───────────────────────────────────────────────────────

program
  .command('lint <query>')
  .description('Lint a DSL query and report diagnostics')
  .action((queryArg: string) => {
    try {
      parse(queryArg)
      // Linter is implemented in Phase 6 (T052).
      console.log('No issues found.')
    } catch (err) {
      if (err instanceof ParseError) {
        console.error(pc.red(`Parse error: ${err.message}`))
        process.exit(1)
      }
      throw err
    }
  })

program.parseAsync(process.argv).catch(err => {
  console.error(pc.red(String(err)))
  process.exit(1)
})
