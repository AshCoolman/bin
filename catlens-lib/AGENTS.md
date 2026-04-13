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
query      = selection [ unless(selection) ]
selection  = predicate | and(s,...) | or(s,...) | not(s)
```

Predicates:
- `ext(ts, tsx)` — by extension (no dot)
- `keyword("term")` — files containing literal string
- `file("path")` — exact repo-relative path
- `glob("src/**/*.ts")` — glob against repo-relative path
- `diff()` / `diff("HEAD~3")` — files in working diff, or vs ref
- `older_than("30d")` / `newer_than("7d")` — by mtime (units: d w m y)

`unless` is top-level only: `sel unless(excl)` runs sel then drops excl matches.

Exit codes:

- `0` success, `1` error, `3` no matches, `5` result too large (rerun with `--force`)

Examples:

```bash
catlens 'and(ext(ts), keyword("checkout"))' --preview
catlens 'diff()' --preview
catlens 'and(ext(ts), keyword("checkout")) unless(glob("**/*.test.*"))'
catlens 'ext(ts)' --output file-list
```
