# Data Model: CatLens Query Engine

**Phase**: 1
**Date**: 2026-04-11

This document defines the canonical data types that flow through the shared core
pipeline. All frontends (CLI, MCP) produce and consume these types exclusively.

---

## 1. Query AST

The `Query` type is the canonical internal representation of any user intent.
The DSL, lens files, and MCP JSON all compile to this structure.

```typescript
// Root query type
type Query = {
  selection: SelectionNode;     // required: the boolean selection expression
  extract?: ExtractDirective;   // optional: section/diff extraction rules
  render?: RenderDirective;     // optional: output format preferences
};

// ── Selection nodes ──────────────────────────────────────────────────────────

type SelectionNode =
  | AndNode
  | OrNode       // also: any()
  | NotNode
  | UnlessNode
  | PredicateNode;

type AndNode = {
  type: 'and';
  children: SelectionNode[];   // minimum 2
};

type OrNode = {
  type: 'or';                  // 'any' in DSL is an alias
  children: SelectionNode[];   // minimum 2
};

type NotNode = {
  type: 'not';
  child: SelectionNode;
};

type UnlessNode = {
  type: 'unless';
  selection: SelectionNode;    // the base selection
  exclusion: SelectionNode;    // what to subtract from it
};

// ── Predicate leaf nodes ─────────────────────────────────────────────────────

type PredicateNode =
  | FilePathPredicate
  | GlobPredicate
  | ExtPredicate
  | KeywordPredicate
  | TagPredicate
  | TaggedSectionPredicate
  | DiffPredicate
  | CommitMessagePredicate
  | AuthoredByPredicate
  | OlderThanPredicate
  | NewerThanPredicate;

type FilePathPredicate = {
  type: 'file';
  paths: string[];             // one or more explicit relative paths
};

type GlobPredicate = {
  type: 'glob';
  pattern: string;             // single glob pattern
};

type ExtPredicate = {
  type: 'ext';
  extensions: string[];        // e.g. ['ts', 'tsx'] — without leading dot
};

type KeywordPredicate = {
  type: 'keyword';
  term: string;                // substring match against file content
  caseSensitive?: boolean;     // default: false
};

type TagPredicate = {
  type: 'tag';
  tag: string;                 // tag to look for (e.g. 'catty:task')
  scope: 'file' | 'anywhere'; // 'file' = top of file only; 'anywhere' = anywhere
};

type TaggedSectionPredicate = {
  type: 'tagged_section';
  openTag: string;             // open marker text
  closeTag?: string;           // close marker (defaults to matching close form)
};

type DiffPredicate = {
  type: 'diff';
  ref?: string;                // git ref to diff against (default: HEAD)
};

type CommitMessagePredicate = {
  type: 'commit_message';
  term: string;                // substring match against commit messages touching file
  since?: string;              // limit to commits since this ref/duration
};

type AuthoredByPredicate = {
  type: 'authored_by';
  author: string;              // email or name substring
};

type OlderThanPredicate = {
  type: 'older_than';
  duration: Duration;          // e.g. '365d', '12w', '6m'
};

type NewerThanPredicate = {
  type: 'newer_than';
  duration: Duration;
};

type Duration = {
  value: number;
  unit: 'd' | 'w' | 'm' | 'y';  // days, weeks, months, years
};

// ── Extraction directives ────────────────────────────────────────────────────

type ExtractDirective = {
  sections?: TaggedSectionExtract[];
  includeDiff?: boolean;       // include git diff for matched files
};

type TaggedSectionExtract = {
  tags: string[];              // which tagged sections to extract
};

// ── Render directives ────────────────────────────────────────────────────────

type RenderDirective = {
  format: RenderFormat;
  lineNumbers?: boolean;       // include line numbers in output (default: true)
};

type RenderFormat = 'markdown' | 'file-list' | 'snippets' | 'diff' | 'json';
```

---

## 2. SelectionResult

`SelectionResult` is the stable boundary between the engine and all renderers.
Both preview and full render consume this type. Renderers MUST NOT re-query the repo.

```typescript
type SelectionResult = {
  query: Query;                // the query that produced this result
  repoRoot: string;            // absolute path to the repo root
  files: FileHit[];
  sections: SectionHit[];
  diffs: DiffHit[];
  stats: Stats;
};

type FileHit = {
  path: string;                // relative to repoRoot
  reasons: Reason[];
  lineCount: number;
  content?: string;            // populated if content was read during evaluation
};

type SectionHit = {
  path: string;                // relative to repoRoot
  startLine: number;           // 1-indexed, inclusive
  endLine: number;             // 1-indexed, inclusive
  tag?: string;                // the tag that matched (if tagged section)
  reasons: Reason[];
  content?: string;            // the extracted section text
};

type DiffHit = {
  path: string;
  patch: string;               // unified diff format
  reasons: Reason[];
};

type Reason = {
  predicate: string;           // e.g. 'keyword', 'ext', 'tagged_section'
  detail?: string;             // human-readable context, e.g. 'matched "checkout"'
};

type Stats = {
  fileCount: number;
  sectionCount: number;
  diffCount: number;
  totalLines: number;
  estimatedChars: number;
};
```

---

## 3. Lens

A `Lens` is a saved, named query persisted to `.catlens/{name}.json`.

```typescript
type Lens = {
  name: string;                // [a-z0-9-]+ — matches filename without extension
  description?: string;        // optional human-readable description
  query: Query;                // the full AST
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
};
```

The lens file format is defined in `contracts/lens-format.md`.

---

## 4. Pipeline stage interfaces

These interfaces define the contract between pipeline stages.
All implementations live in `packages/core`.

```typescript
// Stage 1: parse DSL string or JSON → Query AST
interface Parser {
  parse(input: string | object): Query;
}

// Stage 2: discover candidate file paths
interface Discoverer {
  discover(repoRoot: string, query: Query): Promise<string[]>;
}

// Stage 3: collect facts about candidate files
interface FactCollector {
  collect(paths: string[], repoRoot: string, query: Query): Promise<FileFacts[]>;
}

type FileFacts = {
  path: string;
  content: string;
  lineCount: number;
  extension: string;
  gitFacts?: GitFacts;
};

type GitFacts = {
  lastAuthor?: string;
  lastAuthorEmail?: string;
  lastCommitDate?: Date;
  lastCommitMessage?: string;
  inCurrentDiff: boolean;
  diffPatch?: string;
};

// Stage 4: evaluate selection expression → SelectionResult
interface Engine {
  evaluate(
    query: Query,
    candidates: FileFacts[],
    repoRoot: string
  ): SelectionResult;
}

// Stage 5: render SelectionResult → string
interface Renderer {
  render(result: SelectionResult, options?: RenderOptions): string;
}

type RenderOptions = {
  lineNumbers?: boolean;
  maxFiles?: number;
};
```

---

## 5. Validation and lint types

```typescript
type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

type ValidationError = {
  message: string;
  location?: SourceSpan;
};

type LintResult = {
  diagnostics: LintDiagnostic[];
};

type LintDiagnostic = {
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule: string;               // e.g. 'duplicate-predicate', 'always-empty'
  location?: SourceSpan;
};

type SourceSpan = {
  offset: number;
  length: number;
  line: number;
  column: number;
};
```

---

## 6. Entity relationships

```text
Query
 └── SelectionNode (tree: and/or/not/unless/predicate)
 └── ExtractDirective?
 └── RenderDirective?

SelectionResult
 ├── query: Query          (the producing query)
 ├── files: FileHit[]      (file-level matches)
 ├── sections: SectionHit[] (section-level matches within files)
 ├── diffs: DiffHit[]      (git diff patches for matched files)
 └── stats: Stats          (aggregate counts and size estimates)

Lens
 └── query: Query          (stored AST — the lens IS a named query)

Pipeline (stages):
  Parser → Discoverer → FactCollector → Engine → SelectionResult → Renderer
```
