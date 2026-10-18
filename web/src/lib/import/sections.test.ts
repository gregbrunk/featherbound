import { describe, expect, it } from 'vitest';
import { buildSections, countWords, escapeHtml, looksLikeMatter, stripDuplicateHeading } from './sections';

describe('sections helpers', () => {
  it('escapes HTML and counts words', () => {
    expect(escapeHtml('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;');
    expect(countWords("It's a well-known fact — 42 times.")).toBe(6);
  });

  it('recognises front and back matter titles', () => {
    for (const t of ['Cover', 'Title Page', 'Copyright', 'Dedication', 'Table of Contents', 'Epigraph', 'Map', 'Also by Ada Quill', 'Praise for The Book', 'Acknowledgements', 'About the Author', 'Excerpt from Book Two', 'Sneak Peek', 'Newsletter', 'THE FULL PROJECT GUTENBERG™ LICENSE']) {
      expect(looksLikeMatter(t), t).toBe(true);
    }
    for (const t of ['Prologue', 'Epilogue', 'Interlude', 'Part One', 'Chapter 7', '12', 'XIV', 'The Long Road']) {
      expect(looksLikeMatter(t), t).toBe(false);
    }
  });

  it('classifies by position: matter after the first chapter is back matter', () => {
    const p = (html: string) => ({ type: 'p' as const, html });
    const sections = buildSections(
      [
        { title: 'Also by the Author', blocks: [p('Other books.')] },
        { title: 'Chapter 1', blocks: [{ type: 'h', level: 1, html: 'Chapter 1' }, p('Text here.')] },
        { title: 'Also by the Author', blocks: [p('Other books.')] },
        { title: 'Empty', blocks: [] },
        { title: 'Part Two', blocks: [] },
      ],
      'Book',
    );
    expect(sections.map((s) => [s.title, s.kind, s.include, s.words])).toEqual([
      ['Also by the Author', 'front', false, 2],
      ['Chapter 1', 'chapter', true, 2],
      ['Also by the Author', 'back', false, 2],
      ['Part Two', 'chapter', true, 0],
    ]);
    expect(sections[1].blocks).toEqual([p('Text here.')]);
  });

  it('strips a two-line heading that matches the title', () => {
    const blocks = stripDuplicateHeading('Chapter 3: Night', [
      { type: 'h', level: 2, html: 'Chapter 3' },
      { type: 'h', level: 3, html: 'Night' },
      { type: 'p', html: 'Dark.' },
    ]);
    expect(blocks).toEqual([{ type: 'p', html: 'Dark.' }]);
  });
});
