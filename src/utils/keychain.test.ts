import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSessionSecret, loadSessionSecret, saveSessionSecret } from "./keychain.js";

// Never let the real @napi-rs/keyring load in tests — it would read/write the
// developer's actual OS credential store (macOS Keychain / Credential Manager /
// libsecret). Replace it entirely with an in-memory fake whose per-method
// behavior tests configure via `behavior.*.mockResolvedValueOnce(...)` before
// calling the function under test.
const { AsyncEntryMock, instances, behavior } = vi.hoisted(() => {
  const behavior = {
    getPassword: vi.fn(async () => undefined as string | undefined),
    setPassword: vi.fn(async (_value: string) => {}),
    deleteCredential: vi.fn(async () => {}),
  };
  const instances: { service: string; account: string }[] = [];

  class AsyncEntryMock {
    service: string;
    account: string;
    constructor(service: string, account: string) {
      this.service = service;
      this.account = account;
      instances.push({ service, account });
    }
    getPassword() {
      return behavior.getPassword();
    }
    setPassword(value: string) {
      return behavior.setPassword(value);
    }
    deleteCredential() {
      return behavior.deleteCredential();
    }
  }

  return { AsyncEntryMock, instances, behavior };
});

vi.mock("@napi-rs/keyring", () => ({ AsyncEntry: AsyncEntryMock }));

beforeEach(() => {
  instances.length = 0;
  behavior.getPassword.mockReset().mockResolvedValue(undefined);
  behavior.setPassword.mockReset().mockResolvedValue(undefined);
  behavior.deleteCredential.mockReset().mockResolvedValue(undefined);
});

describe("keychain", () => {
  it("loadSessionSecret() returns the stored password", async () => {
    behavior.getPassword.mockResolvedValueOnce("s3ss10n-secret");
    expect(await loadSessionSecret()).toBe("s3ss10n-secret");
    expect(instances).toEqual([{ service: "bitty-tui", account: "session" }]);
  });

  it("loadSessionSecret() returns null when no password is stored", async () => {
    behavior.getPassword.mockResolvedValueOnce(undefined);
    expect(await loadSessionSecret()).toBeNull();
  });

  it("saveSessionSecret() writes the password under the 'bitty-tui'/'session' entry", async () => {
    await saveSessionSecret("my-session-json");

    expect(behavior.setPassword).toHaveBeenCalledWith("my-session-json");
    expect(instances).toEqual([{ service: "bitty-tui", account: "session" }]);
  });

  it("deleteSessionSecret() deletes the credential", async () => {
    await deleteSessionSecret();

    expect(behavior.deleteCredential).toHaveBeenCalledTimes(1);
  });

  it("deleteSessionSecret() swallows errors (e.g. no credential to delete)", async () => {
    behavior.deleteCredential.mockRejectedValueOnce(new Error("not found"));

    await expect(deleteSessionSecret()).resolves.toBeUndefined();
  });
});
