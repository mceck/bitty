import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { TabButton } from "./TabButton.js";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

afterEach(cleanup);

describe("TabButton (smoke)", () => {
  it("renders its children", () => {
    const { lastFrame, unmount } = render(
      <TabButton onClick={() => {}}>Main</TabButton>
    );
    expect(strip(lastFrame() ?? "")).toContain("Main");
    unmount();
  });

  it("renders without throwing when active/inactive", () => {
    const active = render(
      <TabButton active onClick={() => {}}>
        Tab A
      </TabButton>
    );
    expect(strip(active.lastFrame() ?? "")).toContain("Tab A");
    active.unmount();

    const inactive = render(
      <TabButton active={false} onClick={() => {}}>
        Tab B
      </TabButton>
    );
    expect(strip(inactive.lastFrame() ?? "")).toContain("Tab B");
    inactive.unmount();
  });

  it("renders without throwing with borderLess", () => {
    const { lastFrame, unmount } = render(
      <TabButton borderLess onClick={() => {}}>
        Plain
      </TabButton>
    );
    expect(strip(lastFrame() ?? "")).toContain("Plain");
    // borderLess must not draw a box border around the label.
    expect(strip(lastFrame() ?? "")).not.toMatch(/[╭╮╰╯│─]/);
    unmount();
  });
});
