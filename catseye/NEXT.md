# What's Next

## 1. Commit Phase 4–8 work

Stage all untracked/modified files and commit with:

```
feat: phases 4-8 — lens store, MCP server, validator, formatter, linter, predicate expansion

- US2: lens store (save/load/list/delete), JSON roundtrip, fzf/readline fuzzy disambiguation,
  CLI --save flag, lens list/rm/show subcommands, run-by-name detection
- US3: full McpServer (run_query, parse_query, format_query, list_lenses, run_lens,
  preview_lens, render_selection, save_lens); in-memory parity tests
- US4: validator wired into engine, canonical formatter (idempotent, sorts ext, any→or),
  linter (contradictory-branches, duplicate-predicate, suspiciously-broad,
  likely-zero-match); real fmt/lint CLI subcommands
- Phase 7: glob (minimatch), tag (file/anywhere), tagged_section → SectionHit, git facts
  (simple-git, graceful degradation), authored_by, older_than/newer_than, diff,
  commit_message; diff + snippets renderers
- Phase 8: tiered linting with --strict, --explain flag, snippets/diff output formats,
  exit-codes integration test (all 6 codes verified)
- 83 integration tests, 0 type errors
```

## 2. Add MCP server CLI entrypoint

`quickstart.md` documents `npx tsx packages/mcp/src/server.ts --root /path/to/repo` but the file
has no `process.argv` handling. Add a self-invocation block at the bottom of
`packages/mcp/src/server.ts`.

## 3. Write docs/predicates.md (T073)

Document all predicates with syntax, arguments, examples. Reference:
`specs/001-catlens-query-engine/contracts/dsl-grammar.md`

## 4. Validate quickstart.md (T074)

Known fix: `npm run test:integration -- --grep "..."` → `npm run test:integration -- <filename>`
(vitest doesn't use `--grep`).
