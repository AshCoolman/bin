import type { SelectionResult } from '../query/result.js'

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  java: 'java',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  css: 'css',
  html: 'html',
}

function langFor(path: string): string {
  const ext = path.split('.').pop() ?? ''
  return LANG_MAP[ext] ?? ''
}

/**
 * Render SectionHit ranges as fenced blocks with file path + line anchors.
 * Falls back to full FileHit content when no sections are present.
 */
export function renderSnippets(result: SelectionResult): string {
  if (result.sections.length > 0) {
    return result.sections
      .map(s => {
        const anchor = `${s.path}#L${s.startLine}-L${s.endLine}`
        const lang = langFor(s.path)
        return `## ${anchor}\n\n\`\`\`${lang}\n${s.content}\n\`\`\``
      })
      .join('\n\n')
  }

  // Fall back to full file content
  return result.files
    .map(f => {
      const lang = langFor(f.path)
      return `## ${f.path}\n\n\`\`\`${lang}\n${f.content}\n\`\`\``
    })
    .join('\n\n')
}
