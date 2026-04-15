# CatLens

Gather the smallest correct code slice for the current task.

Write a query, get back only the files (or sections) that matter — as a markdown bundle ready to paste into a prompt or diff.

---

## Quick start

```bash
npm install
npx tsx packages/cli/src/index.ts 'ext:ts && keyword:checkout' --preview
```

No build step required. `tsx` runs TypeScript directly.

---

## Query syntax

Queries are `key:value` predicates composed with infix operators.

### Predicates

| Predicate | Matches |
|-----------|---------|
| `ext:ts,tsx` | Files with these extensions |
| `keyword:term` or `keyword:"multi word"` | Files containing the substring (case-insensitive) |
| `file:src/api.ts` | Exact file path (comma-sep for multiple) |
| `path:src/**/*.ts` | Files matching a glob pattern |
| `*diff:` / `*diff:HEAD~3` | Files in the working diff, or vs ref |
| `*older:30d` | Files not committed in 30 days (`d` `w` `m` `y`) |
| `*newer:7d` | Files committed within 7 days |

`*` = slow: shells out to git per query.

### Operators

```
ext:ts && keyword:checkout    — all must match
ext:ts || ext:tsx             — any must match
!keyword:test                 — exclude matches
ext:ts && !keyword:test       — subtract exclusion from selection
(a || b) && c                 — grouping; && binds tighter than ||
```

---

## Examples

```bash
# Preview matched files (no content output)
catlens 'ext:ts && keyword:checkout' --preview

# Render as markdown bundle
catlens 'ext:ts && keyword:checkout'

# Only files in the current diff
catlens 'diff:' --preview

# Exclude test files
catlens 'ext:ts && !path:**/*.test.*' --output file-list

# Files changed since last week in src/
catlens 'path:src/**/*.ts && newer:7d' --preview

# Point at any repo
catlens ~/projects/myapp 'ext:ts && keyword:TODO' --preview

# Different filters per directory
catlens ./src 'ext:ts,md' ./src/mocks '!ext:md'
```

---

## Lens management

Save a useful query as a named lens, then rerun it by name.

```bash
# Save
catlens 'ext:ts && keyword:checkout' --save checkout-ts

# Rerun by name
catlens checkout-ts

# List saved lenses
catlens lens list

# Show the stored query
catlens lens show checkout-ts

# Delete
catlens lens rm checkout-ts
```

Lenses are stored as JSON in `.catlens/` at the repo root.

---

## Query tools

```bash
# Inspect the AST
catlens parse 'ext:ts && keyword:foo'

# Canonical formatting (idempotent)
catlens fmt 'ext:tsx,ts && keyword:api'
# → ext:ts,tsx && keyword:api

# Lint for mistakes
catlens lint 'ext:ts && !ext:ts'
# → error [contradictory-branches] always empty

catlens lint 'ext:ts' --strict
# → error [suspiciously-broad] (warnings promoted to errors)
```

---

## Output formats

| Flag | Output |
|------|--------|
| *(default)* | Fenced markdown with file headers |
| `--output file-list` | One path per line |
| `--output json` | Full `SelectionResult` as JSON |
| `--output snippets` | Fenced blocks for tagged sections; falls back to full files |
| `--output diff` | Unified diff patches (requires `diff:` predicate) |
| `--preview` / `-p` | File list + stats, no content |

---

## Other flags

| Flag | Effect |
|------|--------|
| `--root <path>` | Repo root (default: cwd) |
| `--no-line-numbers` | Suppress line numbers in markdown output |
| `-r, --reasons` | Show match reasons in `--preview` |
| `--explain` | Print inclusion reasons after render |
| `--force` | Bypass 200 KB output guard |
| `--save <name>` | Save query as lens after running |
| `--agents` | Print the tool's AGENTS.md reference |

---

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Parse or engine error |
| 2 | Lint errors found |
| 3 | No matches |
| 4 | Lens not found |
| 5 | Output exceeds threshold (use `--force`) |

---

## Project structure

```
packages/core/    shared engine: query, engine, facts, renderers, lenses
packages/cli/     terminal frontend
packages/mcp/     MCP server frontend
test/fixtures/    fixture repos for integration tests
specs/            speckit specifications and planning docs
```

`packages/core` has no dependency on `packages/cli` or `packages/mcp`. All queries compile to the same AST; both frontends call the same engine.
