export function createId(prefix: string): string {
  const random = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  return `${prefix}_${random}`
}
