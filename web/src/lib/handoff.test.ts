import { beforeAll, describe, expect, it } from 'vitest';
import { allowedWhileLocked, decodeLock, encodeLock, readTries, writeTries } from './handoff';

beforeAll(() => { process.env.BETTER_AUTH_SECRET = 'test-secret-for-handoff'; });
const lock = { userId: 'u1', editionId: 'e1', bookId: 'b1' };

describe('hand-off lock', () => {
  it('round-trips a signed lock', () => {
    expect(decodeLock(encodeLock(lock))).toEqual(lock);
  });
  it('rejects an edited or unsigned lock', () => {
    const [payload, sig] = encodeLock(lock).split('.');
    const forged = Buffer.from(JSON.stringify({ ...lock, editionId: 'other' })).toString('base64url');
    expect(decodeLock(`${forged}.${sig}`)).toBeNull();
    expect(decodeLock(payload)).toBeNull();
    expect(decodeLock('nonsense')).toBeNull();
  });
  it('only allows the locked edition’s reader and what it loads', () => {
    expect(allowedWhileLocked('/read/edition/e1', lock)).toBe(true);
    expect(allowedWhileLocked('/api/editions/e1/sections/s1', lock)).toBe(true);
    expect(allowedWhileLocked('/api/books/b1/images/ill_1', lock)).toBe(true);
    for (const p of ['/', '/settings', '/books/b1', '/read/book/b1', '/read/edition/e2', '/api/editions/e2/sections/s1', '/api/books/b1/original', '/api/editions/e1/export']) {
      expect(allowedWhileLocked(p, lock), p).toBe(false);
    }
  });
  it('keeps a tamper-proof count of wrong PINs', () => {
    expect(readTries(writeTries(3, 0))).toEqual({ count: 3, until: 0 });
    expect(readTries('9.0.fake')).toEqual({ count: 0, until: 0 });
  });
});
