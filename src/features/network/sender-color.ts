export const SENDER_COLORS: readonly string[] = [
  '#1d4ed8', // Blue
  '#6d28d9', // Violet
  '#047857', // Emerald
  '#be123c', // Crimson
  '#b45309', // Amber
  '#0e7490', // Teal
  '#a21caf', // Fuchsia
  '#c2410c', // Orange
  '#4338ca', // Indigo
  '#0f766e', // Deep Teal
];

export function getSenderColor(sender: string): string {
  if (!sender) return SENDER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < sender.length; i++) {
    hash = (hash << 5) - hash + sender.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % SENDER_COLORS.length;
  return SENDER_COLORS[index];
}
