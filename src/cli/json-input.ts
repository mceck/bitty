import fs from "node:fs/promises";
import { fail } from "./ui.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

export async function readJsonInput(source: string): Promise<any> {
  const raw = source === "-" ? await readStdin() : await fs.readFile(source, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`Invalid JSON in ${source === "-" ? "stdin" : source}: ${(e as Error).message}`);
  }
}
