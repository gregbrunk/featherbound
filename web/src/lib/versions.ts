import type { VersionLevel } from '@/db/schema';

// Semantic versions for editions. Pure helpers, safe to use in the browser.

export function nextVersion(current: string | null, level: VersionLevel) {
  const [ma, mi, pa] = (current || '1.0.0').split('.').map(Number);
  if (level === 'major') return `${ma + 1}.0.0`;
  if (level === 'minor') return `${ma}.${mi + 1}.0`;
  return `${ma}.${mi}.${pa + 1}`;
}

/** Highest existing version at each level, so a new number never collides after a rollback. */
export function nextFreeVersion(existing: string[], base: string, level: VersionLevel) {
  let n = nextVersion(base, level);
  while (existing.includes(n)) n = nextVersion(n, 'patch');
  return n;
}

export function suggestedLevel(scope: 'whole' | 'chapters' | 'passage', chapters: number): VersionLevel {
  if (scope === 'whole') return 'major';
  return scope === 'chapters' && chapters > 1 ? 'minor' : 'patch';
}

/** Requests that change who the book is for belong in a new edition, not a new version. */
export const looksLikeNewEdition = (guidance: string) => /\b(age|years? old|older|younger|grade)\b|\bfor (my )?\d+\b/i.test(guidance);
