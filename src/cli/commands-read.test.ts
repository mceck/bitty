import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { CipherType, type Cipher, type SyncResponse } from "../clients/bw.js";

class FailError extends Error {
  code?: number;
  constructor(message: string, code = 1) {
    super(message);
    this.code = code;
  }
}

const ensureSession = vi.fn().mockResolvedValue(undefined);
const bwClient = {
  getDecryptedSync: vi.fn(),
};
const currentTotpFor = vi.fn();

vi.mock("./auth.js", () => ({ ensureSession: (...a: unknown[]) => ensureSession(...a) }));
vi.mock("../hooks/bw.js", () => ({ bwClient }));
vi.mock("../utils/totp.js", () => ({ currentTotpFor: (...a: unknown[]) => currentTotpFor(...a) }));
vi.mock("./ui.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ui.js")>();
  return {
    ...actual,
    fail: vi.fn((message: string, code = 1) => {
      throw new FailError(message, code);
    }),
    printSuccess: vi.fn(),
  };
});

const { registerReadCommands } = await import("./commands-read.js");
const { fail, printSuccess } = await import("./ui.js");

function loginCipher(overrides: Partial<Cipher> = {}): Cipher {
  return {
    id: "cipher-login",
    type: CipherType.Login,
    folderId: null,
    organizationId: null,
    collectionIds: null,
    deletedDate: null,
    name: "GitHub",
    notes: "",
    favorite: false,
    login: {
      username: "octocat",
      password: "s3cr3t",
      totp: "JBSWY3DPEHPK3PXP",
      uri: "https://github.com",
    },
    ...overrides,
  } as Cipher;
}

function cardCipher(overrides: Partial<Cipher> = {}): Cipher {
  return {
    id: "cipher-card",
    type: CipherType.Card,
    folderId: null,
    organizationId: null,
    collectionIds: null,
    deletedDate: null,
    name: "Visa",
    notes: "",
    favorite: false,
    card: {
      cardholderName: "Jane Doe",
      brand: "Visa",
      number: "4111111111111111",
      expMonth: "01",
      expYear: "2030",
      code: "123",
    },
    ...overrides,
  } as Cipher;
}

function identityCipher(overrides: Partial<Cipher> = {}): Cipher {
  return {
    id: "cipher-identity",
    type: CipherType.Identity,
    folderId: null,
    organizationId: null,
    collectionIds: null,
    deletedDate: null,
    name: "Jane's ID",
    notes: "",
    favorite: false,
    identity: {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
    },
    ...overrides,
  } as Cipher;
}

function sshKeyCipher(overrides: Partial<Cipher> = {}): Cipher {
  return {
    id: "cipher-sshkey",
    type: CipherType.SSHKey,
    folderId: null,
    organizationId: null,
    collectionIds: null,
    deletedDate: null,
    name: "Server key",
    notes: "",
    favorite: false,
    sshKey: {
      privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----",
      publicKey: "ssh-ed25519 AAAA",
      keyFingerprint: "SHA256:abc",
    },
    ...overrides,
  } as Cipher;
}

function syncWith(ciphers: Cipher[], extra: Partial<SyncResponse> = {}): SyncResponse {
  return { ciphers, collections: [], profile: { organizations: [] }, ...extra };
}

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerReadCommands(program);
  return program;
}

async function run(program: Command, args: string[]) {
  await program.parseAsync(args, { from: "user" });
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  ensureSession.mockClear().mockResolvedValue(undefined);
  bwClient.getDecryptedSync.mockReset();
  currentTotpFor.mockReset();
  vi.mocked(fail).mockClear();
  vi.mocked(printSuccess).mockClear();
});

afterEach(() => {
  logSpy.mockRestore();
});

function printedLines(): string[] {
  return logSpy.mock.calls.map((c: unknown[]) => String(c[0]));
}

describe("get <name>", () => {
  it("prints the login password by default", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher()]));
    await run(buildProgram(), ["get", "GitHub"]);
    expect(ensureSession).toHaveBeenCalledWith({ interactive: true });
    expect(printedLines()).toContain("s3cr3t");
  });

  it("--field username prints the username", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher()]));
    await run(buildProgram(), ["get", "GitHub", "--field", "username"]);
    expect(printedLines()).toContain("octocat");
  });

  it("--field uri prints the uri", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher()]));
    await run(buildProgram(), ["get", "GitHub", "--field", "uri"]);
    expect(printedLines()).toContain("https://github.com");
  });

  it("--field notes prints notes, failing if empty", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(
      syncWith([loginCipher({ notes: "hello world" })])
    );
    await run(buildProgram(), ["get", "GitHub", "--field", "notes"]);
    expect(printedLines()).toContain("hello world");

    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher({ notes: "" })]));
    await expect(run(buildProgram(), ["get", "GitHub", "--field", "notes"])).rejects.toThrow(
      FailError
    );
    expect(fail).toHaveBeenCalledWith(expect.stringContaining("has no notes"));
  });

  it("--field totp computes and prints the current code", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher()]));
    currentTotpFor.mockResolvedValue("123456");
    await run(buildProgram(), ["get", "GitHub", "--field", "totp"]);
    expect(currentTotpFor).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP");
    expect(printedLines()).toContain("123456");
  });

  it("--field totp fails if no code could be generated", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher()]));
    currentTotpFor.mockResolvedValue(null);
    await expect(run(buildProgram(), ["get", "GitHub", "--field", "totp"])).rejects.toThrow(
      FailError
    );
    expect(fail).toHaveBeenCalledWith(expect.stringContaining("Could not generate a TOTP code"));
  });

  it("--json prints the full decrypted item, stripping any legacy `data` blob", async () => {
    const cipher = loginCipher() as Cipher & { data?: unknown };
    cipher.data = { legacy: true };
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([cipher]));
    await run(buildProgram(), ["get", "GitHub", "--json"]);
    const printed = printedLines().join("\n");
    expect(printed).toContain('"password": "s3cr3t"');
    expect(printed).not.toContain("legacy");
  });

  it("--json skips field validation (no --field needed, unknown field ignored)", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher()]));
    await run(buildProgram(), ["get", "GitHub", "--json", "--field", "bogus"]);
    expect(fail).not.toHaveBeenCalled();
    expect(printedLines().join("\n")).toContain('"name": "GitHub"');
  });

  it("unknown --field fails with the list of valid fields", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher()]));
    await expect(run(buildProgram(), ["get", "GitHub", "--field", "bogus"])).rejects.toThrow(
      FailError
    );
    expect(fail).toHaveBeenCalledWith(expect.stringContaining('Unknown field "bogus"'));
  });

  it("fails when the cipher doesn't have the requested field (e.g. password on a Card)", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([cardCipher()]));
    await expect(run(buildProgram(), ["get", "Visa", "--field", "password"])).rejects.toThrow(
      FailError
    );
    expect(fail).toHaveBeenCalledWith(expect.stringContaining("has no password field"));
  });

  it("fails when no item matches the given name", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher()]));
    await expect(run(buildProgram(), ["get", "Nonexistent"])).rejects.toThrow(FailError);
  });

  it("fails immediately when neither a name nor --id is given", async () => {
    await expect(run(buildProgram(), ["get"])).rejects.toThrow(FailError);
    expect(fail).toHaveBeenCalledWith(expect.stringContaining("Provide an item name, or --id"));
    expect(ensureSession).not.toHaveBeenCalled();
  });

  it("looks up by --id alone, without a name", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher(), cardCipher()]));
    await run(buildProgram(), ["get", "--id", "cipher-card", "--field", "number"]);
    expect(printedLines()).toContain("4111111111111111");
  });

  describe("non-login items", () => {
    it("defaults to the card number for a Card", async () => {
      bwClient.getDecryptedSync.mockResolvedValue(syncWith([cardCipher()]));
      await run(buildProgram(), ["get", "Visa"]);
      expect(printedLines()).toContain("4111111111111111");
    });

    it("--field code prints the card security code", async () => {
      bwClient.getDecryptedSync.mockResolvedValue(syncWith([cardCipher()]));
      await run(buildProgram(), ["get", "Visa", "--field", "code"]);
      expect(printedLines()).toContain("123");
    });

    it("defaults to the email for an Identity", async () => {
      bwClient.getDecryptedSync.mockResolvedValue(syncWith([identityCipher()]));
      await run(buildProgram(), ["get", "Jane's ID"]);
      expect(printedLines()).toContain("jane@example.com");
    });

    it("--field firstName prints the identity's first name", async () => {
      bwClient.getDecryptedSync.mockResolvedValue(syncWith([identityCipher()]));
      await run(buildProgram(), ["get", "Jane's ID", "--field", "firstName"]);
      expect(printedLines()).toContain("Jane");
    });

    it("defaults to the private key for an SSH key", async () => {
      bwClient.getDecryptedSync.mockResolvedValue(syncWith([sshKeyCipher()]));
      await run(buildProgram(), ["get", "Server key"]);
      expect(printedLines()).toContain("-----BEGIN OPENSSH PRIVATE KEY-----");
    });

    it("--field publicKey prints the ssh public key", async () => {
      bwClient.getDecryptedSync.mockResolvedValue(syncWith([sshKeyCipher()]));
      await run(buildProgram(), ["get", "Server key", "--field", "publicKey"]);
      expect(printedLines()).toContain("ssh-ed25519 AAAA");
    });

    it("defaults to notes for a Secure Note", async () => {
      bwClient.getDecryptedSync.mockResolvedValue(
        syncWith([
          {
            id: "cipher-note",
            type: CipherType.SecureNote,
            folderId: null,
            organizationId: null,
            collectionIds: null,
            deletedDate: null,
            name: "Wifi",
            notes: "the-actual-note",
            favorite: false,
          } as Cipher,
        ])
      );
      await run(buildProgram(), ["get", "Wifi"]);
      expect(printedLines()).toContain("the-actual-note");
    });
  });
});

describe("ls", () => {
  it("prints a table by default", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher(), cardCipher()]));
    await run(buildProgram(), ["ls"]);
    const printed = printedLines().join("\n");
    expect(printed).toContain("GitHub");
    expect(printed).toContain("Visa");
    expect(printed).toContain("ID");
  });

  it("--json prints the full filtered array, stripping `data`", async () => {
    const cipher = loginCipher() as Cipher & { data?: unknown };
    cipher.data = { legacy: true };
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([cipher]));
    await run(buildProgram(), ["ls", "--json"]);
    const printed = printedLines().join("\n");
    expect(printed).toContain('"id": "cipher-login"');
    expect(printed).not.toContain("legacy");
  });

  it("--search filters by name/username/uri/notes", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher(), cardCipher()]));
    await run(buildProgram(), ["ls", "--search", "visa", "--json"]);
    const printed = printedLines().join("\n");
    expect(printed).toContain("cipher-card");
    expect(printed).not.toContain("cipher-login");
  });

  it("--type filters by cipher type", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([loginCipher(), cardCipher()]));
    await run(buildProgram(), ["ls", "--type", "card", "--json"]);
    const printed = printedLines().join("\n");
    expect(printed).toContain("cipher-card");
    expect(printed).not.toContain("cipher-login");
  });

  it("--org filters by organization id or resolved org name", async () => {
    const orgCipher = loginCipher({ id: "org-cipher", organizationId: "org-1", name: "Org item" });
    bwClient.getDecryptedSync.mockResolvedValue(
      syncWith([loginCipher(), orgCipher], {
        profile: { organizations: [{ id: "org-1", name: "Acme", key: "k" }] },
      })
    );
    await run(buildProgram(), ["ls", "--org", "Acme", "--json"]);
    const printed = printedLines().join("\n");
    expect(printed).toContain("org-cipher");
    expect(printed).not.toContain('"id": "cipher-login"');
  });

  it("--folder filters by folder id", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(
      syncWith([loginCipher({ folderId: "f1" }), cardCipher({ folderId: "f2" })])
    );
    await run(buildProgram(), ["ls", "--folder", "f1", "--json"]);
    const printed = printedLines().join("\n");
    expect(printed).toContain("cipher-login");
    expect(printed).not.toContain("cipher-card");
  });
});

describe("sync", () => {
  it("refreshes and prints success", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWith([]));
    await run(buildProgram(), ["sync"]);
    expect(bwClient.getDecryptedSync).toHaveBeenCalledWith({ forceRefresh: true });
    expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("synced"));
  });
});

describe("collections", () => {
  function syncWithCollections() {
    return syncWith([], {
      collections: [
        { id: "col-1", organizationId: "org-1", name: "Engineering", readOnly: false },
        { id: "col-2", organizationId: "org-2", name: "Marketing", readOnly: false },
      ],
      profile: {
        organizations: [
          { id: "org-1", name: "Acme", key: "k1" },
          { id: "org-2", name: "Beta", key: "k2" },
        ],
      },
    });
  }

  it("prints a table by default", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWithCollections());
    await run(buildProgram(), ["collections"]);
    const printed = printedLines().join("\n");
    expect(printed).toContain("Engineering");
    expect(printed).toContain("Marketing");
  });

  it("--json prints raw collections", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWithCollections());
    await run(buildProgram(), ["collections", "--json"]);
    const printed = printedLines().join("\n");
    expect(printed).toContain('"id": "col-1"');
  });

  it("--org filters by id or resolved name", async () => {
    bwClient.getDecryptedSync.mockResolvedValue(syncWithCollections());
    await run(buildProgram(), ["collections", "--org", "Acme", "--json"]);
    const printed = printedLines().join("\n");
    expect(printed).toContain("col-1");
    expect(printed).not.toContain("col-2");
  });
});
