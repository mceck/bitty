import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const debugEnabled = process.argv.includes("--debug");

const logDir = path.join(os.homedir(), ".config", "bitty");
export const debugLogPath = path.join(logDir, "debug.log");

if (debugEnabled) {
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(
    debugLogPath,
    `--- debug session started ${new Date().toISOString()} ---\n`
  );
}

export function debugLog(message: string): void {
  if (!debugEnabled) return;
  fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] ${message}\n`);
}
