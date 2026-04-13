export interface Task {
  id: string
  title: string
  done: boolean
}

export function createTask(title: string): Task {
  return { id: crypto.randomUUID(), title, done: false }
}

// catty:start task-ops
export function completeTask(task: Task): Task {
  return { ...task, done: true }
}

export function filterPending(tasks: Task[]): Task[] {
  return tasks.filter(t => !t.done)
}
// catty:end task-ops

export function sortByTitle(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.title.localeCompare(b.title))
}
