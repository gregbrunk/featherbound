import { describe, expect, it } from 'vitest';
import { changedShare, diffWords, plainText } from './diff';

const text = (segs: { text: string }[]) => segs.map((s) => s.text).join('');
const marked = (segs: { text: string; changed: boolean }[]) => segs.filter((s) => s.changed).map((s) => s.text.trim());

describe('diffWords', () => {
  it('marks nothing when the paragraphs match', () => {
    const d = diffWords('The house rose.', 'The house rose.');
    expect(d.changed).toBe(false);
    expect(marked(d.right)).toEqual([]);
  });

  it('marks removed words on the left and added words on the right, keeping the full text', () => {
    const a = 'With one blow he cut off the wolf’s head.';
    const b = 'With one clang the wolf ran off into the night.';
    const d = diffWords(a, b);
    expect(text(d.left)).toBe(a);
    expect(text(d.right)).toBe(b);
    expect(marked(d.left).join(' ')).toContain('cut');
    expect(marked(d.right).join(' ')).toContain('ran');
    expect(marked(d.right).join(' ')).not.toContain('With');
  });

  it('groups neighbouring changes into one highlight', () => {
    const d = diffWords('a very big scary lion', 'a big friendly lion');
    expect(d.right.filter((s) => s.changed)).toHaveLength(1);
  });

  it('reads stored paragraphs as plain text', () => {
    expect(plainText('Tom &amp; <em>Jerry</em><br/>ran')).toBe('Tom & Jerry ran');
  });

  it('measures how much changed', () => {
    expect(changedShare(diffWords('one two three four', 'one two five six').right)).toBeCloseTo(0.5);
  });
});
