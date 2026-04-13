# CLI Contract: CatLens

**Version**: 1.0
**Date**: 2026-04-11

---

## Invocation patterns

```
catlens <query>                   # run inline DSL query, markdown output
catlens <query> --preview         # preview matches without rendering
catlens <query> --save <name>     # run and save as named lens
catlens <name>                    # run saved lens by name
catlens <prefix>                  # fuzzy-match saved lens by prefix
catlens parse <query>             # parse and print AST (JSON)
catlens fmt <query>               # format and print canonical DSL
catlens lint <query>              # lint query and print diagnostics
catlens lens list                 # list all saved lenses
catlens lens rm <name>            # delete a saved lens
catlens lens show <name>          # print saved lens query
```

---

## Global options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--output <format>` | `-o` | `markdown` | Output format: markdown, file-list, snippets, diff, json |
| `--preview` | `-p` | false | Preview matched files/sections; do not render full output |
| `--save <name>` | `-s` | — | Save query as named lens after running |
| `--line-numbers` | — | true | Include line numbers in rendered output |
| `--no-line-numbers` | — | — | Suppress line numbers |
| `--reasons` | `-r` | false | Include inclusion reasons in preview output |
| `--root <path>` | — | cwd | Repo root to run against |
| `--force` | — | false | Bypass large-result threshold warning |

---

## Subcommands

### `catlens parse <query>`

Parse a DSL query and print the AST as JSON. Exits non-zero on parse error.

```
$ catlens parse 'ext(ts,tsx)'
{
  "selection": {
    "type": "ext",
    "extensions": ["ts", "tsx"]
  }
}
```

### `catlens fmt <query>`

Format a DSL query and print canonical output. Idempotent.

```
$ catlens fmt 'and(ext(ts,tsx),keyword("checkout"))'
and(
  ext(ts, tsx),
  keyword("checkout")
)
```

### `catlens lint <query>`

Lint a query and print diagnostics. Exits non-zero if errors found.

```
$ catlens lint 'and(ext(ts), not(ext(ts)))'
warning  duplicate-predicate  ext(ts) appears in both and and not branches
```

### `catlens lens list`

List all saved lenses in the current repo.

```
$ catlens lens list
checkout-roundtrip-v1   (created 2026-04-10)
api-surface             (created 2026-04-08)
```

### `catlens lens rm <name>`

Delete a saved lens. Prompts for confirmation.

### `catlens lens show <name>`

Print the stored query for a named lens in canonical DSL format.

---

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error (parse failure, validation error, etc.) |
| 2 | Lint error (only when `lint` subcommand is used) |
| 3 | No matches found |
| 4 | Lens not found |
| 5 | Result exceeds large-result threshold (without `--force`) |

---

## Output format: preview

```
Matched: 3 files  |  142 lines  |  ~5.8 KB

  src/engine/evaluate.ts       (48 lines)  [keyword: "checkout"]
  src/query/ast.ts             (61 lines)  [ext: ts]
  src/render/markdown.ts       (33 lines)  [ext: ts]
```

With `--reasons`, each file shows the predicates that matched it.

---

## Output format: markdown (default)

````
## src/engine/evaluate.ts

```typescript
// line 1
...
```

## src/query/ast.ts

```typescript
// line 1
...
```
````

---

## Fuzzy disambiguation

When the user provides a prefix that matches multiple saved lens names:
1. If `fzf` is available: pipe matches to `fzf` and let the user choose interactively.
2. If `fzf` is not available: print a numbered list and prompt for a number via `readline`.

```
Multiple lenses match 'check':
  [1] checkout-roundtrip-v1
  [2] checkout-api-only
Choose [1-2]: 
```

---

## Large-result threshold

If the estimated rendered output exceeds 200 KB, the tool prints a warning and exits
with code 5 unless `--force` is passed.

```
Warning: estimated output is ~380 KB (1,840 lines across 22 files).
Run with --force to proceed, or refine your query.
```
