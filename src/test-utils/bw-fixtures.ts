/**
 * Test-only fixture builders that construct valid Bitwarden-formatted encrypted
 * strings independently of src/clients/bw.ts, so tests can build realistic
 * server responses (sync payloads, login tokens) and assert the client decrypts
 * them correctly. Mirrors the documented cipher string format from bw.ts's
 * module docstring: "<type>.[<iv_base64>|]<ciphertext_base64>|<hmac_base64>".
 *
 * Not a *.test.ts file: vitest won't pick this up as a test suite on its own.
 */
import crypto from "node:crypto";
import * as argon2 from "argon2";

export interface RawKey {
  key: Buffer;
  mac: Buffer;
}

export function randomKey(): RawKey {
  return { key: crypto.randomBytes(32), mac: crypto.randomBytes(32) };
}

/** AES-256-CBC + HMAC-SHA256, formatted as Bitwarden cipher type "2". */
export function bwEncryptBytes(value: Buffer, key: RawKey): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key.key, iv);
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  const mac = crypto
    .createHmac("sha256", key.mac)
    .update(iv)
    .update(encrypted)
    .digest();
  return `2.${iv.toString("base64")}|${encrypted.toString("base64")}|${mac.toString("base64")}`;
}

export function bwEncrypt(value: string, key: RawKey): string {
  return bwEncryptBytes(Buffer.from(value, "utf-8"), key);
}

/** RSA-OAEP, formatted as Bitwarden cipher type "3" (sha256) or "4" (sha1). */
export function bwEncryptRsa(
  value: Buffer,
  publicKeyPem: string,
  hash: "sha1" | "sha256" = "sha256"
): string {
  const ciphertext = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: hash,
      oaepLabel: Buffer.alloc(0),
    },
    value
  );
  const type = hash === "sha256" ? "3" : "4";
  // decryptRsaOaep never reads the trailing hmac part; leave it empty.
  return `${type}.${ciphertext.toString("base64")}|`;
}

export interface RsaKeyPair {
  publicKeyPem: string;
  privateKeyDer: Buffer;
}

export function generateRsaKeyPair(): RsaKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "der" },
  });
  return { publicKeyPem: publicKey, privateKeyDer: privateKey as unknown as Buffer };
}

/** Mirrors Bw.derivePbkdf2: PBKDF2-HMAC-SHA256, 32-byte output. */
export function pbkdf2(
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  iterations: number
): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
}

/** Mirrors Bw.hkdfExpandSha256: HMAC-SHA256(ikm, info || 0x01). */
export function hkdfExpandSha256(ikm: Uint8Array, info: string): Buffer {
  const mac = crypto.createHmac("sha256", ikm);
  mac.update(info);
  mac.update(Buffer.from([0x01]));
  return mac.digest();
}

/** Mirrors Bw.deriveArgon2. */
export async function deriveArgon2(
  password: string,
  email: string,
  iterations: number,
  memory: number,
  parallelism: number
): Promise<Buffer> {
  const saltHash = crypto
    .createHash("sha256")
    .update(Buffer.from(email, "utf-8"))
    .digest();
  const hash = await argon2.hash(password, {
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

export interface LoginFixture {
  email: string;
  password: string;
  masterKey: Buffer;
  masterPasswordHash: string;
  encryptionKey: RawKey;
  userKey: RawKey;
  userKeyEncrypted: string;
  rsa: RsaKeyPair;
  privateKeyEncrypted: string;
}

/**
 * Builds a self-consistent set of login fixtures: a PBKDF2-derived master key
 * (matching what Client.login will derive from the same email/password/prelogin),
 * a random "real" user key wrapped with the encryption key, and an RSA keypair
 * wrapped with the user key — exactly what a Bitwarden server returns as
 * `Key`/`PrivateKey` on the token endpoint.
 */
export function buildPbkdf2LoginFixture(
  email: string,
  password: string,
  kdfIterations: number
): LoginFixture {
  const normalizedEmail = email.trim().toLowerCase();
  const masterKey = pbkdf2(password, normalizedEmail, kdfIterations);
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
  const rsa = generateRsaKeyPair();
  const privateKeyEncrypted = bwEncryptBytes(rsa.privateKeyDer, userKey);

  return {
    email,
    password,
    masterKey,
    masterPasswordHash,
    encryptionKey,
    userKey,
    userKeyEncrypted,
    rsa,
    privateKeyEncrypted,
  };
}

/** Wraps a plaintext organization/cipher key (32+32 bytes) with a wrapping key. */
export function wrapKey(inner: RawKey, wrappingKey: RawKey): string {
  return bwEncryptBytes(Buffer.concat([inner.key, inner.mac]), wrappingKey);
}

/** Wraps an org key with the user's RSA public key, as the server would. */
export function wrapKeyRsa(inner: RawKey, publicKeyPem: string): string {
  return bwEncryptRsa(Buffer.concat([inner.key, inner.mac]), publicKeyPem, "sha256");
}
