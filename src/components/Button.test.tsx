import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { Button } from "./Button.js";
import { flush } from "../test-utils/ink-flush.js";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

// A render() left mounted (no explicit unmount()) keeps its App instance's
// focus/input listeners alive, which can interfere with later tests in the
// same file (e.g. stealing autoFocus). Always clean up between tests.
afterEach(cleanup);

describe("Button (smoke)", () => {
  it("renders its children", () => {
    const { lastFrame } = render(<Button onClick={() => {}}>Save</Button>);
    expect(strip(lastFrame() ?? "")).toContain("Save");
  });

  it("renders without throwing when inactive", () => {
    const { lastFrame } = render(
      <Button isActive={false} onClick={() => {}}>
        Disabled
      </Button>
    );
    expect(strip(lastFrame() ?? "")).toContain("Disabled");
  });

  it("renders without throwing with doubleConfirm/tripleConfirm", () => {
    const a = render(
      <Button doubleConfirm onClick={() => {}}>
        Delete
      </Button>
    );
    expect(strip(a.lastFrame() ?? "")).toContain("Delete");

    const b = render(
      <Button tripleConfirm onClick={() => {}}>
        Wipe
      </Button>
    );
    expect(strip(b.lastFrame() ?? "")).toContain("Wipe");
  });

  it("calls onClick on Enter when autoFocus is set", async () => {
    let clicked = false;
    const { stdin, unmount } = render(
      <Button autoFocus onClick={() => (clicked = true)}>
        Go
      </Button>
    );
    await flush();
    stdin.write("\r");
    await flush();
    expect(clicked).toBe(true);
    unmount();
  });

  it("with doubleConfirm, the first Enter asks for confirmation and only the second Enter calls onClick", async () => {
    let clicks = 0;
    const { stdin, lastFrame, unmount } = render(
      <Button autoFocus doubleConfirm onClick={() => clicks++}>
        Delete
      </Button>
    );
    await flush();
    stdin.write("\r");
    await flush();
    expect(clicks).toBe(0);
    expect(strip(lastFrame() ?? "")).toContain("Confirm?");
    stdin.write("\r");
    await flush();
    expect(clicks).toBe(1);
    unmount();
  });
});
