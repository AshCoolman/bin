import type { Query } from './ast.js'

// SelectionResult is the stable boundary between the engine and all renderers.
// Renderers MUST NOT re-query the repo — they receive this and produce output only.

export type SelectionResult = {
  readonly query: Query
  readonly repoRoot: string
  readonly files: readonly FileHit[]
  readonly sections: readonly SectionHit[]
  readonly diffs: readonly DiffHit[]
  readonly stats: Stats
}

export type FileHit = {
  readonly path: string
  readonly reasons: readonly Reason[]
  readonly lineCount: number
  readonly content: string
}

export type SectionHit = {
  readonly path: string
  readonly startLine: number
  readonly endLine: number
  readonly tag?: string
  readonly reasons: readonly Reason[]
  readonly content: string
}

export type DiffHit = {
  readonly path: string
  readonly patch: string
  readonly reasons: readonly Reason[]
}

export type Reason = {
  readonly predicate: string
  readonly detail?: string
}

export type Stats = {
  readonly fileCount: number
  readonly sectionCount: number
  readonly diffCount: number
  readonly totalLines: number
  readonly estimatedChars: number
}

// Pipeline stage interfaces

export type FileFacts = {
  readonly path: string
  readonly content: string
  readonly lineCount: number
  readonly extension: string
  readonly mtime: Date
  readonly gitFacts?: GitFacts
}

export type GitFacts = {
  readonly lastAuthor?: string
  readonly lastAuthorEmail?: string
  readonly lastCommitDate?: Date
  readonly lastCommitMessage?: string
  readonly inCurrentDiff: boolean
  readonly diffPatch?: string
}

export type ValidationResult = {
  readonly valid: boolean
  readonly errors: readonly ValidationError[]
}

export type ValidationError = {
  readonly message: string
  readonly location?: SourceSpan
}

export type LintResult = {
  readonly diagnostics: readonly LintDiagnostic[]
}

export type LintDiagnostic = {
  readonly severity: 'error' | 'warning' | 'info'
  readonly message: string
  readonly rule: string
  readonly location?: SourceSpan
}

export type SourceSpan = {
  readonly offset: number
  readonly length: number
  readonly line: number
  readonly column: number
}
