import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CipherType } from "../clients/bw.js";
import { makeTempHome, removeTempHome } from "../test-utils/fake-home.js";

// hooks/bw.ts reads/writes real files under `os.homedir()/.config/bitty/` and
// persists sessions via the OS keychain. Neither must ever touch the
// developer's actual home directory or credential store during tests: redirect
// homedir() to a throwaway temp directory, and replace the keychain module
// with an in-memory fake.
const homeRef = vi.hoisted(() => ({ dir: "" }));

vi.mock("os", () => ({
  default: { homedir: () => homeRef.dir },
}));

vi.mock("../utils/keychain.js", () => ({
  loadSessionSecret: vi.fn(),
  saveSessionSecret: vi.fn(),
  deleteSessionSecret: vi.fn(),
}));

homeRef.dir = makeTempHome("bitty-hooks-bw-test-");
const configDir = path.join(homeRef.dir, ".config", "bitty");
const configPath = path.join(configDir, "config.json");

const { loadSessionSecret, saveSessionSecret, deleteSessionSecret } = await import(
  "../utils/keychain.js"
);
const {
  bwClient,
  loadLoginHints,
  saveLoginHints,
  loadConfig,
  saveConfig,
  clearConfig,
  createEmptyCipher,
  emptyCipher,
} = await import("./bw.js");

function readConfigFile(): any {
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
}

afterAll(() => {
  removeTempHome(homeRef.dir);
});

beforeEach(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
  vi.mocked(loadSessionSecret).mockReset().mockResolvedValue(null);
  vi.mocked(saveSessionSecret).mockReset().mockResolvedValue(undefined);
  vi.mocked(deleteSessionSecret).mockReset().mockResolvedValue(undefined);
  bwClient.keys = {};
  bwClient.refreshToken = null;
  bwClient.token = null;
  bwClient.tokenExpiration = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createEmptyCipher", () => {
  it("builds an empty Login skeleton by default", () => {
    const cipher = createEmptyCipher();
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.login).toEqual({ username: null, password: null, totp: null, uris: [] });
    expect(cipher.name).toBe("");
    expect(cipher.fields).toEqual([]);
  });

  it("emptyCipher matches createEmptyCipher()'s default output", () => {
    expect(emptyCipher).toEqual(createEmptyCipher());
  });

  it("builds an empty SecureNote skeleton", () => {
    const cipher = createEmptyCipher(CipherType.SecureNote);
    expect(cipher.secureNote).toEqual({ type: 0 });
  });

  it("builds an empty Card skeleton with all card fields null", () => {
    const cipher = createEmptyCipher(CipherType.Card);
    expect(cipher.card).toEqual({
      cardholderName: null,
      brand: null,
      number: null,
      expMonth: null,
      expYear: null,
      code: null,
    });
  });

  it("builds an empty Identity skeleton with all identity fields null", () => {
    const cipher = createEmptyCipher(CipherType.Identity);
    expect(Object.values(cipher.identity).every((v) => v === null)).toBe(true);
    expect(Object.keys(cipher.identity)).toContain("passportNumber");
  });

  it("falls back to just the base shape for a type with no dedicated template (e.g. SSHKey)", () => {
    const cipher = createEmptyCipher(CipherType.SSHKey);
    expect(cipher.login).toBeUndefined();
    expect(cipher.card).toBeUndefined();
    expect(cipher.type).toBe(CipherType.SSHKey);
  });
});

describe("loadLoginHints / saveLoginHints", () => {
  it("returns {} when no config file exists yet", async () => {
    expect(await loadLoginHints()).toEqual({});
  });

  it("round-trips email and baseUrl through the (base64-encoded) config file", async () => {
    await saveLoginHints({ email: "user@example.com", baseUrl: "https://vault.example.com" });
    expect(await loadLoginHints()).toEqual({
      email: "user@example.com",
      baseUrl: "https://vault.example.com",
    });
    // Stored as base64-encoded JSON on disk, not plaintext JSON.
    expect(() => JSON.parse(fs.readFileSync(configPath, "utf-8"))).toThrow();
  });

  it("overwrites previous hints on subsequent saves", async () => {
    await saveLoginHints({ email: "first@example.com", baseUrl: "https://one.example.com" });
    await saveLoginHints({ email: "second@example.com", baseUrl: "https://two.example.com" });
    expect(await loadLoginHints()).toEqual({
      email: "second@example.com",
      baseUrl: "https://two.example.com",
    });
  });

  it("creates the config directory if it doesn't exist", async () => {
    expect(fs.existsSync(configDir)).toBe(false);
    await saveLoginHints({ email: "a@b.com" });
    expect(fs.existsSync(configDir)).toBe(true);
  });
});

describe("loadConfig / saveConfig / clearConfig", () => {
  it("loadConfig() returns false when there is no saved session", async () => {
    expect(await loadConfig()).toBe(false);
  });

  it("saveConfig() persists the session via the keychain and the baseUrl hint on disk", async () => {
    const keys = {
      masterPasswordHash: "hash123",
      userKey: { key: new Uint8Array([1, 2, 3]), mac: new Uint8Array([4, 5, 6]) },
    };
    await saveConfig({
      baseUrl: "https://vault.example.com",
      keys: keys as any,
      refreshToken: "refresh-abc",
    });

    expect(saveSessionSecret).toHaveBeenCalledTimes(1);
    const persisted = JSON.parse(vi.mocked(saveSessionSecret).mock.calls[0]![0] as string);
    expect(persisted.refreshToken).toBe("refresh-abc");
    expect(persisted.keys.masterPasswordHash).toBe("hash123");
    expect(persisted.keys.userKey.key).toEqual([1, 2, 3]);

    expect(readConfigFile().baseUrl).toBe("https://vault.example.com");
  });

  it("loadConfig() restores keys/refreshToken from the keychain and refreshes the token", async () => {
    const savedSession = JSON.stringify({
      keys: {
        masterPasswordHash: "hash123",
        userKey: { key: [1, 2, 3, 4], mac: [5, 6, 7, 8] },
      },
      refreshToken: "refresh-abc",
    });
    vi.mocked(loadSessionSecret).mockResolvedValue(savedSession);
    await fs.promises.mkdir(configDir, { recursive: true });
    fs.writeFileSync(
      configPath,
      Buffer.from(JSON.stringify({ baseUrl: "https://vault.example.com" })).toString("base64")
    );

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "new-token", refresh_token: "new-refresh", expires_in: 60 }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadConfig();

    expect(result).toBe(true);
    expect(bwClient.apiUrl).toBe("https://vault.example.com/api");
    expect(Buffer.from(bwClient.keys.userKey!.key)).toEqual(Buffer.from([1, 2, 3, 4]));
    expect(bwClient.keys.masterPasswordHash).toBe("hash123");
    expect(bwClient.token).toBe("new-token");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("loadConfig() returns false and resets client state when the stored session is corrupt", async () => {
    vi.mocked(loadSessionSecret).mockResolvedValue("not valid json{");
    bwClient.token = "stale-token";

    const result = await loadConfig();

    expect(result).toBe(false);
    expect(bwClient.keys).toEqual({});
    expect(bwClient.token).toBeNull();
  });

  it("loadConfig() returns false when the keychain has no saved secret", async () => {
    vi.mocked(loadSessionSecret).mockResolvedValue(null);
    expect(await loadConfig()).toBe(false);
  });

  it("clearConfig() deletes the keychain secret and the on-disk config file", async () => {
    await saveLoginHints({ email: "a@b.com" });
    expect(fs.existsSync(configPath)).toBe(true);

    await clearConfig();

    expect(deleteSessionSecret).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(configPath)).toBe(false);
  });

  it("clearConfig() is safe to call when there is nothing saved yet", async () => {
    await expect(clearConfig()).resolves.toBeUndefined();
    expect(deleteSessionSecret).toHaveBeenCalledTimes(1);
  });
});
