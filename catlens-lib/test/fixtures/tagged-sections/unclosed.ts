// File with an unclosed catty:start marker

export function alpha(): string {
  return 'alpha'
}

// catty:start important-section
export function beta(): string {
  return 'beta'
}

export function gamma(): string {
  return 'gamma'
}

// Note: no catty:end here — this tests graceful handling of unclosed markers
