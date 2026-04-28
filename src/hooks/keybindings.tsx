import os from "os";
import fs from "fs";
import path from "path";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Key } from "ink";

export type KeybindingId =
  | "logout"
  | "nextTab"
  | "prevTab"
  | "focusSearch"
  | "newCipher"
  | "copyPrimary"
  | "copySecondary"
  | "copyTotp"
  | "copyField"
  | "cursorEnd"
  | "cursorStart"
  | "openKeybindings"
  | "refresh";

export interface KeyBinding {
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  key: string;
}

export type KeybindingsMap = Record<KeybindingId, KeyBinding>;

export const KEYBINDING_LABELS: Record<KeybindingId, string> = {
  logout: "Logout",
  nextTab: "Next Tab",
  prevTab: "Previous Tab",
  focusSearch: "Focus Search",
  newCipher: "New Cipher",
  copyPrimary: "Copy Primary (Password/Note/Key)",
  copySecondary: "Copy Secondary (Username/Pub Key)",
  copyTotp: "Copy TOTP",
  copyField: "Copy Field (in editor)",
  cursorEnd: "Cursor to End",
  cursorStart: "Cursor to Start",
  openKeybindings: "Open Keybindings",
  refresh: "Refresh Vault",
};

export const KEYBINDING_ORDER: KeybindingId[] = [
  "logout",
  "nextTab",
  "prevTab",
  "focusSearch",
  "newCipher",
  "copyPrimary",
  "copySecondary",
  "copyTotp",
  "copyField",
  "cursorEnd",
  "cursorStart",
  "openKeybindings",
  "refresh",
];

export const DEFAULT_KEYBINDINGS: KeybindingsMap = {
  logout: { ctrl: true, key: "w" },
  nextTab: { shift: true, key: "rightArrow" },
  prevTab: { shift: true, key: "leftArrow" },
  focusSearch: { key: "/" },
  newCipher: { ctrl: true, key: "n" },
  copyPrimary: { ctrl: true, key: "y" },
  copySecondary: { ctrl: true, key: "u" },
  copyTotp: { ctrl: true, key: "t" },
  copyField: { ctrl: true, key: "y" },
  cursorEnd: { ctrl: true, key: "e" },
  cursorStart: { ctrl: true, key: "a" },
  openKeybindings: { ctrl: true, key: "k" },
  refresh: { ctrl: true, key: "r" },
};

const configDir = path.join(os.homedir(), ".config", "bitty");
const keybindsPath = path.join(configDir, "keybinds.json");

export async function loadKeybindings(): Promise<KeybindingsMap> {
  try {
    if (fs.existsSync(keybindsPath)) {
      const content = await fs.promises.readFile(keybindsPath, "utf-8");
      const overrides = JSON.parse(content);
      return { ...DEFAULT_KEYBINDINGS, ...overrides };
    }
  } catch {}
  return { ...DEFAULT_KEYBINDINGS };
}

export async function saveKeybindings(
  keybindings: KeybindingsMap
): Promise<void> {
  const overrides: Partial<KeybindingsMap> = {};
  for (const [id, binding] of Object.entries(keybindings) as [
    KeybindingId,
    KeyBinding,
  ][]) {
    const def = DEFAULT_KEYBINDINGS[id];
    if (JSON.stringify(binding) !== JSON.stringify(def)) {
      overrides[id] = binding;
    }
  }
  await fs.promises.mkdir(configDir, { recursive: true });
  await fs.promises.writeFile(keybindsPath, JSON.stringify(overrides, null, 2));
}

const SPECIAL_KEY_DISPLAY: Record<string, string> = {
  upArrow: "↑",
  downArrow: "↓",
  leftArrow: "←",
  rightArrow: "→",
  escape: "Esc",
  return: "Enter",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  pageUp: "PgUp",
  pageDown: "PgDn",
  space: "Space",
};

export function displayBinding(binding: KeyBinding): string {
  const parts: string[] = [];
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.shift) parts.push("Shift");
  if (binding.meta) parts.push("Meta");
  const keyDisplay =
    SPECIAL_KEY_DISPLAY[binding.key] ?? binding.key.toUpperCase();
  parts.push(keyDisplay);
  return parts.join("+");
}

/**
 * Capture a key combination from raw Ink input.
 * Returns null if the combination should not be captured (Ctrl+C, Ctrl+Z, bare Escape).
 */
export function captureBinding(input: string, key: Key): KeyBinding | null {
  // Never capture Ctrl+C or Ctrl+Z (terminal signals)
  if (key.ctrl && (input === "c" || input === "z")) return null;
  // Bare Escape is used to cancel capture mode
  if (key.escape && !key.ctrl && !key.shift && !key.meta) return null;

  let keyName: string;
  if (key.upArrow) keyName = "upArrow";
  else if (key.downArrow) keyName = "downArrow";
  else if (key.leftArrow) keyName = "leftArrow";
  else if (key.rightArrow) keyName = "rightArrow";
  else if (key.return) keyName = "return";
  else if (key.tab) keyName = "tab";
  else if (key.backspace) keyName = "backspace";
  else if (key.delete) keyName = "delete";
  else if (key.pageUp) keyName = "pageUp";
  else if (key.pageDown) keyName = "pageDown";
  else if (input === " ") keyName = "space";
  else if (input) keyName = input.toLowerCase();
  else return null;

  return {
    ctrl: key.ctrl || undefined,
    shift: key.shift || undefined,
    meta: key.meta || undefined,
    key: keyName,
  };
}

/**
 * Returns true if the given (input, key) pair matches the binding.
 */
export function matchBinding(
  input: string,
  key: Key,
  binding: KeyBinding
): boolean {
  if (!!binding.ctrl !== !!key.ctrl) return false;
  if (!!binding.shift !== !!key.shift) return false;
  if (!!binding.meta !== !!key.meta) return false;

  switch (binding.key) {
    case "upArrow":
      return !!key.upArrow;
    case "downArrow":
      return !!key.downArrow;
    case "leftArrow":
      return !!key.leftArrow;
    case "rightArrow":
      return !!key.rightArrow;
    case "escape":
      return !!key.escape;
    case "return":
      return !!key.return;
    case "tab":
      return !!key.tab;
    case "backspace":
      return !!key.backspace;
    case "delete":
      return !!key.delete;
    case "pageUp":
      return !!key.pageUp;
    case "pageDown":
      return !!key.pageDown;
    case "space":
      return input === " ";
    default:
      return input === binding.key;
  }
}

// ── Context ────────────────────────────────────────────────────────────────

interface KeybindingsContextValue {
  keybindings: KeybindingsMap;
  updateKeybindings: (newBindings: KeybindingsMap) => Promise<void>;
}

const KeybindingsContext = createContext<KeybindingsContextValue>({
  keybindings: DEFAULT_KEYBINDINGS,
  updateKeybindings: async () => {},
});

export function KeybindingsProvider({ children }: { children: ReactNode }) {
  const [keybindings, setKeybindings] =
    useState<KeybindingsMap>(DEFAULT_KEYBINDINGS);

  useEffect(() => {
    loadKeybindings().then(setKeybindings);
  }, []);

  const updateKeybindings = async (newBindings: KeybindingsMap) => {
    await saveKeybindings(newBindings);
    setKeybindings(newBindings);
  };

  return (
    <KeybindingsContext.Provider value={{ keybindings, updateKeybindings }}>
      {children}
    </KeybindingsContext.Provider>
  );
}

export function useKeybindings() {
  return useContext(KeybindingsContext);
}
