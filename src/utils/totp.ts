import { createGuardrails, generate, stringToBytes } from "otplib";

const OTP_GUARDRAILS = createGuardrails({
  MIN_SECRET_BYTES: 1,
  MAX_SECRET_BYTES: 1024,
});

export const DEFAULT_TOTP_PERIOD = 30;

export type TotpConfig = {
  secret: string;
  period?: number;
  digits?: 6 | 7 | 8;
  algorithm?: "sha1" | "sha256" | "sha512";
};

export function parseTotpConfig(value: string): TotpConfig {
  if (!value.startsWith("otpauth://")) {
    return { secret: value };
  }

  try {
    const url = new URL(value);
    const secret = url.searchParams.get("secret") ?? "";
    const periodRaw = Number.parseInt(url.searchParams.get("period") ?? "", 10);
    const digitsRaw = Number.parseInt(url.searchParams.get("digits") ?? "", 10);
    const algorithmRaw = (url.searchParams.get("algorithm") ?? "").toLowerCase();

    const period = Number.isFinite(periodRaw) && periodRaw > 0 ? periodRaw : undefined;
    const digits =
      digitsRaw === 6 || digitsRaw === 7 || digitsRaw === 8
        ? digitsRaw
        : undefined;
    const algorithm =
      algorithmRaw === "sha1" ||
      algorithmRaw === "sha256" ||
      algorithmRaw === "sha512"
        ? algorithmRaw
        : undefined;

    return { secret, period, digits, algorithm };
  } catch {
    return { secret: value };
  }
}

function normalizeBase32Secret(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function totpPeriod(config: TotpConfig): number {
  return config.period ?? DEFAULT_TOTP_PERIOD;
}

export async function computeTotp(config: TotpConfig): Promise<string | null> {
  if (!config.secret) return null;
  const normalizedSecret = normalizeBase32Secret(config.secret);
  const options = {
    guardrails: OTP_GUARDRAILS,
    ...(config.period ? { period: config.period } : {}),
    ...(config.digits ? { digits: config.digits } : {}),
    ...(config.algorithm ? { algorithm: config.algorithm } : {}),
  };

  try {
    return await generate({ ...options, secret: normalizedSecret });
  } catch {
    try {
      return await generate({ ...options, secret: stringToBytes(config.secret) });
    } catch {
      return null;
    }
  }
}

export async function currentTotpFor(secretOrUri: string): Promise<string | null> {
  return computeTotp(parseTotpConfig(secretOrUri));
}
