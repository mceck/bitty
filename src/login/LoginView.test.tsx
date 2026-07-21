import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { flush } from "../test-utils/ink-flush.js";

// See VaultList.test.tsx: ink-testing-library's fake stdout has no `rows`.
vi.mock("ink", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ink")>();
  return {
    ...actual,
    useStdout: () => {
      const real = actual.useStdout();
      return { ...real, stdout: { ...real.stdout, rows: 40 } };
    },
  };
});

// Never let a smoke test touch the real network, fs config, or OS keychain.
const bwClient = {
  setUrls: vi.fn(),
  login: vi.fn(),
  isVaultWarden: vi.fn(() => false),
  sendEmailMfaCode: vi.fn(),
  keys: {},
  refreshToken: null as string | null,
};
const loadConfig = vi.fn(async (..._args: unknown[]) => false);
const loadLoginHints = vi.fn(
  async (..._args: unknown[]) => ({}) as { email?: string; baseUrl?: string }
);
const saveConfig = vi.fn(async (..._args: unknown[]) => {});
const saveLoginHints = vi.fn(async (..._args: unknown[]) => {});

vi.mock("../hooks/bw.js", () => ({
  bwClient,
  loadConfig: (...args: unknown[]) => loadConfig(...args),
  loadLoginHints: (...args: unknown[]) => loadLoginHints(...args),
  saveConfig: (...args: unknown[]) => saveConfig(...args),
  saveLoginHints: (...args: unknown[]) => saveLoginHints(...args),
}));

const { LoginView } = await import("./LoginView.js");

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

afterEach(cleanup);

describe("LoginView (smoke)", () => {
  it("shows a loading state, then the login form once config/hints resolve", async () => {
    const { lastFrame, unmount } = render(<LoginView onLogin={() => {}} />);
    // Initial synchronous render, before the mount effect resolves.
    expect(strip(lastFrame() ?? "")).toContain("Loading");

    await flush();
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("https://vault.bitwarden.eu"); // default server URL value
    expect(frame).toContain("Email address");
    expect(frame).toContain("Log In");
    unmount();
  });

  it("pre-fills email and server URL from saved login hints", async () => {
    loadLoginHints.mockResolvedValueOnce({
      email: "saved@example.com",
      baseUrl: "https://vault.example.com",
    });
    const { lastFrame, unmount } = render(<LoginView onLogin={() => {}} />);
    await flush();
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("saved@example.com");
    expect(frame).toContain("https://vault.example.com");
    unmount();
  });

  it("calls onLogin immediately when a session is already saved", async () => {
    loadConfig.mockResolvedValueOnce(true);
    let loggedIn = false;
    const { unmount } = render(<LoginView onLogin={() => (loggedIn = true)} />);
    await flush();
    expect(loggedIn).toBe(true);
    unmount();
  });
});
