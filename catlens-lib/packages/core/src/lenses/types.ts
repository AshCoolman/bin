import type { Query } from '../query/ast.js'

export type Lens = {
  readonly name: string
  readonly description?: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly query: Query
}
