import { Command } from "commander";
import { bwClient } from "../hooks/bw.js";
import { CipherType } from "../clients/bw.js";
import { currentTotpFor } from "../utils/totp.js";
import { ensureSession } from "./auth.js";
import { fail, printSuccess, renderTable } from "./ui.js";
import {
  DEFAULT_FIELD_BY_TYPE,
  FIELD_EXTRACTORS,
  filterCiphers,
  forJson,
  orgNameIndex,
  resolveCipher,
  typeLabel,
} from "./vault.js";

export function registerReadCommands(program: Command): void {
  program
    .command("get [name]")
    .description("Print a single field from a vault item")
    .option(
      "--field <field>",
      "Item field to print (defaults to the item's most relevant field, e.g. password for logins, number for cards)"
    )
    .option("--id <id>", "Look up by item id (makes <name> optional)")
    .option("--folder <folderId>", "Disambiguate by folder id")
    .option("--json", "Print the full decrypted item as JSON instead")
    .option("--no-interactive", "Fail instead of prompting for input")
    .action(async (name: string | undefined, opts) => {
      if (!name && !opts.id) {
        fail("Provide an item name, or --id <id>.");
      }

      await ensureSession({ interactive: opts.interactive });
      const cipher = await resolveCipher(name, {
        id: opts.id,
        folder: opts.folder,
        interactive: opts.interactive,
      });

      if (opts.json) {
        console.log(JSON.stringify(forJson(cipher), null, 2));
        return;
      }

      const field = opts.field ?? DEFAULT_FIELD_BY_TYPE[cipher.type] ?? "notes";

      if (field === "totp") {
        if (cipher.type !== CipherType.Login || !cipher.login?.totp) {
          fail(`"${cipher.name}" has no TOTP configured.`);
        }
        const code = await currentTotpFor(cipher.login.totp);
        if (!code) fail(`Could not generate a TOTP code for "${cipher.name}".`);
        console.log(code);
        return;
      }

      const extractor = FIELD_EXTRACTORS[field];
      if (!extractor) {
        fail(
          `Unknown field "${field}". Expected one of: totp, ${Object.keys(FIELD_EXTRACTORS).join(", ")}.`
        );
      }
      const value = extractor(cipher);
      if (!value) fail(`"${cipher.name}" has no ${field} field.`);
      console.log(value);
    });

  program
    .command("ls")
    .description("List vault items")
    .option("--search <query>", "Filter by name, id, notes, uri or username")
    .option("--type <type>", "Filter by item type (login, note, card, identity, sshkey)")
    .option("--org <org>", "Filter by organization id or name")
    .option("--folder <folderId>", "Filter by folder id")
    .option("--json", "Print the full decrypted list as JSON instead of a table")
    .option("--no-interactive", "Fail instead of prompting for input")
    .action(async (opts) => {
      await ensureSession({ interactive: opts.interactive });
      const sync = await bwClient.getDecryptedSync();
      const items = filterCiphers(sync, opts);

      if (opts.json) {
        console.log(JSON.stringify(items.map(forJson), null, 2));
        return;
      }

      const orgIndex = orgNameIndex(sync);
      console.log(
        renderTable(
          ["ID", "NAME", "TYPE", "ORG"],
          items.map((c) => [
            c.id,
            c.name,
            typeLabel(c.type),
            c.organizationId ? orgIndex.get(c.organizationId) ?? c.organizationId : "-",
          ])
        )
      );
    });

  program
    .command("sync")
    .description("Refresh the local vault cache from the server")
    .option("--no-interactive", "Fail instead of prompting for input")
    .action(async (opts) => {
      await ensureSession({ interactive: opts.interactive });
      await bwClient.getDecryptedSync({ forceRefresh: true });
      printSuccess("Vault synced.");
    });

  program
    .command("collections")
    .description("List available collections")
    .option("--org <org>", "Filter by organization id or name")
    .option("--json", "Print as JSON instead of a table")
    .option("--no-interactive", "Fail instead of prompting for input")
    .action(async (opts) => {
      await ensureSession({ interactive: opts.interactive });
      const sync = await bwClient.getDecryptedSync();
      const orgIndex = orgNameIndex(sync);
      let collections = sync.collections ?? [];
      if (opts.org) {
        collections = collections.filter(
          (c) => c.organizationId === opts.org || orgIndex.get(c.organizationId) === opts.org
        );
      }

      if (opts.json) {
        console.log(JSON.stringify(collections, null, 2));
        return;
      }

      console.log(
        renderTable(
          ["ID", "NAME", "ORG"],
          collections.map((c) => [
            c.id,
            c.name,
            orgIndex.get(c.organizationId) ?? c.organizationId,
          ])
        )
      );
    });
}
