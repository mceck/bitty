import os from "os";
import fs from "fs";
import path from "path";
import { Client, SyncResponse, CipherType } from "mcbw";
import { useCallback, useEffect, useState } from "react";

interface BwConfig {
  baseUrl?: string;
  username?: string;
  password?: string;
}

export const bwClient = new Client();
const configPath = path.join(os.homedir(), ".config", "bwtui", "config.json");

export async function loadConfig() {
  if (fs.existsSync(configPath)) {
    const content = await fs.promises.readFile(configPath, "utf-8");
    const config = JSON.parse(content);
    if (config.baseUrl) {
      await bwClient.setUrls({ baseUrl: config.baseUrl });
    }
    if (config.username && config.password) {
      await bwClient.login(config.username, config.password);
      return true;
    }
  }
  return false;
}
export async function saveConfig(config: BwConfig) {
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
}

export async function clearConfig() {
  if (fs.existsSync(configPath)) {
    await fs.promises.unlink(configPath);
  }
}

export const useBwSync = () => {
  const [sync, setSync] = useState<SyncResponse | null>(null);
  const fetchSync = useCallback(async (forceRefresh = true) => {
    const sync = await bwClient.getDecryptedSync({ forceRefresh });
    setSync(sync);
  }, []);
  useEffect(() => {
    fetchSync();
  }, [fetchSync]);
  return { sync, fetchSync };
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
