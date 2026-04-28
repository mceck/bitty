#!/usr/bin/env node
import { render } from "ink";
import App from "./app.js";
import { StatusMessageProvider } from "./hooks/status-message.js";
import { MouseProvider } from "./hooks/use-mouse.js";
import { KeybindingsProvider } from "./hooks/keybindings.js";
import { readPackageUpSync } from "read-package-up";
import { art } from "./theme/art.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { debugEnabled, debugLogPath } from "./debug.js";

const args = process.argv.slice(2);

if (args.includes("--version") || args.includes("-v")) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pkg = readPackageUpSync({ cwd: __dirname });
  console.log(pkg?.packageJson.version ?? "unknown");
  process.exit(0);
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`${art}
  Usage
    $ bitty

  Options
    --help     Show help
    --version  Show version
    --debug    Write API debug logs to ${debugLogPath}
`);
  process.exit(0);
}

render(
  <KeybindingsProvider>
    <StatusMessageProvider>
      <MouseProvider>
        <App />
      </MouseProvider>
    </StatusMessageProvider>
  </KeybindingsProvider>
);
