import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { collectGitFacts } from './git.js'

describe('collectGitFacts', () => {
  describe('graceful degradation', () => {
    let tmp: string

    beforeAll(async () => {
      tmp = await mkdtemp(join(tmpdir(), 'catlens-git-nonrepo-'))
      await writeFile(join(tmp, 'a.ts'), 'hello')
    })

    afterAll(async () => {
      await rm(tmp, { recursive: true, force: true })
    })

    it('returns an empty map for a non-git directory', async () => {
      const result = await collectGitFacts(tmp, ['a.ts'])
      expect(result.size).toBe(0)
    })

    it('returns an empty map when path does not exist', async () => {
      const result = await collectGitFacts('/nonexistent/path/that/cannot/exist', ['a.ts'])
      expect(result.size).toBe(0)
    })
  })

  describe('with a real git repo', () => {
    let tmp: string

    beforeAll(async () => {
      tmp = await mkdtemp(join(tmpdir(), 'catlens-git-repo-'))
      await mkdir(join(tmp, 'src'), { recursive: true })
      await writeFile(join(tmp, 'src/a.ts'), 'original\n')
      await writeFile(join(tmp, 'src/b.ts'), 'other\n')
      await writeFile(join(tmp, 'src/c.ts'), 'third\n')

      const env = { GIT_AUTHOR_NAME: 'Alice', GIT_AUTHOR_EMAIL: 'alice@example.com', GIT_COMMITTER_NAME: 'Alice', GIT_COMMITTER_EMAIL: 'alice@example.com' }
      await execa('git', ['init', '-q', '-b', 'main'], { cwd: tmp })
      await execa('git', ['config', 'user.email', 'alice@example.com'], { cwd: tmp })
      await execa('git', ['config', 'user.name', 'Alice'], { cwd: tmp })
      await execa('git', ['add', '.'], { cwd: tmp })
      await execa('git', ['commit', '-q', '-m', 'initial commit with checkout feature'], { cwd: tmp, env })

      // Make one unstaged and one staged modification to exercise both diff loops
      await writeFile(join(tmp, 'src/a.ts'), 'unstaged change\n')
      await writeFile(join(tmp, 'src/c.ts'), 'staged change\n')
      await execa('git', ['add', 'src/c.ts'], { cwd: tmp })
    }, 30_000)

    afterAll(async () => {
      await rm(tmp, { recursive: true, force: true })
    })

    it('collects log-derived facts for each file', async () => {
      const result = await collectGitFacts(tmp, ['src/a.ts', 'src/b.ts'])
      const a = result.get('src/a.ts')
      expect(a).toBeDefined()
      expect(a!.lastAuthor).toBe('Alice')
      expect(a!.lastAuthorEmail).toBe('alice@example.com')
      expect(a!.lastCommitMessage).toContain('checkout')
      expect(a!.lastCommitDate).toBeInstanceOf(Date)
    })

    it('marks both staged and unstaged modified files as inCurrentDiff', async () => {
      const result = await collectGitFacts(tmp, ['src/a.ts', 'src/b.ts', 'src/c.ts'])
      const a = result.get('src/a.ts')
      const b = result.get('src/b.ts')
      const c = result.get('src/c.ts')
      expect(a!.inCurrentDiff).toBe(true)
      expect(a!.diffPatch).toContain('unstaged')
      expect(c!.inCurrentDiff).toBe(true)
      expect(b!.inCurrentDiff).toBe(false)
      expect(b!.diffPatch).toBeUndefined()
    })

    it('skips files with no log entries without throwing', async () => {
      const result = await collectGitFacts(tmp, ['src/a.ts', 'src/not-tracked.ts'])
      expect(result.has('src/a.ts')).toBe(true)
      expect(result.has('src/not-tracked.ts')).toBe(false)
    })
  })
})
