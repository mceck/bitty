import os from "os";
import fs from "fs";
import path from "path";
import { BwKeys, CipherType, Client, SyncResponse } from "../clients/bw.js";
import { useCallback, useEffect, useState } from "react";

interface BwConfig {
  baseUrl?: string;
  keys: BwKeys;
  refreshToken: string;
}

export const bwClient = new Client();
const configPath = path.join(os.homedir(), ".config", "bitty", "config.json");

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
      if (config.keys && config.refreshToken) {
        const keys: any = {};
        if (config.keys.masterKey)
          keys.masterKey = Uint8Array.from(config.keys.masterKey);
        if (config.keys.masterPasswordHash)
          keys.masterPasswordHash = config.keys.masterPasswordHash;
        if (config.keys.privateKey)
          keys.privateKey = {
            key: Uint8Array.from(config.keys.privateKey.key),
            mac: Uint8Array.from(config.keys.privateKey.mac),
          };
        if (config.keys.encryptionKey)
          keys.encryptionKey = {
            key: Uint8Array.from(config.keys.encryptionKey.key),
            mac: Uint8Array.from(config.keys.encryptionKey.mac),
          };
        if (config.keys.userKey)
          keys.userKey = {
            key: Uint8Array.from(config.keys.userKey.key),
            mac: Uint8Array.from(config.keys.userKey.mac),
          };
        bwClient.keys = keys;
        bwClient.refreshToken = config.refreshToken;
        await bwClient.checkToken();
        return true;
      }
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
  if (config.keys.masterKey) keys.masterKey = Array.from(config.keys.masterKey);
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
  const encConfig = Buffer.from(
    JSON.stringify({
      ...config,
      keys,
    })
  ).toString("base64");
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, encConfig);
}

export async function clearConfig() {
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

export const emptyCipher: any = {
  name: "",
  type: CipherType.Login,
  notes: null,
  login: {
    username: null,
    password: null,
    uris: [],
  },
  fields: [],
  organizationId: null,
};
