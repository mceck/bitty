import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { CipherType, type Cipher } from "../../clients/bw.js";

// ink-testing-library's fake stdout has no `rows` (only `columns`), and
// VaultList uses `stdout.rows` to size its visible window — without this,
// `Math.max(undefined - 14, 20)` is NaN and the list silently renders zero
// rows. Give it a realistic terminal height so items actually show up.
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

// Never let a smoke test touch the real system clipboard.
vi.mock("clipboardy", () => ({ default: { write: vi.fn(), hasImages: vi.fn(), readImages: vi.fn() } }));

const { VaultList } = await import("./VaultList.js");

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

function makeCipher(overrides: Partial<Cipher>): Cipher {
  return {
    id: "1",
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

describe("VaultList (smoke)", () => {
  it("renders the name of each cipher", () => {
    const ciphers = [
      makeCipher({ id: "1", name: "GitHub" }),
      makeCipher({ id: "2", name: "AWS Console" }),
    ];
    const { lastFrame, unmount } = render(
      <VaultList filteredCiphers={ciphers} isFocused={false} selected={0} onSelect={() => {}} />
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("GitHub");
    expect(frame).toContain("AWS Console");
    unmount();
  });

  it("renders a favorite marker for favorited items", () => {
    const ciphers = [makeCipher({ id: "1", name: "Starred", favorite: true })];
    const { lastFrame, unmount } = render(
      <VaultList filteredCiphers={ciphers} isFocused={false} selected={0} onSelect={() => {}} />
    );
    expect(strip(lastFrame() ?? "")).toContain("★");
    unmount();
  });

  it("renders without throwing when the list is empty", () => {
    const { lastFrame, unmount } = render(
      <VaultList filteredCiphers={[]} isFocused={false} selected={null} onSelect={() => {}} />
    );
    expect(lastFrame()).toBeDefined();
    unmount();
  });
});
