import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, hashPin, verifyPin } from './crypto';

beforeAll(() => {
  process.env.KEY_ENCRYPTION_KEY = randomBytes(32).toString('base64');
});

describe('API key encryption', () => {
  it('round-trips a key', () => {
    const enc = encryptSecret('vck_test_1234567890');
    expect(enc.ciphertext).not.toContain('vck_test');
    expect(decryptSecret(enc)).toBe('vck_test_1234567890');
  });

  it('uses a fresh IV every time', () => {
    expect(encryptSecret('same').iv).not.toBe(encryptSecret('same').iv);
  });

  it('rejects tampered ciphertext', () => {
    const enc = encryptSecret('secret-value');
    const bad = Buffer.from(enc.ciphertext, 'base64');
    bad[0] ^= 1;
    expect(() => decryptSecret({ ...enc, ciphertext: bad.toString('base64') })).toThrow();
  });
});

describe('hand-off PIN', () => {
  it('verifies the right PIN and rejects others', () => {
    const stored = hashPin('1234');
    expect(verifyPin('1234', stored)).toBe(true);
    expect(verifyPin('4321', stored)).toBe(false);
  });
});
