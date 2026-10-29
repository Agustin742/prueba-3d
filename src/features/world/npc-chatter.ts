/** One clip of a gesture: played once, or held (looping) for `hold` seconds. */
export interface GestureStep {
  clip: string;
  hold?: number;
}

export const yesSequence = (): GestureStep[] => [{ clip: 'Yes' }];

/** ThinkStart -> Think held 2-3 s -> ThinkEnd; `random` in [0, 1) picks the hold. */
export const thinkSequence = (random: number): GestureStep[] => [
  { clip: 'ThinkStart' },
  { clip: 'Think', hold: 2 + random },
  { clip: 'ThinkEnd' },
];

export const chatterMinDelayMs = 15_000;
export const chatterMaxDelayMs = 40_000;
/** Matches how long player chat bubbles stay visible. */
export const chatterBubbleMs = 6000;

export interface NpcChatterOptions {
  lines: readonly string[];
  /** Returns a number in [0, 1); injected so tests are deterministic. */
  random: () => number;
  /** Receives the line to show, then null when the bubble expires. */
  onLine(text: string | null): void;
  /** Absent when the NPC cannot animate (reduced motion): the bubble is shown alone. */
  playGesture?(steps: GestureStep[]): Promise<void>;
}

/** Schedules random local chatter. Returns the function that cancels every pending timer. */
export function startNpcChatter({ lines, random, onLine, playGesture }: NpcChatterOptions): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let stopped = false;
  let lastIndex = -1;

  const after = (ms: number, run: () => void) => {
    const timer = setTimeout(() => { timers.delete(timer); if (!stopped) run(); }, ms);
    timers.add(timer);
  };

  const schedule = () => after(chatterMinDelayMs + random() * (chatterMaxDelayMs - chatterMinDelayMs), speak);

  function speak() {
    if (lines.length === 0) return;
    // Draw among the other lines so the same one never repeats back to back.
    let index = Math.floor(random() * Math.max(lines.length - 1, 1));
    if (lastIndex >= 0 && index >= lastIndex) index++;
    lastIndex = index;
    onLine(lines[index]);
    if (playGesture) playGesture(random() < 0.5 ? yesSequence() : thinkSequence(random())).catch(() => {});
    after(chatterBubbleMs, () => onLine(null));
    // The next interval counts from the moment the line appeared.
    schedule();
  }

  schedule();
  return () => { stopped = true; timers.forEach(clearTimeout); timers.clear(); };
}
