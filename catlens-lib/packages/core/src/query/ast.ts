// CatLens Query AST
// All frontends (CLI, MCP, lens files) compile to this representation.

export type Query = {
  selection: SelectionNode
  extract?: ExtractDirective
  render?: RenderDirective
}

// ── Selection nodes ────────────────────────────────────────────────────────

export type SelectionNode =
  | AndNode
  | OrNode
  | NotNode
  | UnlessNode
  | PredicateNode

export type AndNode = {
  readonly type: 'and'
  readonly children: readonly SelectionNode[]
}

export type OrNode = {
  readonly type: 'or'
  readonly children: readonly SelectionNode[]
}

export type NotNode = {
  readonly type: 'not'
  readonly child: SelectionNode
}

export type UnlessNode = {
  readonly type: 'unless'
  readonly selection: SelectionNode
  readonly exclusion: SelectionNode
}

// ── Predicate leaf nodes ───────────────────────────────────────────────────

export type PredicateNode =
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
  | NewerThanPredicate

export type FilePathPredicate = {
  readonly type: 'file'
  readonly paths: readonly string[]
}

export type GlobPredicate = {
  readonly type: 'glob'
  readonly pattern: string
}

export type ExtPredicate = {
  readonly type: 'ext'
  readonly extensions: readonly string[]
}

export type KeywordPredicate = {
  readonly type: 'keyword'
  readonly term: string
  readonly caseSensitive?: boolean
}

export type TagPredicate = {
  readonly type: 'tag'
  readonly tag: string
  readonly scope: 'file' | 'anywhere'
}

export type TaggedSectionPredicate = {
  readonly type: 'tagged_section'
  readonly openTag: string
  readonly closeTag?: string
}

export type DiffPredicate = {
  readonly type: 'diff'
  readonly ref?: string
}

export type CommitMessagePredicate = {
  readonly type: 'commit_message'
  readonly term: string
  readonly since?: string
}

export type AuthoredByPredicate = {
  readonly type: 'authored_by'
  readonly author: string
}

export type OlderThanPredicate = {
  readonly type: 'older_than'
  readonly duration: Duration
}

export type NewerThanPredicate = {
  readonly type: 'newer_than'
  readonly duration: Duration
}

export type Duration = {
  readonly value: number
  readonly unit: 'd' | 'w' | 'm' | 'y'
}

// ── Extraction directives ──────────────────────────────────────────────────

export type ExtractDirective = {
  readonly sections?: readonly TaggedSectionExtract[]
  readonly includeDiff?: boolean
}

export type TaggedSectionExtract = {
  readonly tags: readonly string[]
}

// ── Render directives ──────────────────────────────────────────────────────

export type RenderDirective = {
  readonly format: RenderFormat
  readonly lineNumbers?: boolean
}

export type RenderFormat = 'markdown' | 'file-list' | 'snippets' | 'diff' | 'json'
