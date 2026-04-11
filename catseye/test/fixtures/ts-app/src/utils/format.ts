export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}
