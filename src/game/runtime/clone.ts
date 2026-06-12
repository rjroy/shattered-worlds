export function clonePlain<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value) as T
  }

  return JSON.parse(JSON.stringify(value)) as T
}
