import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Client,
  CipherType,
  FetchError,
  KdfType,
  type Cipher,
  type SyncResponse,
} from "./bw.js";
import {
  buildPbkdf2LoginFixture,
  bwEncrypt,
  bwEncryptBytes,
  deriveArgon2,
  generateRsaKeyPair,
  hkdfExpandSha256,
  pbkdf2,
  randomKey,
  wrapKey,
  wrapKeyRsa,
  type LoginFixture,
  type RawKey,
} from "../test-utils/bw-fixtures.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textErrorResponse(body: string, status = 400): Response {
  return new Response(body, { status });
}

/** Installs a fetch mock that returns the given responses in call order. */
function mockFetchSequence(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockImplementationOnce(async () => r);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FetchError", () => {
  it("carries status/data and a default message", () => {
    const err = new FetchError(404, "not found");
    expect(err.status).toBe(404);
    expect(err.data).toBe("not found");
    expect(err.message).toBe("FetchError: 404 not found");
  });

  it("json() parses the stored data", () => {
    const err = new FetchError(400, JSON.stringify({ TwoFactorProviders: ["0"] }));
    expect(err.json()).toEqual({ TwoFactorProviders: ["0"] });
  });
});

describe("Client construction and URL handling", () => {
  it("derives api/identity URLs from a baseUrl, trimming trailing slashes", () => {
    const client = new Client({ baseUrl: "https://vault.example.com///" });
    expect(client.apiUrl).toBe("https://vault.example.com/api");
    expect(client.identityUrl).toBe("https://vault.example.com/identity");
  });

  it("accepts explicit apiUrl/identityUrl instead of baseUrl", () => {
    const client = new Client({
      apiUrl: "https://custom/api",
      identityUrl: "https://custom/identity",
    });
    expect(client.apiUrl).toBe("https://custom/api");
    expect(client.identityUrl).toBe("https://custom/identity");
  });

  it("defaults to the official Bitwarden EU cloud", () => {
    const client = new Client();
    expect(client.apiUrl).toBe("https://vault.bitwarden.eu/api");
  });

  it("isVaultWarden() is false for bitwarden.eu / bitwarden.com, true otherwise", () => {
    expect(new Client({ baseUrl: "https://vault.bitwarden.eu" }).isVaultWarden()).toBe(false);
    expect(new Client({ baseUrl: "https://vault.bitwarden.com" }).isVaultWarden()).toBe(false);
    expect(new Client({ baseUrl: "https://vault.mycompany.com" }).isVaultWarden()).toBe(true);
  });

  it("starts logged out with empty state", () => {
    const client = new Client();
    expect(client.token).toBeNull();
    expect(client.refreshToken).toBeNull();
    expect(client.keys).toEqual({});
    expect(client.orgKeys).toEqual({});
  });
});

describe("Client.login", () => {
  const email = "User@Example.com";
  const password = "correct horse battery staple";
  const kdfIterations = 10;

  function tokenResponseFor(fixture: LoginFixture) {
    return {
      access_token: "access-token-1",
      refresh_token: "refresh-token-1",
      expires_in: 3600,
      Key: fixture.userKeyEncrypted,
      PrivateKey: fixture.privateKeyEncrypted,
    };
  }

  it("derives keys via PBKDF2, decodes user/private keys and sets session state", async () => {
    const fixture = buildPbkdf2LoginFixture(email, password, kdfIterations);
    const fetchMock = mockFetchSequence(
      jsonResponse({ kdf: KdfType.PBKDF2, kdfIterations }),
      jsonResponse(tokenResponseFor(fixture))
    );

    const client = new Client({ baseUrl: "https://vault.example.com" });
    await client.login(email, password);

    expect(client.token).toBe("access-token-1");
    expect(client.refreshToken).toBe("refresh-token-1");
    expect(client.tokenExpiration).toBeGreaterThan(Date.now());

    // Master key must be cleared from memory after login.
    expect(client.keys.masterKey).toBeUndefined();
    expect(client.keys.masterPasswordHash).toBe(fixture.masterPasswordHash);

    // The user key decrypted from `Key` must match the fixture's random user key exactly.
    expect(Buffer.from(client.keys.userKey!.key)).toEqual(fixture.userKey.key);
    expect(Buffer.from(client.keys.userKey!.mac)).toEqual(fixture.userKey.mac);

    // The private key decrypted from `PrivateKey` must match the generated RSA DER bytes.
    expect(Buffer.from(client.keys.privateKey!.key)).toEqual(fixture.rsa.privateKeyDer);

    // Prelogin call.
    const [preloginUrl, preloginInit] = fetchMock.mock.calls[0]!;
    expect(String(preloginUrl)).toBe("https://vault.example.com/identity/accounts/prelogin");
    expect(JSON.parse(preloginInit.body as string)).toEqual({ email });

    // Token call must authenticate with the derived master password hash, not the raw password.
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[1]!;
    expect(String(tokenUrl)).toBe("https://vault.example.com/identity/connect/token");
    const body = new URLSearchParams(tokenInit.body as string);
    expect(body.get("username")).toBe(email);
    expect(body.get("password")).toBe(fixture.masterPasswordHash);
    expect(body.get("grant_type")).toBe("password");
    expect(body.get("scope")).toBe("api offline_access");
  });

  it("is deterministic: the same email/password/iterations always produce the same master password hash", async () => {
    const fixtureA = buildPbkdf2LoginFixture(email, password, kdfIterations);
    const fetchMockA = mockFetchSequence(
      jsonResponse({ kdf: KdfType.PBKDF2, kdfIterations }),
      jsonResponse(tokenResponseFor(fixtureA))
    );
    const clientA = new Client({ baseUrl: "https://vault.example.com" });
    await clientA.login(email, password);
    vi.unstubAllGlobals();

    const fixtureB = buildPbkdf2LoginFixture(email, password, kdfIterations);
    mockFetchSequence(
      jsonResponse({ kdf: KdfType.PBKDF2, kdfIterations }),
      jsonResponse(tokenResponseFor(fixtureB))
    );
    const clientB = new Client({ baseUrl: "https://vault.example.com" });
    await clientB.login(email, password);

    expect(clientA.keys.masterPasswordHash).toBe(clientB.keys.masterPasswordHash);
    void fetchMockA;
  });

  it("normalizes the email (trim + lowercase) before deriving the master key", async () => {
    const normalized = buildPbkdf2LoginFixture("user@example.com", password, kdfIterations);
    mockFetchSequence(
      jsonResponse({ kdf: KdfType.PBKDF2, kdfIterations }),
      jsonResponse(tokenResponseFor(normalized))
    );
    const client = new Client({ baseUrl: "https://vault.example.com" });
    await client.login("  User@Example.COM  ", password);
    expect(client.keys.masterPasswordHash).toBe(normalized.masterPasswordHash);
  });

  it("derives keys via Argon2id when the server reports that KDF", async () => {
    const masterKey = await deriveArgon2(password, email.trim().toLowerCase(), 1, 8, 1);
    const masterPasswordHash = pbkdf2(masterKey, password, 1).toString("base64");
    const encryptionKey: RawKey = {
      key: hkdfExpandSha256(masterKey, "enc"),
      mac: hkdfExpandSha256(masterKey, "mac"),
    };
    const userKey = randomKey();
    const userKeyEncrypted = bwEncryptBytes(
      Buffer.concat([userKey.key, userKey.mac]),
      encryptionKey
    );

    mockFetchSequence(
      jsonResponse({ kdf: KdfType.Argon2id, kdfIterations: 1, kdfMemory: 8, kdfParallelism: 1 }),
      jsonResponse({
        access_token: "tok",
        refresh_token: "ref",
        expires_in: 3600,
        Key: userKeyEncrypted,
        PrivateKey: "",
      })
    );

    const client = new Client({ baseUrl: "https://vault.example.com" });
    await client.login(email, password);

    expect(client.keys.masterPasswordHash).toBe(masterPasswordHash);
    expect(Buffer.from(client.keys.userKey!.key)).toEqual(userKey.key);
  });

  it("propagates a FetchError with the response body when prelogin fails", async () => {
    mockFetchSequence(textErrorResponse("email is required", 400));
    const client = new Client({ baseUrl: "https://vault.example.com" });
    await expect(client.login(email, password)).rejects.toMatchObject({
      status: 400,
      data: "email is required",
    });
  });

  it("propagates a two-factor challenge as a FetchError from the token endpoint", async () => {
    mockFetchSequence(
      jsonResponse({ kdf: KdfType.PBKDF2, kdfIterations }),
      textErrorResponse(JSON.stringify({ TwoFactorProviders: ["0"] }), 400)
    );
    const client = new Client({ baseUrl: "https://vault.example.com" });
    let caught: FetchError | undefined;
    try {
      await client.login(email, password);
    } catch (e) {
      caught = e as FetchError;
    }
    expect(caught).toBeInstanceOf(FetchError);
    expect(caught!.json()).toEqual({ TwoFactorProviders: ["0"] });
  });

  it("passes through extra opts (e.g. two-factor fields) into the token request body", async () => {
    const fixture = buildPbkdf2LoginFixture(email, password, kdfIterations);
    const fetchMock = mockFetchSequence(
      jsonResponse(tokenResponseFor(fixture)) // skipPrelogin path only issues one request
    );
    const client = new Client({ baseUrl: "https://vault.example.com" });
    // skipPrelogin=true reuses already-derived keys; still needs encryptionKey to decode `Key`.
    client.keys = {
      masterPasswordHash: fixture.masterPasswordHash,
      encryptionKey: fixture.encryptionKey,
    };
    await client.login(email, password, true, {
      twoFactorProvider: "0",
      twoFactorToken: "123456",
    });

    const [, tokenInit] = fetchMock.mock.calls[0]!;
    const body = new URLSearchParams(tokenInit.body as string);
    expect(body.get("twoFactorProvider")).toBe("0");
    expect(body.get("twoFactorToken")).toBe("123456");
  });
});

describe("Client.checkToken", () => {
  it("does not refresh when the token is still valid", async () => {
    const fetchMock = mockFetchSequence();
    const client = new Client();
    client.token = "still-valid";
    client.refreshToken = "refresh";
    client.tokenExpiration = Date.now() + 60_000;
    await client.checkToken();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.token).toBe("still-valid");
  });

  it("refreshes the token when expired", async () => {
    const fetchMock = mockFetchSequence(
      jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 60 })
    );
    const client = new Client({ baseUrl: "https://vault.example.com" });
    client.token = "old";
    client.refreshToken = "old-refresh";
    client.tokenExpiration = Date.now() - 1000;

    await client.checkToken();

    expect(client.token).toBe("new-access");
    expect(client.refreshToken).toBe("new-refresh");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://vault.example.com/identity/connect/token");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-refresh");
  });

  it("throws when the token is expired and there is no refresh token", async () => {
    const client = new Client();
    client.tokenExpiration = Date.now() - 1000;
    client.refreshToken = null;
    await expect(client.checkToken()).rejects.toThrow(/login first/i);
  });
});

describe("Client.sendEmailMfaCode", () => {
  it("posts the master password hash and device identifier", async () => {
    const fetchMock = mockFetchSequence(jsonResponse({}));
    const client = new Client({ baseUrl: "https://vault.example.com" });
    client.keys = { masterPasswordHash: "hash123" };
    await client.sendEmailMfaCode("user@example.com");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://vault.example.com/api/two-factor/send-email-login");
    const body = JSON.parse(init.body as string);
    expect(body.email).toBe("user@example.com");
    expect(body.masterPasswordHash).toBe("hash123");
  });
});

describe("Client.encrypt / decrypt", () => {
  it("round-trips arbitrary text through AES-256-CBC + HMAC", () => {
    const client = new Client();
    const key = randomKey();
    const encrypted = client.encrypt("hunter2 🔒 unicode", key);
    expect(encrypted).toMatch(/^2\.[A-Za-z0-9+/=]+\|[A-Za-z0-9+/=]+\|[A-Za-z0-9+/=]+$/);
    expect(client.decrypt(encrypted, key)).toBe("hunter2 🔒 unicode");
  });

  it("decrypts a string produced by an independent implementation of the format", () => {
    const client = new Client();
    const key = randomKey();
    const encrypted = bwEncrypt("independently encrypted", key);
    expect(client.decrypt(encrypted, key)).toBe("independently encrypted");
  });

  it("decrypt() falls back to returning the original value if decryption fails", () => {
    const client = new Client();
    const key = randomKey();
    expect(client.decrypt("not a valid cipher string", key)).toBe("not a valid cipher string");
  });

  it("decrypt()/encrypt() pass through null/undefined/empty unchanged", () => {
    const client = new Client();
    expect(client.decrypt(null)).toBeNull();
    expect(client.decrypt(undefined)).toBeUndefined();
    expect(client.encrypt(null)).toBeNull();
  });

  it("encrypt() throws when no key is available", () => {
    const client = new Client();
    expect(() => client.encrypt("value", undefined)).toThrow(/missing value or key/i);
  });

  it("uses this.keys.userKey by default when no explicit key is passed", () => {
    const client = new Client();
    client.keys.userKey = randomKey();
    const encrypted = client.encrypt("default key value");
    expect(client.decrypt(encrypted)).toBe("default key value");
  });
});

describe("Client.getDecryptionKey", () => {
  it("returns the user key for a personal cipher with no custom key", () => {
    const client = new Client();
    const userKey = randomKey();
    client.keys.userKey = userKey;
    const key = client.getDecryptionKey({ organizationId: null });
    expect(key).toBe(userKey);
  });

  it("returns the org key for an org-owned cipher with no custom key", () => {
    const client = new Client();
    const orgKey = randomKey();
    client.orgKeys["org-1"] = orgKey;
    const key = client.getDecryptionKey({ organizationId: "org-1" });
    expect(key).toBe(orgKey);
  });

  it("falls back to the user key if the org key is unknown", () => {
    const client = new Client();
    const userKey = randomKey();
    client.keys.userKey = userKey;
    const key = client.getDecryptionKey({ organizationId: "unknown-org" });
    expect(key).toBe(userKey);
  });

  it("unwraps a cipher-specific key using the base key", () => {
    const client = new Client();
    const userKey = randomKey();
    client.keys.userKey = userKey;
    const cipherKey = randomKey();
    const wrapped = wrapKey(cipherKey, userKey);

    const key = client.getDecryptionKey({ organizationId: null, key: wrapped });
    // decryptKey returns the raw concatenated bytes (key+mac) as a single buffer.
    expect(Buffer.from(key!.key).subarray(0, 32)).toEqual(cipherKey.key);

    const field = bwEncryptBytes(Buffer.from("secret value", "utf-8"), cipherKey);
    expect(client.decrypt(field, key)).toBe("secret value");
  });
});

describe("Client sync + decryption pipeline", () => {
  const orgId = "org-1";
  const userKey: RawKey = randomKey();
  const orgKey: RawKey = randomKey();
  const cipherSpecificKey: RawKey = randomKey();
  const rsa = generateRsaKeyPair();

  function buildClient(): Client {
    const client = new Client();
    client.keys.userKey = userKey;
    client.keys.privateKey = { key: rsa.privateKeyDer, mac: new Uint8Array() };
    return client;
  }

  /**
   * Directly assigning `syncCache` (as these tests do, to avoid mocking fetch)
   * skips the org-key decryption that `syncRefresh()` normally performs
   * immediately afterwards. Replicate that step so org-owned ciphers decrypt
   * with the right key instead of silently falling back to the user key.
   */
  function primeSync(client: Client, cache: SyncResponse): void {
    client.syncCache = cache;
    client.decryptOrgKeys();
  }

  function buildSyncCache(): SyncResponse {
    const loginCipher: Cipher = {
      id: "cipher-login",
      type: CipherType.Login,
      key: null,
      folderId: null,
      organizationId: null,
      collectionIds: null,
      deletedDate: null,
      name: bwEncrypt("GitHub", userKey),
      notes: bwEncrypt("some notes", userKey),
      favorite: false,
      login: {
        username: bwEncrypt("octocat", userKey),
        password: bwEncrypt("s3cr3t", userKey),
        totp: bwEncrypt("JBSWY3DPEHPK3PXP", userKey),
        uri: bwEncrypt("https://github.com", userKey),
        uris: [
          { uri: bwEncrypt("https://github.com", userKey), uriChecksum: null },
          { uri: bwEncrypt("https://github.com/login", userKey), uriChecksum: null },
        ],
      },
      fields: [
        { name: bwEncrypt("custom1", userKey), value: bwEncrypt("value1", userKey), type: 0 },
        { name: bwEncrypt("custom2", userKey), value: bwEncrypt("value2", userKey), type: 1 },
      ],
    };

    const cardCipher: Cipher = {
      id: "cipher-card",
      type: CipherType.Card,
      key: null,
      folderId: null,
      organizationId: orgId,
      collectionIds: ["col-1"],
      deletedDate: null,
      name: bwEncrypt("Visa", orgKey),
      notes: "",
      favorite: false,
      card: {
        cardholderName: bwEncrypt("Jane Doe", orgKey),
        brand: bwEncrypt("Visa", orgKey),
        number: bwEncrypt("4111111111111111", orgKey),
        expMonth: bwEncrypt("01", orgKey),
        expYear: bwEncrypt("2030", orgKey),
        code: bwEncrypt("123", orgKey),
      },
    };

    const identityCipher: Cipher = {
      id: "cipher-identity",
      type: CipherType.Identity,
      key: null,
      folderId: null,
      organizationId: null,
      collectionIds: null,
      deletedDate: null,
      name: bwEncrypt("Passport", userKey),
      notes: "",
      favorite: false,
      identity: {
        address1: bwEncrypt("1 Infinite Loop", userKey),
        address2: bwEncrypt("Suite 2", userKey),
        address3: bwEncrypt("Building 3", userKey),
        city: bwEncrypt("Cupertino", userKey),
        company: bwEncrypt("Acme", userKey),
        country: bwEncrypt("US", userKey),
        email: bwEncrypt("jane@example.com", userKey),
        firstName: bwEncrypt("Jane", userKey),
        lastName: bwEncrypt("Doe", userKey),
        licenseNumber: bwEncrypt("LIC123", userKey),
        middleName: bwEncrypt("Q", userKey),
        passportNumber: bwEncrypt("P123456", userKey),
        phone: bwEncrypt("555-1234", userKey),
        postalCode: bwEncrypt("95014", userKey),
        ssn: bwEncrypt("000-00-0000", userKey),
        state: bwEncrypt("CA", userKey),
        title: bwEncrypt("Ms", userKey),
        username: bwEncrypt("janedoe", userKey),
      },
    };

    const sshCipher: Cipher = {
      id: "cipher-ssh",
      type: CipherType.SSHKey,
      key: null,
      folderId: null,
      organizationId: null,
      collectionIds: null,
      deletedDate: null,
      name: bwEncrypt("Deploy key", userKey),
      notes: "",
      favorite: false,
      sshKey: {
        keyFingerprint: bwEncrypt("SHA256:abc123", userKey),
        privateKey: bwEncrypt("-----BEGIN OPENSSH PRIVATE KEY-----", userKey),
        publicKey: bwEncrypt("ssh-ed25519 AAAA...", userKey),
      },
    };

    const sharedKeyCipher: Cipher = {
      id: "cipher-shared-key",
      type: CipherType.Login,
      key: wrapKey(cipherSpecificKey, orgKey),
      folderId: null,
      organizationId: orgId,
      collectionIds: ["col-1"],
      deletedDate: null,
      name: bwEncrypt("Shared login", cipherSpecificKey),
      notes: "",
      favorite: false,
      login: {
        username: bwEncrypt("shared-user", cipherSpecificKey),
        password: bwEncrypt("shared-pass", cipherSpecificKey),
      },
    };

    return {
      ciphers: [loginCipher, cardCipher, identityCipher, sshCipher, sharedKeyCipher],
      collections: [
        { id: "col-1", organizationId: orgId, name: bwEncrypt("Engineering", orgKey), readOnly: false },
      ],
      profile: {
        organizations: [{ id: orgId, name: "Acme Inc", key: wrapKeyRsa(orgKey, rsa.publicKeyPem) }],
      },
    };
  }

  it("decrypts organization keys once per org id", () => {
    const client = buildClient();
    primeSync(client, buildSyncCache());
    client.decryptOrgKeys();
    expect(Buffer.from(client.orgKeys[orgId]!.key).subarray(0, 32)).toEqual(orgKey.key);

    // Calling again must not attempt to re-decrypt (would throw if it tried with a stale cache).
    const before = client.orgKeys[orgId];
    client.decryptOrgKeys();
    expect(client.orgKeys[orgId]).toBe(before);
  });

  it("decrypts every field of a personal login cipher, including custom fields and multiple URIs", async () => {
    const client = buildClient();
    primeSync(client, buildSyncCache());
    const sync = await client.getDecryptedSync();
    const cipher = sync.ciphers.find((c) => c.id === "cipher-login")!;

    expect(cipher.name).toBe("GitHub");
    expect(cipher.notes).toBe("some notes");
    expect(cipher.login!.username).toBe("octocat");
    expect(cipher.login!.password).toBe("s3cr3t");
    expect(cipher.login!.totp).toBe("JBSWY3DPEHPK3PXP");
    expect(cipher.login!.uri).toBe("https://github.com");
    expect(cipher.login!.uris).toEqual([
      { uri: "https://github.com", uriChecksum: null },
      { uri: "https://github.com/login", uriChecksum: null },
    ]);
    expect(cipher.fields).toEqual([
      { name: "custom1", value: "value1", type: 0 },
      { name: "custom2", value: "value2", type: 1 },
    ]);
  });

  it("decrypts an org-owned card cipher and its collection name using the org key", async () => {
    const client = buildClient();
    primeSync(client, buildSyncCache());
    const sync = await client.getDecryptedSync();
    const cipher = sync.ciphers.find((c) => c.id === "cipher-card")!;

    expect(cipher.name).toBe("Visa");
    expect(cipher.card).toEqual({
      cardholderName: "Jane Doe",
      brand: "Visa",
      number: "4111111111111111",
      expMonth: "01",
      expYear: "2030",
      code: "123",
    });
    expect(sync.collections![0]!.name).toBe("Engineering");
  });

  it("decrypts every identity field", async () => {
    const client = buildClient();
    primeSync(client, buildSyncCache());
    const sync = await client.getDecryptedSync();
    const cipher = sync.ciphers.find((c) => c.id === "cipher-identity")!;

    expect(cipher.identity).toMatchObject({
      address1: "1 Infinite Loop",
      address2: "Suite 2",
      city: "Cupertino",
      company: "Acme",
      country: "US",
      email: "jane@example.com",
      firstName: "Jane",
      lastName: "Doe",
      licenseNumber: "LIC123",
      middleName: "Q",
      passportNumber: "P123456",
      phone: "555-1234",
      postalCode: "95014",
      ssn: "000-00-0000",
      state: "CA",
      title: "Ms",
      username: "janedoe",
    });
  });

  it("decrypts SSH key fields", async () => {
    const client = buildClient();
    primeSync(client, buildSyncCache());
    const sync = await client.getDecryptedSync();
    const cipher = sync.ciphers.find((c) => c.id === "cipher-ssh")!;

    expect(cipher.sshKey).toEqual({
      keyFingerprint: "SHA256:abc123",
      privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----",
      publicKey: "ssh-ed25519 AAAA...",
    });
  });

  it("decrypts a cipher protected by its own (org-wrapped) key", async () => {
    const client = buildClient();
    primeSync(client, buildSyncCache());
    const sync = await client.getDecryptedSync();
    const cipher = sync.ciphers.find((c) => c.id === "cipher-shared-key")!;

    expect(cipher.name).toBe("Shared login");
    expect(cipher.login!.username).toBe("shared-user");
    expect(cipher.login!.password).toBe("shared-pass");
  });

  it("caches the decrypted sync and only re-decrypts on forceRefresh", async () => {
    const client = buildClient();
    client.token = "access-token";
    client.refreshToken = "refresh-token";
    client.tokenExpiration = Date.now() + 60_000;
    primeSync(client, buildSyncCache());
    const first = await client.getDecryptedSync();
    const second = await client.getDecryptedSync();
    expect(second).toBe(first);

    const fetchMock = mockFetchSequence(jsonResponse(buildSyncCache()));
    const third = await client.getDecryptedSync({ forceRefresh: true });
    expect(fetchMock).toHaveBeenCalled();
    expect(third).not.toBe(first);
  });

  it("getSecretByName / getSecretById find decrypted or raw ciphers, and report no matches", async () => {
    const client = buildClient();
    primeSync(client, buildSyncCache());

    const byName = await client.getSecretByName("GitHub");
    expect(byName).toHaveLength(1);
    expect(byName[0]!.login!.password).toBe("s3cr3t");

    const rawByName = await client.getSecretByName("GitHub", { decrypted: false });
    expect(rawByName[0]!.login!.password).not.toBe("s3cr3t");

    expect(await client.getSecretByName("does not exist")).toEqual([]);

    const byId = await client.getSecretById("cipher-card");
    expect(byId!.name).toBe("Visa");
    expect(await client.getSecretById("missing")).toBeUndefined();
  });
});

describe("Client CRUD operations", () => {
  function buildClient(): Client {
    const client = new Client({ baseUrl: "https://vault.example.com" });
    client.token = "access-token";
    client.tokenExpiration = Date.now() + 60_000;
    client.refreshToken = "refresh-token";
    client.keys.userKey = randomKey();
    return client;
  }

  it("createSecret posts to /ciphers when there are no collections", async () => {
    const client = buildClient();
    const fetchMock = mockFetchSequence(jsonResponse({ id: "new-id" }));

    const result = await client.createSecret({
      type: CipherType.Login,
      name: "New item",
      notes: "",
      favorite: false,
      login: { username: "u", password: "p" },
    } as any);

    expect(result).toEqual({ id: "new-id" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://vault.example.com/api/ciphers");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer access-token");
    const body = JSON.parse(init.body as string);
    expect(body.name).not.toBe("New item"); // must be encrypted, not plaintext
    expect(client.decrypt(body.name)).toBe("New item");
  });

  it("createSecret posts to /ciphers/create with collectionIds when sharing", async () => {
    const client = buildClient();
    const fetchMock = mockFetchSequence(jsonResponse({ id: "new-id" }));

    await client.createSecret({
      type: CipherType.SecureNote,
      name: "Shared note",
      notes: "",
      favorite: false,
      organizationId: "org-1",
      collectionIds: ["col-1", "col-2"],
    } as any);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://vault.example.com/api/ciphers/create");
    const body = JSON.parse(init.body as string);
    expect(body.collectionIds).toEqual(["col-1", "col-2"]);
    expect(body.cipher.organizationId).toBe("org-1");
  });

  it("updateSecret sends only the changed fields and invalidates the cache", async () => {
    const client = buildClient();
    const original: Cipher = {
      id: "c1",
      type: CipherType.Login,
      folderId: null,
      organizationId: null,
      collectionIds: null,
      deletedDate: null,
      name: client.encrypt("Old name"),
      notes: "",
      favorite: false,
      login: {
        username: client.encrypt("old-user"),
        password: client.encrypt("old-pass"),
      },
    };
    client.syncCache = { ciphers: [original] };
    client.decryptedSyncCache = null;

    const fetchMock = mockFetchSequence(jsonResponse({ id: "c1" }));
    const updated = await client.updateSecret("c1", { name: "New name" });

    expect(updated).toEqual({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://vault.example.com/api/ciphers/c1");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(client.decrypt(body.name)).toBe("New name");
    // Untouched sibling fields must be preserved unencrypted-diff, i.e. still decrypt correctly.
    expect(client.decrypt(body.login.username)).toBe("old-user");
    expect(client.decrypt(body.login.password)).toBe("old-pass");

    // Cache must be invalidated so the next read re-syncs.
    expect(client.syncCache).toBeNull();
    expect(client.decryptedSyncCache).toBeNull();
  });

  it("updateSecret is a no-op (no request) when the patch has no actual changes", async () => {
    const client = buildClient();
    const original: Cipher = {
      id: "c1",
      type: CipherType.Login,
      folderId: null,
      organizationId: null,
      collectionIds: null,
      deletedDate: null,
      name: client.encrypt("Same name"),
      notes: "",
      favorite: false,
      login: { username: client.encrypt("user") },
    };
    client.syncCache = { ciphers: [original] };
    const fetchMock = mockFetchSequence();

    const result = await client.updateSecret("c1", { name: "Same name" });
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updateSecret throws when the cipher isn't in the local cache", async () => {
    const client = buildClient();
    client.syncCache = { ciphers: [] };
    await expect(client.updateSecret("missing", { name: "x" })).rejects.toThrow(/sync/i);
  });

  it(
    "KNOWN LIMITATION: patching one element of an array field can null out or truncate " +
      "sibling elements, because objectDiff() diffs arrays element-by-element and " +
      "patchObject() then replaces the whole array with that partial diff instead of merging",
    async () => {
      const client = buildClient();
      const original: Cipher = {
        id: "c1",
        type: CipherType.Login,
        folderId: null,
        organizationId: null,
        collectionIds: null,
        deletedDate: null,
        name: client.encrypt("Item"),
        notes: "",
        favorite: false,
        fields: [
          { name: "kept", value: "kept-value", type: 0 },
          { name: "changed", value: "old-value", type: 0 },
        ],
      };
      client.syncCache = { ciphers: [original] };
      mockFetchSequence(jsonResponse({ id: "c1" }));

      await client.updateSecret("c1", {
        fields: [
          { name: "kept", value: "kept-value", type: 0 },
          { name: "changed", value: "new-value", type: 0 },
        ],
      } as any);

      const sentBody = JSON.parse(
        (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string
      );
      // Documents current (buggy) behavior: the untouched first field is lost.
      expect(sentBody.fields[0]).toBeNull();
      expect(client.decrypt(sentBody.fields[1].value)).toBe("new-value");
    }
  );

  it("deleteSecret sends a DELETE request and invalidates the cache", async () => {
    const client = buildClient();
    client.syncCache = { ciphers: [] } as any;
    client.decryptedSyncCache = { ciphers: [] } as any;
    const fetchMock = mockFetchSequence(jsonResponse({}));

    await client.deleteSecret("c1");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://vault.example.com/api/ciphers/c1");
    expect(init.method).toBe("DELETE");
    expect(client.syncCache).toBeNull();
    expect(client.decryptedSyncCache).toBeNull();
  });

  it("shareCipher requires at least one collection", async () => {
    const client = buildClient();
    await expect(client.shareCipher("c1", {}, [])).rejects.toThrow(/at least one collection/i);
  });

  it("shareCipher moves a personal cipher into an org with the given collections", async () => {
    const client = buildClient();
    const original: Cipher = {
      id: "c1",
      type: CipherType.Login,
      folderId: null,
      organizationId: null,
      collectionIds: null,
      deletedDate: null,
      name: client.encrypt("Item"),
      notes: "",
      favorite: false,
    };
    client.syncCache = { ciphers: [original] };
    const fetchMock = mockFetchSequence(jsonResponse({ id: "c1" }));

    await client.shareCipher("c1", { organizationId: "org-1" }, ["col-1"]);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://vault.example.com/api/ciphers/c1/share");
    const body = JSON.parse(init.body as string);
    expect(body.collectionIds).toEqual(["col-1"]);
    expect(client.syncCache).toBeNull();
  });

  it("shareCipher throws if the cipher is not present in the cache", async () => {
    const client = buildClient();
    client.syncCache = { ciphers: [] };
    await expect(client.shareCipher("missing", {}, ["col-1"])).rejects.toThrow(/sync/i);
  });

  it("updateCollections is a no-op with an empty list", async () => {
    const client = buildClient();
    const fetchMock = mockFetchSequence();
    const result = await client.updateCollections("c1", []);
    expect(result).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updateCollections PUTs the new collection ids and invalidates the cache", async () => {
    const client = buildClient();
    client.syncCache = { ciphers: [] } as any;
    const fetchMock = mockFetchSequence(jsonResponse({ id: "c1" }));

    await client.updateCollections("c1", ["col-2"]);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://vault.example.com/api/ciphers/c1/collections_v2");
    expect(JSON.parse(init.body as string)).toEqual({ collectionIds: ["col-2"] });
    expect(client.syncCache).toBeNull();
  });
});

describe("Client.logout", () => {
  it("clears all session state", () => {
    const client = new Client();
    client.token = "t";
    client.refreshToken = "r";
    client.tokenExpiration = 123;
    client.keys.userKey = randomKey();
    client.orgKeys["org"] = randomKey();
    client.syncCache = { ciphers: [] };
    client.decryptedSyncCache = { ciphers: [] };

    client.logout();

    expect(client.token).toBeNull();
    expect(client.refreshToken).toBeNull();
    expect(client.tokenExpiration).toBeNull();
    expect(client.keys).toEqual({});
    expect(client.orgKeys).toEqual({});
    expect(client.syncCache).toBeNull();
    expect(client.decryptedSyncCache).toBeNull();
  });
});
