# Tasks: CatLens Query Engine

**Input**: Design documents from `specs/001-catlens-query-engine/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Integration tests are included (fixture-based, as specified in plan.md). Unit tests
and contract tests are not included unless explicitly requested.

**Organization**: Phases 1–2 build shared infrastructure. Phases 3–6 correspond to the four
user stories in priority order. Phase 7 expands the predicate set after all user stories are
independently testable. Phase 8 polishes cross-cutting concerns.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in same phase)
- **[Story]**: Which user story this task belongs to (US1–US4)
- All file paths are relative to the repo root

---

## Phase 1: Setup

**Purpose**: Create the monorepo skeleton, TypeScript config, and dev tooling.

- [ ] T001 Create top-level directory structure: `packages/core/`, `packages/cli/`, `packages/mcp/`, `test/fixtures/`, `specs/`, `docs/`
- [ ] T002 Create root `package.json` with npm workspaces config pointing to `packages/*` and dev scripts: `dev`, `test`, `test:watch`, `test:integration`, `typecheck`, `lint`, `format`, `build`
- [ ] T003 [P] Create `tsconfig.base.json` at repo root: strict mode, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, `target: ES2022`
- [ ] T004 [P] Create `packages/core/package.json` (name: `@catlens/core`, type: module) and `packages/core/tsconfig.json` extending `../../tsconfig.base.json`
- [ ] T005 [P] Create `packages/cli/package.json` (name: `@catlens/cli`, type: module, bin: `catlens`) and `packages/cli/tsconfig.json` extending `../../tsconfig.base.json`, with `@catlens/core` as dependency
- [ ] T006 [P] Create `packages/mcp/package.json` (name: `@catlens/mcp`, type: module) and `packages/mcp/tsconfig.json` extending `../../tsconfig.base.json`, with `@catlens/core` as dependency
- [ ] T007 Create `vitest.config.ts` at repo root: test glob `packages/*/src/**/*.test.ts`, coverage provider v8
- [ ] T008 [P] Create `vitest.integration.config.ts` at repo root: test glob `test/integration/**/*.test.ts`, pool: forks, timeout: 30s

---

## Phase 2: Foundational

**Purpose**: Core data types, fixture repos, integration harness, file discovery, and basic
fact collection. No user story implementation can begin until this phase is complete.

**⚠️ CRITICAL**: All subsequent phases depend on this phase.

- [ ] T009 Create `test/fixtures/ts-app/` fixture repo: ~10 TypeScript and TSX files, mix of imports/exports, some with keyword "checkout", some with keyword "api", varied file ages (use hardcoded file dates or commits)
- [ ] T010 [P] Create `test/fixtures/tagged-sections/` fixture repo: files with `// catty:start` / `// catty:end` markers, files with top-of-file `// @catty:api` tags, and a file with an unclosed marker
- [ ] T011 [P] Create `test/fixtures/git-history/` fixture repo: at least 3 commits, files by different authors, files with varying last-modified dates
- [ ] T012 [P] Create `test/fixtures/ignored-files/` fixture repo: `.gitignore` excluding `*.log` and `node_modules/`, a `node_modules/` directory with a TS file inside, a `.log` file
- [ ] T013 Create `test/integration/helpers.ts`: shared fixture repo path resolution, `runQuery(root, query)` helper that calls engine directly, `runCLI(args)` helper that spawns CLI as child process
- [ ] T014 Define all AST types in `packages/core/src/query/ast.ts` per `specs/001-catlens-query-engine/data-model.md` (Query, SelectionNode, AndNode, OrNode, NotNode, UnlessNode, all PredicateNode variants, ExtractDirective, RenderDirective, Duration)
- [ ] T015 Define SelectionResult and related types in `packages/core/src/query/result.ts` (SelectionResult, FileHit, SectionHit, DiffHit, Reason, Stats, FileFacts, GitFacts) per `specs/001-catlens-query-engine/data-model.md`
- [ ] T016 Implement candidate file discovery in `packages/core/src/repo/discover.ts`: walk repo root with `fast-glob`, load `.gitignore` via `ignore` package, return relative paths; handle nested `.gitignore` files
- [ ] T017 Implement basic facts collector in `packages/core/src/facts/collect.ts`: for each candidate path, read content, count lines, extract extension; return `FileFacts[]` (no git facts yet)
- [ ] T018 Export public API from `packages/core/src/index.ts`: re-export all types and the pipeline stage functions introduced so far

**Checkpoint**: Fixture repos exist. AST types compile. Discovery returns paths. Facts collector returns FileFacts. Integration harness runs.

---

## Phase 3: User Story 1 — Ad Hoc Query and Render (Priority: P1) 🎯 MVP

**Goal**: A developer can run a one-liner DSL query from the terminal, preview matched files,
and render a pasteable markdown bundle.

**Independent Test**: Run `catlens 'and(ext(ts), keyword("checkout"))' --preview` against
`test/fixtures/ts-app/`. Confirm matched files appear. Then run without `--preview` and
confirm markdown output contains those files with correct paths and fenced code blocks.

### Implementation for User Story 1

- [ ] T019 [US1] Implement recursive descent parser in `packages/core/src/query/parser.ts`: parse DSL string → Query AST for predicates: `ext`, `keyword`, `file`, `glob` (stub), operators: `and`, `or`/`any`, `not`; include source spans in parse errors; export `parse(input: string): Query`
- [ ] T020 [P] [US1] Implement boolean evaluator in `packages/core/src/engine/evaluate.ts`: `evaluateNode(node: SelectionNode, facts: FileFacts): boolean` for `AndNode`, `OrNode`, `NotNode`; drives predicate dispatch
- [ ] T021 [P] [US1] Implement ext predicate in `packages/core/src/engine/predicates/ext.ts`: match `FileFacts.extension` against `ExtPredicate.extensions`
- [ ] T022 [P] [US1] Implement keyword predicate in `packages/core/src/engine/predicates/keyword.ts`: substring search in `FileFacts.content`; case-insensitive by default
- [ ] T023 [P] [US1] Implement file predicate in `packages/core/src/engine/predicates/file.ts`: match `FileFacts.path` against `FilePathPredicate.paths`
- [ ] T024 [US1] Implement SelectionResult builder in `packages/core/src/engine/result.ts`: `buildResult(query, candidates, repoRoot): SelectionResult`; runs discover → collect → evaluate; populates FileHit with reasons and stats
- [ ] T025 [P] [US1] Implement preview renderer in `packages/core/src/render/preview.ts`: format `SelectionResult` as terminal summary (file count, total lines, estimated KB, per-file row with path + line count + reasons)
- [ ] T026 [P] [US1] Implement markdown renderer in `packages/core/src/render/markdown.ts`: for each FileHit, emit `## {path}` header + fenced code block with language from extension + content; include line numbers as comments when `lineNumbers: true`
- [ ] T027 [P] [US1] Implement file-list renderer in `packages/core/src/render/file-list.ts`: emit one relative path per line
- [ ] T028 [P] [US1] Implement JSON renderer in `packages/core/src/render/json.ts`: emit `SelectionResult` as formatted JSON
- [ ] T029 [US1] Wire CLI entrypoint in `packages/cli/src/index.ts` using `commander`: accept inline DSL string as positional arg; flags: `--preview`/`-p`, `--output`/`-o` (markdown|file-list|json; default: markdown), `--root` (default: cwd), `--line-numbers`/`--no-line-numbers`, `--force`, `--reasons`/`-r`; add large-result guard (warn + exit 5 if estimatedChars > 200000 without --force); exit codes per `contracts/cli-schema.md`
- [ ] T030 [US1] Add integration tests in `test/integration/us1-ad-hoc-query.test.ts`: keyword match, ext match, and/or/not composition, --preview output contains correct file list, markdown render includes file paths and fenced blocks, zero-match query exits with code 3

**Checkpoint**: `catlens 'and(ext(ts), keyword("checkout"))' --preview` works against ts-app fixture. Markdown render produces correct output. Exit codes are correct.

---

## Phase 4: User Story 2 — Save and Reuse a Lens (Priority: P2)

**Goal**: A developer saves a useful query as a named lens, then reruns it by name.

**Independent Test**: Save `and(ext(ts), keyword("checkout"))` as `checkout-ts`. Close terminal,
reopen, run `catlens checkout-ts`. Output must match a fresh run of the same inline query.

### Implementation for User Story 2

- [ ] T031 [US2] Implement lens store in `packages/core/src/lenses/store.ts`: `saveLens(root, name, query)` writes to `{root}/.catlens/{name}.json`; `loadLens(root, name)` reads and validates; `listLenses(root)` returns all `Lens[]`; `deleteLens(root, name)` removes file; validate name matches `[a-z0-9][a-z0-9-]*`
- [ ] T032 [US2] Implement lens serialization in `packages/core/src/lenses/format.ts`: `serializeLens(lens: Lens): string` (JSON with `$schema`, `name`, `description`, `createdAt`, `updatedAt`, `query`); `deserializeLens(json: string): Lens`; roundtrip must preserve Query AST exactly
- [ ] T033 [US2] Implement fuzzy lens disambiguation in `packages/core/src/lenses/fuzzy.ts`: `disambiguate(matches: string[]): Promise<string>`; spawn `fzf` via `child_process` if available; fall back to numbered `readline` prompt; return selected name
- [ ] T034 [US2] Add `--save <name>` flag and lens-run-by-name to `packages/cli/src/index.ts`: detect whether positional arg is a saved lens name (load from `.catlens/`), ambiguous prefix (fuzzy select), or inline DSL (parse); `--save` runs query then saves result
- [ ] T035 [P] [US2] Add `catlens lens list` subcommand in `packages/cli/src/commands/lens.ts`: list saved lenses with name and createdAt; format as table
- [ ] T036 [P] [US2] Add `catlens lens rm <name>` subcommand in `packages/cli/src/commands/lens.ts`: prompt for confirmation, then call `deleteLens`; exit 4 if lens not found
- [ ] T037 [P] [US2] Add `catlens lens show <name>` subcommand in `packages/cli/src/commands/lens.ts`: load lens, run through formatter (from US4 — if not yet available, print raw DSL via simple serializer), print to stdout
- [ ] T038 [US2] Add integration tests in `test/integration/us2-lens-save-reuse.test.ts`: save/load roundtrip produces identical SelectionResult, prefix resolution finds correct lens, ambiguous prefix triggers disambiguator, lens rm removes file, listing shows all saved lenses

**Checkpoint**: Save a lens, rerun by name, confirm output matches inline query.

---

## Phase 5: User Story 3 — MCP Query from an AI Agent (Priority: P3)

**Goal**: An AI agent issues a structured JSON query over MCP and receives the same
SelectionResult as the equivalent CLI query.

**Independent Test**: Start MCP server against `test/fixtures/ts-app/`. Issue `run_query`
with the JSON AST for `and(ext(ts), keyword("checkout"))`. Compare result to CLI output
for the same query on the same fixture.

### Implementation for User Story 3

- [ ] T039 [US3] Set up MCP server in `packages/mcp/src/server.ts` using `@modelcontextprotocol/sdk`: stdio transport; accept `--root <path>` CLI arg; register all tools; export `startServer(root: string)`
- [ ] T040 [P] [US3] Implement `list_lenses` MCP tool in `packages/mcp/src/tools/list-lenses.ts`: delegate to `listLenses` from `@catlens/core`; return tool result per `contracts/mcp-schema.md`
- [ ] T041 [P] [US3] Implement `run_lens` MCP tool in `packages/mcp/src/tools/run-lens.ts`: load lens by name, run through core engine, render with requested format; error shape per `contracts/mcp-schema.md`
- [ ] T042 [P] [US3] Implement `preview_lens` MCP tool in `packages/mcp/src/tools/preview-lens.ts`: load lens, run engine, return FileHit[] and Stats (no full render)
- [ ] T043 [US3] Implement `run_query` MCP tool in `packages/mcp/src/tools/run-query.ts`: accept Query AST as JSON input; validate structure; run through core engine; render with requested format
- [ ] T044 [P] [US3] Implement `render_selection` MCP tool in `packages/mcp/src/tools/render-selection.ts`: accept a `SelectionResult` object and a format; call renderer; return rendered string
- [ ] T045 [P] [US3] Implement `format_query` MCP tool in `packages/mcp/src/tools/format-query.ts`: accept DSL string; parse → format; return canonical DSL (stub formatter if US4 not yet complete)
- [ ] T046 [P] [US3] Implement `parse_query` MCP tool in `packages/mcp/src/tools/parse-query.ts`: accept DSL string; parse → return Query AST as JSON
- [ ] T047 [US3] Add structured error handling in `packages/mcp/src/errors.ts`: map engine errors to MCP error codes (PARSE_ERROR, VALIDATION_ERROR, LENS_NOT_FOUND, NO_MATCHES, GIT_UNAVAILABLE) per `contracts/mcp-schema.md`
- [ ] T048 [US3] Add parity integration tests in `test/integration/us3-mcp-parity.test.ts`: start MCP server in-process; issue `run_query` for same AST as CLI query; assert identical SelectionResult; test `list_lenses` after saving a lens via CLI

**Checkpoint**: MCP server starts. `run_query` with `and(ext(ts), keyword("checkout"))` returns same files as CLI. `list_lenses` returns correct list.

---

## Phase 6: User Story 4 — Query Authoring with Feedback (Priority: P4)

**Goal**: A developer uses lint, format, and validate feedback to refine a complex query.
Malformed queries are rejected before any repo access.

**Independent Test**: Run `catlens lint 'and(ext(ts), not(ext(ts)))'`. Confirm linter reports
the contradiction. Run `catlens fmt 'and(ext(ts,tsx),keyword("x"))'` twice and confirm
identical output both times.

### Implementation for User Story 4

- [ ] T049 [US4] Implement validator in `packages/core/src/query/validator.ts`: `validate(query: Query): ValidationResult`; checks: unknown predicate types, wrong argument count, wrong argument types, empty and/or children, invalid duration format; run with source spans where available
- [ ] T050 [US4] Wire validator into engine execution in `packages/core/src/engine/result.ts`: call `validate(query)` before discovery; throw `ValidationError` with formatted message on failure; MCP and CLI both surface this as an error before touching the filesystem
- [ ] T051 [US4] Implement formatter in `packages/core/src/query/formatter.ts`: `format(query: Query): string`; canonical indentation (2-space), canonical operator names (`or` not `any`), extensions sorted and unquoted, strings double-quoted; idempotent (format(format(q)) === format(q))
- [ ] T052 [US4] Implement linter in `packages/core/src/query/linter.ts`: `lint(query: Query): LintResult`; rules: `duplicate-predicate` (same predicate+args appears twice in same and/or group), `contradictory-branches` (and containing a node and its not), `empty-group` (and/or with zero children), `always-empty` (and contains not(x) and x for same x), `suspiciously-broad` (single ext() with no other narrowing predicates), `likely-zero-match` (not wrapping the only predicate); severity: error for contradictions, warning for others
- [ ] T053 [P] [US4] Add `catlens parse <query>` subcommand in `packages/cli/src/commands/parse.ts`: parse DSL, print AST as JSON to stdout; exit 1 on parse error with message to stderr
- [ ] T054 [P] [US4] Add `catlens fmt <query>` subcommand in `packages/cli/src/commands/fmt.ts`: parse DSL, format, print canonical DSL to stdout; exit 1 on parse error
- [ ] T055 [P] [US4] Add `catlens lint <query>` subcommand in `packages/cli/src/commands/lint.ts`: parse, validate, lint; print diagnostics (severity + rule + message); exit 0 if no errors, exit 2 if lint errors, exit 1 if parse/validation failure
- [ ] T056 [US4] Add integration tests in `test/integration/us4-query-authoring.test.ts`: validator rejects unknown predicate, validator rejects wrong arity, linter reports contradictory-branches, formatter is idempotent over 3 iterations, fmt subcommand exits 1 on bad DSL, lint subcommand exits 2 on lint error

**Checkpoint**: `catlens lint 'and(ext(ts), not(ext(ts)))'` reports contradiction. `catlens fmt` is idempotent. Malformed query is rejected before repo scan.

---

## Phase 7: Predicate Expansion

**Purpose**: Add the full predicate set required by FR-002. All four user stories are
independently functional before this phase begins.

- [ ] T057 [P] Implement glob predicate in `packages/core/src/engine/predicates/glob.ts`: use `fast-glob.convertPathToPattern` + `minimatch` to match `FileFacts.path` against `GlobPredicate.pattern`; add parser support in `packages/core/src/query/parser.ts`
- [ ] T058 [P] Implement tag predicate in `packages/core/src/engine/predicates/tag.ts`: scan `FileFacts.content` for `tag` string; scope `file` = first 10 lines only, scope `anywhere` = full content; add to parser
- [ ] T059 Implement tagged_section predicate + SectionHit extraction in `packages/core/src/engine/predicates/tagged-section.ts`: scan content for open/close marker pairs; capture `SectionHit` with startLine/endLine/tag; update `buildResult` in `packages/core/src/engine/result.ts` to populate `SelectionResult.sections`
- [ ] T060 Implement git facts collection in `packages/core/src/facts/git.ts` using `simple-git`: `collectGitFacts(root, paths): Promise<Map<string, GitFacts>>`; collect lastAuthor, lastAuthorEmail, lastCommitDate, lastCommitMessage, inCurrentDiff, diffPatch; gracefully degrade when git is unavailable
- [ ] T061 [P] Implement authored_by predicate in `packages/core/src/engine/predicates/authored-by.ts`: match `GitFacts.lastAuthorEmail` or `lastAuthor` as substring (case-insensitive); add to parser; require git facts (error if git unavailable)
- [ ] T062 [P] Implement older_than / newer_than predicates in `packages/core/src/engine/predicates/age.ts`: compare `GitFacts.lastCommitDate` against computed threshold from `Duration`; add both to parser
- [ ] T063 [P] Implement diff predicate in `packages/core/src/engine/predicates/diff.ts`: match files where `GitFacts.inCurrentDiff` is true; update `buildResult` to populate `SelectionResult.diffs` with `DiffHit`; add to parser
- [ ] T064 [P] Implement commit_message predicate in `packages/core/src/engine/predicates/commit-message.ts`: substring match against `GitFacts.lastCommitMessage`; add to parser
- [ ] T065 [P] Implement diff renderer in `packages/core/src/render/diff.ts`: emit unified diff patches from `SelectionResult.diffs`; include file path header
- [ ] T066 [P] Implement snippets renderer in `packages/core/src/render/snippets.ts`: emit `SectionHit` ranges as fenced blocks with file path + line range anchors; fall back to full FileHit when no sections
- [ ] T067 Implement unless at top level: add `UnlessNode` parsing in `packages/core/src/query/parser.ts` (top-level `unless(...)` modifier after main selection); add evaluation in `packages/core/src/engine/evaluate.ts`; add formatter support
- [ ] T068 Add integration tests for predicate expansion in `test/integration/predicate-expansion.test.ts`: glob matches correct paths, tag predicate respects scope, tagged_section captures correct line ranges, git predicates skip gracefully on non-git fixture, unless subtracts correct files, diff renderer includes patch text

**Checkpoint**: All FR-002 predicates implemented. Unless composition works. Diff and snippets renderers produce correct output.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span multiple user stories; harden the complete surface.

- [ ] T069 [P] Add `--reasons` flag output to preview renderer in `packages/core/src/render/preview.ts`: when enabled, show per-file reason details below each file row
- [ ] T070 [P] Implement tiered linting in `packages/core/src/query/linter.ts`: lower severity for ad hoc CLI queries (`--strict` flag upgrades severity); saved lenses always run at full severity
- [ ] T071 Add exit code enforcement tests in `test/integration/exit-codes.test.ts`: verify all exit codes from `contracts/cli-schema.md` are correct (0, 1, 2, 3, 4, 5)
- [ ] T072 [P] Add `--explain` flag to CLI in `packages/cli/src/index.ts`: print inclusion reasons for each file in verbose format after render
- [ ] T073 [P] Write `docs/predicates.md`: document all predicates with examples; copy from `contracts/dsl-grammar.md` and expand with real fixture examples
- [ ] T074 Run quickstart.md validation: execute every command in `specs/001-catlens-query-engine/quickstart.md` against the real repo; fix any discrepancies

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — MVP target
- **US2 (Phase 4)**: Depends on Phase 2; may start after Phase 3 core engine tasks (T019–T024) complete
- **US3 (Phase 5)**: Depends on Phase 2; may start after Phase 3 is complete
- **US4 (Phase 6)**: Depends on Phase 2; may start in parallel with Phase 4
- **Predicate Expansion (Phase 7)**: Depends on Phases 3–6 all complete
- **Polish (Phase 8)**: Depends on Phase 7 completion

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories — implement first
- **US2 (P2)**: No dependency on US1 output; only needs Phase 2 foundation
- **US3 (P3)**: No dependency on US1 or US2; needs Phase 2 foundation + at least one renderer (Phase 3 T025–T028)
- **US4 (P4)**: No dependency on US1/US2/US3; needs Phase 2 foundation + parser (Phase 3 T019)

### Within Each User Story

- Parser before evaluator (T019 before T020–T023)
- Evaluator before SelectionResult builder (T020–T023 before T024)
- SelectionResult builder before renderers (T024 before T025–T028)
- Renderers before CLI wiring (T025–T028 before T029)
- Implementation before integration tests (last task in each phase)

### Parallel Opportunities

- All Phase 1 [P] tasks can run simultaneously
- All Phase 2 fixture creation tasks (T009–T012) can run in parallel
- Within Phase 3: T020–T023 (predicate evaluators) can run in parallel after T019
- Within Phase 3: T025–T028 (renderers) can run in parallel after T024
- Within Phase 5: T040–T046 (MCP tools) can run in parallel after T039
- Within Phase 6: T049–T052 can run sequentially; T053–T055 can run in parallel after T051

---

## Parallel Example: Phase 3 (US1)

```bash
# After T019 (parser) completes, launch evaluators in parallel:
Task: "T020 [US1] Implement boolean evaluator in packages/core/src/engine/evaluate.ts"
Task: "T021 [P] [US1] Implement ext predicate in packages/core/src/engine/predicates/ext.ts"
Task: "T022 [P] [US1] Implement keyword predicate in packages/core/src/engine/predicates/keyword.ts"
Task: "T023 [P] [US1] Implement file predicate in packages/core/src/engine/predicates/file.ts"

# After T024 (result builder) completes, launch renderers in parallel:
Task: "T025 [P] [US1] Implement preview renderer in packages/core/src/render/preview.ts"
Task: "T026 [P] [US1] Implement markdown renderer in packages/core/src/render/markdown.ts"
Task: "T027 [P] [US1] Implement file-list renderer in packages/core/src/render/file-list.ts"
Task: "T028 [P] [US1] Implement JSON renderer in packages/core/src/render/json.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 (T019–T030)
4. **STOP and VALIDATE**: `catlens 'and(ext(ts), keyword("checkout"))' --preview` works against ts-app fixture; markdown render is correct
5. Share / demo the MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. **US1** → `catlens` works for inline ad hoc queries → demo MVP
3. **US2** → `catlens --save` + lens reuse → save useful queries
4. **US3** → MCP server → AI agents can query the repo
5. **US4** → lint/fmt/validate → authoring feedback loop closes
6. **Predicate Expansion** → full FR-002 predicate set
7. **Polish** → hardened, documented, exit codes verified

### Rock-Solid Start Definition (from initial-plan.md)

The project is ready to widen scope when ALL of the following are true:

- AST exists and is the only query model ✓ (Phase 2)
- `SelectionResult` is stable and used by both preview and render ✓ (Phase 3)
- CLI works end-to-end for real queries ✓ (Phase 3)
- Saved lenses work ✓ (Phase 4)
- Fixture-based integration tests exist ✓ (Phase 3–4)
- Validator/formatter/linter exist ✓ (Phase 6)
- Core has no frontend leakage ✓ (enforced by package.json dependencies)
- MCP starts only after core parity is provable ✓ (Phase 5)

---

## Notes

- `[P]` tasks = no file conflicts, no dependencies on incomplete tasks in same phase
- `[Story]` label maps task to user story for traceability
- All fixture repos in `test/fixtures/` are plain directories (not git repos unless noted)
- `test/fixtures/git-history/` is the only fixture that requires git commits
- Avoid: vague tasks, same-file conflicts within a parallel group, cross-story dependencies that break independent testability
- The `packages/core` import rule (no frontend imports) is enforced by package.json, not by convention
