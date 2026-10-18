import { describe, expect, it } from 'vitest';
import { normalizeEmail } from './allowlist';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Greg.Brunk@Gmail.com ')).toBe('greg.brunk@gmail.com');
  });
});
