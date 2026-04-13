// @catty:api
// API service for user management

export interface User {
  id: string
  email: string
  name: string
}

// catty:start auth-handlers
export async function getUser(id: string): Promise<User> {
  return { id, email: 'user@example.com', name: 'Test User' }
}

export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  return { id, email: data.email ?? 'user@example.com', name: data.name ?? 'Test User' }
}
// catty:end auth-handlers

export function formatUserDisplay(user: User): string {
  return `${user.name} <${user.email}>`
}

// catty:start validation
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateName(name: string): boolean {
  return name.length >= 2 && name.length <= 100
}
// catty:end validation
