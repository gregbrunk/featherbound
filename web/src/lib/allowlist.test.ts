import { describe, expect, it } from 'vitest';
import { normalizeEmail } from './allowlist';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Parent@Example.com ')).toBe('parent@example.com');
  });
});
