# catseye Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-11

## Active Technologies

- TypeScript 5.x, strict mode + `fast-glob` (discovery), `ignore` (gitignore), `simple-git` (001-catlens-query-engine)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x, strict mode: Follow standard conventions

## Recent Changes

- 001-catlens-query-engine: Added TypeScript 5.x, strict mode + `fast-glob` (discovery), `ignore` (gitignore), `simple-git`

<!-- MANUAL ADDITIONS START -->
## Project Structure (actual)

```text
packages/
├── core/       # shared engine: query/, engine/, repo/, facts/, render/, lenses/
├── cli/        # terminal frontend (imports core only)
└── mcp/        # MCP server frontend (imports core only)

test/fixtures/  # fixture repos for integration tests
specs/          # speckit specifications
docs/           # project documentation
```

## Key rules

- `packages/core` MUST NOT import from `packages/cli` or `packages/mcp`
- All queries compile to the same AST regardless of frontend (CLI, MCP, lens file)
- Renderers consume `SelectionResult` only — no re-querying inside a renderer
- Run `catlens parse '...'` to inspect the AST for any DSL input
- Lens store: `.catlens/` at repo root, one JSON file per lens
<!-- MANUAL ADDITIONS END -->
