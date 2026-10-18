import { describe, expect, it } from 'vitest';
import { blockWords, chunkIndexes, cleanInline } from './adapt';
import type { Block } from './import/types';

const para = (n: number): Block => ({ type: 'p', html: Array.from({ length: n }, () => 'word').join(' ') });

describe('adaptation helpers', () => {
  it('chunks text blocks by word count without splitting paragraphs or including pictures', () => {
    const blocks: Block[] = [para(900), { type: 'img', imageId: 'x', alt: '' }, para(900), para(900), { type: 'hr' }, para(100)];
    expect(chunkIndexes(blocks, 2000)).toEqual([[0, 2], [3, 5]]);
  });

  it('keeps a single oversized paragraph as its own chunk', () => {
    expect(chunkIndexes([para(5000), para(10)], 2000)).toEqual([[0], [1]]);
  });

  it('counts words in text blocks only', () => {
    expect(blockWords([para(3), { type: 'h', level: 1, html: '<em>Two</em> words' }, { type: 'hr' }])).toBe(5);
  });

  it('keeps only em, strong and br tags', () => {
    expect(cleanInline('<p>Hi <em>there</em><br/> <span class="x">you</span> <script>x</script></p>')).toBe('Hi <em>there</em><br/> you x');
  });
});

describe('recaps', () => {
  it('drops a "The story so far…" lead the model added', async () => {
    const { stripRecapLead } = await import('./adapt');
    expect(stripRecapLead('The story so far… A cyclone whisked Dorothy away.')).toBe('A cyclone whisked Dorothy away.');
    expect(stripRecapLead('The story so far: Dorothy met a Scarecrow.')).toBe('Dorothy met a Scarecrow.');
    expect(stripRecapLead('Dorothy met a Scarecrow.')).toBe('Dorothy met a Scarecrow.');
  });
});

describe('picture moments', () => {
  it('splits a chapter’s pictures across its parts by length, adding up exactly', async () => {
    const { picturesForPart } = await import('./adapt');
    const { defaultSettings } = await import('./editions');
    const blocks = [para(1500), para(1500), para(1000)];
    const job = { settings: defaultSettings(7), bible: '', guidance: [], storySoFar: [], chapterNumber: 1, title: 't', chapterSummary: '', blocks, pictures: 3 };
    const chunks = [[0], [1], [2]];
    const split = chunks.map((_, i) => picturesForPart(job, chunks, i));
    expect(split.reduce((a, b) => a + b, 0)).toBe(3);
    expect(picturesForPart({ ...job, pictures: 0 }, chunks, 0)).toBe(0);
  });
});
