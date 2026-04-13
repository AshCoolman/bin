<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Modified principles:
  II. AST-First — dropped "TypeScript discriminated unions"; added TypeScript helpers as input form
  IV. Terminal-First CLI → "Terminal-First Development, MCP-Driven Ambition" — reframed
  V. MCP as Equal Citizen → "MCP as Strategic Frontend" — reframed with strategic intent
  VI. Query Integrity → renumbered to VII; split lint/validate; linting tiered by context
  VII. Deferred Scope → renumbered to VIII
Added sections: VI. Explicit Query Semantics (new principle)
Removed sections: none
Technology Stack: dropped "zero-dependency core"; added tsx; softened dependency policy
Development Workflow: tightened breaking-change rule to cover all four real contracts
Templates requiring updates:
  ⚠ .specify/templates/plan-template.md — Branch field N/A under trunk-based dev (unchanged)
  ⚠ .specify/templates/spec-template.md — Feature Branch field N/A (unchanged)
Follow-up TODOs: none
-->

# CatLens Constitution

## Core Principles

### I. Shared Core (NON-NEGOTIABLE)

The CLI and MCP MUST share one query AST, one selection engine, and one render pipeline.
No frontend may implement its own selection logic. Every path from user input to output
MUST traverse: parse → discover → facts → evaluate → SelectionResult → render.

Rationale: divergence between CLI and MCP behavior is a defect, not a configuration option.

### II. AST-First Query Model

The canonical query representation is a typed AST.
The inline DSL, lens files, TypeScript helpers, and MCP JSON are all input forms
that compile to the same AST.

No predicate, operator, extraction rule, or render directive exists unless it has
a node type in the AST.

Rationale: the AST is the contract that makes validation, linting, formatting, MCP
interoperability, and stable reuse possible. It MUST be defined before any frontend is built.

### III. SelectionResult as the Stable Intermediate

`SelectionResult` is the stable boundary between the selection engine and all renderers.
Renderers MUST NOT re-query the repo or re-evaluate predicates. They receive
`SelectionResult` and produce output only.

Rationale: this enforces that concat is a renderer, not the core abstraction. It makes
preview, JSON, and markdown output interchangeable over the same selection pass.

### IV. Terminal-First Development, MCP-Driven Ambition

The CLI is the primary development frontend for fast local iteration.
It MUST support compact one-liners, preview before render, saving a proven query,
rerun by name, and human-readable and JSON output.

The product MUST NOT require file-based authoring for one-off queries.
Complex queries MAY be authored and maintained in lens files when complexity justifies it.

CatLens MUST also optimize for eventual MCP-first usefulness.
No feature may be introduced in a way that makes it CLI-only by design if it is
semantically meaningful for MCP.

### V. MCP as Strategic Frontend

CatLens MUST treat MCP as a first-class frontend and long-term strategic target.

The MCP server MUST expose the same core engine as the CLI. It MUST NOT duplicate
predicate evaluation or selection logic. Its primary interface is structured JSON,
not raw DSL text.

Any predicate, operator, extraction rule, or render capability available through the CLI
MUST have a path to MCP exposure unless explicitly declared local-only for operational reasons.

Required MCP capabilities for V1:
- list saved lenses
- run a saved lens
- preview a saved lens
- run a structured query
- render a selection result

MCP is not an adapter around shell commands. It is a frontend over the same core model.

### VI. Explicit Query Semantics

Boolean structure is a core part of the product, not a CLI convenience.

The system MUST preserve explicit grouping and operator semantics across all frontends.
At minimum, the query model MUST support:
- `and`
- `or` / `any`
- `not`
- `unless`
- grouping / nesting

No frontend may flatten grouped semantics into additive flags or otherwise change
query meaning during translation to the AST.

### VII. Query Integrity

Queries are first-class artifacts.

The engine MUST enforce:
- validation before execution
- canonical formatting for any valid query
- linting support for all query forms

Validation covers parse correctness, known predicates, and argument type checks.

Linting covers contradictory clauses, duplicate predicates, unreachable branches,
suspiciously broad queries, and likely-zero-match queries.

Linting SHOULD be lightweight for ad hoc CLI use and stronger for saved lenses and
MCP-submitted queries.

### VIII. Deferred Scope (Hard Boundary)

The following are out of scope for V1 and MUST NOT be introduced without a
constitution amendment:
- vector databases or embedding-based retrieval
- arbitrary JavaScript/TypeScript eval as a query mechanism
- plugin-heavy extension architecture
- tree-sitter structural selectors
- rich web UI

Adding any of the above requires a MAJOR version bump to this constitution.

## Technology Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Dev runner**: `tsx`
- **Module structure**: one shared core package consumed by CLI and MCP entrypoints
- **Testing**: unit tests for AST/engine/renderer; integration tests against real repo fixtures
- **Dependency policy**: keep the core dependency-light and justify each dependency;
  frontend-specific dependencies should remain in CLI and MCP shells where possible

The core (`query`, `engine`, `repo`, `facts`, `render`, `lenses`) MUST have no CLI-specific
or MCP-specific imports. Frontends import core; core does not import frontends.

## Development Workflow

- **Branching**: trunk-based development on `main`. No feature branches.
- **Commits**: small, focused, working increments.
- **Specs and plans**: stored under `specs/` per the Specify workflow; branch fields in
  templates are N/A for this project — treat them as `main`.
- **Review**: self-review or pair; no PR gate required for solo work.
- **Breaking changes**: any change that removes, renames, or materially alters:
  - AST node shapes
  - `SelectionResult` structure
  - saved lens format
  - MCP request/response contracts

  MUST be called out explicitly in the commit message and spec.

## Governance

This constitution supersedes all other practices documented in this repository.

Amendment procedure:
1. Edit this file with the change.
2. Increment the version according to semver rules below.
3. Update the Sync Impact Report comment at the top.
4. Commit with message: `docs: amend constitution to vX.Y.Z (<summary>)`

Version rules:
- **MAJOR**: principle removed, redefined, or hard-boundary scope relaxed.
- **MINOR**: new principle added or section materially expanded.
- **PATCH**: clarifications, wording, non-semantic refinements.

All implementation plans and specs MUST include a Constitution Check section that
verifies compliance with Principles I–VIII before work begins.

**Version**: 1.1.0 | **Ratified**: 2026-04-11 | **Last Amended**: 2026-04-11
