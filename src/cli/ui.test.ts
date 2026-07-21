import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class ExitError extends Error {
  code: number | undefined;
  constructor(code?: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

vi.mock("prompts", () => ({
  default: vi.fn(),
}));

const promptsLib = (await import("prompts")).default;
const {
  style,
  printSuccess,
  printError,
  printWarn,
  printInfo,
  fail,
  renderTable,
  promptText,
  promptPassword,
  promptConfirm,
  promptSelect,
} = await import("./ui.js");

function stubExit() {
  return vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new ExitError(code);
  }) as never);
}

beforeEach(() => {
  // `vi.mock("prompts")` produces a plain vi.fn(), whose call history the
  // vitest.config.ts `restoreMocks` setting does not clear (only real vi.spyOn
  // spies are restored) — clear explicitly so mock.calls[0] means "this test".
  vi.mocked(promptsLib).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("style", () => {
  it("exposes chalk-based text styling functions that return strings containing the input", () => {
    for (const fn of [style.brand, style.success, style.error, style.warn, style.dim, style.bold]) {
      expect(fn("text")).toContain("text");
    }
  });
});

describe("renderTable", () => {
  it('returns "No results." for an empty row set', () => {
    expect(renderTable(["ID", "NAME"], [])).toContain("No results.");
  });

  it("aligns columns to the widest cell per column and trims trailing whitespace", () => {
    const table = renderTable(
      ["ID", "NAME"],
      [
        ["1", "Short"],
        ["12345", "A much longer name"],
      ]
    );
    const lines = table.split("\n");
    expect(lines).toHaveLength(3); // header + 2 rows
    // Column 0 must be padded to the widest cell ("12345" = 5 chars).
    expect(lines[1]!.startsWith("1    ")).toBe(true);
    expect(lines[2]!.startsWith("12345")).toBe(true);
    // No trailing whitespace on any line.
    for (const line of lines) expect(line).toBe(line.trimEnd());
    // Content itself is preserved.
    expect(lines[1]).toContain("Short");
    expect(lines[2]).toContain("A much longer name");
  });

  it("pads header to at least its own length even if no cell is wider", () => {
    const table = renderTable(["VERYLONGHEADER"], [["x"]]);
    const lines = table.split("\n");
    expect(lines[0]).toContain("VERYLONGHEADER");
  });
});

describe("print helpers", () => {
  it("printSuccess logs to console.log including the message", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printSuccess("All good");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toContain("All good");
  });

  it("printError logs to console.error including the message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    printError("Something broke");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toContain("Something broke");
  });

  it("printWarn logs to console.error including the message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    printWarn("Careful");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toContain("Careful");
  });

  it("printInfo logs to console.log including the message", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printInfo("FYI");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toContain("FYI");
  });
});

describe("fail", () => {
  it("prints the error and exits with the default code 1", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = stubExit();
    expect(() => fail("boom")).toThrow(ExitError);
    expect(errSpy.mock.calls[0]![0]).toContain("boom");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with a custom exit code", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = stubExit();
    expect(() => fail("aborted", 130)).toThrow(ExitError);
    expect(exitSpy).toHaveBeenCalledWith(130);
  });
});

describe("prompt wrappers", () => {
  it("promptText forwards a text prompt and returns the resolved value", async () => {
    vi.mocked(promptsLib).mockResolvedValueOnce({ value: "hello" });
    const result = await promptText("Enter something", { initial: "default" });
    expect(result).toBe("hello");
    const question = vi.mocked(promptsLib).mock.calls[0]![0] as any;
    expect(question.type).toBe("text");
    expect(question.initial).toBe("default");
  });

  it("promptPassword forwards a password prompt", async () => {
    vi.mocked(promptsLib).mockResolvedValueOnce({ value: "s3cr3t" });
    const result = await promptPassword("Master password");
    expect(result).toBe("s3cr3t");
    const question = vi.mocked(promptsLib).mock.calls[0]![0] as any;
    expect(question.type).toBe("password");
  });

  it("promptConfirm forwards a confirm prompt with the given initial value", async () => {
    vi.mocked(promptsLib).mockResolvedValueOnce({ value: true });
    const result = await promptConfirm("Are you sure?", true);
    expect(result).toBe(true);
    const question = vi.mocked(promptsLib).mock.calls[0]![0] as any;
    expect(question.type).toBe("confirm");
    expect(question.initial).toBe(true);
  });

  it("promptSelect forwards a select prompt with choices", async () => {
    vi.mocked(promptsLib).mockResolvedValueOnce({ value: "b" });
    const choices = [
      { title: "A", value: "a" },
      { title: "B", value: "b" },
    ];
    const result = await promptSelect("Pick one", choices);
    expect(result).toBe("b");
    const question = vi.mocked(promptsLib).mock.calls[0]![0] as any;
    expect(question.type).toBe("select");
    expect(question.choices).toBe(choices);
  });

  it("aborts (exit code 130) when the underlying prompt is cancelled", async () => {
    vi.mocked(promptsLib).mockResolvedValueOnce({});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = stubExit();
    await expect(promptText("Enter something")).rejects.toThrow(ExitError);
    expect(exitSpy).toHaveBeenCalledWith(130);
    expect(errSpy.mock.calls[0]![0]).toContain("Aborted");
  });
});
