/**
 * Test-only helper for ink-testing-library-based component tests.
 *
 * Ink wires focus/input handling through chained `useEffect`s (e.g.
 * `useFocus`'s autoFocus effect sets state, which triggers a re-render, whose
 * OWN effect then subscribes `useInput`'s listener). Passive effects run on a
 * later macrotask than the one a single `await new Promise(r => setTimeout(r,
 * N))` resolves on, so code like:
 *
 *   render(<Component />);
 *   await new Promise(r => setTimeout(r, 300));
 *   stdin.write("\r"); // <-- can fire before the listener is even attached
 *
 * silently drops the write: the listener isn't subscribed yet, and
 * EventEmitter never queues an event for a not-yet-registered listener.
 * Confirmed empirically: a single wait, however long, isn't sufficient — what
 * matters is the *number* of event-loop turns, not elapsed time. Awaiting
 * this a couple of times between mounting/writing and asserting gives every
 * link in that effect chain a turn to run.
 *
 * Separately, Ink's input parser buffers a lone ESC byte for up to 20ms
 * (`pendingInputFlushDelayMilliseconds` in ink's App.js) before deciding it's
 * really a standalone Escape and not the start of a longer arrow-key/kitty
 * sequence — a single write("\x1b") needs real wall-clock time to pass, not
 * just extra event-loop turns, or the emitted 'input' event never fires
 * within the test. Each tick below waits 10ms (not 0) so 3 default calls
 * clear both that debounce and the effect-chain issue above.
 *
 * Not a *.test.ts file: vitest won't pick this up as a test suite on its own.
 */
export async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
