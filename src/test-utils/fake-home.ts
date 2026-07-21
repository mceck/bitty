/**
 * Test-only helper for src/hooks/bw.ts and src/hooks/keybindings.tsx, both of
 * which read/write files under `os.homedir()/.config/bitty/`. Tests must never
 * touch the developer's real home directory, so each test file mocks the bare
 * `"os"` specifier (the exact one those modules import) to point `homedir()`
 * at a throwaway temp directory created here.
 *
 * Deliberately avoids importing "os"/"node:os" itself: Vitest treats a builtin
 * and its "node:"-prefixed alias as the same mockable module, so a test file's
 * `vi.mock("os", ...)` would also intercept `node:os` and break `os.tmpdir()`
 * here. `process.env`/a hardcoded fallback sidestep that entirely.
 *
 * Not a *.test.ts file: vitest won't pick this up as a test suite on its own.
 */
import fs from "node:fs";
import path from "node:path";

function realTmpDir(): string {
  return process.env["TMPDIR"] || process.env["TEMP"] || process.env["TMP"] || "/tmp";
}

export function makeTempHome(prefix: string): string {
  return fs.mkdtempSync(path.join(realTmpDir(), prefix));
}

export function removeTempHome(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}
