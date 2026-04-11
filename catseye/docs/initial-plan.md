# CatLens (CatsEye?) — Software Spec

## Goal

Build a local tool that gathers the **smallest correct code slice for the current task**.

Primary use:
- paste/share relevant code into another context
- without sharing the whole repo

Targets:
- ChatGPT
- other AI tools
- humans
- gists
- issue threads

Output must be real code:
- files
- snippets / sections
- diffs

Output must preserve orientation:
- file paths
- line numbers where useful

---

## Solution

Build **CatLens** as a **local query engine** with **multiple frontends over one shared core**:

1. **CLI** for fast local iteration
2. **MCP** as the strategic AI-facing frontend
3. **Lens files** for more complex or longer-lived queries

Core model:
- one shared **typed query AST**
- one shared **selection engine**
- one shared **render pipeline**

The CLI, lens files, and MCP requests all compile to the same AST.

---

## Solution motivation

The real problem is not concatenation.

The real problem is **deterministic, reusable selection of task-relevant code**.

Existing packers solve:
- “turn chosen files into one bundle”

They do **not** solve well enough:
- reusable task queries
- explicit grouped boolean logic
- file + section selection
- git-aware selection
- stable reuse across CLI, files, and MCP

So the core must be:
- query model first
- selection engine second
- renderer third

---

## Product shape

CatLens is a **task-context code bundler**.

Not:
- a whole-repo exporter
- an AI-only summariser
- a hosted platform
- a config-file-first tool
- a bag of grep flags

It should:
- gather the right code slice
- let the user share only that slice
- work directly from the terminal for the common path
- allow file-based authoring when query complexity justifies it
- support saved reusable lenses
- expose the same model over MCP

---

## Main requirements

### Functional

Must support selection by:
- explicit file paths
- path / glob / extension
- keywords
- tag / marker comments
  - top of file
  - anywhere in file
  - open/close tagged sections
- current diff
- commit message match
- authorship
- age / recency

Must support composition by:
- `and`
- `or` / `any`
- `not`
- `unless`
- grouping / nesting

Must support outputs:
- file list
- markdown concat
- snippets with file/line anchors
- diffs
- structured JSON

Must support flows:
- quick manual gather
- ad hoc query
- save lens
- rerun saved lens
- preview before render

### Non-functional

Highest priority:
- maintainability
- extension speed
- explicit internal model
- correct code selection

Important:
- terminal-first for common local use
- MCP as the strategic frontend
- local execution
- free for commercial use
- human-readable output
- reusable saved lenses
- deterministic, inspectable behaviour

Lower priority:
- raw speed

Fast enough is sufficient.

---

## Frontends

## 1. CLI

Default development frontend.

Must support:
- compact one-liners
- fast run / inspect / tweak loop
- preview
- save after query proves useful

Example flow:
\`\`\`
catlens 'and(ext(ts,tsx), any(keyword("checkout"), keyword("/api/checkout")), not(older_than("365d")))' --preview
catlens '...' --save checkout-roundtrip-v1
catlens checkout-roundtrip-v1
catlens checkout-
\`\`\`

If a saved-lens prefix is ambiguous:
- support fuzzy disambiguation
- use `fzf` when available

## 2. MCP

Strategic frontend.

Must expose the same engine, not a separate logic path.

Primary MCP interface should be **structured JSON**, not raw DSL text.

Useful tools:
- `list_lenses`
- `run_lens`
- `preview_lens`
- `run_query`
- `render_selection`
- `format_query`
- `parse_query`

## 3. Lens files

Valid authoring frontend for more complex queries.

Purpose:
- persistence
- review
- editing when query complexity exceeds comfortable one-liner use

They are first-class, but not the default for ad hoc use.

---

## Query model

Canonical representation:
- typed AST / JSON

Human authoring forms:
- inline mini DSL
- lens file

Agent authoring form:
- structured JSON over MCP

Optional advanced authoring form later:
- TypeScript builder helpers that compile to the same AST

### Why AST-first

Needed for:
- shared semantics across CLI / file / MCP
- validation
- linting
- formatting
- explanation
- stable compatibility
- easy rendering

---

## Query language

Use a **small DSL**.

It should be:
- regular
- low-ambiguity
- easy to parse
- easy to lint
- easy to format
- easy to map to AST

It should not depend on:
- JS eval
- ad hoc shell parsing
- many synonymous spellings
- precedence tricks

### Example shape

\`\`\`
and(
  ext(ts, tsx),
  any(
    keyword("calculateCheckoutTotal"),
    keyword("/api/checkout")
  ),
  not(
    older_than("365d")
  )
)
unless(
  authored_by("ash@example.com")
)
extract(
  tagged_sections("catty:task", "catty:api"),
  include_diff()
)
render(
  markdown(),
  line_numbers()
)
\`\`\`

---

## Why not Lucene

Lucene is suitable only as a possible **sub-syntax** inside specific predicates.

It is not suitable as the main lens language because the overall problem includes:
- extraction rules
- render rules
- section selection
- git predicates
- reusable structured semantics

---

## Why not evalled JS as the main query language

Rejected as the primary lens format because it weakens:
- safety
- stability
- portability
- linting
- MCP interoperability
- explainability

TypeScript builder APIs are acceptable later as an advanced internal or power-user layer, but not as the main user contract.

---

## Internal architecture

Core modules:

- `query`
  - AST types
  - parser
  - formatter
  - validator
  - linter

- `engine`
  - predicate evaluation
  - boolean composition
  - selection construction

- `repo`
  - candidate discovery
  - ignore handling
  - path normalization

- `facts`
  - file facts
  - section facts
  - diff facts
  - git facts

- `render`
  - file list
  - markdown concat
  - snippets
  - diffs
  - JSON

- `lenses`
  - save/load/list named lenses
  - fuzzy lookup integration

- `mcp`
  - MCP tool surface over the same AST + engine

---

## Core data model

### Query
Declarative selection + extraction + render intent.

### SelectionResult
Stable result object containing:
- files
- sections
- diffs
- inclusion reasons
- stats

### FileHit
Selected file with inclusion metadata.

### SectionHit
Selected range within a file.

### Reason
Why a file/section/diff was included.

This makes concat a renderer, not the core abstraction.

---

## Query processing pipeline

1. parse query into AST
2. discover candidate files
3. extract relevant facts
4. evaluate boolean expression
5. build `SelectionResult`
6. preview or render output

This same pipeline must be used by:
- CLI
- lens files
- MCP

---

## Preview requirement

The tool must support preview before render.

Preview should show:
- matched files
- matched sections
- rough size
- optionally inclusion reasons

Purpose:
- fast terminal iteration
- trust
- avoid accidental over-sharing

Preview and render must derive from the same `SelectionResult`.

---

## Lint / format / validate

Required early.

### Validator
Checks:
- parse correctness
- known predicates/operators
- argument shape/types

Validation must run before execution.

### Formatter
Provides canonical readable query formatting.

### Linter
Checks:
- contradictory clauses
- duplicate predicates
- unreachable branches
- empty groups
- suspiciously broad queries
- suspiciously expensive queries
- likely-zero-match queries

Linting must be available for all query forms.
It may be lightweight for ad hoc CLI use and stricter for saved lenses and MCP-submitted queries.

Reason:
- queries are a first-class artifact
- they need guardrails

---

## Save / reuse model

Saved lenses are repo-local named query artifacts.

Flow:
1. user authors query in terminal
2. iterates until useful
3. saves with `--save`
4. reruns by name later
5. discovers by prefix / fuzzy match

Saved representation should be:
- human-readable
- stable
- based on the canonical AST model

---

## Output model

Primary outputs:
- file list
- markdown bundle
- snippet bundle
- diff bundle
- structured JSON

All code outputs must preserve orientation:
- file path
- line numbers where useful

Reason:
- human use is first-class
- AI use still benefits from clear code orientation

---

## TypeScript choice

Recommend **TypeScript** for implementation.

Reason:
- strongest fit for typed ASTs and discriminated unions
- easiest path for rapid extension
- easiest path to MCP integration
- easy reuse of JS/TS ecosystem for later structural selectors
- runtime overhead is acceptable for this usage pattern

This problem values:
- maintainability
- extension speed
- shared model clarity

more than:
- maximum native performance

---

## Deferred scope

Do not build initially:
- vector DB
- embeddings-first retrieval
- plugin-heavy architecture
- arbitrary JS query execution
- rich web UI
- tree-sitter everywhere

These may be added later if needed.

---

## V1 scope

Must include:
- CLI
- DSL parser
- AST
- preview
- save/load/list lenses
- fuzzy saved-lens selection
- file/path/glob/ext predicates
- keyword predicates
- tag predicates
- tagged section predicates
- diff predicate
- commit message predicate
- authored-by predicate
- age predicate
- markdown/snippet/diff renderers
- MCP wrapper over same engine
- formatter/linter/validator

---

## Success criteria

The tool is successful if a developer can:

1. stay in the terminal for the common path
2. quickly iterate on a task query
3. preview the selected code slice
4. render a pasteable code bundle
5. save the query as a reusable lens
6. rerun the same lens later against current repo state
7. expose the same selection model to AI tools via MCP
8. move to file-based authoring when query complexity justifies it

---

## Short conclusion

Build **CatLens** as a **local TypeScript query engine** with:
- terminal-first CLI for common local use
- MCP as the strategic frontend
- shared AST
- small DSL
- saved reusable lenses
- preview/lint/format/validate
- one shared core engine underneath

Reason:
- the missing capability is not packing
- it is **deterministic, reusable, composable task-context code selection**

# CatLens — Phased Implementation Plan

## Planning stance

Front-load the phases where the architecture is clear and mistakes would be expensive:
- query model
- pipeline boundaries
- repo fixtures
- preview/render contracts
- CLI/MCP/core separation

Then reduce precision later where real usage should drive the shape:
- richer predicates
- MCP ergonomics
- advanced authoring
- structural selectors

The goal is a **stable core early**, not maximum surface area early.

---

# Phase 0 — Foundation and guardrails

## Goal

Create the minimum project shape, repo discipline, and test scaffolding needed to avoid architectural drift in Phase 1.

## Scope

- create repo structure
- establish strict TypeScript setup
- establish core package boundaries
- create fixture repos for integration tests
- define baseline developer workflow
- wire basic CLI and MCP shells that do nothing useful yet
- lock down architecture with tests and docs before feature work starts

## Deliverables

- working monorepo or simple workspace layout
- strict `tsconfig`
- `core`, `cli`, and `mcp` package/module boundaries
- fixture repos under `test/fixtures/`
- smoke test harness
- constitution/spec committed
- baseline scripts:
  - `dev`
  - `test`
  - `typecheck`
  - `lint`
  - `format`

## Concrete steps

1. Create initial layout:
   - `packages/core`
   - `packages/cli`
   - `packages/mcp`
   - `test/fixtures`
   - `specs`
   - `docs`

2. Set up TypeScript in strict mode.
   - no implicit any
   - exact optional property types if tolerable
   - no emit for typecheck script
   - separate build config if needed

3. Add `tsx` for dev running, but keep Node as runtime target.

4. Define import rule:
   - `core` imports nothing from `cli` or `mcp`
   - `cli` and `mcp` import `core`

5. Add fixture repos covering:
   - small TS/TSX app
   - FE↔BE round trip fixture
   - tagged section examples
   - git history examples
   - ignored files examples

6. Create first integration test harness that can:
   - point engine at fixture repo path
   - run a query
   - inspect result shape

7. Add placeholder CLI entrypoint:
   - parse args minimally
   - print “not implemented”
   - verify packaging path

8. Add placeholder MCP entrypoint:
   - expose one no-op tool
   - verify same repo/package can host MCP server

9. Commit architecture note:
   - one AST
   - one engine
   - one `SelectionResult`
   - one render path

## Exit criteria

- project structure exists
- strict TS passes
- fixtures exist
- integration harness runs
- CLI and MCP shells compile/run
- no frontend-specific code exists in core

---

# Phase 1 — Core query model and execution skeleton

## Goal

Define the canonical internal model and make a trivial end-to-end query execute through the full pipeline.

## Scope

- AST
- query parser skeleton
- `SelectionResult`
- pipeline stages
- preview/render boundary
- minimal file discovery
- minimal renderer

This phase is about **shape correctness**, not feature breadth.

## Deliverables

- typed AST
- parser for a tiny subset of DSL
- candidate discovery
- stub facts stage
- boolean evaluator
- `SelectionResult`
- preview renderer
- markdown/file-list renderer
- first real CLI query path

## Concrete steps

1. Define AST types for:
   - query root
   - predicates
   - `and`
   - `any`
   - `not`
   - `unless`
   - extract directives
   - render directives

2. Keep AST deliberately small at first.
   Initial predicates only:
   - explicit file paths
   - extension
   - keyword

3. Define `SelectionResult` and related types:
   - `FileHit`
   - `SectionHit`
   - `Reason`
   - `Stats`

4. Define pipeline interfaces:
   - parse
   - discover
   - collect facts
   - evaluate
   - build result
   - preview/render

5. Implement candidate discovery for:
   - explicit paths
   - recursive repo walk
   - ignore handling placeholder if full handling is not ready yet

6. Implement first facts collector:
   - path
   - extension
   - basic file text read
   - line count

7. Implement evaluator for:
   - `and`
   - `any`
   - `not`
   - extension
   - keyword
   - explicit paths

8. Implement `SelectionResult` builder from evaluator output.

9. Implement preview output from `SelectionResult`:
   - files
   - line counts
   - total estimate

10. Implement minimal markdown renderer:
   - file header
   - fenced code block
   - file contents

11. Wire CLI:
   - accept inline DSL string
   - run full pipeline
   - support `--preview`
   - support default markdown render

12. Add integration tests against fixtures:
   - single keyword match
   - `and`
   - `any`
   - `not`
   - explicit file list
   - preview vs render both derived from same result

## Exit criteria

- one-liner query runs end-to-end
- AST is the only internal query representation
- preview and render both consume `SelectionResult`
- core engine works without CLI-specific assumptions

---

# Phase 2 — Query integrity: validator, formatter, linter

## Goal

Make queries safe, stable, and inspectable before adding much more power.

## Scope

- validator
- formatter
- linter
- error reporting
- canonical query printing
- normalized AST output

## Deliverables

- parse errors with location/context
- validator with argument/type checks
- formatter producing canonical DSL
- linter with first practical rules
- CLI commands/subcommands for parse/format/lint

## Concrete steps

1. Upgrade parser to retain source spans where practical.

2. Implement validator for:
   - unknown predicates
   - wrong arity
   - invalid argument shapes
   - illegal directive placement

3. Implement formatter:
   - canonical operator names
   - stable indentation
   - stable ordering where appropriate

4. Implement linter rules for:
   - duplicate predicates in same group
   - empty groups
   - obvious contradictions
   - double negation
   - suspiciously broad query with no narrowing
   - likely-zero-match query shape where determinable

5. Add CLI support:
   - `catlens parse`
   - `catlens fmt`
   - `catlens lint`

6. Ensure execution path always validates before running.
   Lint remains available and encouraged, but not mandatory for every ad hoc query.

7. Add tests for:
   - invalid syntax
   - invalid semantics
   - formatter idempotence
   - linter diagnostics

## Exit criteria

- every query is validated before execution
- canonical formatting exists
- linter catches obvious bad queries
- parser/formatter/linter all operate on same AST model

---

# Phase 3 — Save/reuse model and terminal workflow

## Goal

Make the CLI genuinely useful for daily work.

## Scope

- named lenses
- save/load/list
- prefix lookup
- fuzzy disambiguation
- quick manual gather path
- improved preview UX

## Deliverables

- repo-local lens store
- `--save`
- run by name
- prefix matching
- fuzzy choose for ambiguous prefixes
- explicit file gather mode
- stable preview output

## Concrete steps

1. Define lens file format.
   Keep it human-readable and directly mappable to AST.

2. Add storage location rules:
   - repo-local
   - predictable
   - easy to inspect and commit or ignore

3. Implement:
   - `saveLens(name, query)`
   - `loadLens(name)`
   - `listLenses()`
   - prefix search

4. Add CLI flows:
   - `catlens '<query>' --save name`
   - `catlens name`
   - `catlens prefix`
   - explicit file mode without DSL

5. Add fuzzy disambiguation:
   - use `fzf` if present
   - fallback to numbered prompt if not

6. Improve preview:
   - matched files
   - matched sections count
   - total lines
   - maybe reasons in verbose mode

7. Add tests around:
   - save/load roundtrip
   - prefix resolution
   - ambiguity handling
   - repo-local lens isolation

## Exit criteria

- common terminal-first loop works
- one-liners can be saved and reused
- ambiguous lens names can be resolved quickly
- CLI now feels better than the original bash script for simple cases

---

# Phase 4 — Core predicate expansion

## Goal

Add the highest-value deterministic selectors that are already well understood.

## Scope

- path/glob
- tag/marker comments
- tagged sections
- age/recency
- authorship
- current diff
- commit message contains

## Deliverables

- expanded predicate set
- section extraction model
- git-backed selectors
- richer reason reporting

## Concrete steps

1. Add path/glob predicate support.
2. Add comment/tag detection:
   - top-of-file
   - anywhere in file
3. Add tagged-section extraction:
   - open/close marker support
   - file + line range capture
4. Add age/recency predicate.
5. Add current diff predicate.
6. Add commit-message match predicate.
7. Add authored-by predicate.
8. Expand `Reason` model so hits explain why they were selected.
9. Add fixture repo cases for every predicate.
10. Add tests mixing grouped boolean logic with these predicates.

## Exit criteria

- the main user-stated selectors exist
- file-level and section-level selection both work
- git-aware selection works on fixture repos
- reasons are visible enough to debug query behavior

---

# Phase 5 — MCP v1 on the shared core

## Goal

Expose the existing engine cleanly to AI tooling without creating a second logic path.

## Scope

- structured MCP tools
- query execution via JSON payload
- saved lens execution
- preview/render through MCP
- tool contract tests

## Deliverables

- MCP server using shared core only
- JSON schema for query payloads
- basic MCP tool suite
- parity tests against CLI behavior

## Concrete steps

1. Define MCP request/response schemas for:
   - `list_lenses`
   - `run_lens`
   - `preview_lens`
   - `run_query`
   - `render_selection`
   - `format_query`
   - `parse_query`

2. Build MCP adapter layer over core services.
   No shelling out to CLI.

3. Add parity tests:
   - same query via CLI and MCP yields same `SelectionResult`
   - same lens via CLI and MCP yields same render output semantics

4. Keep MCP output structured first.
   Rendered markdown/code is derived, not primary.

5. Add error handling that is explicit and machine-usable.

## Exit criteria

- MCP works over same core engine
- no duplicated predicate logic
- agent can run structured queries and get code-oriented results
- parity with CLI is proven by tests

---

# Phase 6 — Query ergonomics and stabilization

## Goal

Reduce friction in writing, understanding, and maintaining real lenses.

## Scope

- better DSL ergonomics
- explain mode
- query cost hints
- improved error messages
- command polish
- result size guardrails

## Deliverables

- `--explain`
- `--count`
- better diagnostics
- size warnings and safeguards
- improved query authoring experience

## Suggested directions

- show inclusion reasons more clearly
- estimate result size before full render
- surface expensive predicates
- improve wording of parse/lint errors
- add canonical examples and docs
- refine DSL only where real pain is clear

## Exit criteria

- writing real lenses becomes less awkward
- debugging unexpected matches is practical
- users can avoid accidental giant bundles

---

# Phase 7 — Structural and language-aware expansion

## Goal

Add higher-value selectors once usage proves where the real gaps are.

## Scope

Intentionally looser. Drive this phase from observed tasks.

## Likely candidates

- JS/TS-aware predicates:
  - imports module
  - exports symbol
  - references identifier
  - route/client linkage hints
- smarter snippet extraction
- language-specific comment syntax handling
- richer FE↔BE traversal helpers
- TypeScript builder helpers that compile to AST

## Guidance

Do not pre-build all of this.
Use real failed queries and repeated workarounds to decide what belongs here.

## Exit criteria

- at least one structural selector is added because it solved repeated real cases
- additions preserve AST-first and shared-core principles
- no speculative architecture sprawl

---

# Phase 8 — Optional higher-level authoring surfaces

## Goal

Add richer authoring only if the terminal and lens files clearly hit complexity limits.

## Scope

Deliberately open.

## Possible directions

- richer lens file editing support
- editor integration
- visual query builder
- web UI with guardrails
- query test cases and saved previews
- lens catalog and documentation tooling

## Guidance

Only pursue this if:
- CLI/MCP/core are already solid
- real query complexity justifies it
- it does not create a second semantic model

## Exit criteria

- richer frontend improves authoring without changing core semantics
- AST remains the canonical model
- CLI and MCP remain first-class

---

# Cross-phase quality rules

## 1. Preserve one core
Every phase must preserve:
- one AST
- one engine
- one `SelectionResult`
- one render pipeline

## 2. Prove parity
Whenever a feature is exposed in more than one frontend, add parity tests.

## 3. Build on fixtures
Every new predicate or renderer behavior should land with fixture coverage.

## 4. Prefer explanation over magic
If behavior becomes hard to predict, improve preview/reasons/lint before adding more power.

## 5. Keep V1 deterministic
Do not pull in semantic/vector/AI retrieval to compensate for unclear core design.

---

# Suggested first implementation sequence inside the first few phases

If you want the most conservative strong start, do the first commits roughly in this order:

1. repo layout + strict TS + package boundaries
2. fixture repos + integration harness
3. AST types
4. `SelectionResult` types
5. parser for tiny DSL subset
6. candidate discovery
7. minimal facts collector
8. evaluator for `and` / `any` / `not`
9. preview renderer
10. markdown renderer
11. CLI end-to-end path
12. validator
13. formatter
14. linter
15. save/load/list lenses
16. fuzzy lens selection
17. path/glob predicate
18. tag predicates
19. tagged sections
20. diff/authorship/commit-message predicates
21. MCP v1

That sequence gets:
- architecture locked early
- useful CLI value early
- MCP after the core is real, not speculative

---

# Definition of a rock-solid start

The project is off to a rock-solid start when all of the below are true:

- the AST exists and is the only query model
- `SelectionResult` is stable and used by both preview and render
- CLI works end-to-end for real queries
- saved lenses work
- fixture-based integration tests exist
- validator/formatter/linter exist
- core has no frontend leakage
- MCP starts only after core parity is provable

That is the right point to widen scope.