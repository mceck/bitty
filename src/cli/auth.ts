import {
  bwClient,
  clearConfig,
  loadConfig,
  loadLoginHints,
  saveConfig,
  saveLoginHints,
} from "../hooks/bw.js";
import { FetchError, TwoFactorProvider } from "../clients/bw.js";
import { fail, printInfo, printSuccess, promptSelect, promptText, promptPassword } from "./ui.js";

const DEFAULT_SERVER_URL = "https://vault.bitwarden.eu";
const MAX_MFA_ATTEMPTS = 5;

export interface LoginOptions {
  serverUrl?: string;
  email?: string;
  totp?: string;
  rememberMe: boolean;
  interactive: boolean;
}

interface EnvLoginOptions {
  email: string;
  password: string;
  totp?: string;
  serverUrl?: string;
}

async function resolveMfa(
  email: string,
  providers: string[],
  providers2: Record<string, any> | undefined
) {
  let provider = providers[0]!;
  if (providers.length > 1) {
    provider = await promptSelect(
      "Choose a two-factor method",
      providers.map((p) => ({
        title: TwoFactorProvider[p] ?? `Provider ${p}`,
        value: p,
      }))
    );
  }

  if (provider === "1" && providers.length > 1) {
    await bwClient.sendEmailMfaCode(email);
    printInfo(`Sent a verification code to ${email}.`);
  } else if (provider === "2" || provider === "6") {
    const authUrl = providers2?.[provider]?.AuthUrl;
    printInfo("Open the Duo URL in a browser and approve the request.");
    if (authUrl) printInfo(`Auth URL: ${authUrl}`);
    printInfo("Then paste the `code` and `state` from the final URL as `code|state`.");
  } else if (provider === "7") {
    printInfo("Use your FIDO2/WebAuthn security key to generate a response, then paste it here.");
  }

  const label = provider === "7" ? "response" : "code";
  const token = await promptText(
    `Enter your ${TwoFactorProvider[provider] ?? `provider ${provider}`} ${label}`
  );
  return { twoFactorProvider: provider, twoFactorToken: token, twoFactorRemember: 0 };
}

export async function interactiveLogin(opts: LoginOptions): Promise<void> {
  if (!opts.interactive) {
    fail(
      "`bitty login` needs an interactive terminal to enter the master password."
    );
  }

  const hints = await loadLoginHints();
  const serverUrl = opts.serverUrl?.trim() || hints.baseUrl || DEFAULT_SERVER_URL;
  bwClient.setUrls({ baseUrl: serverUrl });

  const email =
    opts.email?.trim() || (await promptText("Email address", { initial: hints.email }));
  const password = await promptPassword("Master password");

  let mfa: { twoFactorProvider: string; twoFactorToken: string; twoFactorRemember?: number } | undefined;
  let usedTotpFlag = false;
  let attempts = 0;

  while (true) {
    try {
      if (mfa) mfa.twoFactorRemember = opts.rememberMe ? 1 : 0;
      await bwClient.login(email, password, !!mfa, mfa);
      break;
    } catch (e) {
      if (!(e instanceof FetchError)) throw e;
      let data: any;
      try {
        data = e.json();
      } catch {
        throw e;
      }
      const providers2 = data.TwoFactorProviders2;
      const providers: string[] = (
        data.TwoFactorProviders ?? (providers2 ? Object.keys(providers2) : []) ?? []
      ).map(String);
      if (!providers.length) {
        fail("Login failed, please check your credentials.");
      }

      attempts++;
      if (attempts > MAX_MFA_ATTEMPTS) {
        fail("Too many failed two-factor attempts.");
      }
      if (mfa) printInfo("Invalid two-factor code, please try again.");

      if (opts.totp && !usedTotpFlag) {
        usedTotpFlag = true;
        const provider = providers.includes("0") ? "0" : providers[0]!;
        mfa = { twoFactorProvider: provider, twoFactorToken: opts.totp };
        continue;
      }

      mfa = await resolveMfa(email, providers, providers2);
    }
  }

  if (opts.rememberMe) {
    await saveConfig({
      baseUrl: serverUrl,
      keys: bwClient.keys,
      refreshToken: bwClient.refreshToken!,
    });
    printSuccess("Logged in and session saved.");
  } else {
    await saveLoginHints({ email, baseUrl: serverUrl });
    printSuccess("Logged in.");
  }
}

export async function logoutCommand(): Promise<void> {
  bwClient.logout();
  await clearConfig();
  printSuccess("Logged out.");
}

async function envLogin(opts: EnvLoginOptions): Promise<void> {
  const hints = await loadLoginHints();
  const serverUrl = opts.serverUrl?.trim() || hints.baseUrl || DEFAULT_SERVER_URL;
  bwClient.setUrls({ baseUrl: serverUrl });

  try {
    await bwClient.login(opts.email, opts.password, false, undefined);
  } catch (e) {
    if (!(e instanceof FetchError)) throw e;
    let data: any;
    try {
      data = e.json();
    } catch {
      throw e;
    }
    const providers2 = data.TwoFactorProviders2;
    const providers: string[] = (
      data.TwoFactorProviders ?? (providers2 ? Object.keys(providers2) : []) ?? []
    ).map(String);
    if (!providers.length) {
      fail("Login failed, please check BITTY_EMAIL/BITTY_PASSWORD.");
    }
    if (!opts.totp) {
      fail("Account requires two-factor authentication; set BITTY_TOTP to log in via environment variables.");
    }

    const provider = providers.includes("0") ? "0" : providers[0]!;
    try {
      await bwClient.login(opts.email, opts.password, true, {
        twoFactorProvider: provider,
        twoFactorToken: opts.totp,
        twoFactorRemember: 0,
      });
    } catch (e2) {
      if (!(e2 instanceof FetchError)) throw e2;
      fail("Two-factor authentication failed for BITTY_TOTP.");
    }
  }

  printSuccess("Logged in using BITTY_EMAIL/BITTY_PASSWORD (session not persisted).");
}

export async function ensureSession(opts: { interactive: boolean }): Promise<void> {
  const loggedIn = await loadConfig();
  if (loggedIn) return;

  if (!opts.interactive) {
    const email = process.env["BITTY_EMAIL"];
    const password = process.env["BITTY_PASSWORD"];
    if (email && password) {
      await envLogin({
        email,
        password,
        totp: process.env["BITTY_TOTP"],
        serverUrl: process.env["BITTY_SERVER_URL"],
      });
      return;
    }
    if (email || password) {
      fail("Both BITTY_EMAIL and BITTY_PASSWORD must be set to log in via environment variables.");
    }
    fail(
      'Not logged in. Run "bitty login --remember-me" first, set BITTY_EMAIL/BITTY_PASSWORD env vars, or drop --no-interactive to log in now.'
    );
  }

  printInfo("No saved session found, please log in.");
  await interactiveLogin({ rememberMe: false, interactive: true });
}
