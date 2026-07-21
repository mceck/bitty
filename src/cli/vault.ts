import { bwClient } from "../hooks/bw.js";
import { Cipher, CipherType, SyncResponse } from "../clients/bw.js";
import { fail, printError, printInfo, promptSelect, style } from "./ui.js";

export const TYPE_LABELS: Record<CipherType, string> = {
  [CipherType.Login]: "login",
  [CipherType.SecureNote]: "note",
  [CipherType.Card]: "card",
  [CipherType.Identity]: "identity",
  [CipherType.SSHKey]: "sshkey",
};

const LABEL_TYPES: Record<string, CipherType> = Object.fromEntries(
  Object.entries(TYPE_LABELS).map(([type, label]) => [label, Number(type) as CipherType])
);

// Matches what the TUI's "new item" type switcher offers (SSH keys are view-only there).
export const CREATABLE_TYPE_LABELS = ["login", "note", "card", "identity"];

export function typeLabel(type: CipherType): string {
  return TYPE_LABELS[type] ?? "unknown";
}

export function typeFromLabel(label: string): CipherType | undefined {
  return LABEL_TYPES[label.toLowerCase()];
}

export function requireCreatableType(label: string): CipherType {
  const type = typeFromLabel(label);
  if (type === undefined || !CREATABLE_TYPE_LABELS.includes(label.toLowerCase())) {
    fail(
      `Unknown or unsupported type "${label}". Expected one of: ${CREATABLE_TYPE_LABELS.join(", ")}.`
    );
  }
  return type;
}

export interface ResolveCipherOptions {
  id?: string;
  folder?: string;
  interactive: boolean;
}

export async function resolveCipher(
  name: string | undefined,
  opts: ResolveCipherOptions
): Promise<Cipher> {
  if (!name && !opts.id) {
    fail("Provide an item name, or --id <id>.");
  }

  const description = [
    name && `name "${name}"`,
    opts.id && `id "${opts.id}"`,
    opts.folder && `folder "${opts.folder}"`,
  ]
    .filter(Boolean)
    .join(", ");

  const sync = await bwClient.getDecryptedSync();
  let matches = sync.ciphers.filter((c) => !c.deletedDate);
  if (name) matches = matches.filter((c) => c.name?.toLowerCase() === name.toLowerCase());
  if (opts.id) matches = matches.filter((c) => c.id === opts.id);
  if (opts.folder) matches = matches.filter((c) => c.folderId === opts.folder);

  if (!matches.length) {
    fail(`No item found matching ${description}.`, 2);
  }
  if (matches.length === 1) {
    return matches[0]!;
  }

  if (!opts.interactive) {
    printError(`${matches.length} items match ${description}:`);
    for (const m of matches) {
      const folderHint = m.folderId ? style.dim(` (folder ${m.folderId})`) : "";
      console.error(`  ${style.dim(m.id)}  ${m.name}${folderHint}`);
    }
    printInfo("Use --id <id> or --folder <id> to disambiguate.");
    process.exit(1);
  }

  const pickedId = await promptSelect(
    `Multiple items match ${description}, pick one`,
    matches.map((m) => ({
      title: `${m.name}  ${style.dim(m.id)}`,
      value: m.id,
    }))
  );
  return matches.find((m) => m.id === pickedId)!;
}

// Fields printable via `get --field`, keyed by name. `totp` is handled separately
// since generating the current code is async and only applies to Login items.
export const FIELD_EXTRACTORS: Record<string, (cipher: Cipher) => string | null | undefined> = {
  notes: (c) => c.notes,
  // login
  password: (c) => c.login?.password,
  uri: (c) => c.login?.uri,
  // shared between login and identity
  username: (c) => c.login?.username ?? c.identity?.username,
  // card
  cardholderName: (c) => c.card?.cardholderName,
  brand: (c) => c.card?.brand,
  number: (c) => c.card?.number,
  expMonth: (c) => c.card?.expMonth,
  expYear: (c) => c.card?.expYear,
  code: (c) => c.card?.code,
  // identity
  title: (c) => c.identity?.title,
  firstName: (c) => c.identity?.firstName,
  middleName: (c) => c.identity?.middleName,
  lastName: (c) => c.identity?.lastName,
  company: (c) => c.identity?.company,
  email: (c) => c.identity?.email,
  phone: (c) => c.identity?.phone,
  address1: (c) => c.identity?.address1,
  address2: (c) => c.identity?.address2,
  address3: (c) => c.identity?.address3,
  city: (c) => c.identity?.city,
  state: (c) => c.identity?.state,
  postalCode: (c) => c.identity?.postalCode,
  country: (c) => c.identity?.country,
  ssn: (c) => c.identity?.ssn,
  passportNumber: (c) => c.identity?.passportNumber,
  licenseNumber: (c) => c.identity?.licenseNumber,
  // ssh key
  privateKey: (c) => c.sshKey?.privateKey,
  publicKey: (c) => c.sshKey?.publicKey,
  keyFingerprint: (c) => c.sshKey?.keyFingerprint,
};

export const DEFAULT_FIELD_BY_TYPE: Record<CipherType, string> = {
  [CipherType.Login]: "password",
  [CipherType.SecureNote]: "notes",
  [CipherType.Card]: "number",
  [CipherType.Identity]: "email",
  [CipherType.SSHKey]: "privateKey",
};

export interface ListFilters {
  search?: string;
  type?: string;
  org?: string;
  folder?: string;
}

export function orgNameIndex(sync: SyncResponse): Map<string, string> {
  return new Map((sync.profile?.organizations ?? []).map((o) => [o.id, o.name]));
}

// The Bitwarden API includes a legacy `data` blob duplicating a cipher's other
// fields in ciphertext; strip it before printing so --json only shows decrypted data.
export function forJson(cipher: Cipher): Cipher {
  const { data, ...rest } = cipher as Cipher & { data?: unknown };
  return rest as Cipher;
}

export function filterCiphers(sync: SyncResponse, opts: ListFilters): Cipher[] {
  const orgIndex = orgNameIndex(sync);
  let list = sync.ciphers.filter((c) => !c.deletedDate);

  if (opts.type) {
    const type = typeFromLabel(opts.type);
    if (type === undefined) {
      fail(
        `Unknown type "${opts.type}". Expected one of: ${Object.values(TYPE_LABELS).join(", ")}.`
      );
    }
    list = list.filter((c) => c.type === type);
  }
  if (opts.search) {
    const q = opts.search.toLowerCase();
    list = list.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q) ||
        c.login?.uri?.toLowerCase().includes(q) ||
        c.login?.username?.toLowerCase().includes(q)
    );
  }
  if (opts.org) {
    list = list.filter(
      (c) =>
        c.organizationId === opts.org ||
        (!!c.organizationId && orgIndex.get(c.organizationId) === opts.org)
    );
  }
  if (opts.folder) {
    list = list.filter((c) => c.folderId === opts.folder);
  }

  return list.sort((a, b) => a.name.localeCompare(b.name));
}
