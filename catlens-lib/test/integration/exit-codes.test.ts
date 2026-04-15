import { describe, it, expect } from 'vitest'
import { runCLI } from './helpers.js'
import { fixturePath } from './helpers.js'

const TS_APP = fixturePath('ts-app')

describe('exit codes per contracts/cli-schema.md', () => {
  it('exit 0: successful query with output', async () => {
    const result = await runCLI(['ext:ts', '--output', 'file-list'], { root: TS_APP })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.length).toBeGreaterThan(0)
  })

  it('exit 0: --preview with matches', async () => {
    const result = await runCLI(['ext:ts', '--preview'], { root: TS_APP })
    expect(result.exitCode).toBe(0)
  })

  it('exit 1: parse error', async () => {
    const result = await runCLI(['bad((('], { root: TS_APP })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/parse error/i)
  })

  it('exit 1: fmt subcommand parse error', async () => {
    const result = await runCLI(['fmt', 'bad((('])
    expect(result.exitCode).toBe(1)
  })

  it('exit 1: lint subcommand parse error', async () => {
    const result = await runCLI(['lint', 'bad((('])
    expect(result.exitCode).toBe(1)
  })

  it('exit 2: lint reports errors', async () => {
    const result = await runCLI(['lint', 'ext:ts && !ext:ts'])
    expect(result.exitCode).toBe(2)
  })

  it('exit 2: lint --strict promotes warnings to errors', async () => {
    const result = await runCLI(['lint', 'ext:ts', '--strict'])
    expect(result.exitCode).toBe(2)
  })

  it('exit 3: zero matches', async () => {
    const result = await runCLI(['keyword:zzz-never-matches-xyzxyz'], { root: TS_APP })
    expect(result.exitCode).toBe(3)
    expect(result.stderr).toMatch(/no matches/i)
  })

  it('exit 4: lens rm for nonexistent lens', async () => {
    const result = await runCLI(['lens', 'rm', 'nope-not-here', '--yes'], { root: TS_APP })
    expect(result.exitCode).toBe(4)
  })

  it('exit 5: large result without --force', async () => {
    const result = await runCLI(['ext:ts', '--output', 'markdown'], { root: TS_APP })
    expect(result.exitCode).not.toBe(5)
  })
})
