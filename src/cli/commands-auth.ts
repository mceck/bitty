import { Command } from "commander";
import { interactiveLogin, logoutCommand } from "./auth.js";

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
    .description("Log in to your Bitwarden/Vaultwarden account")
    .option("--server-url <url>", "Vault server URL")
    .option("--email <email>", "Account email")
    .option("--totp <code>", "Two-factor authentication code")
    .option("--remember-me", "Persist the session to ~/.config/bitty/config.json", false)
    .option("--no-interactive", "Fail instead of prompting for input")
    .action(async (opts) => {
      await interactiveLogin({
        serverUrl: opts.serverUrl,
        email: opts.email,
        totp: opts.totp,
        rememberMe: !!opts.rememberMe,
        interactive: opts.interactive,
      });
    });

  program
    .command("logout")
    .description("Clear the saved session")
    .action(async () => {
      await logoutCommand();
    });
}
