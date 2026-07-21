import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOTP_PERIOD,
  computeTotp,
  currentTotpFor,
  parseTotpConfig,
  totpPeriod,
} from "./totp.js";

describe("parseTotpConfig", () => {
  it("treats a plain (non-otpauth) value as the raw secret", () => {
    expect(parseTotpConfig("JBSWY3DPEHPK3PXP")).toEqual({ secret: "JBSWY3DPEHPK3PXP" });
  });

  it("extracts secret/period/digits/algorithm from an otpauth:// URI", () => {
    const uri =
      "otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&period=60&digits=8&algorithm=SHA256";
    expect(parseTotpConfig(uri)).toEqual({
      secret: "JBSWY3DPEHPK3PXP",
      period: 60,
      digits: 8,
      algorithm: "sha256",
    });
  });

  it("lowercases the algorithm regardless of case in the query string", () => {
    const uri = "otpauth://totp/Example?secret=ABC&algorithm=SHA1";
    expect(parseTotpConfig(uri).algorithm).toBe("sha1");
  });

  it.each([6, 7, 8] as const)("accepts digits=%d", (digits) => {
    const uri = `otpauth://totp/Example?secret=ABC&digits=${digits}`;
    expect(parseTotpConfig(uri).digits).toBe(digits);
  });

  it.each([5, 9, 0])("drops out-of-range digits=%d (undefined)", (digits) => {
    const uri = `otpauth://totp/Example?secret=ABC&digits=${digits}`;
    expect(parseTotpConfig(uri).digits).toBeUndefined();
  });

  it("drops a non-numeric digits value", () => {
    const uri = "otpauth://totp/Example?secret=ABC&digits=abc";
    expect(parseTotpConfig(uri).digits).toBeUndefined();
  });

  it("drops an unknown algorithm", () => {
    const uri = "otpauth://totp/Example?secret=ABC&algorithm=md5";
    expect(parseTotpConfig(uri).algorithm).toBeUndefined();
  });

  it.each([0, -30, -1])("drops a non-positive period=%d", (period) => {
    const uri = `otpauth://totp/Example?secret=ABC&period=${period}`;
    expect(parseTotpConfig(uri).period).toBeUndefined();
  });

  it("drops a non-numeric period value", () => {
    const uri = "otpauth://totp/Example?secret=ABC&period=abc";
    expect(parseTotpConfig(uri).period).toBeUndefined();
  });

  it("defaults the secret to an empty string when the query param is missing", () => {
    const uri = "otpauth://totp/Example";
    expect(parseTotpConfig(uri)).toEqual({ secret: "" });
  });

  it("falls back to treating the whole value as the secret when the URI is malformed", () => {
    const malformed = "otpauth://[::1";
    expect(parseTotpConfig(malformed)).toEqual({ secret: malformed });
  });
});

describe("totpPeriod", () => {
  it("returns the configured period when set", () => {
    expect(totpPeriod({ secret: "x", period: 60 })).toBe(60);
  });

  it("returns the default period when not set", () => {
    expect(totpPeriod({ secret: "x" })).toBe(DEFAULT_TOTP_PERIOD);
    expect(DEFAULT_TOTP_PERIOD).toBe(30);
  });
});

describe("computeTotp", () => {
  it("returns null when the secret is empty", async () => {
    expect(await computeTotp({ secret: "" })).toBeNull();
  });

  it("returns null when secret is missing entirely", async () => {
    expect(await computeTotp({} as any)).toBeNull();
  });

  it("produces a 6-digit numeric code for a valid base32 secret by default", async () => {
    const code = await computeTotp({ secret: "JBSWY3DPEHPK3PXP" });
    expect(code).toMatch(/^\d{6}$/);
  });

  it("normalizes whitespace and case in the base32 secret", async () => {
    const a = await computeTotp({ secret: "JBSWY3DPEHPK3PXP" });
    const b = await computeTotp({ secret: "jbsw y3dp ehpk 3pxp" });
    expect(b).toBe(a);
  });

  it("honors a custom digit count", async () => {
    const code = await computeTotp({ secret: "JBSWY3DPEHPK3PXP", digits: 8 });
    expect(code).toMatch(/^\d{8}$/);
  });

  it("accepts a custom period without throwing", async () => {
    const code = await computeTotp({ secret: "JBSWY3DPEHPK3PXP", period: 60 });
    expect(code).toMatch(/^\d{6}$/);
  });

  it.each(["sha1", "sha256", "sha512"] as const)(
    "accepts a custom algorithm (%s) without throwing",
    async (algorithm) => {
      const code = await computeTotp({ secret: "JBSWY3DPEHPK3PXP", algorithm });
      expect(code).toMatch(/^\d{6}$/);
    }
  );

  it("falls back to stringToBytes for a non-base32 secret instead of throwing", async () => {
    const code = await computeTotp({ secret: "not base32 at all!!" });
    expect(code).toMatch(/^\d{6}$/);
  });
});

describe("currentTotpFor", () => {
  it("computes a code directly from a plain secret", async () => {
    const code = await currentTotpFor("JBSWY3DPEHPK3PXP");
    expect(code).toMatch(/^\d{6}$/);
  });

  it("computes a code from a full otpauth:// URI, honoring its digit count", async () => {
    const uri = "otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP&digits=8";
    const code = await currentTotpFor(uri);
    expect(code).toMatch(/^\d{8}$/);
  });

  it("produces the same code for an equivalent plain secret and otpauth:// URI", async () => {
    const plain = await currentTotpFor("JBSWY3DPEHPK3PXP");
    const viaUri = await currentTotpFor("otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP");
    expect(viaUri).toBe(plain);
  });

  it("returns null for an otpauth:// URI with no secret", async () => {
    expect(await currentTotpFor("otpauth://totp/Example?period=30")).toBeNull();
  });
});
