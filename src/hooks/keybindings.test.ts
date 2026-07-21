import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Key } from "ink";
import { makeTempHome, removeTempHome } from "../test-utils/fake-home.js";

// keybindings.tsx reads/writes real files under `os.homedir()/.config/bitty/`.
// Never let that touch the developer's real home directory: redirect
// homedir() to a throwaway temp directory instead.
const homeRef = vi.hoisted(() => ({ dir: "" }));

vi.mock("os", () => ({
  default: { homedir: () => homeRef.dir },
}));

homeRef.dir = makeTempHome("bitty-keybindings-test-");
const configDir = path.join(homeRef.dir, ".config", "bitty");
const keybindsPath = path.join(configDir, "keybinds.json");

const {
  DEFAULT_KEYBINDINGS,
  displayBinding,
  captureBinding,
  matchBinding,
  loadKeybindings,
  saveKeybindings,
} = await import("./keybindings.js");

function key(overrides: Partial<Key> = {}): Key {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    ...overrides,
  } as Key;
}

afterAll(() => {
  removeTempHome(homeRef.dir);
});

beforeEach(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("displayBinding", () => {
  it("uppercases a plain letter key with no modifiers", () => {
    expect(displayBinding({ key: "w" })).toBe("W");
  });

  it("prepends Ctrl/Shift/Meta in a fixed order", () => {
    expect(displayBinding({ ctrl: true, key: "w" })).toBe("Ctrl+W");
    expect(displayBinding({ ctrl: true, shift: true, key: "w" })).toBe("Ctrl+Shift+W");
    expect(displayBinding({ ctrl: true, shift: true, meta: true, key: "w" })).toBe(
      "Ctrl+Shift+Meta+W"
    );
  });

  it.each([
    ["upArrow", "↑"],
    ["downArrow", "↓"],
    ["leftArrow", "←"],
    ["rightArrow", "→"],
    ["escape", "Esc"],
    ["return", "Enter"],
    ["tab", "Tab"],
    ["backspace", "Backspace"],
    ["delete", "Delete"],
    ["pageUp", "PgUp"],
    ["pageDown", "PgDn"],
    ["space", "Space"],
  ] as const)("displays special key %s as %s", (specialKey, expected) => {
    expect(displayBinding({ key: specialKey })).toBe(expected);
  });

  it("leaves non-letter, non-special keys as-is (uppercased)", () => {
    expect(displayBinding({ key: "/" })).toBe("/");
  });
});

describe("captureBinding", () => {
  it("refuses to capture Ctrl+C (terminal interrupt signal)", () => {
    expect(captureBinding("c", key({ ctrl: true }))).toBeNull();
  });

  it("refuses to capture Ctrl+Z (terminal suspend signal)", () => {
    expect(captureBinding("z", key({ ctrl: true }))).toBeNull();
  });

  it("refuses to capture a bare Escape (used to cancel capture mode)", () => {
    expect(captureBinding("", key({ escape: true }))).toBeNull();
  });

  it("KNOWN LIMITATION: Escape+modifier is still never captured, because the key-name " +
      "chain below has no `key.escape` branch — only bare Escape is explicitly rejected, " +
      "but Escape+Ctrl/Shift/Meta silently falls through to the final `else return null`", () => {
    expect(captureBinding("", key({ escape: true, ctrl: true }))).toBeNull();
  });

  it.each([
    ["upArrow", { upArrow: true }],
    ["downArrow", { downArrow: true }],
    ["leftArrow", { leftArrow: true }],
    ["rightArrow", { rightArrow: true }],
    ["return", { return: true }],
    ["tab", { tab: true }],
    ["backspace", { backspace: true }],
    ["delete", { delete: true }],
    ["pageUp", { pageUp: true }],
    ["pageDown", { pageDown: true }],
  ] as const)("captures the special key %s", (expectedKeyName, keyFlags) => {
    const result = captureBinding("", key(keyFlags));
    expect(result?.key).toBe(expectedKeyName);
  });

  it("captures a space input as the 'space' key", () => {
    expect(captureBinding(" ", key())?.key).toBe("space");
  });

  it("captures and lowercases a plain character", () => {
    expect(captureBinding("W", key())?.key).toBe("w");
  });

  it("captures modifiers alongside a regular key, omitting false ones", () => {
    const result = captureBinding("n", key({ ctrl: true, shift: true }));
    expect(result).toEqual({ ctrl: true, shift: true, meta: undefined, key: "n" });
  });

  it("returns null when there is no input and no recognized special key", () => {
    expect(captureBinding("", key())).toBeNull();
  });
});

describe("matchBinding", () => {
  it("requires modifiers to match exactly", () => {
    expect(matchBinding("w", key(), { key: "w" })).toBe(true);
    expect(matchBinding("w", key({ ctrl: true }), { key: "w" })).toBe(false);
    expect(matchBinding("w", key(), { ctrl: true, key: "w" })).toBe(false);
    expect(matchBinding("w", key({ ctrl: true }), { ctrl: true, key: "w" })).toBe(true);
  });

  it.each([
    ["upArrow", { upArrow: true }],
    ["downArrow", { downArrow: true }],
    ["leftArrow", { leftArrow: true }],
    ["rightArrow", { rightArrow: true }],
    ["escape", { escape: true }],
    ["return", { return: true }],
    ["tab", { tab: true }],
    ["backspace", { backspace: true }],
    ["delete", { delete: true }],
    ["pageUp", { pageUp: true }],
    ["pageDown", { pageDown: true }],
  ] as const)("matches the special binding %s only when the flag is set", (bindingKey, keyFlags) => {
    expect(matchBinding("", key(keyFlags), { key: bindingKey })).toBe(true);
    expect(matchBinding("", key(), { key: bindingKey })).toBe(false);
  });

  it("matches 'space' binding only against a literal space input", () => {
    expect(matchBinding(" ", key(), { key: "space" })).toBe(true);
    expect(matchBinding("x", key(), { key: "space" })).toBe(false);
  });

  it("falls back to plain input equality for ordinary keys", () => {
    expect(matchBinding("/", key(), { key: "/" })).toBe(true);
    expect(matchBinding("x", key(), { key: "/" })).toBe(false);
  });
});

describe("loadKeybindings / saveKeybindings", () => {
  it("returns a copy of the defaults when no file exists yet", async () => {
    const loaded = await loadKeybindings();
    expect(loaded).toEqual(DEFAULT_KEYBINDINGS);
    expect(loaded).not.toBe(DEFAULT_KEYBINDINGS);
  });

  it("persists only the entries that differ from the defaults", async () => {
    const customized = { ...DEFAULT_KEYBINDINGS, logout: { ctrl: true, key: "q" } };
    await saveKeybindings(customized);

    const onDisk = JSON.parse(fs.readFileSync(keybindsPath, "utf-8"));
    expect(onDisk).toEqual({ logout: { ctrl: true, key: "q" } });
  });

  it("round-trips a customized binding, leaving the rest at their defaults", async () => {
    const customized = { ...DEFAULT_KEYBINDINGS, logout: { ctrl: true, key: "q" } };
    await saveKeybindings(customized);

    const loaded = await loadKeybindings();
    expect(loaded.logout).toEqual({ ctrl: true, key: "q" });
    expect(loaded.nextTab).toEqual(DEFAULT_KEYBINDINGS.nextTab);
  });

  it("writes an empty override object (and still creates the file) when nothing changed", async () => {
    await saveKeybindings({ ...DEFAULT_KEYBINDINGS });
    expect(fs.existsSync(keybindsPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(keybindsPath, "utf-8"))).toEqual({});
  });

  it("falls back to the defaults when the saved file is corrupt", async () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(keybindsPath, "not valid json{");
    expect(await loadKeybindings()).toEqual(DEFAULT_KEYBINDINGS);
  });

  it("creates the config directory on first save", async () => {
    expect(fs.existsSync(configDir)).toBe(false);
    await saveKeybindings({ ...DEFAULT_KEYBINDINGS });
    expect(fs.existsSync(configDir)).toBe(true);
  });
});
