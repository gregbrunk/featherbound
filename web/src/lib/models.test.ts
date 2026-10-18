import { describe, expect, it } from 'vitest';
import { DEFAULT_MODELS, IMAGE_MODELS, TEXT_MODELS, imageCostUsd, keyFor, textCostUsd } from './models';

describe('keyFor', () => {
  it('prefers the provider’s own key by default', () => {
    expect(keyFor('anthropic', { gateway: 'k', anthropic: 'k' })).toBe('anthropic');
    expect(keyFor('openai', { gateway: 'k', anthropic: 'k' })).toBe('gateway');
  });
  it('prefers the gateway key when asked to', () => {
    expect(keyFor('anthropic', { gateway: 'k', anthropic: 'k' }, false)).toBe('gateway');
    expect(keyFor('anthropic', { anthropic: 'k' }, false)).toBe('anthropic');
  });
  it('always uses the gateway for gateway-only providers', () => {
    expect(keyFor('bfl', { gateway: 'k', openai: 'k' })).toBe('gateway');
  });
  it('falls back to the provider key', () => {
    expect(keyFor('anthropic', { anthropic: 'k' })).toBe('anthropic');
  });
  it('needs the gateway for gateway-only providers', () => {
    expect(keyFor('bfl', { openai: 'k' })).toBeNull();
  });
  it('returns null with no usable key', () => {
    expect(keyFor('xai', { anthropic: 'k' })).toBeNull();
  });
});

describe('catalog', () => {
  it('defaults point at real catalog entries', () => {
    expect(TEXT_MODELS.some((m) => m.id === DEFAULT_MODELS.text)).toBe(true);
    for (const id of DEFAULT_MODELS.images) expect(IMAGE_MODELS.some((m) => m.id === id)).toBe(true);
  });
  it('prices text and pictures', () => {
    expect(textCostUsd('anthropic/claude-opus-5.5', 1_000_000, 100_000)).toBeCloseTo(6);
    expect(imageCostUsd('openai/gpt-image-2', 10)).toBeCloseTo(0.54);
  });
});
