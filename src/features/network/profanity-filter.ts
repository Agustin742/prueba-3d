import React from 'react';

// Common Argentine profanities and offensive slang
export const PROFANITY_WORDS: readonly string[] = [
  'puto', 'puta', 'putos', 'putas', 'putito', 'putita', 'putitos', 'putitas',
  'trolo', 'trola', 'trolos', 'trolas', 'trolito', 'trolita',
  'mierda', 'mierdas',
  'concha', 'conchas', 'conchudo', 'conchuda', 'conchudos', 'conchudas',
  'pelotudo', 'pelotuda', 'pelotudos', 'pelotudas',
  'forro', 'forra', 'forros', 'forras',
  'boludo', 'boluda', 'boludos', 'boludas', 'boludito', 'boludita',
  'choto', 'chota', 'chotos', 'chotas',
  'pija', 'pijas',
  'orto', 'ortos',
  'garca', 'garcas',
  'culiao', 'culiada', 'culiado', 'culiaos',
  'hdp', 'lcdtm',
];

// Regex matching whole words case-insensitively with unicode word boundaries
const pattern = PROFANITY_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
export const PROFANITY_REGEX = new RegExp(`(?<=^|[^\\p{L}\\p{N}])(${pattern})(?=[^\\p{L}\\p{N}]|$)`, 'giu');

/**
 * Replaces profanities with plain string "Integrar".
 */
export function filterProfanityPlain(text: string, enabled = true): string {
  if (!enabled || !text) return text;
  return text.replace(PROFANITY_REGEX, 'Integrar');
}

/**
 * Splits text and replaces profanities with bold <strong>Integrar</strong> elements.
 */
export function renderFilteredContent(text: string, enabled = true): React.ReactNode {
  if (!enabled || !text) return text;

  // Split keeping matches
  const parts = text.split(PROFANITY_REGEX);
  if (parts.length === 1) return text;

  // PROFANITY_REGEX with capture group alternates: [text, match, text, match, ...]
  return parts.map((part, index) => {
    // Check if this part matches one of the profanities
    const isProfane = PROFANITY_WORDS.some(w => w.toLowerCase() === part.toLowerCase());
    if (isProfane) {
      return React.createElement('strong', {
        key: index,
        className: 'profanity-replacement',
      }, 'Integrar');
    }
    return part;
  });
}
