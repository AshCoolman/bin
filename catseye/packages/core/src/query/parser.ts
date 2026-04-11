import type {
  Query,
  SelectionNode,
  AndNode,
  OrNode,
  NotNode,
  ExtPredicate,
  KeywordPredicate,
  FilePathPredicate,
  GlobPredicate,
  Duration,
  OlderThanPredicate,
  NewerThanPredicate,
  TagPredicate,
  AuthoredByPredicate,
  CommitMessagePredicate,
  DiffPredicate,
} from './ast.js'

// Recursive descent parser for the CatLens DSL.
// Parses a string into a Query AST.

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly offset: number,
  ) {
    super(message)
    this.name = 'ParseError'
  }
}

type Token =
  | { type: 'ident'; value: string; offset: number }
  | { type: 'string'; value: string; offset: number }
  | { type: 'lparen'; offset: number }
  | { type: 'rparen'; offset: number }
  | { type: 'comma'; offset: number }
  | { type: 'eof'; offset: number }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const ch = input[i]!

    // whitespace
    if (/\s/.test(ch)) { i++; continue }

    // string literal
    if (ch === '"') {
      const start = i
      i++
      let value = ''
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && input[i + 1] === '"') {
          value += '"'
          i += 2
        } else {
          value += input[i]
          i++
        }
      }
      if (i >= input.length) throw new ParseError('Unterminated string literal', start)
      i++ // closing quote
      tokens.push({ type: 'string', value, offset: start })
      continue
    }

    if (ch === '(') { tokens.push({ type: 'lparen', offset: i }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'rparen', offset: i }); i++; continue }
    if (ch === ',') { tokens.push({ type: 'comma', offset: i }); i++; continue }

    // identifier or bare word (e.g. extension without quotes: ts, tsx)
    if (/[a-zA-Z_\-\.\/]/.test(ch)) {
      const start = i
      let value = ''
      while (i < input.length && /[a-zA-Z0-9_\-\.\/]/.test(input[i]!)) {
        value += input[i]
        i++
      }
      tokens.push({ type: 'ident', value: value.toLowerCase(), offset: start })
      continue
    }

    throw new ParseError(`Unexpected character: ${ch}`, i)
  }

  tokens.push({ type: 'eof', offset: i })
  return tokens
}

class Parser {
  private pos = 0

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: 'eof', offset: 0 }
  }

  private consume(): Token {
    const t = this.peek()
    this.pos++
    return t
  }

  private expect(type: Token['type']): Token {
    const t = this.consume()
    if (t.type !== type) {
      throw new ParseError(
        `Expected ${type} but got ${t.type}`,
        t.offset,
      )
    }
    return t
  }

  private expectIdent(): { value: string; offset: number } {
    const t = this.consume()
    if (t.type !== 'ident') {
      throw new ParseError(`Expected identifier but got ${t.type}`, t.offset)
    }
    return t
  }

  private expectString(): { value: string; offset: number } {
    const t = this.consume()
    if (t.type !== 'string') {
      throw new ParseError(`Expected string literal but got ${t.type}`, t.offset)
    }
    return t
  }

  parseQuery(): Query {
    const selection = this.parseSelection()

    // Optional top-level unless(...)
    let finalSelection = selection
    if (this.peek().type === 'ident' && (this.peek() as { value: string }).value === 'unless') {
      this.consume()
      this.expect('lparen')
      const exclusion = this.parseSelection()
      this.expect('rparen')
      finalSelection = { type: 'unless', selection, exclusion }
    }

    this.expect('eof')
    return { selection: finalSelection }
  }

  private parseSelection(): SelectionNode {
    const t = this.peek()
    if (t.type !== 'ident') {
      throw new ParseError(`Expected predicate or operator name, got ${t.type}`, t.offset)
    }

    const name = (t as { value: string }).value
    this.consume()
    this.expect('lparen')

    let node: SelectionNode

    switch (name) {
      case 'and':
        node = this.parseAnd()
        break
      case 'or':
      case 'any':
        node = this.parseOr()
        break
      case 'not':
        node = this.parseNot()
        break
      case 'ext':
        node = this.parseExt()
        break
      case 'keyword':
        node = this.parseKeyword()
        break
      case 'file':
        node = this.parseFile()
        break
      case 'glob':
        node = this.parseGlob()
        break
      case 'tag':
        node = this.parseTag()
        break
      case 'authored_by':
        node = this.parseAuthoredBy()
        break
      case 'commit_message':
        node = this.parseCommitMessage()
        break
      case 'diff':
        node = this.parseDiff()
        break
      case 'older_than':
        node = this.parseOlderThan()
        break
      case 'newer_than':
        node = this.parseNewerThan()
        break
      default:
        throw new ParseError(`Unknown predicate or operator: ${name}`, t.offset)
    }

    return node
  }

  private parseAnd(): AndNode {
    const children: SelectionNode[] = []
    children.push(this.parseSelection())
    while (this.peek().type === 'comma') {
      this.consume()
      children.push(this.parseSelection())
    }
    this.expect('rparen')
    if (children.length < 2) {
      throw new ParseError('and() requires at least 2 children', 0)
    }
    return { type: 'and', children }
  }

  private parseOr(): OrNode {
    const children: SelectionNode[] = []
    children.push(this.parseSelection())
    while (this.peek().type === 'comma') {
      this.consume()
      children.push(this.parseSelection())
    }
    this.expect('rparen')
    if (children.length < 2) {
      throw new ParseError('or()/any() requires at least 2 children', 0)
    }
    return { type: 'or', children }
  }

  private parseNot(): NotNode {
    const child = this.parseSelection()
    this.expect('rparen')
    return { type: 'not', child }
  }

  private parseExt(): ExtPredicate {
    const extensions: string[] = []
    const first = this.expectIdent()
    extensions.push(first.value.replace(/^\./, ''))
    while (this.peek().type === 'comma') {
      this.consume()
      const next = this.expectIdent()
      extensions.push(next.value.replace(/^\./, ''))
    }
    this.expect('rparen')
    return { type: 'ext', extensions }
  }

  private parseKeyword(): KeywordPredicate {
    const term = this.expectString()
    this.expect('rparen')
    return { type: 'keyword', term: term.value }
  }

  private parseFile(): FilePathPredicate {
    const paths: string[] = []
    paths.push(this.expectString().value)
    while (this.peek().type === 'comma') {
      this.consume()
      paths.push(this.expectString().value)
    }
    this.expect('rparen')
    return { type: 'file', paths }
  }

  private parseGlob(): GlobPredicate {
    const pattern = this.expectString()
    this.expect('rparen')
    return { type: 'glob', pattern: pattern.value }
  }

  private parseTag(): TagPredicate {
    const tag = this.expectString()
    let scope: 'file' | 'anywhere' = 'anywhere'
    if (this.peek().type === 'comma') {
      this.consume()
      const scopeToken = this.expectIdent()
      if (scopeToken.value !== 'file' && scopeToken.value !== 'anywhere') {
        throw new ParseError(`tag() scope must be 'file' or 'anywhere'`, scopeToken.offset)
      }
      scope = scopeToken.value as 'file' | 'anywhere'
    }
    this.expect('rparen')
    return { type: 'tag', tag: tag.value, scope }
  }

  private parseAuthoredBy(): AuthoredByPredicate {
    const author = this.expectString()
    this.expect('rparen')
    return { type: 'authored_by', author: author.value }
  }

  private parseCommitMessage(): CommitMessagePredicate {
    const term = this.expectString()
    this.expect('rparen')
    return { type: 'commit_message', term: term.value }
  }

  private parseDiff(): DiffPredicate {
    if (this.peek().type === 'rparen') {
      this.consume()
      return { type: 'diff' }
    }
    const ref = this.expectString()
    this.expect('rparen')
    return { type: 'diff', ref: ref.value }
  }

  private parseDuration(token: { value: string; offset: number }): Duration {
    const m = /^(\d+)([dwmy])$/.exec(token.value)
    if (!m || !m[1] || !m[2]) {
      throw new ParseError(
        `Invalid duration "${token.value}". Expected format: 365d, 12w, 6m, 2y`,
        token.offset,
      )
    }
    return { value: parseInt(m[1], 10), unit: m[2] as Duration['unit'] }
  }

  private parseOlderThan(): OlderThanPredicate {
    const durStr = this.expectString()
    this.expect('rparen')
    return { type: 'older_than', duration: this.parseDuration(durStr) }
  }

  private parseNewerThan(): NewerThanPredicate {
    const durStr = this.expectString()
    this.expect('rparen')
    return { type: 'newer_than', duration: this.parseDuration(durStr) }
  }
}

export function parse(input: string): Query {
  const tokens = tokenize(input.trim())
  const parser = new Parser(tokens)
  return parser.parseQuery()
}
