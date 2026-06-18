import { describe, it, expect } from 'vitest';
import {
  normalizeRoomId,
  isValidRoomId,
  sanitizeDisplayName,
  isValidDisplayName,
} from '@vibecam/shared';

describe('room id validation', () => {
  it('normalizes messy input into a safe slug', () => {
    expect(normalizeRoomId('  My Room!! ')).toBe('my-room');
    expect(normalizeRoomId('Team__Standup')).toBe('team-standup');
    expect(normalizeRoomId('---a---b---')).toBe('a-b');
  });

  it('accepts valid slugs and rejects invalid ones', () => {
    expect(isValidRoomId('my-room')).toBe(true);
    expect(isValidRoomId('room1')).toBe(true);
    expect(isValidRoomId('')).toBe(false);
    expect(isValidRoomId('-bad')).toBe(false);
    expect(isValidRoomId('Bad Caps')).toBe(false);
  });
});

describe('display name validation', () => {
  it('sanitizes and bounds names', () => {
    expect(sanitizeDisplayName('  Ada   Lovelace ')).toBe('Ada Lovelace');
    expect(sanitizeDisplayName('x'.repeat(50)).length).toBe(32);
  });

  it('validates length', () => {
    expect(isValidDisplayName('Ada')).toBe(true);
    expect(isValidDisplayName('')).toBe(false);
    expect(isValidDisplayName('   ')).toBe(false);
  });
});
