import { describe, expect, it } from 'vitest';
import type { Block } from './import/types';
import { alignOriginal, looksLikeNewEdition, nextFreeVersion, nextVersion, passageWindow, suggestedLevel } from './refine';

describe('versions', () => {
  it('bumps semantic versions', () => {
    expect(nextVersion('1.0.0', 'patch')).toBe('1.0.1');
    expect(nextVersion('1.0.3', 'minor')).toBe('1.1.0');
    expect(nextVersion('1.4.2', 'major')).toBe('2.0.0');
  });
  it('never reuses a number after rolling back', () => {
    // On 1.0.0 again after making 1.1.0: a minor bump would collide, so it becomes 1.1.1.
    expect(nextFreeVersion(['1.0.0', '1.1.0'], '1.0.0', 'minor')).toBe('1.1.1');
  });
  it('suggests a level from the scope', () => {
    expect(suggestedLevel('whole', 24)).toBe('major');
    expect(suggestedLevel('chapters', 3)).toBe('minor');
    expect(suggestedLevel('chapters', 1)).toBe('patch');
    expect(suggestedLevel('passage', 1)).toBe('patch');
  });
});

describe('refinement helpers', () => {
  it('takes a window of text paragraphs around a passage, skipping pictures', () => {
    const b: Block[] = [{ type: 'p', html: 'a' }, { type: 'img', imageId: 'x', alt: '' }, { type: 'p', html: 'b' }, { type: 'p', html: 'c' }, { type: 'p', html: 'd' }];
    expect(passageWindow(b, 3, 1)).toEqual([2, 3, 4]);
    expect(passageWindow(b, 1, 1)).toEqual([]);
  });
  it('pairs original and adapted paragraphs in reading order around added pictures', () => {
    const orig: Block[] = [{ type: 'p', html: 'one' }, { type: 'img', imageId: 'book', alt: '' }, { type: 'p', html: 'two' }];
    const cur: Block[] = [{ type: 'p', html: 'One' }, { type: 'img', imageId: 'ill_1', alt: '' }, { type: 'p', html: 'Two' }, { type: 'img', imageId: 'ill_2', alt: '' }];
    const aligned = alignOriginal(orig, cur)!;
    expect(aligned).toHaveLength(4);
    expect(aligned[0]).toEqual({ type: 'p', html: 'one' });
    expect(aligned[2]).toEqual({ type: 'p', html: 'two' });
    expect(alignOriginal([{ type: 'p', html: 'one' }], cur)).toBeNull();
  });
  it('spots requests that should be a new edition', () => {
    expect(looksLikeNewEdition('Make it for my 10 year old')).toBe(true);
    expect(looksLikeNewEdition('Make it suitable for an older reader')).toBe(true);
    expect(looksLikeNewEdition('The Lion should be braver')).toBe(false);
  });
});
