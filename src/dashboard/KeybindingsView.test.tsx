import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { flush } from "../test-utils/ink-flush.js";

// See VaultList.test.tsx: ink-testing-library's fake stdout has no `rows`,
// and this component sizes its visible row count from it.
vi.mock("ink", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ink")>();
  return {
    ...actual,
    useStdout: () => {
      const real = actual.useStdout();
      return { ...real, stdout: { ...real.stdout, rows: 40 } };
    },
  };
});

const { KeybindingsView } = await import("./KeybindingsView.js");

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

afterEach(cleanup);

describe("KeybindingsView (smoke)", () => {
  it("renders every action label and its default binding", () => {
    const { lastFrame, unmount } = render(<KeybindingsView onClose={() => {}} />);
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("Logout");
    expect(frame).toContain("Next Tab");
    expect(frame).toContain("Ctrl+W");
    expect(frame).toContain("Reset to defaults");
    unmount();
  });

  it("moves the selection pointer down on the down arrow", async () => {
    const { stdin, lastFrame, unmount } = render(<KeybindingsView onClose={() => {}} />);
    await flush();
    const before = strip(lastFrame() ?? "");
    const firstLineWithPointer = before.split("\n").find((l) => l.includes("▶"));
    stdin.write("\x1b[B"); // down arrow
    await flush();
    const after = strip(lastFrame() ?? "");
    const secondLineWithPointer = after.split("\n").find((l) => l.includes("▶"));
    expect(secondLineWithPointer).not.toEqual(firstLineWithPointer);
    unmount();
  });

  it("calls onClose on Escape", async () => {
    let closed = false;
    const { stdin, unmount } = render(<KeybindingsView onClose={() => (closed = true)} />);
    await flush();
    stdin.write("\x1b");
    await flush();
    expect(closed).toBe(true);
    unmount();
  });

  it("enters capture mode on Enter, showing 'Press new key...'", async () => {
    const { stdin, lastFrame, unmount } = render(<KeybindingsView onClose={() => {}} />);
    await flush();
    stdin.write("\r");
    await flush();
    expect(strip(lastFrame() ?? "")).toContain("Press new key...");
    unmount();
  });
});
