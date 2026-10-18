import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ownsPath } from './storage';

// Static checks that every way into the app checks who's asking. They read the source, so a new
// route or action that forgets its account check fails CI.

const root = join(__dirname, '..', 'app');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(root);

describe('every API route checks the account', () => {
  const routes = files.filter((f) => f.endsWith('route.ts') && !f.includes(join('api', 'auth')) && !f.includes(join('api', 'cron')));
  it('finds the routes', () => expect(routes.length).toBeGreaterThan(5));
  for (const f of routes) {
    it(f.slice(root.length), () => {
      const src = readFileSync(f, 'utf8');
      expect(src).toMatch(/getAccount\(\)/);
      // Each handler bails out with 401 before doing anything else.
      expect(src).toMatch(/if \(!account\) return/);
    });
  }
});

describe('cron routes need the cron secret', () => {
  for (const f of files.filter((x) => x.endsWith('route.ts') && x.includes(join('api', 'cron')))) {
    it(f.slice(root.length), () => {
      const src = readFileSync(f, 'utf8');
      expect(src).toMatch(/process\.env\.CRON_SECRET/);
      expect(src).toMatch(/Bearer \$\{secret\}/);
    });
  }
});

describe('every server action checks the account', () => {
  const actionFiles = files.filter((f) => /^'use server'/.test(readFileSync(f, 'utf8')));
  it('finds the action files', () => expect(actionFiles.length).toBeGreaterThan(3));
  for (const f of actionFiles) {
    const src = readFileSync(f, 'utf8');
    // Split into exported functions and look at each body.
    const parts = src.split(/\nexport async function /).slice(1);
    for (const part of parts) {
      const name = part.slice(0, part.indexOf('('));
      const body = part.slice(0, part.search(/\n}\n/) + 1);
      it(`${f.slice(root.length)} → ${name}`, () => {
        expect(body).toMatch(/await (requireAccount|requireAdmin)\(\)/);
      });
    }
  }
});

describe('file paths', () => {
  it('only lets an account touch its own folder', () => {
    expect(ownsPath('u1', 'accounts/u1/uploads/a.epub')).toBe(true);
    expect(ownsPath('u1', 'accounts/u2/uploads/a.epub')).toBe(false);
    expect(ownsPath('u1', 'accounts/u1/../u2/uploads/a.epub')).toBe(false);
    expect(ownsPath('u1', 'accounts/u10/uploads/a.epub')).toBe(false);
  });
});

describe('API keys never reach the browser', () => {
  it('the key listing returns only the last four characters and status', () => {
    const src = readFileSync(join(__dirname, 'keys.ts'), 'utf8');
    const listKeys = src.slice(src.indexOf('export async function listKeys'), src.indexOf('}\n', src.indexOf('export async function listKeys')));
    expect(listKeys).not.toMatch(/ciphertext|authTag|decryptSecret/);
  });
  it('no client component imports the key or crypto modules', () => {
    for (const f of walk(join(__dirname, '..')).filter((x) => /\.tsx?$/.test(x))) {
      const src = readFileSync(f, 'utf8');
      if (!/^'use client'/.test(src)) continue;
      expect(src, f).not.toMatch(/from '@\/lib\/(keys|crypto|ai|images|storage)'/);
    }
  });
});
