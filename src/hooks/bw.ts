import os from "os";
import fs from "fs";
import path from "path";
import { BwKeys, CipherType, Client, SyncResponse } from "../clients/bw.js";
import { useCallback, useEffect, useState } from "react";
import {
  deleteSessionSecret,
  loadSessionSecret,
  saveSessionSecret,
} from "../utils/keychain.js";

interface BwConfig {
  baseUrl?: string;
  keys: BwKeys;
  refreshToken: string;
}

export const bwClient = new Client();
const configDir = path.join(os.homedir(), ".config", "bitty");
const configPath = path.join(configDir, "config.json");

export interface LoginHints {
  email?: string;
  baseUrl?: string;
}

export async function loadLoginHints(): Promise<LoginHints> {
  try {
    if (fs.existsSync(configPath)) {
      const content = await fs.promises.readFile(configPath, "utf-8");
      const config = JSON.parse(
        Buffer.from(content, "base64").toString("utf-8")
      );
      return { email: config.email, baseUrl: config.baseUrl };
    }
  } catch {}
  return {};
}

export async function saveLoginHints(hints: LoginHints) {
  let config: any = {};
  try {
    if (fs.existsSync(configPath)) {
      const content = await fs.promises.readFile(configPath, "utf-8");
      config = JSON.parse(Buffer.from(content, "base64").toString("utf-8"));
    }
  } catch {}
  config.email = hints.email;
  config.baseUrl = hints.baseUrl;
  const encoded = Buffer.from(JSON.stringify(config)).toString("base64");
  await fs.promises.mkdir(configDir, { recursive: true });
  await fs.promises.writeFile(configPath, encoded);
}

export async function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const content = await fs.promises.readFile(configPath, "utf-8");
      const config = JSON.parse(
        Buffer.from(content, "base64").toString("utf-8")
      );
      if (config.baseUrl) {
        await bwClient.setUrls({ baseUrl: config.baseUrl });
      }
    }

    const secret = await loadSessionSecret();
    if (!secret) return false;
    const session = JSON.parse(secret);

    if (session.keys && session.refreshToken) {
      const keys: any = {};
      if (session.keys.masterPasswordHash)
        keys.masterPasswordHash = session.keys.masterPasswordHash;
      if (session.keys.privateKey)
        keys.privateKey = {
          key: Uint8Array.from(session.keys.privateKey.key),
          mac: Uint8Array.from(session.keys.privateKey.mac),
        };
      if (session.keys.encryptionKey)
        keys.encryptionKey = {
          key: Uint8Array.from(session.keys.encryptionKey.key),
          mac: Uint8Array.from(session.keys.encryptionKey.mac),
        };
      if (session.keys.userKey)
        keys.userKey = {
          key: Uint8Array.from(session.keys.userKey.key),
          mac: Uint8Array.from(session.keys.userKey.mac),
        };
      bwClient.keys = keys;
      bwClient.refreshToken = session.refreshToken;
      await bwClient.checkToken();
      return true;
    }
  } catch (e) {
    bwClient.keys = {};
    bwClient.refreshToken = null;
    bwClient.token = null;
  }
  return false;
}
export async function saveConfig(config: BwConfig) {
  const keys: any = {};
  if (config.keys.masterPasswordHash)
    keys.masterPasswordHash = config.keys.masterPasswordHash;
  if (config.keys.privateKey)
    keys.privateKey = {
      key: Array.from(config.keys.privateKey.key),
      mac: Array.from(config.keys.privateKey.mac),
    };
  if (config.keys.encryptionKey)
    keys.encryptionKey = {
      key: Array.from(config.keys.encryptionKey.key),
      mac: Array.from(config.keys.encryptionKey.mac),
    };
  if (config.keys.userKey)
    keys.userKey = {
      key: Array.from(config.keys.userKey.key),
      mac: Array.from(config.keys.userKey.mac),
    };

  await saveSessionSecret(
    JSON.stringify({ keys, refreshToken: config.refreshToken })
  );

  let hints: any = {};
  try {
    if (fs.existsSync(configPath)) {
      const content = await fs.promises.readFile(configPath, "utf-8");
      hints = JSON.parse(Buffer.from(content, "base64").toString("utf-8"));
    }
  } catch {}
  hints.baseUrl = config.baseUrl;
  const encoded = Buffer.from(JSON.stringify(hints)).toString("base64");
  await fs.promises.mkdir(configDir, { recursive: true });
  await fs.promises.writeFile(configPath, encoded);
}

export async function clearConfig() {
  await deleteSessionSecret();
  if (fs.existsSync(configPath)) {
    await fs.promises.unlink(configPath);
  }
}

export const useBwSync = () => {
  const [sync, setSync] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchSync = useCallback(async (forceRefresh = true) => {
    try {
      setError(null);
      const sync = await bwClient.getDecryptedSync({ forceRefresh });
      setSync(sync);
    } catch (e) {
      console.error("Error fetching sync data:", e);
      setError("Error fetching sync data");
    }
  }, []);
  useEffect(() => {
    fetchSync();
  }, [fetchSync]);
  return { sync, error, fetchSync };
};

const emptyLogin = {
  username: null,
  password: null,
  totp: null,
  uris: [],
};

const emptyCard = {
  cardholderName: null,
  brand: null,
  number: null,
  expMonth: null,
  expYear: null,
  code: null,
};

const emptyIdentity = {
  title: null,
  firstName: null,
  middleName: null,
  lastName: null,
  username: null,
  company: null,
  email: null,
  phone: null,
  address1: null,
  address2: null,
  address3: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  ssn: null,
  passportNumber: null,
  licenseNumber: null,
};

export function createEmptyCipher(type: CipherType = CipherType.Login): any {
  const base = {
    name: "",
    type,
    notes: null,
    fields: [],
    organizationId: null,
    collectionIds: [],
  };
  switch (type) {
    case CipherType.Login:
      return { ...base, login: { ...emptyLogin } };
    case CipherType.SecureNote:
      return { ...base, secureNote: { type: 0 } };
    case CipherType.Card:
      return { ...base, card: { ...emptyCard } };
    case CipherType.Identity:
      return { ...base, identity: { ...emptyIdentity } };
    default:
      return base;
  }
}

export const emptyCipher: any = createEmptyCipher();
