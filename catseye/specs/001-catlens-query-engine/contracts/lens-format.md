# Lens File Format: CatLens

**Version**: 1.0
**Date**: 2026-04-11

---

## Storage location

Lenses are stored in `.catlens/` at the repo root. Each lens is a single JSON file:

```
<repo-root>/
└── .catlens/
    ├── checkout-roundtrip-v1.json
    └── api-surface.json
```

The `.catlens/` directory may be committed to source control (to share lenses with
the team) or added to `.gitignore` (to keep them local). CatLens does not enforce either.

---

## File naming

Lens names follow `[a-z0-9][a-z0-9-]*` (kebab-case, no leading dash).
The filename is `{name}.json`.

---

## File structure

```json
{
  "$schema": "https://catlens.dev/schemas/lens/1.0.json",
  "name": "checkout-roundtrip-v1",
  "description": "TypeScript files touching the checkout flow, not older than 1 year",
  "createdAt": "2026-04-10T14:23:00Z",
  "updatedAt": "2026-04-10T14:23:00Z",
  "query": {
    "selection": {
      "type": "and",
      "children": [
        { "type": "ext", "extensions": ["ts", "tsx"] },
        {
          "type": "or",
          "children": [
            { "type": "keyword", "term": "calculateCheckoutTotal" },
            { "type": "keyword", "term": "/api/checkout" }
          ]
        },
        { "type": "not", "child": { "type": "older_than", "duration": { "value": 365, "unit": "d" } } }
      ]
    },
    "render": {
      "format": "markdown",
      "lineNumbers": true
    }
  }
}
```

---

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$schema` | string | no | Schema URL for editor tooling |
| `name` | string | yes | Lens name (must match filename) |
| `description` | string | no | Human-readable description |
| `createdAt` | ISO 8601 | yes | Creation timestamp |
| `updatedAt` | ISO 8601 | yes | Last modification timestamp |
| `query` | Query AST | yes | The full query AST (see data-model.md) |

---

## Breaking changes

Any change to the lens JSON structure that removes or renames fields is a breaking
change and requires a constitution amendment and version bump.

The `$schema` URL will reflect the version (e.g., `.../lens/2.0.json`) when breaking
changes occur.

---

## Roundtrip guarantee

A lens saved by CatLens and then loaded by CatLens MUST produce an identical
`SelectionResult` to the original inline query for the same repo state.
