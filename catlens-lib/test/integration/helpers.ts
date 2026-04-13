import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execa } from 'execa'
import { parse, buildResult } from '@catlens/core'
import type { SelectionResult, Query } from '@catlens/core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, '../fixtures')
const CLI_PATH = path.resolve(__dirname, '../../packages/cli/src/index.ts')

/** Absolute path to a named fixture repo. */
export function fixturePath(name: string): string {
  return path.join(FIXTURES, name)
}

/** Run a DSL query string against a fixture repo, returning SelectionResult. */
export async function runQuery(
  fixtureDir: string,
  dsl: string,
): Promise<SelectionResult> {
  const query = parse(dsl)
  return buildResult(query, fixtureDir)
}

/** Run a pre-parsed Query against a fixture repo. */
export async function runParsedQuery(
  fixtureDir: string,
  query: Query,
): Promise<SelectionResult> {
  return buildResult(query, fixtureDir)
}

export type CLIResult = {
  stdout: string
  stderr: string
  exitCode: number
}

/** Spawn the CLI as a child process against a fixture repo. */
export async function runCLI(
  args: string[],
  options: { root?: string } = {},
): Promise<CLIResult> {
  const root = options.root ?? path.join(FIXTURES, 'ts-app')
  try {
    const result = await execa('tsx', [CLI_PATH, ...args, '--root', root], {
      reject: false,
    })
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    }
  } catch (err) {
    return { stdout: '', stderr: String(err), exitCode: 1 }
  }
}
