import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FetchError } from "../clients/bw.js";

const { FailError } = vi.hoisted(() => {
  class FailError extends Error {}
  return { FailError };
});

vi.mock("../hooks/bw.js", () => {
  return {
    bwClient: {
      setUrls: vi.fn(),
      login: vi.fn(),
      sendEmailMfaCode: vi.fn(),
      logout: vi.fn(),
      keys: {} as Record<string, unknown>,
      refreshToken: null as string | null,
    },
    clearConfig: vi.fn(),
    loadConfig: vi.fn(),
    loadLoginHints: vi.fn(),
    saveConfig: vi.fn(),
    saveLoginHints: vi.fn(),
  };
});

vi.mock("./ui.js", () => {
  return {
    fail: vi.fn((message: string) => {
      throw new FailError(message);
    }),
    printInfo: vi.fn(),
    printSuccess: vi.fn(),
    promptSelect: vi.fn(),
    promptText: vi.fn(),
    promptPassword: vi.fn(),
  };
});

import {
  bwClient,
  clearConfig,
  loadConfig,
  loadLoginHints,
  saveConfig,
  saveLoginHints,
} from "../hooks/bw.js";
import { fail, printInfo, printSuccess, promptSelect, promptText, promptPassword } from "./ui.js";
import { ensureSession, interactiveLogin, logoutCommand } from "./auth.js";

const DEFAULT_SERVER_URL = "https://vault.bitwarden.eu";
const ENV_KEYS = ["BITTY_EMAIL", "BITTY_PASSWORD", "BITTY_TOTP", "BITTY_SERVER_URL"] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  // vitest.config.ts sets `restoreMocks: true`, but that only restores spies'
  // original implementations — plain `vi.fn()`s created inside a `vi.mock()`
  // factory (including any custom mockResolvedValue/mockRejectedValue set by
  // a previous test) keep their configuration across tests unless reset here.
  vi.resetAllMocks();
  vi.mocked(fail).mockImplementation((message: string) => {
    throw new FailError(message);
  });
  bwClient.keys = {};
  bwClient.refreshToken = null;
  vi.mocked(loadLoginHints).mockResolvedValue({});
  vi.mocked(promptPassword).mockResolvedValue("master-password");

  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("interactiveLogin", () => {
  it("fails immediately in non-interactive mode without touching bwClient.login", async () => {
    await expect(
      interactiveLogin({ interactive: false, rememberMe: false })
    ).rejects.toThrow(FailError);
    expect(bwClient.login).not.toHaveBeenCalled();
  });

  it("logs in with an explicit email (skipping the email prompt) and saves the session when rememberMe is true", async () => {
    vi.mocked(bwClient.login).mockResolvedValueOnce(undefined);
    bwClient.keys = { masterPasswordHash: "hash" };
    bwClient.refreshToken = "refresh-abc";

    await interactiveLogin({
      interactive: true,
      rememberMe: true,
      email: "user@example.com",
    });

    expect(promptText).not.toHaveBeenCalled();
    expect(bwClient.setUrls).toHaveBeenCalledWith({ baseUrl: DEFAULT_SERVER_URL });
    expect(bwClient.login).toHaveBeenCalledWith(
      "user@example.com",
      "master-password",
      false,
      undefined
    );
    expect(saveConfig).toHaveBeenCalledWith({
      baseUrl: DEFAULT_SERVER_URL,
      keys: bwClient.keys,
      refreshToken: "refresh-abc",
    });
    expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("saved"));
  });

  it("prompts for the email when none is supplied, using the saved hint as the initial value", async () => {
    vi.mocked(loadLoginHints).mockResolvedValue({ email: "hint@example.com" });
    vi.mocked(promptText).mockResolvedValueOnce("typed@example.com");
    vi.mocked(bwClient.login).mockResolvedValueOnce(undefined);

    await interactiveLogin({ interactive: true, rememberMe: false });

    expect(promptText).toHaveBeenCalledWith("Email address", { initial: "hint@example.com" });
    expect(bwClient.login).toHaveBeenCalledWith(
      "typed@example.com",
      "master-password",
      false,
      undefined
    );
  });

  it("saves only login hints (not the full session) when rememberMe is false", async () => {
    vi.mocked(bwClient.login).mockResolvedValueOnce(undefined);

    await interactiveLogin({ interactive: true, rememberMe: false, email: "user@example.com" });

    expect(saveLoginHints).toHaveBeenCalledWith({
      email: "user@example.com",
      baseUrl: DEFAULT_SERVER_URL,
    });
    expect(saveConfig).not.toHaveBeenCalled();
    expect(printSuccess).toHaveBeenCalledWith("Logged in.");
  });

  describe("server URL resolution", () => {
    it("prefers an explicit serverUrl over the saved hint", async () => {
      vi.mocked(loadLoginHints).mockResolvedValue({ baseUrl: "https://hinted.example.com" });
      vi.mocked(bwClient.login).mockResolvedValueOnce(undefined);

      await interactiveLogin({
        interactive: true,
        rememberMe: false,
        email: "u@example.com",
        serverUrl: "https://explicit.example.com",
      });

      expect(bwClient.setUrls).toHaveBeenCalledWith({ baseUrl: "https://explicit.example.com" });
    });

    it("falls back to the saved hint when no serverUrl is given", async () => {
      vi.mocked(loadLoginHints).mockResolvedValue({ baseUrl: "https://hinted.example.com" });
      vi.mocked(bwClient.login).mockResolvedValueOnce(undefined);

      await interactiveLogin({ interactive: true, rememberMe: false, email: "u@example.com" });

      expect(bwClient.setUrls).toHaveBeenCalledWith({ baseUrl: "https://hinted.example.com" });
    });

    it("falls back to the hardcoded default when neither is given", async () => {
      vi.mocked(bwClient.login).mockResolvedValueOnce(undefined);

      await interactiveLogin({ interactive: true, rememberMe: false, email: "u@example.com" });

      expect(bwClient.setUrls).toHaveBeenCalledWith({ baseUrl: DEFAULT_SERVER_URL });
    });
  });

  describe("two-factor authentication", () => {
    function mfaChallenge(providers: string[], providers2?: Record<string, any>) {
      return new FetchError(
        400,
        JSON.stringify({ TwoFactorProviders: providers, TwoFactorProviders2: providers2 })
      );
    }

    it("with a single available provider, skips the provider picker and prompts directly for the code", async () => {
      vi.mocked(bwClient.login)
        .mockRejectedValueOnce(mfaChallenge(["0"]))
        .mockResolvedValueOnce(undefined);
      vi.mocked(promptText).mockResolvedValueOnce("123456");

      await interactiveLogin({ interactive: true, rememberMe: false, email: "u@example.com" });

      expect(promptSelect).not.toHaveBeenCalled();
      expect(promptText).toHaveBeenCalledWith(expect.stringContaining("Authenticator code"));
      expect(bwClient.login).toHaveBeenCalledTimes(2);
      const secondCallArgs = vi.mocked(bwClient.login).mock.calls[1]!;
      expect(secondCallArgs[2]).toBe(true); // skipPrelogin
      expect(secondCallArgs[3]).toMatchObject({ twoFactorProvider: "0", twoFactorToken: "123456" });
    });

    it("with multiple providers, prompts to choose one before asking for the code", async () => {
      vi.mocked(bwClient.login)
        .mockRejectedValueOnce(mfaChallenge(["0", "1"]))
        .mockResolvedValueOnce(undefined);
      vi.mocked(promptSelect).mockResolvedValueOnce("0");
      vi.mocked(promptText).mockResolvedValueOnce("654321");

      await interactiveLogin({ interactive: true, rememberMe: false, email: "u@example.com" });

      expect(promptSelect).toHaveBeenCalledWith(
        "Choose a two-factor method",
        expect.arrayContaining([expect.objectContaining({ value: "0" }), expect.objectContaining({ value: "1" })])
      );
      expect(promptText).toHaveBeenCalledWith(expect.stringContaining("code"));
    });

    it("email provider ('1') with more than one option sends the email code and informs the user", async () => {
      vi.mocked(bwClient.login)
        .mockRejectedValueOnce(mfaChallenge(["0", "1"]))
        .mockResolvedValueOnce(undefined);
      vi.mocked(promptSelect).mockResolvedValueOnce("1");
      vi.mocked(promptText).mockResolvedValueOnce("999999");

      await interactiveLogin({ interactive: true, rememberMe: false, email: "u@example.com" });

      expect(bwClient.sendEmailMfaCode).toHaveBeenCalledWith("u@example.com");
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining("u@example.com"));
    });

    it("Duo provider ('2') prints the auth URL from TwoFactorProviders2 when available", async () => {
      vi.mocked(bwClient.login)
        .mockRejectedValueOnce(
          mfaChallenge(["2", "6"], { "2": { AuthUrl: "https://duo.example.com/auth" } })
        )
        .mockResolvedValueOnce(undefined);
      vi.mocked(promptSelect).mockResolvedValueOnce("2");
      vi.mocked(promptText).mockResolvedValueOnce("code|state");

      await interactiveLogin({ interactive: true, rememberMe: false, email: "u@example.com" });

      expect(printInfo).toHaveBeenCalledWith(
        expect.stringContaining("https://duo.example.com/auth")
      );
    });

    it("FIDO2 provider ('7') asks for a 'response' instead of a 'code'", async () => {
      vi.mocked(bwClient.login)
        .mockRejectedValueOnce(mfaChallenge(["7"]))
        .mockResolvedValueOnce(undefined);
      vi.mocked(promptText).mockResolvedValueOnce("webauthn-response");

      await interactiveLogin({ interactive: true, rememberMe: false, email: "u@example.com" });

      expect(promptText).toHaveBeenCalledWith(expect.stringContaining("response"));
    });

    it("consumes --totp automatically on the very first retry, without prompting, then falls back to prompting on a further failure", async () => {
      vi.mocked(bwClient.login)
        .mockRejectedValueOnce(mfaChallenge(["2", "6"]))
        .mockRejectedValueOnce(mfaChallenge(["2", "6"]))
        .mockResolvedValueOnce(undefined);
      vi.mocked(promptSelect).mockResolvedValueOnce("2");
      vi.mocked(promptText).mockResolvedValueOnce("prompted-code");

      await interactiveLogin({
        interactive: true,
        rememberMe: false,
        email: "u@example.com",
        totp: "111111",
      });

      expect(bwClient.login).toHaveBeenCalledTimes(3);
      // Second call (first retry) auto-applies --totp with no prompting at all yet.
      const secondCallArgs = vi.mocked(bwClient.login).mock.calls[1]!;
      expect(secondCallArgs[3]).toMatchObject({
        twoFactorProvider: "2", // "0" not offered, falls back to providers[0]
        twoFactorToken: "111111",
      });
      // Third call (second retry) had to fall back to interactive prompting.
      expect(promptSelect).toHaveBeenCalledTimes(1);
      expect(promptText).toHaveBeenCalledWith(expect.stringContaining("code"));
    });

    it("gives up after exceeding the maximum number of failed two-factor attempts", async () => {
      vi.mocked(bwClient.login).mockRejectedValue(mfaChallenge(["0"]));
      vi.mocked(promptText).mockResolvedValue("wrong-code");

      let caught: unknown;
      try {
        await interactiveLogin({ interactive: true, rememberMe: false, email: "u@example.com" });
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(FailError);
      expect((caught as Error).message).toMatch(/too many failed/i);
      expect(bwClient.login).toHaveBeenCalledTimes(6);
    });

    it("fails with a credentials message when the server rejects login without offering any two-factor provider", async () => {
      vi.mocked(bwClient.login).mockRejectedValueOnce(
        new FetchError(400, JSON.stringify({ ErrorModel: { Message: "invalid credentials" } }))
      );

      let caught: unknown;
      try {
        await interactiveLogin({ interactive: true, rememberMe: false, email: "u@example.com" });
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(FailError);
      expect((caught as Error).message).toMatch(/check your credentials/i);
      expect(bwClient.login).toHaveBeenCalledTimes(1);
    });

    it("rethrows the original FetchError as-is when its body isn't parseable JSON", async () => {
      const badBodyError = new FetchError(400, "not valid json{");
      vi.mocked(bwClient.login).mockRejectedValueOnce(badBodyError);

      await expect(
        interactiveLogin({ interactive: true, rememberMe: false, email: "u@example.com" })
      ).rejects.toBe(badBodyError);
      expect(fail).not.toHaveBeenCalled();
    });

    it("rethrows non-FetchError failures unchanged instead of treating them as an MFA challenge", async () => {
      const networkError = new Error("network down");
      vi.mocked(bwClient.login).mockRejectedValueOnce(networkError);

      await expect(
        interactiveLogin({ interactive: true, rememberMe: false, email: "u@example.com" })
      ).rejects.toBe(networkError);
      expect(fail).not.toHaveBeenCalled();
    });
  });
});

describe("logoutCommand", () => {
  it("logs out the client, clears the saved config and reports success", async () => {
    await logoutCommand();

    expect(bwClient.logout).toHaveBeenCalled();
    expect(clearConfig).toHaveBeenCalled();
    expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("Logged out"));
  });
});

describe("ensureSession", () => {
  it("returns immediately when a session is already saved", async () => {
    vi.mocked(loadConfig).mockResolvedValue(true);

    await ensureSession({ interactive: true });

    expect(promptPassword).not.toHaveBeenCalled();
    expect(bwClient.login).not.toHaveBeenCalled();
  });

  it("fails in non-interactive mode when there is no saved session", async () => {
    vi.mocked(loadConfig).mockResolvedValue(false);

    await expect(ensureSession({ interactive: false })).rejects.toThrow(FailError);
    let caught: unknown;
    try {
      await ensureSession({ interactive: false });
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toMatch(/bitty login/i);
  });

  it("falls through to an interactive login when there is no saved session and interactive mode is allowed", async () => {
    vi.mocked(loadConfig).mockResolvedValue(false);
    vi.mocked(promptText).mockResolvedValueOnce("typed@example.com");
    vi.mocked(bwClient.login).mockResolvedValueOnce(undefined);

    await ensureSession({ interactive: true });

    expect(printInfo).toHaveBeenCalledWith(expect.stringContaining("No saved session"));
    expect(bwClient.login).toHaveBeenCalledWith(
      "typed@example.com",
      "master-password",
      false,
      undefined
    );
    // ensureSession always calls interactiveLogin with rememberMe: false.
    expect(saveLoginHints).toHaveBeenCalled();
    expect(saveConfig).not.toHaveBeenCalled();
  });

  describe("with BITTY_EMAIL/BITTY_PASSWORD set", () => {
    beforeEach(() => {
      vi.mocked(loadConfig).mockResolvedValue(false);
      process.env["BITTY_EMAIL"] = "env@example.com";
      process.env["BITTY_PASSWORD"] = "env-password";
    });

    it("logs in non-interactively without prompting, and doesn't persist anything", async () => {
      vi.mocked(bwClient.login).mockResolvedValueOnce(undefined);

      await ensureSession({ interactive: false });

      expect(promptText).not.toHaveBeenCalled();
      expect(promptPassword).not.toHaveBeenCalled();
      expect(bwClient.setUrls).toHaveBeenCalledWith({ baseUrl: DEFAULT_SERVER_URL });
      expect(bwClient.login).toHaveBeenCalledWith(
        "env@example.com",
        "env-password",
        false,
        undefined
      );
      expect(saveConfig).not.toHaveBeenCalled();
      expect(saveLoginHints).not.toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("BITTY_EMAIL"));
    });

    it("uses BITTY_SERVER_URL for the login when set", async () => {
      process.env["BITTY_SERVER_URL"] = "https://env.example.com";
      vi.mocked(bwClient.login).mockResolvedValueOnce(undefined);

      await ensureSession({ interactive: false });

      expect(bwClient.setUrls).toHaveBeenCalledWith({ baseUrl: "https://env.example.com" });
    });

    it("consumes BITTY_TOTP automatically to satisfy a two-factor challenge", async () => {
      process.env["BITTY_TOTP"] = "123456";
      vi.mocked(bwClient.login)
        .mockRejectedValueOnce(new FetchError(400, JSON.stringify({ TwoFactorProviders: ["0"] })))
        .mockResolvedValueOnce(undefined);

      await ensureSession({ interactive: false });

      expect(bwClient.login).toHaveBeenCalledTimes(2);
      const secondCallArgs = vi.mocked(bwClient.login).mock.calls[1]!;
      expect(secondCallArgs[2]).toBe(true); // skipPrelogin
      expect(secondCallArgs[3]).toMatchObject({ twoFactorProvider: "0", twoFactorToken: "123456" });
    });

    it("fails clearly when two-factor is required but BITTY_TOTP isn't set", async () => {
      vi.mocked(bwClient.login).mockRejectedValueOnce(
        new FetchError(400, JSON.stringify({ TwoFactorProviders: ["0"] }))
      );

      let caught: unknown;
      try {
        await ensureSession({ interactive: false });
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(FailError);
      expect((caught as Error).message).toMatch(/two-factor/i);
      expect((caught as Error).message).toMatch(/BITTY_TOTP/);
      expect(bwClient.login).toHaveBeenCalledTimes(1);
    });

    it("fails clearly when BITTY_TOTP is rejected by the server", async () => {
      process.env["BITTY_TOTP"] = "000000";
      vi.mocked(bwClient.login)
        .mockRejectedValueOnce(new FetchError(400, JSON.stringify({ TwoFactorProviders: ["0"] })))
        .mockRejectedValueOnce(new FetchError(400, JSON.stringify({ TwoFactorProviders: ["0"] })));

      let caught: unknown;
      try {
        await ensureSession({ interactive: false });
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(FailError);
      expect((caught as Error).message).toMatch(/two-factor/i);
      expect(bwClient.login).toHaveBeenCalledTimes(2);
    });

    it("fails with a credentials message when the server rejects login without offering two-factor", async () => {
      vi.mocked(bwClient.login).mockRejectedValueOnce(
        new FetchError(400, JSON.stringify({ ErrorModel: { Message: "invalid credentials" } }))
      );

      await expect(ensureSession({ interactive: false })).rejects.toThrow(FailError);
      expect(bwClient.login).toHaveBeenCalledTimes(1);
    });

    it("is ignored when interactive mode is allowed, falling through to the interactive prompt instead", async () => {
      vi.mocked(promptText).mockResolvedValueOnce("typed@example.com");
      vi.mocked(bwClient.login).mockResolvedValueOnce(undefined);

      await ensureSession({ interactive: true });

      expect(bwClient.login).toHaveBeenCalledWith(
        "typed@example.com",
        "master-password",
        false,
        undefined
      );
    });
  });

  it("fails when only BITTY_EMAIL is set without BITTY_PASSWORD", async () => {
    vi.mocked(loadConfig).mockResolvedValue(false);
    process.env["BITTY_EMAIL"] = "env@example.com";

    let caught: unknown;
    try {
      await ensureSession({ interactive: false });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(FailError);
    expect((caught as Error).message).toMatch(/BITTY_EMAIL.*BITTY_PASSWORD/i);
    expect(bwClient.login).not.toHaveBeenCalled();
  });

  it("fails when only BITTY_PASSWORD is set without BITTY_EMAIL", async () => {
    vi.mocked(loadConfig).mockResolvedValue(false);
    process.env["BITTY_PASSWORD"] = "env-password";

    await expect(ensureSession({ interactive: false })).rejects.toThrow(FailError);
    expect(bwClient.login).not.toHaveBeenCalled();
  });
});
