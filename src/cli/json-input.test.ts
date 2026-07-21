import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FailError extends Error {}

vi.mock("./ui.js", () => ({
  fail: vi.fn((message: string) => {
    throw new FailError(message);
  }),
}));

const { readJsonInput } = await import("./json-input.js");
const { fail } = await import("./ui.js");

let tmpDir: string | undefined;

beforeEach(() => {
  // `vi.mock` factory functions produce plain vi.fn()s, whose call history the
  // vitest.config.ts `restoreMocks` setting does not clear (only real vi.spyOn
  // spies are restored) — clear explicitly so mock.calls[0] means "this test".
  vi.mocked(fail).mockClear();
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

async function writeTempFile(contents: string): Promise<string> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bitty-json-input-test-"));
  const filePath = path.join(tmpDir, "input.json");
  await fs.writeFile(filePath, contents, "utf-8");
  return filePath;
}

/** Temporarily replaces process.stdin's async iterator with one yielding the given chunks. */
function withStdinChunks<T>(chunks: Buffer[], run: () => Promise<T>): Promise<T> {
  const original = (process.stdin as any)[Symbol.asyncIterator];
  (process.stdin as any)[Symbol.asyncIterator] = async function* () {
    for (const chunk of chunks) yield chunk;
  };
  return run().finally(() => {
    (process.stdin as any)[Symbol.asyncIterator] = original;
  });
}

describe("readJsonInput", () => {
  it("reads and parses valid JSON from a real file", async () => {
    const filePath = await writeTempFile(JSON.stringify({ name: "Item", count: 3 }));
    const result = await readJsonInput(filePath);
    expect(result).toEqual({ name: "Item", count: 3 });
  });

  it("fails with a message naming the file path on invalid JSON", async () => {
    const filePath = await writeTempFile("{ not valid json");
    await expect(readJsonInput(filePath)).rejects.toThrow(FailError);
    const message = vi.mocked(fail).mock.calls[0]![0] as string;
    expect(message).toContain(filePath);
    expect(message).not.toContain("stdin");
  });

  it('reads and parses valid JSON from stdin when source is "-"', async () => {
    const chunks = [
      Buffer.from('{"name":"Fro'),
      Buffer.from('m Stdin","ok":true}'),
    ];
    const result = await withStdinChunks(chunks, () => readJsonInput("-"));
    expect(result).toEqual({ name: "From Stdin", ok: true });
  });

  it('fails with a message naming "stdin" on invalid JSON from stdin', async () => {
    const chunks = [Buffer.from("not json at all")];
    await expect(
      withStdinChunks(chunks, () => readJsonInput("-"))
    ).rejects.toThrow(FailError);
    const message = vi.mocked(fail).mock.calls[0]![0] as string;
    expect(message).toContain("stdin");
  });
});
