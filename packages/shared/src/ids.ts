/**
 * Tiny id generator. Uses crypto.randomUUID where available (Node 18+, modern
 * browsers) and falls back to a random string otherwise.
 */
export function generateId(prefix = ''): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const uuid =
    g.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${uuid}` : uuid;
}
