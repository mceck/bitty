import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { TextInput } from "./TextInput.js";
import { flush } from "../test-utils/ink-flush.js";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

afterEach(cleanup);

/** A minimal controlled-input harness, since TextInput itself is fully controlled. */
function Harness(props: {
  initial?: string;
  isPassword?: boolean;
  onSubmit?: () => void;
}) {
  const [value, setValue] = useState(props.initial ?? "");
  return (
    <TextInput
      autoFocus
      value={value}
      onChange={setValue}
      isPassword={props.isPassword}
      onSubmit={props.onSubmit}
    />
  );
}

describe("TextInput (smoke)", () => {
  it("renders a placeholder when the value is empty", () => {
    const { lastFrame, unmount } = render(
      <TextInput value="" placeholder="Email address" onChange={() => {}} />
    );
    expect(strip(lastFrame() ?? "")).toContain("Email address");
    unmount();
  });

  it("renders the value in plain text by default", () => {
    const { lastFrame, unmount } = render(
      <TextInput value="hello" onChange={() => {}} />
    );
    expect(strip(lastFrame() ?? "")).toContain("hello");
    unmount();
  });

  it("masks the value when isPassword is set and not focused", () => {
    const { lastFrame, unmount } = render(
      <TextInput value="hunter2" isPassword onChange={() => {}} />
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).not.toContain("hunter2");
    expect(frame).toContain("•");
    unmount();
  });

  it("shows the real value when focused and showPasswordOnFocus is set", async () => {
    const { lastFrame, unmount } = render(
      <TextInput value="hunter2" isPassword showPasswordOnFocus autoFocus onChange={() => {}} />
    );
    await flush();
    expect(strip(lastFrame() ?? "")).toContain("hunter2");
    unmount();
  });

  it("appends typed characters to the value", async () => {
    const { stdin, lastFrame, unmount } = render(<Harness initial="ab" />);
    await flush();
    stdin.write("c");
    await flush();
    expect(strip(lastFrame() ?? "")).toContain("abc");
    unmount();
  });

  it("backspace removes the last character before the cursor", async () => {
    const { stdin, lastFrame, unmount } = render(<Harness initial="abc" />);
    await flush();
    stdin.write("\x7f"); // backspace
    await flush();
    expect(strip(lastFrame() ?? "")).toContain("ab");
    expect(strip(lastFrame() ?? "")).not.toContain("abc");
    unmount();
  });

  it("backspace at the start of the field is a no-op and does not corrupt later edits", async () => {
    const { stdin, lastFrame, unmount } = render(<Harness initial="ab" />);
    await flush();
    stdin.write("\x01"); // ctrl+a -> cursor to start
    await flush();
    stdin.write("\x7f"); // backspace at cursor 0: should do nothing
    await flush();
    expect(strip(lastFrame() ?? "")).toContain("ab");
    stdin.write("\x7f"); // backspace again at cursor 0: still should do nothing
    await flush();
    expect(strip(lastFrame() ?? "")).toContain("ab");
    unmount();
  });

  it("calls onSubmit on Enter", async () => {
    let submitted = false;
    const { stdin, unmount } = render(
      <Harness initial="value" onSubmit={() => (submitted = true)} />
    );
    await flush();
    stdin.write("\r");
    await flush();
    expect(submitted).toBe(true);
    unmount();
  });
});
