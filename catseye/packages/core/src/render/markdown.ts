import type { SelectionResult } from '../query/result.js'

export type MarkdownOptions = {
  readonly lineNumbers?: boolean
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  sh: 'bash',
  md: 'markdown',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  css: 'css',
  html: 'html',
}

/**
 * Render a SelectionResult as a markdown bundle.
 * Each file is a fenced code block under a heading.
 */
export function renderMarkdown(
  result: SelectionResult,
  options: MarkdownOptions = {},
): string {
  const { lineNumbers = true } = options
  const blocks: string[] = []

  for (const file of result.files) {
    const ext = file.path.split('.').pop() ?? ''
    const lang = LANG_MAP[ext] ?? ''

    let content = file.content
    if (lineNumbers) {
      const lines = content.split('\n')
      content = lines.map((line, i) => `${String(i + 1).padStart(4)} ${line}`).join('\n')
    }

    blocks.push(`## ${file.path}\n\n\`\`\`${lang}\n${content}\n\`\`\``)
  }

  return blocks.join('\n\n')
}
