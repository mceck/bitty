#!/usr/bin/env node
import { render } from "ink";
import App from "./app.js";
import { StatusMessageProvider } from "./hooks/status-message.js";
import { readPackageUpSync } from "read-package-up";
import { art } from "./theme/art.js";

const args = process.argv.slice(2);

if (args.includes("--version") || args.includes("-v")) {
  const pkg = readPackageUpSync();
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
`);
  process.exit(0);
}

render(
  <StatusMessageProvider>
    <App />
  </StatusMessageProvider>
);
