import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, ROOM_ID_PATTERN } from './constants.js';

/** Normalize a free-form room id from a URL into a safe, lowercase slug. */
export function normalizeRoomId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function isValidRoomId(id: string): boolean {
  return ROOM_ID_PATTERN.test(id);
}

export function sanitizeDisplayName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, DISPLAY_NAME_MAX);
}

export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= DISPLAY_NAME_MIN && trimmed.length <= DISPLAY_NAME_MAX;
}
