import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { Checkbox } from "./Checkbox.js";
import { flush } from "../test-utils/ink-flush.js";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

afterEach(cleanup);

describe("Checkbox (smoke)", () => {
  it("renders the label", () => {
    const { lastFrame, unmount } = render(
      <Checkbox value={false} label="Remember me" onToggle={() => {}} />
    );
    expect(strip(lastFrame() ?? "")).toContain("Remember me");
    unmount();
  });

  it("shows the checkmark only when value is true", () => {
    const unchecked = render(<Checkbox value={false} label="x" onToggle={() => {}} />);
    expect(strip(unchecked.lastFrame() ?? "")).not.toContain("X");
    unchecked.unmount();

    const checked = render(<Checkbox value={true} label="x" onToggle={() => {}} />);
    expect(strip(checked.lastFrame() ?? "")).toContain("X");
    checked.unmount();
  });

  it("toggles via Space once focused (Tab moves focus to it, since Checkbox has no autoFocus)", async () => {
    let value = false;
    const { stdin, unmount } = render(
      <Checkbox
        value={value}
        label="opt"
        onToggle={(v) => {
          value = v;
        }}
      />
    );
    await flush();
    stdin.write("\t");
    await flush();
    stdin.write(" ");
    await flush();
    expect(value).toBe(true);
    unmount();
  });
});
