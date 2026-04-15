**catlens: Gathers the smallest correct code slice for a task.**

Usage:

```
catlens [path] '<query>' [--preview] [--output markdown|file-list|json|snippets|diff] [--force]
```

- Default output: markdown (fenced blocks per file, `## path` headers)
- `--preview` — file list + sizes only, no content (cheapest, use first)
- `--output file-list` — one path per line, pipe-friendly
- `--force` — bypass 200 KB warning

Query DSL:

```
query     = expr
expr      = and_expr ('||' and_expr)*
and_expr  = not_expr ('&&' not_expr)*
not_expr  = '!' not_expr | atom
atom      = key:value | '(' expr ')'
```

Predicates:
- `ext:ts,tsx` — by extension (no dot, comma-separated)
- `keyword:term` or `keyword:"multi word"` — files containing literal string
- `file:src/foo.ts` — exact repo-relative path (comma-sep for multiple)
- `path:src/**/*.ts` — glob against repo-relative path
- `*diff:` / `*diff:HEAD~3` — files in working diff, or vs ref
- `*older:30d` / `*newer:7d` — by last-commit date (units: d w m y)

`*` = slow: shells out to git per query. Avoid in loops or on huge repos.

Operators: `&&` (AND), `||` (OR), `!` (NOT), `()` for grouping. `&&` binds tighter than `||`.

Exit codes:

- `0` success, `1` error, `3` no matches, `5` result too large (rerun with `--force`)

Examples:

```bash
catlens 'ext:ts && keyword:checkout' --preview
catlens 'diff:' --preview
catlens 'ext:ts && keyword:checkout && !path:**/*.test.*'
catlens 'ext:ts' --output file-list
```
