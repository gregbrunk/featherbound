import { describe, expect, it } from 'vitest';
import { defaultSettings, editionSettingsSchema } from './editions';
import { defaultCap, densityTiers, estimateAnalysis, estimateEdition, picturesFor } from './estimate';
import { DEFAULT_MODELS } from './models';

const oz = { words: 39_000, chapters: 24 };

describe('estimates', () => {
  it('prices a text-only edition near the adaptation spike (~$0.035 per 1,000 words)', () => {
    const e = estimateEdition(oz, defaultSettings(7), DEFAULT_MODELS);
    expect(e.images).toBe(0);
    expect(e.total / (oz.words / 1000)).toBeGreaterThan(0.02);
    expect(e.total / (oz.words / 1000)).toBeLessThan(0.06);
    expect(e.samples).toBeLessThan(e.total);
  });

  it('adds pictures, and more pictures cost more', () => {
    const s = defaultSettings(7);
    const few = estimateEdition(oz, { ...s, picture: { ...s.picture, on: true, density: 'chapter1' } }, DEFAULT_MODELS);
    const many = estimateEdition(oz, { ...s, picture: { ...s.picture, on: true, density: 'page1' } }, DEFAULT_MODELS);
    expect(few.images).toBe(24);
    expect(many.images).toBeGreaterThan(few.images);
    expect(many.total).toBeGreaterThan(few.total);
    expect(many.totalWorst).toBeGreaterThanOrEqual(many.total);
  });

  it('never gives fewer than one picture per chapter for page-based densities', () => {
    expect(picturesFor({ words: 2000, chapters: 10 }, 'page8')).toBe(10);
  });

  it('lists density tiers from most to fewest pictures with no duplicate counts', () => {
    const tiers = densityTiers(oz);
    const counts = tiers.map((t) => t.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(new Set(counts).size).toBe(counts.length);
    expect(tiers.at(-1)!.id).toBe('chapter1');
  });

  it('prices reading a book once well below adapting it', () => {
    const a = estimateAnalysis(oz, DEFAULT_MODELS.text);
    expect(a.cost).toBeGreaterThan(0);
    expect(a.cost).toBeLessThan(estimateEdition(oz, defaultSettings(7), DEFAULT_MODELS).total);
  });

  it('sets a cap above the estimate in whole dollars', () => {
    expect(defaultCap(1.2)).toBe(2);
    expect(defaultCap(0.1)).toBe(1);
    expect(defaultCap(10)).toBe(13);
  });

  it('accepts its own defaults as valid settings', () => {
    for (const age of [3, 7, 11, 17]) expect(editionSettingsSchema.safeParse(defaultSettings(age)).success).toBe(true);
  });
});
