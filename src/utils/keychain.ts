import { AsyncEntry } from "@napi-rs/keyring";

const SERVICE_NAME = "bitty-tui";
const SESSION_ACCOUNT = "session";

const sessionEntry = () => new AsyncEntry(SERVICE_NAME, SESSION_ACCOUNT);

export async function loadSessionSecret(): Promise<string | null> {
  const value = await sessionEntry().getPassword();
  return value ?? null;
}

export async function saveSessionSecret(value: string): Promise<void> {
  await sessionEntry().setPassword(value);
}

export async function deleteSessionSecret(): Promise<void> {
  try {
    await sessionEntry().deleteCredential();
  } catch {}
}
