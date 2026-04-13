# Research: CatLens Query Engine

**Phase**: 0
**Date**: 2026-04-11
**Status**: Complete — no NEEDS CLARIFICATION items remained after reading initial-plan.md

---

## Decision 1: Package structure

**Decision**: Three-package npm workspaces monorepo (`core`, `cli`, `mcp`).

**Rationale**: Enforces the constitution's import-direction rule at the package level.
`core` cannot accidentally import from `cli` or `mcp` because it has no dependency on them
in its `package.json`. TypeScript project references reinforce this at build time.
A single-package approach would require lint rules and discipline alone to enforce the
boundary, which is weaker.

**Alternatives considered**:
- Single package with internal module convention: weaker enforcement, no package-level
  isolation.
- Three separate repos: too much ceremony for a solo project; no shared test runner.

---

## Decision 2: Test framework

**Decision**: [vitest](https://vitest.dev/)

**Rationale**: Native TypeScript and ESM support without `ts-jest` or Babel config.
Fast HMR-style watch mode. Compatible with the `--pool=forks` flag for fixture-based
integration tests that spawn child processes. Outputs tap/junit for CI if needed.

**Alternatives considered**:
- Jest: requires `ts-jest` or `babel-jest` for TypeScript; slower cold start.
- node:test (built-in): insufficient matchers; no watch mode worth using in 2026.

---

## Decision 3: File discovery

**Decision**: [fast-glob](https://github.com/mrmlnc/fast-glob)

**Rationale**: Well-maintained, performant, supports negation patterns and ignore options
directly. Works cross-platform. Handles the combination of glob patterns and ignore rules
that the repo discovery step requires.

**Alternatives considered**:
- Node.js built-in `fs.glob` (22+): still maturing; less battle-tested for complex
  negation patterns.
- `globby`: a thin wrapper around fast-glob; no reason to add the indirection.

---

## Decision 4: Ignore handling

**Decision**: [ignore](https://github.com/kaelzhang/node-ignore)

**Rationale**: The canonical Node.js library for `.gitignore`-compatible pattern matching.
Lightweight, dependency-free, handles edge cases (re-inclusion after exclusion, etc.).
Composable with fast-glob by filtering candidates after discovery.

**Alternatives considered**:
- Rolling a manual `.gitignore` parser: unnecessary; the edge cases are subtle and
  well-handled by `ignore`.

---

## Decision 5: Git fact collection

**Decision**: [simple-git](https://github.com/steveukx/git.js)

**Rationale**: Clean TypeScript-friendly API over the git CLI. Handles diff, log,
blame, and status. No native bindings — pure Node.js wrapper. Degrades gracefully
when git is not installed. Covers all the git-backed predicates: `diff`, `authored_by`,
`older_than`, `commit_message`.

**Alternatives considered**:
- `nodegit` / `libgit2` bindings: native dependency, platform-specific build pain;
  not worth it for the predicates needed.
- Shelling out raw `git` commands: possible, but requires manual stdout parsing and
  error handling that simple-git already provides.

---

## Decision 6: CLI argument parsing

**Decision**: [commander](https://github.com/tj/commander.js)

**Rationale**: The most established Node.js CLI framework. Excellent TypeScript types.
Handles subcommands, options, and variadic arguments cleanly. Output format is
predictable and well-tested.

**Alternatives considered**:
- `yargs`: heavier, more config, output format harder to control.
- `minimist`: too low-level; no subcommand support.
- `meow`: fine but less TypeScript-native than commander.

---

## Decision 7: Terminal output

**Decision**: [picocolors](https://github.com/alexeyraspopov/picocolors)

**Rationale**: Zero-dependency, ~1kB, faster than chalk. Sufficient for the output
coloring needed in preview/lint output. No reason to pull in chalk's full feature set.

**Alternatives considered**:
- `chalk`: larger, more features than needed.
- No coloring: acceptable but worse developer experience for preview output.

---

## Decision 8: MCP integration

**Decision**: [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk)

**Rationale**: The official TypeScript SDK for the MCP protocol. Handles transport
(stdio, HTTP+SSE), tool registration, and request/response serialization. The `mcp`
package is a thin wrapper: it registers tools that delegate directly to `core` services.

**Alternatives considered**:
- `fastmcp`: higher-level but less control over tool schemas.
- Manual MCP implementation: unnecessary; the SDK handles the protocol correctly.

---

## Decision 9: Lens storage

**Decision**: `.catlens/` directory at repo root; one `.json` file per lens.

**Rationale**: Human-readable, committable to source control, easy to inspect and delete.
The canonical lens format is JSON (maps directly to the AST). The directory name is
predictable and can be added to `.gitignore` or committed based on team preference.

File naming: `{lens-name}.json`. Lens names follow `[a-z0-9-]+` convention.

**Alternatives considered**:
- Single `lenses.json` file: merge conflicts when multiple lenses change concurrently;
  harder to delete a single lens cleanly.
- SQLite: overkill; lenses are a handful of JSON objects.
- YAML: less direct mapping to the AST JSON model.

---

## Decision 10: Fuzzy lens disambiguation

**Decision**: Spawn `fzf` as a child process when available; fall back to a numbered
prompt (via `readline`) when not.

**Rationale**: `fzf` provides the best interactive disambiguation UX without requiring
it as a hard dependency. The fallback is acceptable for environments where `fzf` is
not installed. Neither approach requires an npm dependency.

**Alternatives considered**:
- `inquirer` / `@inquirer/prompts`: adds a dependency for a feature that is only needed
  when lens prefix is ambiguous. Not worth it.

---

## Decision 11: DSL parser approach

**Decision**: Hand-written recursive descent parser.

**Rationale**: The DSL grammar is small and regular. A hand-written parser gives full
control over error messages, source span tracking, and incremental extension. No
parser generator overhead or dependency.

**Alternatives considered**:
- `nearley` / `chevrotain` / `ohm`: parser generators are appropriate for larger
  grammars. For a DSL with ~15 predicates, they add more than they provide.
- `peggy`: same concern; the grammar is simple enough that the meta-language is
  more complex than the parser itself would be.

---

## Decision 12: Node.js version

**Decision**: Node.js 22 LTS (minimum).

**Rationale**: Node 22 is the current LTS as of 2026. It has stable `fs/promises`,
`readline`, and `child_process` APIs. ESM support is mature. `tsx` runs on Node 18+,
so this is not a constraint.

---

## Decision 13: Dev runner

**Decision**: `tsx` for development; `tsc --noEmit` for type-checking; `tsc` for
production build.

**Rationale**: `tsx` provides instant TypeScript execution without a build step during
development. TypeScript compilation for production ensures correct output. `vitest`
handles its own TypeScript transformation via `vite-node`.

---

## Summary: all NEEDS CLARIFICATION resolved

| Question | Resolution |
|----------|------------|
| Package structure | npm workspaces monorepo |
| Test framework | vitest |
| File discovery | fast-glob |
| Ignore handling | ignore package |
| Git facts | simple-git |
| CLI args | commander |
| Terminal output | picocolors |
| MCP SDK | @modelcontextprotocol/sdk |
| Lens storage | .catlens/ JSON files |
| Fuzzy select | fzf child process + readline fallback |
| DSL parser | hand-written recursive descent |
| Node version | 22 LTS |
| Dev runner | tsx |
