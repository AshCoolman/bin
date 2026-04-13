#!/usr/bin/env tsx
import { Command } from 'commander'
import pc from 'picocolors'
import {
  parse,
  ParseError,
  format,
  lint,
  buildResult,
  renderPreview,
  renderMarkdown,
  renderFileList,
  renderJson,
  renderDiff,
  renderSnippets,
  saveLens,
  loadLens,
  listLenses,
  deleteLens,
  findByPrefix,
  disambiguate,
} from '@catlens/core'
import type { RenderFormat, Lens } from '@catlens/core'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'

const LARGE_RESULT_THRESHOLD = 200_000 // chars
const LENS_NAME_RE = /^[a-z0-9][a-z0-9-]*$/

const program = new Command()

program
  .name('catlens')
  .description('Gather the smallest correct code slice for the current task')
  .version('0.1.0')
  .addHelpText('after', `
Examples:
  $ catlens 'and(ext(ts), keyword("checkout"))' --preview
  $ catlens 'ext(ts) unless(keyword(".test."))' --output file-list
  $ catlens 'diff()' --preview
  $ catlens 'and(ext(ts), keyword("TODO"))' --root ~/projects/myapp
  $ catlens 'and(ext(ts), keyword("checkout"))' --save checkout-ts
  $ catlens checkout-ts

Predicates: ext  keyword  file  glob  tag  tagged_section
            diff  authored_by  older_than  newer_than  commit_message
Operators:  and  or  not  unless`)

// ── Main query command ────────────────────────────────────────────────────

program
  .argument('[root-or-query]', 'Repo root path, or DSL query / saved lens name')
  .argument('[query]', 'DSL query string or saved lens name')
  .option('-p, --preview', 'Preview matched files without rendering')
  .option('-o, --output <format>', 'Output format: markdown, file-list, json, snippets, diff', 'markdown')
  .option('--root <path>', 'Repo root path', process.cwd())
  .option('--no-line-numbers', 'Suppress line numbers in rendered output')
  .option('-r, --reasons', 'Show inclusion reasons in preview')
  .option('--force', 'Bypass large-result threshold warning')
  .option('--save <name>', 'Save query as a named lens after running')
  .option('--explain', 'Print inclusion reasons for each file after render')
  .option('--agents', 'Print .catlens/AGENTS.md for the current repo')
  .action(async (firstArg: string | undefined, secondArg: string | undefined, opts: {
    preview: boolean
    output: string
    root: string
    lineNumbers: boolean
    reasons: boolean
    force: boolean
    save?: string
    explain?: boolean
    agents?: boolean
  }) => {
    if (opts.agents) {
      const agentsPath = resolve(process.env.CATLENS_DIR ?? '', 'AGENTS.md')
      try {
        const content = await readFile(agentsPath, 'utf8')
        console.log(content)
      } catch {
        console.error(pc.red(`No AGENTS.md found at ${agentsPath}`))
        process.exit(1)
      }
      return
    }

    // Resolve positional args: optional [root] [query] or just [query]
    let queryArg: string | undefined
    let repoRoot: string
    if (secondArg !== undefined) {
      repoRoot = resolve(firstArg!)
      queryArg = secondArg
    } else if (firstArg !== undefined && /^[./~]/.test(firstArg)) {
      repoRoot = resolve(firstArg)
      queryArg = undefined
    } else {
      repoRoot = resolve(opts.root)
      queryArg = firstArg
    }

    if (!queryArg) {
      program.help()
      return
    }

    // Resolve: is this a lens name, DSL string, or ambiguous prefix?
    let query
    if (LENS_NAME_RE.test(queryArg)) {
      // Could be a saved lens name or an inline DSL that happens to match the pattern.
      // Try loading as a lens first; fall back to parsing as DSL.
      try {
        const lens = await loadLens(repoRoot, queryArg)
        query = lens.query
      } catch {
        // Not a saved lens. Try parsing as DSL.
        // Check if it's a prefix match for multiple lenses.
        const matches = await findByPrefix(repoRoot, queryArg)
        if (matches.length > 1) {
          let chosen: string
          try {
            chosen = await disambiguate(matches)
          } catch {
            console.error(pc.red('Lens selection cancelled.'))
            process.exit(1)
          }
          const lens = await loadLens(repoRoot, chosen)
          query = lens.query
        } else {
          try {
            query = parse(queryArg)
          } catch (err) {
            if (err instanceof ParseError) {
              console.error(pc.red(`Parse error: ${err.message}`))
              process.exit(1)
            }
            throw err
          }
        }
      }
    } else {
      try {
        query = parse(queryArg)
      } catch (err) {
        if (err instanceof ParseError) {
          console.error(pc.red(`Parse error: ${err.message}`))
          process.exit(1)
        }
        throw err
      }
    }

    let result
    try {
      result = await buildResult(query, repoRoot)
    } catch (err) {
      console.error(pc.red(`Engine error: ${err instanceof Error ? err.message : String(err)}`))
      process.exit(1)
    }

    // Save lens if requested (save regardless of result count)
    if (opts.save) {
      try {
        await saveLens(repoRoot, opts.save, query)
        console.error(pc.green(`Lens saved: ${opts.save}`))
      } catch (err) {
        console.error(pc.yellow(`Warning: could not save lens: ${err instanceof Error ? err.message : String(err)}`))
      }
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

    const fmt = opts.output as RenderFormat | 'snippets' | 'diff'
    let output: string

    switch (fmt) {
      case 'markdown':
        output = renderMarkdown(result, { lineNumbers: opts.lineNumbers })
        break
      case 'file-list':
        output = renderFileList(result)
        break
      case 'json':
        output = renderJson(result)
        break
      case 'snippets':
        output = renderSnippets(result)
        break
      case 'diff':
        output = renderDiff(result)
        break
      default:
        console.error(pc.red(`Unknown output format: ${fmt}`))
        process.exit(1)
    }

    console.log(output)

    if (opts.explain) {
      console.log()
      console.log('Inclusion reasons:')
      for (const f of result.files) {
        const reasons = f.reasons.map(r => r.detail ? `${r.predicate}:${r.detail}` : r.predicate).join(', ')
        console.log(`  ${f.path}: ${reasons || '(no reasons recorded)'}`)
      }
    }
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
      const ast = parse(queryArg)
      console.log(format(ast))
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
  .option('--strict', 'Treat warnings as errors')
  .action((queryArg: string, opts: { strict?: boolean }) => {
    try {
      const ast = parse(queryArg)
      const result = lint(ast, opts.strict ? { strict: true } : {})

      if (result.diagnostics.length === 0) {
        console.log('No issues found.')
        return
      }

      let hasErrors = false
      for (const d of result.diagnostics) {
        const prefix = d.severity === 'error' ? pc.red('error') : pc.yellow('warning')
        console.log(`${prefix} [${d.rule}] ${d.message}`)
        if (d.severity === 'error') hasErrors = true
      }

      process.exit(hasErrors ? 2 : 0)
    } catch (err) {
      if (err instanceof ParseError) {
        console.error(pc.red(`Parse error: ${err.message}`))
        process.exit(1)
      }
      throw err
    }
  })

// ── lens subcommand ───────────────────────────────────────────────────────

const lensCmd = program
  .command('lens')
  .description('Manage saved lenses')

lensCmd
  .command('list')
  .description('List saved lenses')
  .action(async () => {
    const repoRoot = resolve(program.opts().root as string)
    const lenses = await listLenses(repoRoot)

    if (lenses.length === 0) {
      console.log('No saved lenses. Use --save <name> to save a query.')
      return
    }

    const nameW = Math.max(4, ...lenses.map(l => l.name.length))
    const dateW = 10
    console.log(`${'NAME'.padEnd(nameW)}  ${'CREATED'.padEnd(dateW)}  DESCRIPTION`)
    console.log(`${'─'.repeat(nameW)}  ${'─'.repeat(dateW)}  ${'─'.repeat(20)}`)
    for (const l of lenses) {
      const date = l.createdAt.toISOString().slice(0, 10)
      const desc = l.description ?? ''
      console.log(`${l.name.padEnd(nameW)}  ${date.padEnd(dateW)}  ${desc}`)
    }
  })

lensCmd
  .command('rm <name>')
  .description('Delete a saved lens')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (name: string, opts: { yes?: boolean }) => {
    const repoRoot = resolve(program.opts().root as string)

    let lens: Lens
    try {
      lens = await loadLens(repoRoot, name)
    } catch {
      console.error(pc.red(`Lens not found: ${name}`))
      process.exit(4)
    }

    if (!opts.yes) {
      const confirmed = await confirm(`Delete lens "${lens.name}"? [y/N] `)
      if (!confirmed) {
        console.log('Cancelled.')
        return
      }
    }

    await deleteLens(repoRoot, name)
    console.log(pc.green(`Deleted lens: ${name}`))
  })

lensCmd
  .command('show <name>')
  .description('Show a saved lens DSL')
  .action(async (name: string) => {
    const repoRoot = resolve(program.opts().root as string)
    let lens: Lens
    try {
      lens = await loadLens(repoRoot, name)
    } catch {
      console.error(pc.red(`Lens not found: ${name}`))
      process.exit(4)
    }

    // Format the DSL from the stored AST for clean output
    console.log(format(lens.query))
  })

program.parseAsync(process.argv).catch(err => {
  console.error(pc.red(String(err)))
  process.exit(1)
})

// ── helpers ────────────────────────────────────────────────────────────────

async function confirm(prompt: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}
