# DSL Grammar: CatLens Query Language

**Version**: 1.0
**Date**: 2026-04-11

The CatLens DSL is a small, regular, function-call-based language.
It compiles directly to the Query AST. No implicit precedence; all grouping is explicit.

---

## Grammar (informal BNF)

```
query          ::= selection unless_clause? extract_clause? render_clause?

selection      ::= call | predicate

call           ::= identifier '(' arg_list? ')'
arg_list       ::= arg (',' arg)*
arg            ::= string | identifier | duration | call | selection

string         ::= '"' [^"]* '"'
identifier     ::= [a-z_][a-z0-9_]*
duration       ::= [0-9]+ ('d' | 'w' | 'm' | 'y')

unless_clause  ::= 'unless' '(' selection ')'
extract_clause ::= 'extract' '(' extract_arg (',' extract_arg)* ')'
render_clause  ::= 'render' '(' render_arg (',' render_arg)* ')'

extract_arg    ::= 'tagged_sections' '(' string (',' string)* ')'
                 | 'include_diff' '(' ')'

render_arg     ::= 'markdown' '(' ')'
                 | 'file_list' '(' ')'
                 | 'snippets' '(' ')'
                 | 'diff' '(' ')'
                 | 'json' '(' ')'
                 | 'line_numbers' '(' ')'
```

---

## Boolean operators

| DSL form | AST node | Notes |
|----------|----------|-------|
| `and(a, b, ...)` | `AndNode` | 2+ children |
| `or(a, b, ...)` | `OrNode` | 2+ children |
| `any(a, b, ...)` | `OrNode` | alias for `or` |
| `not(a)` | `NotNode` | 1 child |
| `and(a) unless(b)` | `UnlessNode` | top-level modifier |

The `unless` clause is a top-level modifier that subtracts a set from the selection.
It is equivalent to `and(selection, not(exclusion))` but is more readable for
the common case of "everything matching X, except files matching Y".

---

## Predicates

| DSL call | AST type | Arguments |
|----------|----------|-----------|
| `file("path/a", "path/b")` | `FilePathPredicate` | one or more paths |
| `glob("src/**/*.ts")` | `GlobPredicate` | one glob pattern |
| `ext(ts, tsx)` | `ExtPredicate` | one or more extensions (no quotes, no dot) |
| `keyword("term")` | `KeywordPredicate` | string term; optional: `case_sensitive` |
| `tag("catty:task")` | `TagPredicate` | string tag; optional scope arg |
| `tagged_section("open", "close")` | `TaggedSectionPredicate` | open tag; optional close tag |
| `diff()` | `DiffPredicate` | optional: ref string |
| `commit_message("term")` | `CommitMessagePredicate` | string term; optional: since |
| `authored_by("user@example.com")` | `AuthoredByPredicate` | email or name substring |
| `older_than("365d")` | `OlderThanPredicate` | duration string |
| `newer_than("30d")` | `NewerThanPredicate` | duration string |

---

## Duration format

```
365d   → 365 days
12w    → 12 weeks
6m     → 6 months
2y     → 2 years
```

---

## Examples

### One-liner: TypeScript files with checkout keyword, not old

```
and(ext(ts,tsx), keyword("checkout"), not(older_than("365d")))
```

### Multi-line: structured query with extract and render

```
and(
  ext(ts, tsx),
  any(
    keyword("calculateCheckoutTotal"),
    keyword("/api/checkout")
  ),
  not(older_than("365d"))
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
```

### Simple file gather

```
file("src/engine/index.ts", "src/query/ast.ts")
```

### Recent diff files that are TypeScript

```
and(diff(), ext(ts))
```

### Files with a specific tag marker anywhere

```
tag("catty:api")
```

---

## Parser error examples

| Input | Error |
|-------|-------|
| `and(ext(ts))` | `and` requires at least 2 children |
| `older_than(365)` | argument must be a duration string (e.g. "365d") |
| `ext(.ts)` | extension must not include leading dot |
| `keyword()` | keyword requires exactly one string argument |
| `and(ext(ts), and())` | nested and requires at least 2 children |

---

## Notes

- Whitespace (spaces, tabs, newlines) is ignored between tokens.
- String literals use double quotes only; single quotes are not supported.
- Identifiers are case-insensitive in the parser but normalized to lowercase in the AST.
- The DSL has no operator precedence; all grouping is through explicit calls.
- Comments are not supported in V1 (lens files are JSON; DSL is for inline use).
