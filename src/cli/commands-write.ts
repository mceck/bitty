import { Command } from "commander";
import { bwClient, createEmptyCipher } from "../hooks/bw.js";
import { Cipher, CipherType } from "../clients/bw.js";
import { ensureSession } from "./auth.js";
import { readJsonInput } from "./json-input.js";
import { fail, printInfo, printSuccess, promptConfirm } from "./ui.js";
import { requireCreatableType, typeLabel } from "./vault.js";

function applyLoginFlags(cipher: Cipher, opts: {
  username?: string;
  password?: string;
  uri?: string;
  totp?: string;
}): void {
  if (!opts.username && !opts.password && !opts.uri && !opts.totp) return;
  cipher.login = { ...cipher.login };
  if (opts.username) cipher.login.username = opts.username;
  if (opts.password) cipher.login.password = opts.password;
  if (opts.uri) cipher.login.uri = opts.uri;
  if (opts.totp) cipher.login.totp = opts.totp;
}

export function registerWriteCommands(program: Command): void {
  program
    .command("template <type>")
    .description("Print an empty JSON skeleton for an item type (login, note, card, identity)")
    .action((type: string) => {
      const cipherType = requireCreatableType(type);
      console.log(JSON.stringify(createEmptyCipher(cipherType), null, 2));
    });

  program
    .command("create <type>")
    .description("Create a vault item (login, note, card, identity)")
    .option("--name <name>", "Item name")
    .option("--username <username>", "Login username")
    .option("--password <password>", "Login password")
    .option("--uri <uri>", "Login URI")
    .option("--totp <secret>", "Login TOTP secret or otpauth:// URI")
    .option("--notes <notes>", "Notes")
    .option("--org <orgId>", "Organization id to share the item with")
    .option("--collection <collectionId>", "Collection id (repeatable)", (v, prev: string[]) => [...prev, v], [] as string[])
    .option("--json <file>", 'Base the item on a JSON file (or "-" for stdin)')
    .option("--no-interactive", "Fail instead of prompting for input")
    .action(async (type: string, opts) => {
      await ensureSession({ interactive: opts.interactive });
      const cipherType = requireCreatableType(type);
      const cipher: Cipher = opts.json
        ? await readJsonInput(opts.json)
        : createEmptyCipher(cipherType);
      cipher.type = cipherType;

      if (opts.name) cipher.name = opts.name;
      if (cipherType === CipherType.Login) applyLoginFlags(cipher, opts);
      if (opts.notes) cipher.notes = opts.notes;
      if (opts.org) cipher.organizationId = opts.org;
      if (opts.collection?.length) cipher.collectionIds = opts.collection;

      if (!cipher.name) fail("Missing item name (use --name, or set it in --json).");
      if (cipher.organizationId && !cipher.collectionIds?.length) {
        fail("Sharing to an organization requires at least one --collection.");
      }

      const created = await bwClient.createSecret(cipher);
      printSuccess(`Created "${cipher.name}" (${typeLabel(cipherType)}) — ${created.id ?? "?"}`);
    });

  program
    .command("edit <id>")
    .description("Edit a vault item")
    .option("--name <name>", "Item name")
    .option("--username <username>", "Login username")
    .option("--password <password>", "Login password")
    .option("--uri <uri>", "Login URI")
    .option("--totp <secret>", "Login TOTP secret or otpauth:// URI")
    .option("--notes <notes>", "Notes")
    .option("--json <file>", 'Patch the item from a JSON file (or "-" for stdin)')
    .option("--no-interactive", "Fail instead of prompting for input")
    .action(async (id: string, opts) => {
      await ensureSession({ interactive: opts.interactive });
      const sync = await bwClient.getDecryptedSync();
      const current = sync.ciphers.find((c) => c.id === id);
      if (!current) fail(`No item found with id "${id}".`, 2);

      const patch: Partial<Cipher> = opts.json ? await readJsonInput(opts.json) : {};
      if (opts.name) patch.name = opts.name;
      if (opts.notes) patch.notes = opts.notes;
      if (current.type === CipherType.Login) {
        applyLoginFlags(patch as Cipher, opts);
      }

      if (!Object.keys(patch).length) {
        fail("Nothing to update: pass --json or at least one field flag.");
      }

      const updated = await bwClient.updateSecret(id, patch);
      if (!updated) {
        printInfo("Nothing changed.");
        return;
      }
      printSuccess(`Updated "${current.name}".`);
    });

  program
    .command("delete <id>")
    .description("Delete a vault item")
    .option("--yes", "Skip the confirmation prompt")
    .option("--no-interactive", "Fail instead of prompting for input")
    .action(async (id: string, opts) => {
      await ensureSession({ interactive: opts.interactive });
      const sync = await bwClient.getDecryptedSync();
      const cipher = sync.ciphers.find((c) => c.id === id);
      if (!cipher) fail(`No item found with id "${id}".`, 2);

      if (!opts.yes) {
        if (!opts.interactive) {
          fail("Refusing to delete without --yes in non-interactive mode.");
        }
        const confirmed = await promptConfirm(
          `Delete "${cipher.name}" (${typeLabel(cipher.type)})?`,
          false
        );
        if (!confirmed) fail("Aborted.", 130);
      }

      await bwClient.deleteSecret(id);
      printSuccess(`Deleted "${cipher.name}".`);
    });

  program
    .command("share <id>")
    .description("Move a personal item into an organization, or update its collections")
    .requiredOption("--org <orgId>", "Organization id")
    .option("--collection <collectionId>", "Collection id (repeatable)", (v, prev: string[]) => [...prev, v], [] as string[])
    .option("--no-interactive", "Fail instead of prompting for input")
    .action(async (id: string, opts) => {
      await ensureSession({ interactive: opts.interactive });
      if (!opts.collection?.length) fail("At least one --collection is required.");

      const sync = await bwClient.getDecryptedSync();
      const cipher = sync.ciphers.find((c) => c.id === id);
      if (!cipher) fail(`No item found with id "${id}".`, 2);

      if (!cipher.organizationId) {
        await bwClient.shareCipher(id, { ...cipher, organizationId: opts.org }, opts.collection);
      } else {
        await bwClient.updateCollections(id, opts.collection);
      }
      printSuccess(`Shared "${cipher.name}".`);
    });
}
