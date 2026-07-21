import { describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const interactiveLogin = vi.fn().mockResolvedValue(undefined);
const logoutCommand = vi.fn().mockResolvedValue(undefined);

vi.mock("./auth.js", () => ({
  interactiveLogin: (...args: unknown[]) => interactiveLogin(...args),
  logoutCommand: (...args: unknown[]) => logoutCommand(...args),
}));

const { registerAuthCommands } = await import("./commands-auth.js");

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerAuthCommands(program);
  return program;
}

async function run(program: Command, args: string[]) {
  await program.parseAsync(args, { from: "user" });
}

describe("login command", () => {
  it("forwards flags to interactiveLogin with defaults applied", async () => {
    await run(buildProgram(), ["login"]);

    expect(interactiveLogin).toHaveBeenCalledWith({
      serverUrl: undefined,
      email: undefined,
      totp: undefined,
      rememberMe: false,
      interactive: true,
    });
  });

  it("forwards --server-url/--email/--totp and coerces --remember-me to a boolean", async () => {
    await run(buildProgram(), [
      "login",
      "--server-url",
      "https://vault.example.com",
      "--email",
      "user@example.com",
      "--totp",
      "123456",
      "--remember-me",
    ]);

    expect(interactiveLogin).toHaveBeenCalledWith({
      serverUrl: "https://vault.example.com",
      email: "user@example.com",
      totp: "123456",
      rememberMe: true,
      interactive: true,
    });
  });

  it("--no-interactive turns off interactive mode", async () => {
    await run(buildProgram(), ["login", "--no-interactive"]);

    expect(interactiveLogin).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: false })
    );
  });
});

describe("logout command", () => {
  it("calls logoutCommand", async () => {
    await run(buildProgram(), ["logout"]);
    expect(logoutCommand).toHaveBeenCalledTimes(1);
  });
});
