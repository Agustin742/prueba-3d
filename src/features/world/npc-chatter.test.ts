import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { npcLines } from './npc-lines';
import { startNpcChatter, thinkSequence, yesSequence } from './npc-chatter';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Deterministic random source that replays the given values, then repeats the last one. */
function sequence(...values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function setup(random: () => number, lines = ['uno', 'dos', 'tres']) {
  const onLine = vi.fn<(text: string | null) => void>();
  const playGesture = vi.fn<(steps: ReturnType<typeof yesSequence>) => Promise<void>>(() => Promise.resolve());
  const stop = startNpcChatter({ lines, random, onLine, playGesture });
  return { onLine, playGesture, stop };
}

it('ships a set of unique, non-empty Spanish lines', () => {
  expect(npcLines.length).toBeGreaterThanOrEqual(8);
  expect(new Set(npcLines).size).toBe(npcLines.length);
  for (const line of npcLines) expect(line.trim()).not.toBe('');
});

it('waits a uniform 15-40 s, shows a line for 6 s, then clears it', () => {
  // delay random 0 -> 15 s; line index 0; gesture pick; then 1 -> 40 s for the next delay.
  const { onLine } = setup(sequence(0, 0, 0, 1));
  vi.advanceTimersByTime(14_999);
  expect(onLine).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onLine).toHaveBeenCalledTimes(1);
  expect(onLine).toHaveBeenLastCalledWith('uno');
  vi.advanceTimersByTime(5_999);
  expect(onLine).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  expect(onLine).toHaveBeenLastCalledWith(null);
  // Next interval is scheduled from the moment the line appeared: 40 s at random 1.
  vi.advanceTimersByTime(40_000 - 6_000 - 1);
  expect(onLine).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(1);
  expect(onLine).toHaveBeenCalledTimes(3);
});

it('never repeats the same line twice in a row', () => {
  // random always 0 would pick index 0 every time without the guard.
  const { onLine } = setup(() => 0);
  vi.advanceTimersByTime(15_000 * 6);
  const seen = onLine.mock.calls.map(([text]) => text).filter((text): text is string => text !== null);
  expect(seen.length).toBeGreaterThanOrEqual(5);
  for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
});

it('plays Yes or the think sequence depending on the random pick', () => {
  const yes = setup(sequence(0, 0, 0.1));
  vi.advanceTimersByTime(15_000);
  expect(yes.playGesture).toHaveBeenCalledWith(yesSequence());
  yes.stop();

  const think = setup(sequence(0, 0, 0.9, 0));
  vi.advanceTimersByTime(15_000);
  expect(think.playGesture).toHaveBeenCalledWith(thinkSequence(0));
  expect(thinkSequence(0)).toEqual([{ clip: 'ThinkStart' }, { clip: 'Think', hold: 2 }, { clip: 'ThinkEnd' }]);
  expect(thinkSequence(1)[1]).toEqual({ clip: 'Think', hold: 3 });
  think.stop();
});

it('shows only the bubble when no gesture player is available', () => {
  const onLine = vi.fn();
  startNpcChatter({ lines: ['uno', 'dos'], random: () => 0, onLine });
  vi.advanceTimersByTime(15_000);
  expect(onLine).toHaveBeenCalledWith('uno');
});

it('clears all timers on stop and ignores a gesture that rejects', async () => {
  const { onLine, stop } = setup(() => 0);
  vi.advanceTimersByTime(15_000);
  stop();
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(100_000);
  expect(onLine).toHaveBeenCalledTimes(1);

  const failing = vi.fn(() => Promise.reject(new Error('boom')));
  const onUnhandled = vi.fn();
  process.on('unhandledRejection', onUnhandled);
  startNpcChatter({ lines: ['uno', 'dos'], random: () => 0, onLine: vi.fn(), playGesture: failing });
  vi.advanceTimersByTime(15_000);
  await Promise.resolve(); await Promise.resolve();
  process.off('unhandledRejection', onUnhandled);
  expect(onUnhandled).not.toHaveBeenCalled();
});
