// @catlens/core public API

// Types
export type { Query, SelectionNode, AndNode, OrNode, NotNode, UnlessNode } from './query/ast.js'
export type {
  PredicateNode,
  ExtPredicate,
  KeywordPredicate,
  FilePathPredicate,
  GlobPredicate,
  TagPredicate,
  TaggedSectionPredicate,
  DiffPredicate,
  CommitMessagePredicate,
  AuthoredByPredicate,
  OlderThanPredicate,
  NewerThanPredicate,
  Duration,
  ExtractDirective,
  RenderDirective,
  RenderFormat,
} from './query/ast.js'

export type {
  SelectionResult,
  FileHit,
  SectionHit,
  DiffHit,
  Reason,
  Stats,
  FileFacts,
  GitFacts,
  ValidationResult,
  ValidationError,
  LintResult,
  LintDiagnostic,
  SourceSpan,
} from './query/result.js'

// Parser
export { parse, ParseError } from './query/parser.js'

// Query tools
export { validate } from './query/validator.js'
export { format, formatSelection } from './query/formatter.js'
export { lint } from './query/linter.js'
export type { LintOptions } from './query/linter.js'

// Engine
export { buildResult } from './engine/result.js'
export { evaluate } from './engine/evaluate.js'

// Discovery and facts
export { discover } from './repo/discover.js'
export { collectFacts } from './facts/collect.js'
export { collectGitFacts } from './facts/git.js'

// Lens store
export type { Lens } from './lenses/types.js'
export { saveLens, loadLens, listLenses, deleteLens, findByPrefix } from './lenses/store.js'
export { serializeLens, deserializeLens } from './lenses/format.js'
export { disambiguate } from './lenses/fuzzy.js'

// Renderers
export { renderPreview } from './render/preview.js'
export { renderMarkdown } from './render/markdown.js'
export { renderFileList } from './render/file-list.js'
export { renderJson } from './render/json.js'
export { renderDiff } from './render/diff.js'
export { renderSnippets } from './render/snippets.js'
