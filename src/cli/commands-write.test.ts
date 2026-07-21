import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command, CommanderError } from "commander";
import { CipherType, type Cipher } from "../clients/bw.js";

class FailError extends Error {
  code?: number;
  constructor(message: string, code = 1) {
    super(message);
    this.code = code;
  }
}

const ensureSession = vi.fn().mockResolvedValue(undefined);
const bwClient = {
  createSecret: vi.fn(),
  getDecryptedSync: vi.fn(),
  updateSecret: vi.fn(),
  deleteSecret: vi.fn(),
  shareCipher: vi.fn(),
  updateCollections: vi.fn(),
};
const createEmptyCipher = vi.fn((type: CipherType) => {
  const base: any = { name: "", type, notes: null, fields: [], organizationId: null, collectionIds: [] };
  if (type === CipherType.Login) base.login = { username: null, password: null, totp: null, uris: [] };
  return base;
});
const readJsonInput = vi.fn();

vi.mock("./auth.js", () => ({ ensureSession: (...a: unknown[]) => ensureSession(...a) }));
vi.mock("../hooks/bw.js", () => ({ bwClient, createEmptyCipher: (...a: unknown[]) => createEmptyCipher(...(a as [CipherType])) }));
vi.mock("./json-input.js", () => ({ readJsonInput: (...a: unknown[]) => readJsonInput(...a) }));
vi.mock("./ui.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ui.js")>();
  return {
    ...actual,
    fail: vi.fn((message: string, code = 1) => {
      throw new FailError(message, code);
    }),
    printInfo: vi.fn(),
    printSuccess: vi.fn(),
    promptConfirm: vi.fn(),
  };
});

const { registerWriteCommands } = await import("./commands-write.js");
const { fail, printInfo, printSuccess, promptConfirm } = await import("./ui.js");

function cipherOf(overrides: Partial<Cipher> = {}): Cipher {
  return {
    id: "c1",
    type: CipherType.Login,
    folderId: null,
    organizationId: null,
    collectionIds: null,
    deletedDate: null,
    name: "Item",
    notes: "",
    favorite: false,
    login: { username: "u", password: "p" },
    ...overrides,
  } as Cipher;
}

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerWriteCommands(program);
  return program;
}

async function run(program: Command, args: string[]) {
  await program.parseAsync(args, { from: "user" });
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  ensureSession.mockClear().mockResolvedValue(undefined);
  createEmptyCipher.mockClear();
  readJsonInput.mockReset();
  bwClient.createSecret.mockReset();
  bwClient.getDecryptedSync.mockReset();
  bwClient.updateSecret.mockReset();
  bwClient.deleteSecret.mockReset();
  bwClient.shareCipher.mockReset();
  bwClient.updateCollections.mockReset();
  vi.mocked(fail).mockClear();
  vi.mocked(printInfo).mockClear();
  vi.mocked(printSuccess).mockClear();
  vi.mocked(promptConfirm).mockReset();
});

afterEach(() => {
  logSpy.mockRestore();
});

function printedLines(): string[] {
  return logSpy.mock.calls.map((c: unknown[]) => String(c[0]));
}

describe("template <type>", () => {
  it("prints an empty skeleton for a creatable type", async () => {
    await run(buildProgram(), ["template", "login"]);
    expect(createEmptyCipher).toHaveBeenCalledWith(CipherType.Login);
    expect(printedLines().join("\n")).toContain('"type": 1');
  });

  it("fails for an unsupported/unknown type", async () => {
    await expect(run(buildProgram(), ["template", "sshkey"])).rejects.toThrow(FailError);
    await expect(run(buildProgram(), ["template", "bogus"])).rejects.toThrow(FailError);
  });
});

describe("create <type>", () => {
  it("creates from flags when no --json is given", async () => {
    bwClient.createSecret.mockResolvedValue({ id: "new-id" });
    await run(buildProgram(), [
      "create",
      "login",
      "--name",
      "New item",
      "--username",
      "bob",
      "--password",
      "hunter2",
    ]);
    expect(bwClient.createSecret).toHaveBeenCalledTimes(1);
    const created = bwClient.createSecret.mock.calls[0]![0];
    expect(created.name).toBe("New item");
    expect(created.login.username).toBe("bob");
    expect(created.login.password).toBe("hunter2");
    expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("new-id"));
  });

  it("builds the cipher from --json when given, flags still layer on top", async () => {
    readJsonInput.mockResolvedValue({ name: "From json", login: { username: "fromjson" } });
    bwClient.createSecret.mockResolvedValue({ id: "id2" });
    await run(buildProgram(), ["create", "login", "--json", "file.json", "--password", "extra"]);
    expect(readJsonInput).toHaveBeenCalledWith("file.json");
    const created = bwClient.createSecret.mock.calls[0]![0];
    expect(created.name).toBe("From json");
    expect(created.login.password).toBe("extra");
  });

  it("login-only flags are ignored for non-login types", async () => {
    bwClient.createSecret.mockResolvedValue({ id: "id3" });
    await run(buildProgram(), [
      "create",
      "note",
      "--name",
      "A note",
      "--username",
      "should-be-ignored",
    ]);
    const created = bwClient.createSecret.mock.calls[0]![0];
    expect(created.login).toBeUndefined();
  });

  it("fails when no name is provided (flag or json)", async () => {
    await expect(run(buildProgram(), ["create", "login"])).rejects.toThrow(FailError);
    expect(fail).toHaveBeenCalledWith(expect.stringContaining("Missing item name"));
    expect(bwClient.createSecret).not.toHaveBeenCalled();
  });

  it("fails when --org is given without any --collection", async () => {
    await expect(
      run(buildProgram(), ["create", "login", "--name", "x", "--org", "org-1"])
    ).rejects.toThrow(FailError);
    expect(fail).toHaveBeenCalledWith(expect.stringContaining("at least one --collection"));
  });

  it("accepts --org together with --collection", async () => {
    bwClient.createSecret.mockResolvedValue({ id: "id4" });
    await run(buildProgram(), [
      "create",
      "login",
      "--name",
      "x",
      "--org",
      "org-1",
      "--collection",
      "col-1",
    ]);
    const created = bwClient.createSecret.mock.calls[0]![0];
    expect(created.organizationId).toBe("org-1");
    expect(created.collectionIds).toEqual(["col-1"]);
  });
});

describe("edit <id>", () => {
  it("fails when the id doesn't exist", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [] });
    await expect(run(buildProgram(), ["edit", "missing", "--name", "x"])).rejects.toThrow(
      FailError
    );
    expect(fail).toHaveBeenCalledWith(expect.stringContaining('"missing"'), 2);
  });

  it("fails when there is nothing to update", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [cipherOf()] });
    await expect(run(buildProgram(), ["edit", "c1"])).rejects.toThrow(FailError);
    expect(fail).toHaveBeenCalledWith(expect.stringContaining("Nothing to update"));
  });

  it("sends a patch containing only the changed field", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [cipherOf()] });
    bwClient.updateSecret.mockResolvedValue({ id: "c1" });
    await run(buildProgram(), ["edit", "c1", "--name", "New name"]);
    expect(bwClient.updateSecret).toHaveBeenCalledWith("c1", { name: "New name" });
    expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("Item"));
  });

  it('prints "Nothing changed." when updateSecret resolves null', async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [cipherOf()] });
    bwClient.updateSecret.mockResolvedValue(null);
    await run(buildProgram(), ["edit", "c1", "--name", "Same"]);
    expect(printInfo).toHaveBeenCalledWith("Nothing changed.");
    expect(printSuccess).not.toHaveBeenCalled();
  });

  it("applies login flags only when the current cipher is a Login", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({
      ciphers: [cipherOf({ type: CipherType.Card, card: {} as any })],
    });
    bwClient.updateSecret.mockResolvedValue({ id: "c1" });
    await run(buildProgram(), ["edit", "c1", "--username", "ignored-for-card", "--notes", "n"]);
    expect(bwClient.updateSecret).toHaveBeenCalledWith("c1", { notes: "n" });
  });
});

describe("delete <id>", () => {
  it("fails when the id doesn't exist", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [] });
    await expect(run(buildProgram(), ["delete", "missing", "--yes"])).rejects.toThrow(FailError);
    expect(fail).toHaveBeenCalledWith(expect.stringContaining('"missing"'), 2);
  });

  it("--yes deletes without prompting", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [cipherOf()] });
    await run(buildProgram(), ["delete", "c1", "--yes"]);
    expect(promptConfirm).not.toHaveBeenCalled();
    expect(bwClient.deleteSecret).toHaveBeenCalledWith("c1");
    expect(printSuccess).toHaveBeenCalled();
  });

  it("prompts for confirmation without --yes; confirming deletes", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [cipherOf()] });
    vi.mocked(promptConfirm).mockResolvedValue(true);
    await run(buildProgram(), ["delete", "c1"]);
    expect(promptConfirm).toHaveBeenCalled();
    expect(bwClient.deleteSecret).toHaveBeenCalledWith("c1");
  });

  it("declining the confirmation aborts without deleting", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [cipherOf()] });
    vi.mocked(promptConfirm).mockResolvedValue(false);
    await expect(run(buildProgram(), ["delete", "c1"])).rejects.toThrow(FailError);
    expect(fail).toHaveBeenCalledWith("Aborted.", 130);
    expect(bwClient.deleteSecret).not.toHaveBeenCalled();
  });

  it("--no-interactive without --yes fails without ever prompting", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [cipherOf()] });
    await expect(run(buildProgram(), ["delete", "c1", "--no-interactive"])).rejects.toThrow(
      FailError
    );
    expect(promptConfirm).not.toHaveBeenCalled();
    expect(bwClient.deleteSecret).not.toHaveBeenCalled();
  });
});

describe("share <id>", () => {
  it("commander itself rejects when --org is missing (required option)", async () => {
    await expect(run(buildProgram(), ["share", "c1", "--collection", "col-1"])).rejects.toThrow(
      CommanderError
    );
  });

  it("fails when no --collection is given", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [cipherOf()] });
    await expect(run(buildProgram(), ["share", "c1", "--org", "org-1"])).rejects.toThrow(
      FailError
    );
    expect(fail).toHaveBeenCalledWith(expect.stringContaining("At least one --collection"));
  });

  it("fails when the id doesn't exist", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [] });
    await expect(
      run(buildProgram(), ["share", "missing", "--org", "org-1", "--collection", "col-1"])
    ).rejects.toThrow(FailError);
    expect(fail).toHaveBeenCalledWith(expect.stringContaining('"missing"'), 2);
  });

  it("shares a personal cipher into the org", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({ ciphers: [cipherOf({ organizationId: null })] });
    await run(buildProgram(), ["share", "c1", "--org", "org-1", "--collection", "col-1"]);
    expect(bwClient.shareCipher).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ organizationId: "org-1" }),
      ["col-1"]
    );
    expect(bwClient.updateCollections).not.toHaveBeenCalled();
  });

  it("updates collections instead when the cipher is already org-owned", async () => {
    bwClient.getDecryptedSync.mockResolvedValue({
      ciphers: [cipherOf({ organizationId: "org-1" })],
    });
    await run(buildProgram(), ["share", "c1", "--org", "org-1", "--collection", "col-2"]);
    expect(bwClient.updateCollections).toHaveBeenCalledWith("c1", ["col-2"]);
    expect(bwClient.shareCipher).not.toHaveBeenCalled();
  });
});
