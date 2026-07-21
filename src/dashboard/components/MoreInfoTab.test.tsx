import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { CipherType, type Cipher } from "../../clients/bw.js";

// See VaultList.test.tsx: ink-testing-library's fake stdout has no `rows`,
// and this component sizes its container from it.
vi.mock("ink", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ink")>();
  return {
    ...actual,
    useStdout: () => {
      const real = actual.useStdout();
      return { ...real, stdout: { ...real.stdout, rows: 40 } };
    },
  };
});

const { MoreInfoTab } = await import("./MoreInfoTab.js");

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

function makeCipher(overrides: Partial<Cipher>): Cipher {
  return {
    id: "cipher-id-123",
    type: CipherType.Login,
    folderId: null,
    organizationId: null,
    collectionIds: null,
    deletedDate: null,
    name: "Item",
    notes: "",
    favorite: false,
    ...overrides,
  } as Cipher;
}

describe("MoreInfoTab (smoke)", () => {
  it("renders the cipher id", () => {
    const { lastFrame, unmount } = render(
      <MoreInfoTab
        isFocused={false}
        selectedCipher={makeCipher({})}
        organizations={[]}
        onChange={() => {}}
      />
    );
    expect(strip(lastFrame() ?? "")).toContain("cipher-id-123");
    unmount();
  });

  it("renders identity-specific fields, masking the SSN", () => {
    const cipher = makeCipher({
      type: CipherType.Identity,
      identity: {
        address1: "1 Infinite Loop",
        city: "Cupertino",
        state: "CA",
        postalCode: "95014",
        country: "US",
        licenseNumber: "LIC123",
        ssn: "000-00-0000",
        passportNumber: "P123456",
      } as any,
    });
    const { lastFrame, unmount } = render(
      <MoreInfoTab
        isFocused={false}
        selectedCipher={cipher}
        organizations={[]}
        onChange={() => {}}
      />
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("1 Infinite Loop");
    expect(frame).toContain("Cupertino");
    expect(frame).toContain("95014");
    expect(frame).toContain("P123456");
    expect(frame).not.toContain("000-00-0000");
    unmount();
  });

  it("renders the SSH key fingerprint for an SSH key cipher", () => {
    const cipher = makeCipher({
      type: CipherType.SSHKey,
      sshKey: { keyFingerprint: "SHA256:abc123", privateKey: null, publicKey: null },
    });
    const { lastFrame, unmount } = render(
      <MoreInfoTab
        isFocused={false}
        selectedCipher={cipher}
        organizations={[]}
        onChange={() => {}}
      />
    );
    expect(strip(lastFrame() ?? "")).toContain("SHA256:abc123");
    unmount();
  });

  it("lists organizations to move a personal cipher into", () => {
    const cipher = makeCipher({ organizationId: null });
    const { lastFrame, unmount } = render(
      <MoreInfoTab
        isFocused={false}
        selectedCipher={cipher}
        organizations={[{ id: "org-1", name: "Acme Inc" }]}
        onChange={() => {}}
      />
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("None (Personal)");
    expect(frame).toContain("Acme Inc");
    unmount();
  });

  it("shows the resolved organization name (read-only) once a cipher belongs to one", () => {
    const cipher = makeCipher({ organizationId: "org-1" });
    const { lastFrame, unmount } = render(
      <MoreInfoTab
        isFocused={false}
        selectedCipher={cipher}
        organizations={[{ id: "org-1", name: "Acme Inc" }]}
        onChange={() => {}}
      />
    );
    expect(strip(lastFrame() ?? "")).toContain("Acme Inc");
    unmount();
  });

  it("renders custom fields and login URIs", () => {
    const cipher = makeCipher({
      type: CipherType.Login,
      login: { uris: [{ uri: "https://example.com" }] },
      fields: [{ name: "Custom Field", value: "custom value", type: 0 }],
    });
    const { lastFrame, unmount } = render(
      <MoreInfoTab
        isFocused={false}
        selectedCipher={cipher}
        organizations={[]}
        onChange={() => {}}
      />
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("Custom Field");
    expect(frame).toContain("custom value");
    expect(frame).toContain("https://example.com");
    unmount();
  });
});
