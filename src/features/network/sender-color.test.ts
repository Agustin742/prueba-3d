import { describe, expect, it } from 'vitest';
import { getSenderColor, SENDER_COLORS } from './sender-color';

describe('getSenderColor', () => {
  it('returns a valid hex color from the palette', () => {
    const color = getSenderColor('Lucas');
    expect(SENDER_COLORS).toContain(color);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('is deterministic for the same sender name', () => {
    expect(getSenderColor('Matias')).toBe(getSenderColor('Matias'));
    expect(getSenderColor('Florencia')).toBe(getSenderColor('Florencia'));
  });

  it('handles empty sender string without error', () => {
    expect(getSenderColor('')).toBe(SENDER_COLORS[0]);
  });
});
