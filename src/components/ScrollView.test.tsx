import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { Text } from "ink";
import { ScrollView } from "./ScrollView.js";
import { flush } from "../test-utils/ink-flush.js";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

afterEach(cleanup);

const items = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];

describe("ScrollView (smoke)", () => {
  it("renders only `count` items starting at the current offset", () => {
    const { lastFrame, unmount } = render(
      <ScrollView count={2} list={items} isActive={false} selectedIndex={0}>
        {({ el }) => <Text key={el}>{el}</Text>}
      </ScrollView>
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("Alpha");
    expect(frame).toContain("Bravo");
    expect(frame).not.toContain("Charlie");
    unmount();
  });

  it("marks the element at selectedIndex as selected", () => {
    let selectedEl: string | undefined;
    const { unmount } = render(
      <ScrollView count={5} list={items} isActive={false} selectedIndex={2}>
        {({ el, selected }) => {
          if (selected) selectedEl = el;
          return <Text key={el}>{el}</Text>;
        }}
      </ScrollView>
    );
    expect(selectedEl).toBe("Charlie");
    unmount();
  });

  it("moves the selection down on the down arrow when active", async () => {
    let selected = 0;
    const { stdin, rerender, unmount } = render(
      <ScrollView
        count={5}
        list={items}
        isActive={true}
        selectedIndex={selected}
        onSelect={(i) => (selected = i)}
      >
        {({ el }) => <Text key={el}>{el}</Text>}
      </ScrollView>
    );
    await flush();
    stdin.write("[B"); // down arrow
    await flush();
    expect(selected).toBe(1);
    rerender(
      <ScrollView count={5} list={items} isActive={true} selectedIndex={selected}>
        {({ el }) => <Text key={el}>{el}</Text>}
      </ScrollView>
    );
    unmount();
  });
});
