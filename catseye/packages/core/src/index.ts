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

// Engine
export { buildResult } from './engine/result.js'
export { evaluate } from './engine/evaluate.js'

// Discovery and facts
export { discover } from './repo/discover.js'
export { collectFacts } from './facts/collect.js'

// Renderers
export { renderPreview } from './render/preview.js'
export { renderMarkdown } from './render/markdown.js'
export { renderFileList } from './render/file-list.js'
export { renderJson } from './render/json.js'
