# MCP Contract: CatLens

**Version**: 1.0
**Date**: 2026-04-11

The MCP server exposes the same core engine as the CLI. It accepts structured JSON
queries (the Query AST in JSON form) as its primary interface, not raw DSL text.

---

## Tool: `list_lenses`

List all saved lenses in the current repo.

**Input**:
```json
{
  "root": "/absolute/path/to/repo"   // optional; defaults to cwd at server start
}
```

**Output**:
```json
{
  "lenses": [
    {
      "name": "checkout-roundtrip-v1",
      "description": "Optional description",
      "createdAt": "2026-04-10T14:23:00Z",
      "updatedAt": "2026-04-10T14:23:00Z"
    }
  ]
}
```

---

## Tool: `run_lens`

Run a saved lens by name and return a rendered result.

**Input**:
```json
{
  "name": "checkout-roundtrip-v1",
  "root": "/absolute/path/to/repo",
  "output": "markdown"               // optional: markdown | file-list | snippets | diff | json
}
```

**Output**:
```json
{
  "content": "## src/...\n\n```typescript\n...\n```",
  "stats": {
    "fileCount": 3,
    "sectionCount": 0,
    "diffCount": 0,
    "totalLines": 142,
    "estimatedChars": 5800
  }
}
```

---

## Tool: `preview_lens`

Preview a saved lens (matched files + stats, no full render).

**Input**:
```json
{
  "name": "checkout-roundtrip-v1",
  "root": "/absolute/path/to/repo"
}
```

**Output**:
```json
{
  "files": [
    {
      "path": "src/engine/evaluate.ts",
      "lineCount": 48,
      "reasons": [
        { "predicate": "keyword", "detail": "matched \"checkout\"" }
      ]
    }
  ],
  "stats": {
    "fileCount": 3,
    "sectionCount": 0,
    "diffCount": 0,
    "totalLines": 142,
    "estimatedChars": 5800
  }
}
```

---

## Tool: `run_query`

Run a structured JSON query against a repo.

**Input**:
```json
{
  "query": {
    "selection": {
      "type": "and",
      "children": [
        { "type": "ext", "extensions": ["ts", "tsx"] },
        { "type": "keyword", "term": "checkout" }
      ]
    },
    "render": {
      "format": "markdown",
      "lineNumbers": true
    }
  },
  "root": "/absolute/path/to/repo",
  "output": "markdown"
}
```

**Output**: same shape as `run_lens` output.

---

## Tool: `render_selection`

Re-render an existing `SelectionResult` in a different format without re-querying.

**Input**:
```json
{
  "selectionResult": { ... },   // a previously returned SelectionResult
  "output": "json"              // re-render in a different format
}
```

**Output**: same shape as `run_lens` output.

---

## Tool: `format_query`

Format a DSL string into canonical form.

**Input**:
```json
{
  "dsl": "and(ext(ts,tsx),keyword(\"checkout\"))"
}
```

**Output**:
```json
{
  "formatted": "and(\n  ext(ts, tsx),\n  keyword(\"checkout\")\n)"
}
```

---

## Tool: `parse_query`

Parse a DSL string and return the Query AST as JSON.

**Input**:
```json
{
  "dsl": "and(ext(ts), keyword(\"checkout\"))"
}
```

**Output**:
```json
{
  "query": {
    "selection": {
      "type": "and",
      "children": [
        { "type": "ext", "extensions": ["ts"] },
        { "type": "keyword", "term": "checkout", "caseSensitive": false }
      ]
    }
  }
}
```

---

## Error responses

All tools return a standard error shape on failure:

```json
{
  "error": {
    "code": "PARSE_ERROR" | "VALIDATION_ERROR" | "LENS_NOT_FOUND" | "NO_MATCHES" | "GIT_UNAVAILABLE",
    "message": "Human-readable description of the error",
    "details": { }   // optional structured context
  }
}
```

---

## Server startup

The MCP server starts with a required `--root` argument pointing to the repo to operate on:

```bash
node packages/mcp/dist/server.js --root /path/to/repo
```

Or via stdio transport for IDE/agent integration (standard MCP pattern).

---

## Parity requirement

Any predicate, operator, or render format available through the CLI MUST be available
through `run_query` using the JSON AST form. There is no CLI-exclusive capability.
