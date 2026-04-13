import { createInterface } from 'node:readline'
import { spawnSync } from 'node:child_process'

/**
 * When multiple lens names match, use fzf if available; fall back to a
 * numbered readline prompt on stderr.
 * Returns the selected lens name.
 */
export async function disambiguate(matches: string[]): Promise<string> {
  if (matches.length === 0) throw new Error('No matches to disambiguate')
  if (matches.length === 1) return matches[0]!

  const fzfResult = tryFzf(matches)
  if (fzfResult !== null) return fzfResult

  return readlinePrompt(matches)
}

function tryFzf(matches: string[]): string | null {
  try {
    const result = spawnSync('fzf', ['--no-mouse'], {
      input: matches.join('\n'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'inherit'],
    })
    if (result.status === 0 && typeof result.stdout === 'string' && result.stdout.trim()) {
      return result.stdout.trim()
    }
  } catch {
    // fzf not available
  }
  return null
}

async function readlinePrompt(matches: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr })

    process.stderr.write('Multiple lenses match:\n')
    matches.forEach((m, i) => process.stderr.write(`  ${i + 1}. ${m}\n`))

    const ask = (): void => {
      rl.question(`Select [1-${matches.length}]: `, (answer) => {
        const idx = parseInt(answer.trim(), 10) - 1
        const chosen = matches[idx]
        if (idx >= 0 && chosen !== undefined) {
          rl.close()
          resolve(chosen)
        } else {
          process.stderr.write(`Please enter a number between 1 and ${matches.length}\n`)
          ask()
        }
      })
    }

    rl.on('close', () => reject(new Error('Lens selection cancelled')))
    ask()
  })
}
