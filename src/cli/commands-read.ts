import { Command } from "commander";
import { bwClient } from "../hooks/bw.js";
import { CipherType } from "../clients/bw.js";
import { currentTotpFor } from "../utils/totp.js";
import { ensureSession } from "./auth.js";
import { fail, printSuccess, renderTable } from "./ui.js";
import { filterCiphers, forJson, orgNameIndex, resolveCipher, typeLabel } from "./vault.js";

const GET_FIELDS = ["password", "username", "totp", "uri", "notes"] as const;

export function registerReadCommands(program: Command): void {
  program
    .command("get <name>")
    .description("Print a single field from a vault item")
    .option("--field <field>", `One of: ${GET_FIELDS.join(", ")}`, "password")
    .option("--id <id>", "Disambiguate by item id")
    .option("--folder <folderId>", "Disambiguate by folder id")
    .option("--json", "Print the full decrypted item as JSON instead")
    .option("--no-interactive", "Fail instead of prompting for input")
    .action(async (name: string, opts) => {
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

      if (!GET_FIELDS.includes(opts.field)) {
        fail(`Unknown field "${opts.field}". Expected one of: ${GET_FIELDS.join(", ")}.`);
      }

      switch (opts.field) {
        case "notes":
          if (!cipher.notes) fail(`"${cipher.name}" has no notes.`);
          console.log(cipher.notes);
          break;
        case "password":
          if (cipher.type !== CipherType.Login || !cipher.login?.password) {
            fail(`"${cipher.name}" has no password field.`);
          }
          console.log(cipher.login.password);
          break;
        case "username":
          if (cipher.type !== CipherType.Login || !cipher.login?.username) {
            fail(`"${cipher.name}" has no username field.`);
          }
          console.log(cipher.login.username);
          break;
        case "uri":
          if (cipher.type !== CipherType.Login || !cipher.login?.uri) {
            fail(`"${cipher.name}" has no URI field.`);
          }
          console.log(cipher.login.uri);
          break;
        case "totp": {
          if (cipher.type !== CipherType.Login || !cipher.login?.totp) {
            fail(`"${cipher.name}" has no TOTP configured.`);
          }
          const code = await currentTotpFor(cipher.login.totp);
          if (!code) fail(`Could not generate a TOTP code for "${cipher.name}".`);
          console.log(code);
          break;
        }
      }
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
