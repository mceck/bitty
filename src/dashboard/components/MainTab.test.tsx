import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { CipherType, type Cipher } from "../../clients/bw.js";
import { MainTab } from "./MainTab.js";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const flush = (ms = 100) => new Promise((r) => setTimeout(r, ms));

function makeCipher(overrides: Partial<Cipher>): Cipher {
  return {
    id: "1",
    type: CipherType.Login,
    folderId: null,
    organizationId: null,
    collectionIds: null,
    deletedDate: null,
    name: "My login",
    notes: "some notes",
    favorite: false,
    ...overrides,
  } as Cipher;
}

describe("MainTab (smoke)", () => {
  it("renders name/username/url for a login cipher, masking the password", () => {
    const cipher = makeCipher({
      type: CipherType.Login,
      login: { username: "octocat", password: "s3cr3t", uris: [{ uri: "https://github.com" }] },
    });
    const { lastFrame, unmount } = render(
      <MainTab isFocused={false} selectedCipher={cipher} mode="view" onChange={() => {}} />
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("My login");
    expect(frame).toContain("octocat");
    expect(frame).toContain("https://github.com");
    expect(frame).toContain("some notes");
    expect(frame).not.toContain("s3cr3t");
    unmount();
  });

  it("renders card fields, masking the card number and CVV", () => {
    const cipher = makeCipher({
      type: CipherType.Card,
      card: {
        cardholderName: "Jane Doe",
        brand: "Visa",
        number: "4111111111111111",
        expMonth: "01",
        expYear: "2030",
        code: "123",
      },
    });
    const { lastFrame, unmount } = render(
      <MainTab isFocused={false} selectedCipher={cipher} mode="view" onChange={() => {}} />
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("Jane Doe");
    expect(frame).toContain("Visa");
    expect(frame).not.toContain("4111111111111111");
    expect(frame).not.toContain("123");
    unmount();
  });

  it("shows a live OTP field when the login has a TOTP secret configured", async () => {
    const cipher = makeCipher({
      type: CipherType.Login,
      login: { username: "u", password: "p", totp: "JBSWY3DPEHPK3PXP" },
    });
    const { lastFrame, unmount } = render(
      <MainTab isFocused={false} selectedCipher={cipher} mode="view" onChange={() => {}} />
    );
    await flush();
    const frame = strip(lastFrame() ?? "");
    expect(frame).toMatch(/OTP \(\d{2}s\)/);
    expect(frame).toMatch(/\d{6}/);
    unmount();
  });

  it("shows a type switcher in 'new' mode", () => {
    const cipher = makeCipher({ type: CipherType.Login, login: {} });
    const { lastFrame, unmount } = render(
      <MainTab isFocused={false} selectedCipher={cipher} mode="new" onChange={() => {}} />
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("Login");
    expect(frame).toContain("Card");
    expect(frame).toContain("Identity");
    unmount();
  });
});
