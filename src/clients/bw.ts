/**
 * Bitwarden client for Node.js
 * This client provides methods to interact with the Bitwarden API and decrypt/encrypt the ciphers.
 *
 * Authentication flow:
 * 1. Prelogin API to get KDF iterations
 * 2. Derive master key using email, password and KDF iterations
 * 3. Get token API using derived password hash
 * 4. Decode user and private keys
 *
 * Cipher decryption:
 * 1. Fetch sync data from Bitwarden API
 * 2. Decrypt organization keys using private key
 * 3. Choose the appropriate decryption key:
 *  - User key for personal ciphers
 *  - Organization key for org ciphers
 *  - Cipher-specific key if available
 * 4. Decrypt cipher fields using the chosen key
 */

import https from "node:https";
import crypto from "node:crypto";
import * as argon2 from "argon2";

interface FetchResponse {
  status: number | undefined;
  json: () => Promise<any>;
  text: () => Promise<string>;
}

export class FetchError extends Error {
  status: number;
  data: string;
  constructor(status: number, data: string, message?: string) {
    super(message ?? `FetchError: ${status} ${data}`);
    this.status = status;
    this.data = data;
  }

  json(): any {
    return JSON.parse(this.data);
  }
}

function fetch(
  url: string,
  options: { method?: string; headers?: Record<string, string> } = {},
  body: any = null
): Promise<FetchResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = https.request(requestOptions, (res) => {
      let data = "";
      const onData = (chunk: any) => {
        data += chunk;
      };
      const onEnd = () => {
        cleanup();
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          console.error("HTTP error body:", data);
          reject(
            new FetchError(
              res.statusCode,
              data,
              `HTTP error: ${res.statusCode} ${res.statusMessage}`
            )
          );
          return;
        }
        resolve({
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data),
        });
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        res.removeListener("data", onData);
        res.removeListener("end", onEnd);
        res.removeListener("error", onError);
      };

      res.on("data", onData);
      res.on("end", onEnd);
      res.on("error", onError);
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

export enum CipherType {
  Login = 1,
  SecureNote = 2,
  Card = 3,
  Identity = 4,
  SSHKey = 5,
}

export enum KeyType {
  AES_256 = "0",
  AES_128_MAC = "1",
  AES_256_MAC = "2",
  RSA_SHA256 = "3",
  RSA_SHA1 = "4",
  RSA_SHA256_MAC = "5",
  RSA_SHA1_MAC = "6",
}

export const TwoFactorProvider: Record<string, string> = {
  "0": "Authenticator",
  "1": "Email",
  "2": "Fido2",
  "3": "Yubikey",
  "4": "Duo",
};

export interface Cipher {
  id: string;
  type: CipherType;
  key?: string | null;
  folderId?: string | null;
  organizationId: string | null;
  collectionIds?: string[] | null;
  deletedDate: string | null;
  name: string;
  notes: string;
  favorite: boolean;
  login?: {
    response?: null;
    uri?: string;
    uris?: {
      uri: string;
      uriChecksum?: string | null;
    }[];
    username?: string;
    password?: string;
    totp?: string | null;
  };
  identity?: {
    address1: string | null;
    address2: string | null;
    address3: string | null;
    city: string | null;
    company: string | null;
    country: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    licenseNumber: string | null;
    middleName: string | null;
    passportNumber: string | null;
    phone: string | null;
    postalCode: string | null;
    ssn: string | null;
    state: string | null;
    title: string | null;
    username: string | null;
  };
  sshKey?: {
    keyFingerprint?: string | null;
    privateKey?: string | null;
    publicKey?: string | null;
  };
  fields?: { name: string; value: string; type: number }[];
}

export type CipherDto = Omit<Cipher, "id" | "data">;

export enum KdfType {
  PBKDF2 = 0,
  Argon2id = 1,
}

export interface SyncResponse {
  ciphers: Cipher[];
  profile?: {
    organizations?: { id: string; name: string; key: string }[];
  };
}

export interface Key {
  type?: KeyType | null;
  iv?: Uint8Array | null;
  key: Uint8Array;
  mac: Uint8Array;
}

export interface ClientConfig {
  baseUrl?: string;
  apiUrl?: string;
  identityUrl?: string;
}

export interface BwKeys {
  masterKey?: Uint8Array;
  masterPasswordHash?: string;
  encryptionKey?: Key;
  userKey?: Key;
  privateKey?: Key;
}

const DEVICE_IDENTIFIER = "928f9664-5559-4a7b-9853-caf5bfa5dd57";
class Bw {
  /**
   * Derives the master key and related keys from the user's email and password.
   *
   * First, it derives the master key using PBKDF2 (Argon2 should be implemented in the future).
   * The master key is derived from the password using the email as the salt and the specified number of iterations.
   * The master password hash is then derived from the master key using the password as the salt with a single iteration of PBKDF2.
   *
   * The master password hash will be used for authentication.
   * The master key is used to derive the encryption and MAC keys using HKDF with SHA-256.
   * The encryption key will be used to decrypt the user keys.
   */
  async deriveMasterKey(
    email: string,
    password: string,
    prelogin: {
      kdf: KdfType;
      kdfIterations: number;
      kdfMemory?: number;
      kdfParallelism?: number;
    }
  ): Promise<BwKeys> {
    let masterKey: Uint8Array;
    if (prelogin.kdf === KdfType.PBKDF2) {
      masterKey = this.derivePbkdf2(password, email, prelogin.kdfIterations);
    } else {
      masterKey = await this.deriveArgon2(
        password,
        email,
        prelogin.kdfIterations,
        prelogin.kdfMemory!,
        prelogin.kdfParallelism!
      );
    }
    const masterPasswordHashBytes = this.derivePbkdf2(masterKey, password, 1);
    const masterPasswordHash = Buffer.from(masterPasswordHashBytes).toString(
      "base64"
    );
    const encryptionKey = this.hkdfExpandSha256(masterKey, "enc");
    const encryptionKeyMac = this.hkdfExpandSha256(masterKey, "mac");
    return {
      masterKey,
      masterPasswordHash,
      encryptionKey: {
        key: encryptionKey,
        mac: encryptionKeyMac,
      },
    };
  }

  /**
   * Decode the user key and private key.
   * The user key is decrypted using the encryption key.
   * The private key is decrypted using the user key.
   */
  decodeUserKeys(userKey: string, privateKey: string | null, keys: BwKeys) {
    if (!keys.encryptionKey) throw new Error("Encryption key not derived yet");
    const userKeyDecrypted = this.decryptKey(userKey, keys.encryptionKey);
    keys.userKey = {
      key: userKeyDecrypted.subarray(0, 32),
      mac: userKeyDecrypted.subarray(32, 64),
    };

    if (privateKey) {
      const privateKeyDecrypted = this.decryptKey(privateKey, keys.userKey);
      keys.privateKey = {
        key: privateKeyDecrypted,
        mac: new Uint8Array(),
      };
    }
    return keys;
  }

  /**
   * Decrypt a Bitwarden-formatted string using the provided key.
   * The function first parses the string to extract the type, IV, ciphertext, and HMAC.
   * It then selects the appropriate decryption method based on the type.
   * Supported types: AES-256(0), AES-256-MAC(2), AES-128-MAC(1), RSA-SHA1(4), RSA-SHA256(3), RSA-SHA1-MAC(6), and RSA-SHA256-MAC(5).
   */
  decryptKey(value: string, key: Key) {
    const data = this.parseBwString(value);

    try {
      switch (data.type) {
        case KeyType.AES_256:
        case KeyType.AES_256_MAC:
          return this.decryptAes(data, key, "aes-256-cbc");
        case KeyType.AES_128_MAC:
          return this.decryptAes(data, key, "aes-128-cbc");
        case KeyType.RSA_SHA1:
        case KeyType.RSA_SHA1_MAC:
          return this.decryptRsaOaep(data, key, "sha1");
        case KeyType.RSA_SHA256:
        case KeyType.RSA_SHA256_MAC:
          return this.decryptRsaOaep(data, key, "sha256");
        default:
          throw new Error(`Unknown key type: ${data.type}`);
      }
    } catch (error) {
      console.error("Error decrypting key:", error);
      throw error;
    }
  }

  // Decrypt as UTF-8 string
  decrypt(value: string, key: Key) {
    return this.decryptKey(value, key).toString("utf-8");
  }

  // Encrypt a string using the given key
  encrypt(value: string, key: Key) {
    if (!value || !key?.key) {
      throw new Error("Missing value or key for encryption");
    }

    const iv = crypto.randomBytes(16);
    const encryptionKey = Buffer.from(key.key);
    if (encryptionKey.length < 32) {
      throw new Error(`Key too short: ${encryptionKey.length} bytes, need 32`);
    }

    const aesKey = encryptionKey.subarray(0, 32);
    const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
    let encrypted = cipher.update(value, "utf-8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    let macKey: Buffer;
    if (key.mac && key.mac.length > 0) {
      macKey = Buffer.from(key.mac);
    } else if (key.key.length >= 64) {
      macKey = encryptionKey.subarray(32, 64);
    } else {
      throw new Error(
        "MAC key missing or invalid (need either mac field or 64-byte key)"
      );
    }

    const mac = crypto
      .createHmac("sha256", macKey)
      .update(iv)
      .update(encrypted)
      .digest();

    const ivB64 = iv.toString("base64");
    const encryptedB64 = encrypted.toString("base64");
    const macB64 = mac.toString("base64");

    return `2.${ivB64}|${encryptedB64}|${macB64}`;
  }

  // PBKDF2 key derivation
  derivePbkdf2(
    password: crypto.BinaryLike,
    salt: crypto.BinaryLike,
    iterations: number
  ) {
    return crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  }

  // Argon2 key derivation
  async deriveArgon2(
    password: crypto.BinaryLike,
    salt: crypto.BinaryLike,
    iterations: number,
    memory: number,
    parallelism: number
  ) {
    const saltHash = crypto
      .createHash("sha256")
      .update(Buffer.from(salt.toString(), "utf-8"))
      .digest();

    const hash = await argon2.hash(password.toString(), {
      salt: saltHash,
      timeCost: iterations,
      memoryCost: memory * 1024,
      parallelism,
      hashLength: 32,
      type: argon2.argon2id,
      raw: true,
    });
    return Buffer.from(hash);
  }

  hkdfExpandSha256(ikm: Uint8Array, info: string) {
    const mac = crypto.createHmac("sha256", ikm);
    mac.update(info);
    mac.update(Buffer.from([0x01]));
    return mac.digest();
  }

  /**
   * Parse a Bitwarden-formatted string into its components.
   * The function extracts the type, IV, ciphertext, and HMAC from the string.
   * The bitwarden string format is as follows:
   * A type (1 character) followed by a dot ('.'), then key parts separated by pipes ('|')
   * <type>.[<iv_base64>|]<ciphertext_base64>|<hmac_base64>
   *
   * AES types (0, 1, 2) include the IV, while RSA types (3, 4, 5, 6) do not.
   *
   * Examples:
   *   - 0.MTIzNDU2Nzg5MGFiY2RlZg==|c29tZWNpcGhlcnRleHQ=|aG1hY3ZhbHVl
   *   - 3.c29tZWNpcGhlcnRleHQ=|aG1hY3ZhbHVl
   *
   *   type   iv_base64                    ciphertext_base64        hmac_base64
   *   -------------------------------------------------------------------------
   *   0.     MTIzNDU2Nzg5MGFiY2RlZg==  |  c29tZWNpcGhlcnRleHQ=  |  aG1hY3ZhbHVl
   *   3.                                  c29tZWNpcGhlcnRleHQ=  |  aG1hY3ZhbHVl
   *
   */
  parseBwString(value: string): Key {
    if (!value?.length) {
      throw new Error("Empty value");
    }
    const type = value[0]! as KeyType;
    let ivb64, ciphertextB64, hmacB64;
    const v = value.slice(2).split("|");

    if (["0", "1", "2"].includes(type)) {
      ivb64 = v[0];
      ciphertextB64 = v[1];
      hmacB64 = v[2];
    } else if (["3", "4", "5", "6"].includes(type)) {
      ciphertextB64 = v[0];
      hmacB64 = v[1];
    }

    const iv = ivb64 ? Buffer.from(ivb64, "base64") : null;
    const ciphertext = Buffer.from(ciphertextB64!, "base64");
    const hmac = hmacB64 ? Buffer.from(hmacB64, "base64") : null;

    return { type, iv, key: ciphertext, mac: hmac! };
  }

  // AES decryption
  decryptAes(ciphertext: Key, key: Key, algorithm: string) {
    if (!ciphertext.iv) throw new Error("Missing IV for AES decryption");
    if (!key.key || !key.key.length) return Buffer.from("");

    const keyLength = algorithm.includes("256") ? 32 : 16;
    const keyBuf = Buffer.from(key.key);
    if (keyBuf.length < keyLength) {
      throw new Error(
        `Key too short: ${keyBuf.length} bytes, need ${keyLength}`
      );
    }
    const finalKey = keyBuf.subarray(0, keyLength);
    const decipher = crypto.createDecipheriv(
      algorithm,
      finalKey,
      ciphertext.iv
    );
    const decrypted = decipher.update(ciphertext.key);
    const final = decipher.final();

    return Buffer.concat([decrypted, final]);
  }

  // RSA OAEP decryption
  decryptRsaOaep(ciphertext: Key, key: Key, hashAlgorithm: string): Buffer {
    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(key.key),
      format: "der",
      type: "pkcs1",
    });

    return crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: hashAlgorithm,
        oaepLabel: Buffer.alloc(0),
      },
      Buffer.from(ciphertext.key)
    );
  }
}

const mcbw = new Bw();

export class Client {
  apiUrl!: string;
  identityUrl!: string;
  keys: BwKeys;
  orgKeys: Record<string, Key>;
  token: string | null;
  refreshToken: string | null;
  tokenExpiration: number | null;
  decryptedSyncCache: SyncResponse | null;
  syncCache: SyncResponse | null;

  constructor(
    uri: ClientConfig = {
      baseUrl: "https://vault.bitwarden.eu",
    }
  ) {
    this.setUrls(uri);
    this.keys = {};
    this.orgKeys = {};
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiration = null;
    this.decryptedSyncCache = null;
    this.syncCache = null;
  }

  private patchObject<T>(original: T, patch: Partial<T>): T {
    const result = { ...original };
    for (const key in patch) {
      const originalValue = (original as any)[key];
      const patchValue = (patch as any)[key];

      if (
        originalValue &&
        patchValue &&
        typeof originalValue === "object" &&
        !Array.isArray(originalValue) &&
        typeof patchValue === "object" &&
        !Array.isArray(patchValue)
      ) {
        (result as any)[key] = this.patchObject(originalValue, patchValue);
      } else if (patchValue !== undefined) {
        (result as any)[key] = patchValue;
      }
    }
    return result;
  }

  setUrls(uri: ClientConfig) {
    if (uri.baseUrl) {
      this.apiUrl = uri.baseUrl + "/api";
      this.identityUrl = uri.baseUrl + "/identity";
    } else {
      this.apiUrl = uri.apiUrl!;
      this.identityUrl = uri.identityUrl!;
    }
  }

  /**
   * Authenticates a user with the Bitwarden server using their email and password.
   * The login process involves three main steps:
   * 1. Prelogin request to get KDF iterations
   * 2. Master key derivation using email, password and KDF iterations (see Bw.deriveMasterKey)
   * 3. Token acquisition using derived credentials
   * 4. User and private key decryption (see Bw.decodeUserKeys)
   *
   * After successful authentication, it sets up the client with:
   * - Access token for API requests
   * - Refresh token for token renewal
   * - Token expiration timestamp
   * - Derived encryption keys (master key, user key, private key)
   */
  async login(
    email: string,
    password: string,
    skipPrelogin: boolean = false,
    opts?: Record<string, any>
  ): Promise<void> {
    let keys = this.keys;
    if (!skipPrelogin) {
      const prelogin = await fetch(
        `${this.identityUrl}/accounts/prelogin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
        {
          email,
        }
      ).then((r) => r.json());
      keys = await mcbw.deriveMasterKey(email, password, prelogin);
      this.keys = keys;
    }

    const bodyParams = new URLSearchParams();
    bodyParams.append("username", email);
    bodyParams.append("password", keys.masterPasswordHash!);
    bodyParams.append("grant_type", "password");
    bodyParams.append("deviceName", "chrome");
    bodyParams.append("deviceType", "9");
    bodyParams.append("deviceIdentifier", DEVICE_IDENTIFIER);
    bodyParams.append("client_id", "web");
    bodyParams.append("scope", "api offline_access");
    for (const [key, value] of Object.entries(opts || {})) {
      bodyParams.append(key, value);
    }
    const identityReq = await fetch(
      `${this.identityUrl}/connect/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
      bodyParams.toString()
    ).then((r) => r.json());

    this.token = identityReq.access_token;
    this.refreshToken = identityReq.refresh_token;
    this.tokenExpiration = Date.now() + identityReq.expires_in * 1000;
    const { userKey, privateKey } = mcbw.decodeUserKeys(
      identityReq.Key,
      identityReq.PrivateKey || "",
      keys
    );

    this.keys = {
      ...keys,
      userKey,
      privateKey,
    };
    this.syncCache = null;
    this.decryptedSyncCache = null;
    this.orgKeys = {};
  }

  async sendEmailMfaCode(email: string) {
    fetch(
      "https://vault.bitwarden.eu/api/two-factor/send-email-login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
      JSON.stringify({
        email: email,
        masterPasswordHash: this.keys.masterPasswordHash!,
        ssoEmail2FaSessionToken: "",
        deviceIdentifier: DEVICE_IDENTIFIER,
        authRequestAccessCode: "",
        authRequestId: "",
      })
    );
  }

  // Check and refresh token if needed
  async checkToken() {
    if (!this.tokenExpiration || Date.now() >= this.tokenExpiration) {
      if (!this.refreshToken) {
        throw new Error("No refresh token available. Please login first.");
      }
      const identityReq = await fetch(
        `${this.identityUrl}/connect/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
        `refresh_token=${this.refreshToken}&grant_type=refresh_token&client_id=web&scope=api%20offline_access`
      ).then((r) => r.json());

      this.token = identityReq.access_token;
      this.refreshToken = identityReq.refresh_token;
      this.tokenExpiration = Date.now() + identityReq.expires_in * 1000;
    }
  }

  /**
   * Fetches the latest sync data from the Bitwarden server and decrypts organization keys if available.
   * The orgKeys are decrypted using the private key derived during login.
   * The sync data is cached for future use.
   */
  async syncRefresh() {
    await this.checkToken();
    this.syncCache = await fetch(`${this.apiUrl}/sync?excludeDomains=true`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "bitwarden-client-version": "2025.9.0",
      },
    }).then((r) => r.json());
    this.decryptOrgKeys();
    return this.syncCache;
  }

  decryptOrgKeys() {
    if (!this.keys.privateKey) return;
    for (const org of this.syncCache?.profile?.organizations || []) {
      if (org.id in this.orgKeys) continue;
      this.orgKeys[org.id] = {
        key: mcbw.decryptKey(org.key, this.keys.privateKey),
        mac: new Uint8Array(),
      };
    }
  }

  /**
   * Get the appropriate decryption key for a given cipher.
   * If the cipher belongs to an organization, return the organization's key.
   * If the cipher has its own custom key, the custom key is decrypted using the appropriate key and returned.
   * Otherwise, it uses the user's key.
   */
  getDecryptionKey(cipher: Partial<Cipher>) {
    let key = this.keys.userKey;
    if (cipher.organizationId) {
      key = this.orgKeys[cipher.organizationId] || key;
    }
    if (key && cipher.key) {
      key = { key: mcbw.decryptKey(cipher.key, key!), mac: new Uint8Array() };
    }
    return key;
  }

  // fetch and decrypt the bw sync data
  async getDecryptedSync({ forceRefresh = false } = {}) {
    if (this.decryptedSyncCache && !forceRefresh) {
      return this.decryptedSyncCache;
    }
    if (!this.syncCache || forceRefresh) {
      await this.syncRefresh();
    }
    this.decryptedSyncCache = {
      ...this.syncCache,
      ciphers: this.syncCache!.ciphers.map((cipher) => {
        const key = this.getDecryptionKey(cipher);
        const ret = JSON.parse(JSON.stringify(cipher));
        ret.name = this.decrypt(cipher.name, key);
        ret.notes = this.decrypt(cipher.notes, key);
        if (cipher.login) {
          ret.login.username = this.decrypt(cipher.login.username, key);
          ret.login.password = this.decrypt(cipher.login.password, key);
          ret.login.totp = this.decrypt(cipher.login.totp, key);
          ret.login.uri = this.decrypt(cipher.login.uri, key);
          if (cipher.login.uris?.length) {
            ret.login.uris = cipher.login.uris?.map((uri) => ({
              uri: this.decrypt(uri.uri, key),
              uriChecksum: uri.uriChecksum,
            }));
          }
        }
        if (cipher.identity) {
          ret.identity = {
            address1:
              cipher.identity.address1 &&
              this.decrypt(cipher.identity.address1, key),
            address2:
              cipher.identity.address2 &&
              this.decrypt(cipher.identity.address2, key),
            address3:
              cipher.identity.address3 &&
              this.decrypt(cipher.identity.address3, key),
            city:
              cipher.identity.city && this.decrypt(cipher.identity.city, key),
            company:
              cipher.identity.company &&
              this.decrypt(cipher.identity.company, key),
            country:
              cipher.identity.country &&
              this.decrypt(cipher.identity.country, key),
            email:
              cipher.identity.email && this.decrypt(cipher.identity.email, key),
            firstName:
              cipher.identity.firstName &&
              this.decrypt(cipher.identity.firstName, key),
            lastName:
              cipher.identity.lastName &&
              this.decrypt(cipher.identity.lastName, key),
            licenseNumber:
              cipher.identity.licenseNumber &&
              this.decrypt(cipher.identity.licenseNumber, key),
            middleName:
              cipher.identity.middleName &&
              this.decrypt(cipher.identity.middleName, key),
            passportNumber:
              cipher.identity.passportNumber &&
              this.decrypt(cipher.identity.passportNumber, key),
            phone:
              cipher.identity.phone && this.decrypt(cipher.identity.phone, key),
            postalCode:
              cipher.identity.postalCode &&
              this.decrypt(cipher.identity.postalCode, key),
            ssn: cipher.identity.ssn && this.decrypt(cipher.identity.ssn, key),
            state:
              cipher.identity.state && this.decrypt(cipher.identity.state, key),
            title:
              cipher.identity.title && this.decrypt(cipher.identity.title, key),
            username:
              cipher.identity.username &&
              this.decrypt(cipher.identity.username, key),
          };
        }
        if (cipher.sshKey) {
          ret.sshKey = {
            keyFingerprint:
              cipher.sshKey.keyFingerprint &&
              this.decrypt(cipher.sshKey.keyFingerprint, key),
            privateKey:
              cipher.sshKey.privateKey &&
              this.decrypt(cipher.sshKey.privateKey, key),
            publicKey:
              cipher.sshKey.publicKey &&
              this.decrypt(cipher.sshKey.publicKey, key),
          };
        }
        if (ret.fields?.length) {
          ret.fields = cipher.fields?.map((field: any) => {
            return {
              ...field,
              name: this.decrypt(field.name, key),
              value: this.decrypt(field.value, key),
            };
          });
        }

        return ret;
      }),
    };

    return this.decryptedSyncCache;
  }

  async getSecretByName(name: string, { decrypted = true } = {}) {
    const ret = [];
    const sync = await this.getDecryptedSync();
    for (let i = 0; i < sync.ciphers.length; i++) {
      const cipher = sync.ciphers[i];
      if (cipher?.name === name) {
        ret.push(decrypted ? cipher : this.syncCache!.ciphers[i]);
      }
    }
    return ret;
  }

  async getSecretById(id: string, { decrypted = true } = {}) {
    const sync = await this.getDecryptedSync();
    for (let i = 0; i < sync.ciphers.length; i++) {
      const cipher = sync.ciphers[i];
      if (cipher?.id === id) {
        return decrypted ? cipher : this.syncCache!.ciphers[i];
      }
    }
    return undefined;
  }

  async createSecret(obj: CipherDto) {
    const key = this.getDecryptionKey(obj);
    const s = await fetch(
      `${this.apiUrl}/ciphers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
      },

      this.encryptCipher(obj, key)
    );
    return s.json();
  }

  objectDiff(obj1: any, obj2: any): any {
    if (
      typeof obj1 !== "object" ||
      obj1 === null ||
      typeof obj2 !== "object" ||
      obj2 === null
    ) {
      return obj1 !== obj2 ? obj2 : undefined;
    }

    let diff: any = Array.isArray(obj2) ? [] : {};

    let changed = false;
    for (const key in obj2) {
      if (!(key in obj1)) {
        diff[key] = obj2[key];
        changed = true;
      } else {
        const subDiff = this.objectDiff(obj1[key], obj2[key]);
        if (subDiff !== undefined) {
          diff[key] = subDiff;
          changed = true;
        }
      }
    }

    return changed ? diff : undefined;
  }

  async updateSecret(id: string, patch: Partial<CipherDto>) {
    await this.getDecryptedSync();
    const original = this.syncCache?.ciphers.find((c) => c.id === id);
    const decrypted = this.decryptedSyncCache?.ciphers.find((c) => c.id === id);
    if (!original || !decrypted) {
      throw new Error("Secret not found in cache. Please sync first.");
    }
    const obj = this.objectDiff(decrypted, patch);
    if (!obj) return null;
    const key = this.getDecryptionKey(patch);
    const data = this.patchObject(original, this.encryptCipher(obj, key));
    (data as any).data = undefined;
    const s = await fetch(
      `${this.apiUrl}/ciphers/${id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
      },
      data
    );
    this.decryptedSyncCache = null;
    this.syncCache = null;
    return s.json();
  }

  encrypt(value: string | null, key?: any): string {
    if (!value) return value!;
    const enc = mcbw.encrypt(value, key ?? this.keys.userKey);
    return enc;
  }

  decrypt(value: string | null | undefined, key?: any) {
    if (!value) return value;
    return mcbw.decrypt(value, key ?? this.keys.userKey);
  }

  encryptCipher(obj: Partial<CipherDto>, key?: any) {
    const { ...ret } = obj;
    if (ret.name) {
      ret.name = this.encrypt(ret.name, key);
    }
    if (ret.notes) {
      ret.notes = this.encrypt(ret.notes, key);
    }
    if (ret.fields?.length) {
      ret.fields = ret.fields.map((field: any) => {
        return {
          ...field,
          name: this.encrypt(field.name, key),
          value: this.encrypt(field.value, key),
        };
      });
    }
    if (ret.identity) {
      ret.identity = {
        address1: ret.identity.address1
          ? this.encrypt(ret.identity.address1, key)
          : ret.identity.address1,
        address2: ret.identity.address2
          ? this.encrypt(ret.identity.address2, key)
          : ret.identity.address2,
        address3: ret.identity.address3
          ? this.encrypt(ret.identity.address3, key)
          : ret.identity.address3,
        city: ret.identity.city
          ? this.encrypt(ret.identity.city, key)
          : ret.identity.city,
        company: ret.identity.company
          ? this.encrypt(ret.identity.company, key)
          : ret.identity.company,
        country: ret.identity.country
          ? this.encrypt(ret.identity.country, key)
          : ret.identity.country,
        email: ret.identity.email
          ? this.encrypt(ret.identity.email, key)
          : ret.identity.email,
        firstName: ret.identity.firstName
          ? this.encrypt(ret.identity.firstName, key)
          : ret.identity.firstName,
        lastName: ret.identity.lastName
          ? this.encrypt(ret.identity.lastName, key)
          : ret.identity.lastName,
        licenseNumber: ret.identity.licenseNumber
          ? this.encrypt(ret.identity.licenseNumber, key)
          : ret.identity.licenseNumber,
        middleName: ret.identity.middleName
          ? this.encrypt(ret.identity.middleName, key)
          : ret.identity.middleName,
        passportNumber: ret.identity.passportNumber
          ? this.encrypt(ret.identity.passportNumber, key)
          : ret.identity.passportNumber,
        phone: ret.identity.phone
          ? this.encrypt(ret.identity.phone, key)
          : ret.identity.phone,
        postalCode: ret.identity.postalCode
          ? this.encrypt(ret.identity.postalCode, key)
          : ret.identity.postalCode,
        ssn: ret.identity.ssn
          ? this.encrypt(ret.identity.ssn, key)
          : ret.identity.ssn,
        state: ret.identity.state
          ? this.encrypt(ret.identity.state, key)
          : ret.identity.state,
        title: ret.identity.title
          ? this.encrypt(ret.identity.title, key)
          : ret.identity.title,
        username: ret.identity.username
          ? this.encrypt(ret.identity.username, key)
          : ret.identity.username,
      };
    }
    if (ret.login) {
      ret.login = {
        ...ret.login,
        username: ret.login.username
          ? this.encrypt(ret.login.username, key)
          : ret.login.username,
        password: ret.login.password
          ? this.encrypt(ret.login.password, key)
          : ret.login.password,
        uri: ret.login.uri ? this.encrypt(ret.login.uri, key) : ret.login.uri,
        uris: ret.login.uris?.map((uri) => ({
          uri: uri.uri ? this.encrypt(uri.uri, key) : uri.uri,
        })),
      };
    }
    return ret;
  }
}
