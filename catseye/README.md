# CatLens

Gather the smallest correct code slice for the current task.

Write a query, get back only the files (or sections) that matter — as a markdown bundle ready to paste into a prompt or diff.

---

## Quick start

```bash
npm install
npx tsx packages/cli/src/index.ts 'and(ext(ts), keyword("checkout"))' --preview
```

No build step required. `tsx` runs TypeScript directly.

---

## Query syntax

Queries are function-call style. Operators compose predicates.

### Predicates

| Predicate | Matches |
|-----------|---------|
| `ext(ts, tsx)` | Files with these extensions |
| `keyword("term")` | Files containing the substring (case-insensitive) |
| `file("src/api.ts")` | Exact file path(s) |
| `glob("src/**/*.ts")` | Files matching a glob pattern |
| `tag("@catty:api")` | Files containing the tag string |
| `tag("@catty:api", file)` | Tag in first 10 lines only |
| `tagged_section("catty:start", "catty:end")` | Extracts content between markers |
| `diff()` | Files in the current working diff |
| `authored_by("ashley")` | Files last committed by this author |
| `older_than("30d")` | Files not committed in 30 days (`d` `w` `m` `y`) |
| `newer_than("7d")` | Files committed within 7 days |
| `commit_message("fix")` | Files whose last commit message contains the term |

### Operators

```
and(ext(ts), keyword("checkout"))   — all must match
or(ext(ts), ext(tsx))               — any must match
not(keyword("test"))                — exclude matches
ext(ts) unless(keyword("test"))     — subtract exclusion from selection
```

---

## Examples

```bash
# Preview matched files (no content output)
catlens 'and(ext(ts), keyword("checkout"))' --preview

# Render as markdown bundle
catlens 'and(ext(ts), keyword("checkout"))'

# Only files in the current diff
catlens 'diff()' --preview

# Recent commits by a specific author
catlens 'and(authored_by("ashley"), newer_than("14d"))' --preview

# Exclude test files
catlens 'ext(ts) unless(keyword(".test."))' --output file-list

# Files changed since last week in src/
catlens 'and(glob("src/**/*.ts"), newer_than("7d"))' --preview

# Point at any repo
catlens 'and(ext(ts), keyword("TODO"))' --root ~/projects/myapp --preview
```

---

## Lens management

Save a useful query as a named lens, then rerun it by name.

```bash
# Save
catlens 'and(ext(ts), keyword("checkout"))' --save checkout-ts

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
catlens parse 'and(ext(ts), keyword("foo"))'

# Canonical formatting (idempotent)
catlens fmt 'and(ext(tsx,ts),keyword("api"))'
# → and(ext(ts, tsx), keyword("api"))

# Lint for mistakes
catlens lint 'and(ext(ts), not(ext(ts)))'
# → error [contradictory-branches] always empty

catlens lint 'ext(ts)' --strict
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
| `--output diff` | Unified diff patches (requires `diff()` predicate) |
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
