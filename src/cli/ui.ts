import chalk from "chalk";
import promptsLib from "prompts";
import { primary } from "../theme/style.js";

const brand = chalk.hex(primary);

export const style = {
  brand,
  success: chalk.green,
  error: chalk.red,
  warn: chalk.yellow,
  dim: chalk.dim,
  bold: chalk.bold,
};

export function printSuccess(message: string): void {
  console.log(`${style.success("✔")} ${message}`);
}

export function printError(message: string): void {
  console.error(`${style.error("✖")} ${message}`);
}

export function printWarn(message: string): void {
  console.error(`${style.warn("!")} ${message}`);
}

export function printInfo(message: string): void {
  console.log(style.dim(message));
}

export function fail(message: string, exitCode = 1): never {
  printError(message);
  process.exit(exitCode);
}

export function renderTable(headers: string[], rows: string[][]): string {
  if (!rows.length) return style.dim("No results.");
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );
  const renderRow = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join("  ").trimEnd();
  const headerLine = brand.bold(renderRow(headers));
  const bodyLines = rows.map((r) => renderRow(r));
  return [headerLine, ...bodyLines].join("\n");
}

async function ask<T>(question: promptsLib.PromptObject): Promise<T> {
  const result = await promptsLib(question, { onCancel: () => false });
  if (result["value"] === undefined) {
    fail("Aborted.", 130);
  }
  return result["value"] as T;
}

export async function promptText(
  message: string,
  opts: { initial?: string } = {}
): Promise<string> {
  return ask<string>({
    type: "text",
    name: "value",
    message: brand(message),
    initial: opts.initial,
  });
}

export async function promptPassword(message: string): Promise<string> {
  return ask<string>({
    type: "password",
    name: "value",
    message: brand(message),
  });
}

export async function promptConfirm(
  message: string,
  initial = false
): Promise<boolean> {
  return ask<boolean>({
    type: "confirm",
    name: "value",
    message,
    initial,
  });
}

export async function promptSelect<T extends string>(
  message: string,
  choices: { title: string; description?: string; value: T }[]
): Promise<T> {
  return ask<T>({
    type: "select",
    name: "value",
    message: brand(message),
    choices,
  });
}
