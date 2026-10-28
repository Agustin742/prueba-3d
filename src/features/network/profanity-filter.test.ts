import { describe, expect, it } from 'vitest';
import { filterProfanityPlain, renderFilteredContent } from './profanity-filter';
import React from 'react';

describe('profanity-filter', () => {
  it('replaces common Argentine profanities with Integrar in plain text', () => {
    expect(filterProfanityPlain('pedazo de puto', true)).toBe('pedazo de Integrar');
    expect(filterProfanityPlain('sos una mierda', true)).toBe('sos una Integrar');
    expect(filterProfanityPlain('que pelotudo sos', true)).toBe('que Integrar sos');
    expect(filterProfanityPlain('¡trolo!', true)).toBe('¡Integrar!');
  });

  it('is case-insensitive', () => {
    expect(filterProfanityPlain('PUTA', true)).toBe('Integrar');
    expect(filterProfanityPlain('Mierda', true)).toBe('Integrar');
  });

  it('leaves clean text untouched', () => {
    expect(filterProfanityPlain('hola como estas amigo', true)).toBe('hola como estas amigo');
  });

  it('does nothing when disabled', () => {
    expect(filterProfanityPlain('pedazo de puto', false)).toBe('pedazo de puto');
  });

  it('renders React strong elements for matched profanities', () => {
    const result = renderFilteredContent('pedazo de puto', true);
    expect(Array.isArray(result)).toBe(true);
    if (Array.isArray(result)) {
      expect(result[0]).toBe('pedazo de ');
      expect(React.isValidElement(result[1])).toBe(true);
      const el = result[1] as React.ReactElement<{ children?: string }>;
      expect(el.props.children).toBe('Integrar');
      expect(el.type).toBe('strong');
    }
  });
});
