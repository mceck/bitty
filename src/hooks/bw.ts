import os from "os";
import fs from "fs";
import path from "path";
import { Client, SyncResponse, BwKeys } from "mcbw";
import { useCallback, useEffect, useState } from "react";

interface BwConfig {
  baseUrl?: string;
  accessToken: string;
  keys: BwKeys;
}

export const bwClient = new Client();
const configPath = path.join(os.homedir(), ".config", "bwtui", "config.json");

async function loadConfig() {
  if (fs.existsSync(configPath)) {
    const content = await fs.promises.readFile(configPath, "utf-8");
    const config = JSON.parse(content);
    if (config.baseUrl) {
      await bwClient.setUrls({ baseUrl: config.baseUrl });
    }
    if (config.accessToken && config.keys) {
      bwClient.token = config.accessToken;
      bwClient.keys = config.keys;
    }
  }
}
async function saveConfig(config: BwConfig) {
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
}

export const useBwSync = () => {
  const [sync, setSync] = useState<SyncResponse | null>(null);
  const fetchSync = useCallback(async () => {
    const sync = await bwClient.getDecryptedSync();
    setSync(sync);
  }, []);
  useEffect(() => {
    fetchSync();
  }, [fetchSync]);
  return { sync, fetchSync };
};
