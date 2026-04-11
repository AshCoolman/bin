# Quickstart: CatLens Development

**Date**: 2026-04-11

---

## Prerequisites

- Node.js 22 LTS
- npm 10+
- TypeScript (installed via npm; no global install needed)
- `tsx` (installed via npm)
- `git` (for git-backed predicates in tests)
- `fzf` (optional; for fuzzy lens disambiguation)

---

## Setup

```bash
# Clone the repo
git clone <repo-url>
cd catseye

# Install all workspace dependencies
npm install

# Type-check all packages
npm run typecheck

# Run all tests
npm test
```

---

## Development workflow

```bash
# Run the CLI directly (no build step)
npx tsx packages/cli/src/index.ts 'ext(ts)' --preview

# Or via the workspace script
npm run dev -- 'ext(ts)' --preview

# Watch tests
npm run test:watch

# Type-check only
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

---

## Package structure

```
packages/core/    — shared query engine; start here for predicate work
packages/cli/     — terminal frontend; add CLI commands here
packages/mcp/     — MCP server frontend; add MCP tools here
test/fixtures/    — fixture repos used by integration tests
```

### Adding a new predicate

1. Add the AST node type to `packages/core/src/query/ast.ts`
2. Add parsing in `packages/core/src/query/parser.ts`
3. Add evaluation in `packages/core/src/engine/evaluate.ts`
4. Add formatting in `packages/core/src/query/formatter.ts`
5. Add validator checks in `packages/core/src/query/validator.ts`
6. Add a fixture case in `test/fixtures/` covering the predicate
7. Add an integration test

The predicate is automatically available in both CLI and MCP once step 1–4 are complete,
because both frontends compile to the same AST and use the same engine.

---

## Running against a real repo

```bash
# Point CatLens at any local git repo
npx tsx packages/cli/src/index.ts \
  --root /path/to/your/repo \
  'and(ext(ts), keyword("TODO"))' \
  --preview
```

---

## Running integration tests

Integration tests run the engine against fixture repos under `test/fixtures/`.

```bash
# All integration tests
npm run test:integration

# One fixture
npm run test:integration -- --grep "tagged-sections"
```

---

## Starting the MCP server

```bash
# In development
npx tsx packages/mcp/src/server.ts --root /path/to/repo

# In production (after build)
node packages/mcp/dist/server.js --root /path/to/repo
```

---

## Common scripts (root package.json)

| Script | Description |
|--------|-------------|
| `npm run dev` | Run CLI via tsx |
| `npm test` | Run all tests |
| `npm run test:watch` | Watch mode |
| `npm run test:integration` | Integration tests only |
| `npm run typecheck` | Type-check all packages |
| `npm run lint` | Lint all packages |
| `npm run format` | Format all packages |
| `npm run build` | Compile all packages |
