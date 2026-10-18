import { describe, expect, it } from 'vitest';
import { normalizeEmail } from './allowlist';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Jane.Doe@Example.COM ')).toBe('jane.doe@example.com');
  });
});
