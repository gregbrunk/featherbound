import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// AI keys are encrypted with AES-256-GCM under KEY_ENCRYPTION_KEY (32 random bytes, base64),
// with a fresh IV per key. keyVersion lets us rotate the master key later.
export const KEY_VERSION = 1;

function masterKey() {
  const raw = process.env.KEY_ENCRYPTION_KEY;
  if (!raw) throw new Error('KEY_ENCRYPTION_KEY is not set');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('KEY_ENCRYPTION_KEY must be 32 bytes (base64)');
  return key;
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion: KEY_VERSION,
  };
}

export function decryptSecret(row: { ciphertext: string; iv: string; authTag: string }) {
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

/** Hand-off PIN: scrypt with a random salt, stored as salt:hash. */
export function hashPin(pin: string) {
  const salt = randomBytes(16);
  return `${salt.toString('base64')}:${scryptSync(pin, salt, 32).toString('base64')}`;
}

export function verifyPin(pin: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(pin, Buffer.from(salt, 'base64'), 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
