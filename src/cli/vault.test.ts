import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CipherType, type Cipher, type SyncResponse } from "../clients/bw.js";

class FailError extends Error {
  constructor(message: string, public exitCode?: number) {
    super(message);
  }
}

class ProcessExitError extends Error {
  constructor(public code?: number) {
    super(`process.exit(${code})`);
  }
}

const fail = vi.fn((message: string, exitCode?: number) => {
  throw new FailError(message, exitCode);
});
const printError = vi.fn();
const printInfo = vi.fn();
const promptSelect = vi.fn();
const style = { dim: (s: string) => s };

vi.mock("./ui.js", () => ({
  fail,
  printError,
  printInfo,
  promptSelect,
  style,
}));

const getDecryptedSync = vi.fn();
vi.mock("../hooks/bw.js", () => ({
  bwClient: {
    getDecryptedSync: (...args: unknown[]) => getDecryptedSync(...args),
  },
}));

const {
  typeLabel,
  typeFromLabel,
  requireCreatableType,
  orgNameIndex,
  filterCiphers,
  forJson,
  resolveCipher,
  CREATABLE_TYPE_LABELS,
} = await import("./vault.js");

function makeCipher(overrides: Partial<Cipher> = {}): Cipher {
  return {
    id: "id-1",
    type: CipherType.Login,
    folderId: null,
    organizationId: null,
    collectionIds: null,
    deletedDate: null,
    name: "Item",
    notes: "",
    favorite: false,
    ...overrides,
  } as Cipher;
}

function makeSync(ciphers: Cipher[], extra: Partial<SyncResponse> = {}): SyncResponse {
  return { ciphers, ...extra } as SyncResponse;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("typeLabel / typeFromLabel", () => {
  it("round-trips every CipherType through its label", () => {
    const pairs: [CipherType, string][] = [
      [CipherType.Login, "login"],
      [CipherType.SecureNote, "note"],
      [CipherType.Card, "card"],
      [CipherType.Identity, "identity"],
      [CipherType.SSHKey, "sshkey"],
    ];
    for (const [type, label] of pairs) {
      expect(typeLabel(type)).toBe(label);
      expect(typeFromLabel(label)).toBe(type);
    }
  });

  it("typeFromLabel is case-insensitive", () => {
    expect(typeFromLabel("LOGIN")).toBe(CipherType.Login);
    expect(typeFromLabel("Card")).toBe(CipherType.Card);
  });

  it("typeFromLabel returns undefined for an unknown label", () => {
    expect(typeFromLabel("nonsense")).toBeUndefined();
  });

  it("typeLabel returns 'unknown' for an unrecognized numeric type", () => {
    expect(typeLabel(999 as CipherType)).toBe("unknown");
  });
});

describe("requireCreatableType", () => {
  it("accepts every creatable label", () => {
    expect(CREATABLE_TYPE_LABELS).toEqual(["login", "note", "card", "identity"]);
    expect(requireCreatableType("login")).toBe(CipherType.Login);
    expect(requireCreatableType("note")).toBe(CipherType.SecureNote);
    expect(requireCreatableType("card")).toBe(CipherType.Card);
    expect(requireCreatableType("identity")).toBe(CipherType.Identity);
  });

  it("rejects sshkey: it's a known type but not creatable via this path", () => {
    expect(() => requireCreatableType("sshkey")).toThrow(FailError);
    expect(fail).toHaveBeenCalledWith(expect.stringMatching(/unknown or unsupported/i));
  });

  it("rejects a completely unknown label", () => {
    expect(() => requireCreatableType("bogus")).toThrow(FailError);
  });
});

describe("orgNameIndex", () => {
  it("builds an id -> name map from sync.profile.organizations", () => {
    const sync = makeSync([], {
      profile: { organizations: [{ id: "org-1", name: "Acme" }, { id: "org-2", name: "Beta" }] },
    } as any);
    const index = orgNameIndex(sync);
    expect(index.get("org-1")).toBe("Acme");
    expect(index.get("org-2")).toBe("Beta");
    expect(index.size).toBe(2);
  });

  it("returns an empty map when there are no organizations", () => {
    expect(orgNameIndex(makeSync([])).size).toBe(0);
    expect(orgNameIndex(makeSync([], { profile: {} } as any)).size).toBe(0);
  });
});

describe("forJson", () => {
  it("strips the legacy `data` field but keeps everything else", () => {
    const cipher = makeCipher({ name: "Keep me" }) as Cipher & { data?: unknown };
    cipher.data = { some: "legacy blob" };
    const result = forJson(cipher) as Cipher & { data?: unknown };
    expect(result.data).toBeUndefined();
    expect(result.name).toBe("Keep me");
    expect(result.id).toBe(cipher.id);
  });
});

describe("filterCiphers", () => {
  it("excludes deleted ciphers", () => {
    const sync = makeSync([
      makeCipher({ id: "a", name: "Alive" }),
      makeCipher({ id: "b", name: "Dead", deletedDate: "2024-01-01" }),
    ]);
    const result = filterCiphers(sync, {});
    expect(result.map((c) => c.id)).toEqual(["a"]);
  });

  it("sorts results by name", () => {
    const sync = makeSync([
      makeCipher({ id: "z", name: "Zebra" }),
      makeCipher({ id: "a", name: "Apple" }),
      makeCipher({ id: "m", name: "Mango" }),
    ]);
    expect(filterCiphers(sync, {}).map((c) => c.name)).toEqual(["Apple", "Mango", "Zebra"]);
  });

  describe("search", () => {
    const sync = makeSync([
      makeCipher({ id: "1", name: "GitHub account" }),
      makeCipher({ id: "match-by-id", name: "Other" }),
      makeCipher({ id: "3", name: "Other", notes: "contains SECRETNOTE here" }),
      makeCipher({ id: "4", name: "Other", login: { uri: "https://Example.com" } }),
      makeCipher({ id: "5", name: "Other", login: { username: "Alice" } }),
      makeCipher({ id: "6", name: "Unrelated" }),
    ]);

    it("matches name case-insensitively", () => {
      expect(filterCiphers(sync, { search: "github" }).map((c) => c.id)).toEqual(["1"]);
    });

    it("matches id case-insensitively", () => {
      expect(filterCiphers(sync, { search: "MATCH-BY-ID" }).map((c) => c.id)).toEqual([
        "match-by-id",
      ]);
    });

    it("matches notes case-insensitively", () => {
      expect(filterCiphers(sync, { search: "secretnote" }).map((c) => c.id)).toEqual(["3"]);
    });

    it("matches login.uri case-insensitively", () => {
      expect(filterCiphers(sync, { search: "example.com" }).map((c) => c.id)).toEqual(["4"]);
    });

    it("matches login.username case-insensitively", () => {
      expect(filterCiphers(sync, { search: "alice" }).map((c) => c.id)).toEqual(["5"]);
    });
  });

  it("filters by type and fails on an unknown type", () => {
    const sync = makeSync([
      makeCipher({ id: "1", type: CipherType.Login, name: "L" }),
      makeCipher({ id: "2", type: CipherType.Card, name: "C" }),
    ]);
    expect(filterCiphers(sync, { type: "card" }).map((c) => c.id)).toEqual(["2"]);
    expect(() => filterCiphers(sync, { type: "bogus" })).toThrow(FailError);
  });

  it("filters by org id or by resolved org display name", () => {
    const sync = makeSync(
      [
        makeCipher({ id: "1", name: "A", organizationId: "org-1" }),
        makeCipher({ id: "2", name: "B", organizationId: "org-2" }),
        makeCipher({ id: "3", name: "C", organizationId: null }),
      ],
      { profile: { organizations: [{ id: "org-2", name: "Beta Org" }] } } as any
    );
    expect(filterCiphers(sync, { org: "org-1" }).map((c) => c.id)).toEqual(["1"]);
    expect(filterCiphers(sync, { org: "Beta Org" }).map((c) => c.id)).toEqual(["2"]);
  });

  it("filters by folder", () => {
    const sync = makeSync([
      makeCipher({ id: "1", name: "A", folderId: "f1" }),
      makeCipher({ id: "2", name: "B", folderId: "f2" }),
    ]);
    expect(filterCiphers(sync, { folder: "f1" }).map((c) => c.id)).toEqual(["1"]);
  });

  it("composes multiple filters with AND semantics", () => {
    const sync = makeSync([
      makeCipher({ id: "1", name: "GitHub", type: CipherType.Login }),
      makeCipher({ id: "2", name: "GitHub Card", type: CipherType.Card }),
      makeCipher({ id: "3", name: "Unrelated", type: CipherType.Login }),
    ]);
    expect(
      filterCiphers(sync, { search: "github", type: "login" }).map((c) => c.id)
    ).toEqual(["1"]);
  });
});

describe("resolveCipher", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ProcessExitError(code);
    }) as never);
  });

  it("returns the single case-insensitive match, ignoring deleted items", async () => {
    getDecryptedSync.mockResolvedValue(
      makeSync([
        makeCipher({ id: "1", name: "GitHub" }),
        makeCipher({ id: "2", name: "GitHub", deletedDate: "2024-01-01" }),
      ])
    );
    const result = await resolveCipher("github", { interactive: true });
    expect(result.id).toBe("1");
  });

  it("fails with exit code 2 when there is no match", async () => {
    getDecryptedSync.mockResolvedValue(makeSync([]));
    await expect(resolveCipher("missing", { interactive: true })).rejects.toThrow(FailError);
    expect(fail).toHaveBeenCalledWith(
      expect.stringContaining('No item found matching name "missing".'),
      2
    );
  });

  it("non-interactive: multiple matches print details and process.exit(1) without prompting", async () => {
    getDecryptedSync.mockResolvedValue(
      makeSync([
        makeCipher({ id: "1", name: "GitHub" }),
        makeCipher({ id: "2", name: "GitHub" }),
      ])
    );
    await expect(
      resolveCipher("github", { interactive: false })
    ).rejects.toThrow(ProcessExitError);
    expect(promptSelect).not.toHaveBeenCalled();
    expect(printError).toHaveBeenCalledWith(expect.stringContaining("2 items match"));
    expect(printInfo).toHaveBeenCalledWith(expect.stringContaining("--id"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("interactive: multiple matches prompt the user and return the picked cipher", async () => {
    getDecryptedSync.mockResolvedValue(
      makeSync([
        makeCipher({ id: "1", name: "GitHub" }),
        makeCipher({ id: "2", name: "GitHub" }),
      ])
    );
    promptSelect.mockResolvedValue("2");
    const result = await resolveCipher("github", { interactive: true });
    expect(promptSelect).toHaveBeenCalled();
    expect(result.id).toBe("2");
  });

  it("narrows multiple matches down using --id", async () => {
    getDecryptedSync.mockResolvedValue(
      makeSync([
        makeCipher({ id: "1", name: "GitHub" }),
        makeCipher({ id: "2", name: "GitHub" }),
      ])
    );
    const result = await resolveCipher("github", { interactive: true, id: "2" });
    expect(result.id).toBe("2");
    expect(promptSelect).not.toHaveBeenCalled();
  });

  it("narrows multiple matches down using --folder", async () => {
    getDecryptedSync.mockResolvedValue(
      makeSync([
        makeCipher({ id: "1", name: "GitHub", folderId: "f1" }),
        makeCipher({ id: "2", name: "GitHub", folderId: "f2" }),
      ])
    );
    const result = await resolveCipher("github", { interactive: true, folder: "f2" });
    expect(result.id).toBe("2");
  });

  it("looks up by --id alone, without a name", async () => {
    getDecryptedSync.mockResolvedValue(
      makeSync([makeCipher({ id: "1", name: "GitHub" }), makeCipher({ id: "2", name: "GitLab" })])
    );
    const result = await resolveCipher(undefined, { interactive: true, id: "2" });
    expect(result.id).toBe("2");
  });

  it("fails when neither a name nor --id is given", async () => {
    await expect(resolveCipher(undefined, { interactive: true })).rejects.toThrow(FailError);
    expect(fail).toHaveBeenCalledWith(expect.stringContaining("Provide an item name, or --id"));
    expect(getDecryptedSync).not.toHaveBeenCalled();
  });
});
