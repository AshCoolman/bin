import type {
  Query,
  SelectionNode,
  ExtPredicate,
  KeywordPredicate,
  FilePathPredicate,
  GlobPredicate,
  Duration,
  OlderThanPredicate,
  NewerThanPredicate,
  DiffPredicate,
} from './ast.js'

// Recursive descent parser for the CatLens DSL.
// Syntax: key:value predicates combined with && || ! and grouping ().
// Grammar:
//   query    = or_expr EOF
//   or_expr  = and_expr ('||' and_expr)*
//   and_expr = not_expr ('&&' not_expr)*
//   not_expr = '!' not_expr | atom
//   atom     = PREDICATE | '(' or_expr ')'
//   PREDICATE = key ':' value

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
  | { type: 'and'; offset: number }
  | { type: 'or'; offset: number }
  | { type: 'not'; offset: number }
  | { type: 'lparen'; offset: number }
  | { type: 'rparen'; offset: number }
  | { type: 'predicate'; key: string; value: string; offset: number }
  | { type: 'eof'; offset: number }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const ch = input[i]!

    if (/\s/.test(ch)) { i++; continue }

    if (ch === '&' && input[i + 1] === '&') { tokens.push({ type: 'and', offset: i }); i += 2; continue }
    if (ch === '|' && input[i + 1] === '|') { tokens.push({ type: 'or', offset: i }); i += 2; continue }
    if (ch === '!') { tokens.push({ type: 'not', offset: i }); i++; continue }
    if (ch === '(') { tokens.push({ type: 'lparen', offset: i }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'rparen', offset: i }); i++; continue }

    // key:value predicate — key is alpha/underscore
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i
      let key = ''
      while (i < input.length && /[a-zA-Z_]/.test(input[i]!)) { key += input[i]; i++ }
      if (input[i] !== ':') throw new ParseError(`Expected ':' after "${key}"`, i)
      i++ // consume ':'

      let value = ''
      if (i < input.length && input[i] === '"') {
        i++ // opening quote
        while (i < input.length && input[i] !== '"') {
          if (input[i] === '\\' && input[i + 1] === '"') { value += '"'; i += 2 }
          else { value += input[i]; i++ }
        }
        if (i >= input.length) throw new ParseError('Unterminated string', start)
        i++ // closing quote
      } else {
        // bare value: stop at whitespace, &&, ||, !, (, )
        while (i < input.length && !/[\s!()&|]/.test(input[i]!)) { value += input[i]; i++ }
      }

      tokens.push({ type: 'predicate', key: key.toLowerCase(), value, offset: start })
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

  private peek(): Token { return this.tokens[this.pos] ?? { type: 'eof', offset: 0 } }
  private consume(): Token { return this.tokens[this.pos++] ?? { type: 'eof', offset: 0 } }

  parseQuery(): Query {
    if (this.peek().type === 'eof') throw new ParseError('Empty query', 0)
    const selection = this.parseOr()
    const t = this.peek()
    if (t.type !== 'eof') throw new ParseError(`Unexpected token after expression`, t.offset)
    return { selection }
  }

  private parseOr(): SelectionNode {
    let left = this.parseAnd()
    while (this.peek().type === 'or') {
      this.consume()
      const right = this.parseAnd()
      left = left.type === 'or'
        ? { type: 'or', children: [...left.children, right] }
        : { type: 'or', children: [left, right] }
    }
    return left
  }

  private parseAnd(): SelectionNode {
    let left = this.parseNot()
    while (this.peek().type === 'and') {
      this.consume()
      const right = this.parseNot()
      left = left.type === 'and'
        ? { type: 'and', children: [...left.children, right] }
        : { type: 'and', children: [left, right] }
    }
    return left
  }

  private parseNot(): SelectionNode {
    if (this.peek().type === 'not') {
      this.consume()
      return { type: 'not', child: this.parseNot() }
    }
    return this.parseAtom()
  }

  private parseAtom(): SelectionNode {
    const t = this.peek()
    if (t.type === 'lparen') {
      this.consume()
      const expr = this.parseOr()
      const close = this.consume()
      if (close.type !== 'rparen') throw new ParseError('Expected closing )', close.offset)
      return expr
    }
    if (t.type === 'predicate') {
      this.consume()
      return this.buildPredicate(t.key, t.value, t.offset)
    }
    throw new ParseError(`Expected predicate or '(', got ${t.type}`, t.offset)
  }

  private buildPredicate(key: string, value: string, offset: number): SelectionNode {
    switch (key) {
      case 'ext': {
        const extensions = value.split(',').map(e => e.trim().replace(/^\./, '')).filter(Boolean)
        if (extensions.length === 0) throw new ParseError('ext: requires at least one extension', offset)
        return { type: 'ext', extensions } satisfies ExtPredicate
      }
      case 'keyword': {
        if (!value) throw new ParseError('keyword: requires a value', offset)
        return { type: 'keyword', term: value } satisfies KeywordPredicate
      }
      case 'path': {
        if (!value) throw new ParseError('path: requires a pattern', offset)
        return { type: 'glob', pattern: value } satisfies GlobPredicate
      }
      case 'file': {
        const paths = value.split(',').map(p => p.trim()).filter(Boolean)
        if (paths.length === 0) throw new ParseError('file: requires a path', offset)
        return { type: 'file', paths } satisfies FilePathPredicate
      }
      case 'diff': {
        return (value ? { type: 'diff', ref: value } : { type: 'diff' }) satisfies DiffPredicate
      }
      case 'older': {
        return { type: 'older_than', duration: this.parseDuration(value, offset) } satisfies OlderThanPredicate
      }
      case 'newer': {
        return { type: 'newer_than', duration: this.parseDuration(value, offset) } satisfies NewerThanPredicate
      }
      default:
        throw new ParseError(`Unknown predicate: ${key}`, offset)
    }
  }

  private parseDuration(value: string, offset: number): Duration {
    const m = /^(\d+)([dwmy])$/.exec(value)
    if (!m || !m[1] || !m[2]) {
      throw new ParseError(`Invalid duration "${value}". Expected format: 365d, 12w, 6m, 2y`, offset)
    }
    return { value: parseInt(m[1], 10), unit: m[2] as Duration['unit'] }
  }
}

export function parse(input: string): Query {
  const tokens = tokenize(input.trim())
  const parser = new Parser(tokens)
  return parser.parseQuery()
}
