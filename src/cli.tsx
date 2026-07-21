#!/usr/bin/env node
import { render } from "ink";
import { Command } from "commander";
import App from "./app.js";
import { StatusMessageProvider } from "./hooks/status-message.js";
import { MouseProvider } from "./hooks/use-mouse.js";
import { KeybindingsProvider } from "./hooks/keybindings.js";
import { readPackageUpSync } from "read-package-up";
import { art } from "./theme/art.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { debugLogPath } from "./debug.js";
import { registerAuthCommands } from "./cli/commands-auth.js";
import { registerReadCommands } from "./cli/commands-read.js";
import { registerWriteCommands } from "./cli/commands-write.js";
import { fail } from "./cli/ui.js";

function launchTui() {
  render(
    <KeybindingsProvider>
      <StatusMessageProvider>
        <MouseProvider>
          <App />
        </MouseProvider>
      </StatusMessageProvider>
    </KeybindingsProvider>,
    {
      exitOnCtrlC: false,
      kittyKeyboard: {
        mode: "enabled",
        flags: ["disambiguateEscapeCodes"],
      },
    }
  );
}

// --debug is handled by src/debug.ts reading the raw process.argv directly,
// so it's stripped here to keep it usable alongside any CLI subcommand.
const cliArgs = process.argv.slice(2).filter((a) => a !== "--debug");

if (cliArgs.length === 0) {
  launchTui();
} else {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const version = readPackageUpSync({ cwd: __dirname })?.packageJson.version ?? "unknown";

  const program = new Command();
  program
    .name("bitty")
    .description(
      `${art}\nBitwarden compatible TUI/CLI for your terminal.\n\nRun \`bitty\` with no arguments to launch the interactive TUI.`
    )
    .version(version, "-v, --version", "Show version")
    .addHelpText(
      "after",
      `\nDebug:\n  --debug     Write API debug logs to ${debugLogPath}\n`
    );

  registerAuthCommands(program);
  registerReadCommands(program);
  registerWriteCommands(program);

  program
    .parseAsync([process.argv[0]!, process.argv[1]!, ...cliArgs])
    .catch((e) => fail(e instanceof Error ? e.message : String(e)));
}
