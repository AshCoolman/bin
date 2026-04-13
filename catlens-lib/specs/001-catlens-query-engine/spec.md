# Feature Specification: CatLens Query Engine

**Feature Directory**: `specs/001-catlens-query-engine`
**Created**: 2026-04-11
**Status**: Draft
**Source**: `docs/initial-plan.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ad Hoc Query and Render (Priority: P1)

A developer is working on a task and needs to share only the relevant code with
an AI tool or collaborator. They run a one-liner query that selects files and
sections matching the task, preview the result to confirm scope, then render a
pasteable bundle.

**Why this priority**: The core daily-use case. Without this, the product has no value.

**Independent Test**: Run a query against a sample repo. Confirm matched files appear
in preview. Confirm rendered output contains only those files with correct paths and
line numbers.

**Acceptance Scenarios**:

1. **Given** a repo with TypeScript files, **when** the developer runs a keyword query
   from the terminal, **then** matched files are listed with correct paths and line counts.

2. **Given** a preview of matched files, **when** the developer renders the result as
   markdown, **then** each file appears as a fenced block with its path as a header
   and line numbers preserved.

3. **Given** a query that matches nothing, **when** the developer runs it, **then**
   the tool reports zero matches and does not produce an empty bundle.

---

### User Story 2 — Save and Reuse a Lens (Priority: P2)

A developer has refined a query that captures the right code slice for a recurring
task. They save it under a name, then run it again later against the current repo
state without having to reconstruct the query.

**Why this priority**: Reuse is what distinguishes CatLens from a one-off grep.
Without save/reuse, the tool is a convenience, not a workflow asset.

**Independent Test**: Save a query by name. Close and reopen the terminal. Run the
saved lens by name against the same repo. Confirm the output matches a fresh run of
the same query.

**Acceptance Scenarios**:

1. **Given** a working query, **when** the developer saves it with a chosen name,
   **then** the lens is persisted locally and can be listed by name.

2. **Given** a saved lens, **when** the developer runs it by name, **then** it
   executes against the current repo state and produces the same output as the
   original inline query would.

3. **Given** multiple saved lenses with similar names, **when** the developer types
   an ambiguous prefix, **then** the tool presents matching options for selection
   rather than failing or guessing.

---

### User Story 3 — MCP Query from an AI Agent (Priority: P3)

An AI agent (via MCP) needs to retrieve a task-relevant code slice from a local
repo without a human constructing the query manually. The agent issues a structured
query over MCP and receives a code-oriented result.

**Why this priority**: The strategic frontend. Required for CatLens to function in
agentic workflows, but the core must be solid first.

**Independent Test**: Issue a structured MCP query equivalent to a known CLI query.
Confirm the selection result is identical to what the CLI returns for the same query.

**Acceptance Scenarios**:

1. **Given** a running MCP server, **when** an agent sends a structured query,
   **then** the server returns a selection result with the same files and sections
   as the equivalent CLI query.

2. **Given** saved lenses in the repo, **when** an agent calls `list_lenses`,
   **then** it receives the current set of saved lens names and metadata.

3. **Given** a saved lens name, **when** an agent calls `run_lens`, **then**
   the server returns the rendered result of that lens against current repo state.

---

### User Story 4 — Query Authoring with Feedback (Priority: P4)

A developer is building a non-trivial query with boolean composition (e.g. "files
modified in the last 30 days that contain this keyword, excluding test files"). They
use preview, lint, and format feedback to refine the query iteratively before saving it.

**Why this priority**: Boolean composition is a core differentiator. Without authoring
feedback, complex queries are too fragile to trust and maintain.

**Independent Test**: Write a query with a deliberate lint issue (e.g., contradictory
clauses). Confirm the linter reports it. Fix it. Confirm the formatter produces canonical
output. Confirm preview shows the expected file set.

**Acceptance Scenarios**:

1. **Given** a query with a contradictory clause, **when** the developer lints it,
   **then** the linter reports the contradiction with enough context to fix it.

2. **Given** a valid query, **when** the developer formats it, **then** the output is
   canonical and re-formatting the output produces the same result (idempotent).

3. **Given** a malformed query, **when** the developer tries to run it, **then**
   the tool rejects it with a parse error before touching the repo.

---

### Edge Cases

- What happens when a query matches more than a reasonable threshold of the repo?
  (Tool should warn and require acknowledgement or a `--force` flag.)
- How does the tool behave when run outside a git repository?
  (Non-git predicates should still work; git predicates should fail with a clear message.)
- What if a saved lens name conflicts with an existing one?
  (Tool should prompt to overwrite or save under a different name.)
- What if a tagged section is opened but never closed?
  (Tool should warn about unclosed sections and skip or include the rest of the file,
  whichever is safer, with a warning.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to run an inline DSL query from the terminal and receive
  rendered output in a single command.
- **FR-002**: The query language MUST support selection by: explicit file path, glob
  pattern, file extension, keyword match, tag/marker comment (top-of-file, inline,
  open/close section), current diff, commit message content, authorship, and file age.
- **FR-003**: The query language MUST support boolean composition: `and`, `or`/`any`,
  `not`, `unless`, and arbitrary nesting/grouping.
- **FR-004**: Users MUST be able to preview matched files and estimated size before
  committing to a full render.
- **FR-005**: Users MUST be able to save a query as a named lens persisted to the local repo.
- **FR-006**: Users MUST be able to rerun a saved lens by name.
- **FR-007**: Users MUST be able to list all saved lenses for the current repo.
- **FR-008**: Ambiguous lens name prefixes MUST trigger fuzzy selection rather than
  silent failure or arbitrary choice.
- **FR-009**: The tool MUST support at minimum: file-list, markdown bundle, snippet bundle
  (with file path and line anchors), diff bundle, and structured JSON as output formats.
- **FR-010**: All rendered code output MUST include file paths; line numbers MUST be
  included where they preserve orientation.
- **FR-011**: The tool MUST validate every query before execution and surface parse
  errors with enough context to locate the problem.
- **FR-012**: The tool MUST provide canonical query formatting that is idempotent.
- **FR-013**: The tool MUST provide query linting with diagnostics for contradictory
  clauses, duplicate predicates, unreachable branches, suspiciously broad queries,
  and likely-zero-match queries.
- **FR-014**: The MCP server MUST expose: `list_lenses`, `run_lens`, `preview_lens`,
  `run_query`, and `render_selection` using the same underlying selection engine as
  the CLI.
- **FR-015**: The MCP server MUST accept queries as structured data (not raw DSL text)
  as its primary interface.

### Key Entities

- **Query**: A declarative expression of selection intent, extraction rules, and render
  directives. The authoritative internal form is a typed AST.
- **Lens**: A saved, named query artifact persisted to the local repo.
- **SelectionResult**: The stable intermediate result produced by the engine — contains
  matched files, sections, diffs, inclusion reasons, and stats. Both preview and render
  consume this.
- **FileHit**: A matched file with its inclusion reason.
- **SectionHit**: A matched range within a file (line start/end) with its inclusion reason.

## Success Criteria *(mandatory)*

- **SC-001**: A developer can compose and run an ad hoc query from the terminal, preview
  results, and render a pasteable bundle — end to end — without reading documentation
  beyond the CLI help output.
- **SC-002**: A saved lens runs against current repo state and produces the same selection
  as the equivalent inline query.
- **SC-003**: An MCP query and its equivalent CLI query produce the same `SelectionResult`
  for the same repo state.
- **SC-004**: A malformed or contradictory query is rejected before any repo access occurs.
- **SC-005**: The formatter is idempotent: formatting a query twice produces the same output.
- **SC-006**: Rendered output for any format always includes file paths; no code block
  appears without its source location.
- **SC-007**: Queries using boolean composition (and/or/not/unless/nesting) behave
  identically across CLI and MCP frontends.

## Assumptions

- The tool runs locally; no cloud connectivity is required or assumed.
- The target repo is a standard git repository for git-aware predicates; non-git repos
  are supported for non-git predicates.
- The primary user is a developer working alone or in a small team.
- Lens storage is repo-local (e.g., a `.catlens/` directory); lenses may optionally be
  committed to source control.
- "Fast enough" is the performance standard — no specific throughput target is required
  for V1; correctness and determinism take precedence over raw speed.
- The tool does not transmit code to any external service; it produces local output
  for the user to share manually.
- Fuzzy lens disambiguation requires `fzf` to be available; if absent, the tool falls
  back to a numbered selection prompt.
