import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { CipherType, type Cipher, type Collection } from "../../clients/bw.js";

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

const { CollectionsTab } = await import("./CollectionsTab.js");

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const flush = (ms = 300) => new Promise((r) => setTimeout(r, ms));

function makeCipher(overrides: Partial<Cipher> = {}): Cipher {
  return {
    id: "1",
    type: CipherType.Login,
    folderId: null,
    organizationId: null,
    collectionIds: [],
    deletedDate: null,
    name: "Item",
    notes: "",
    favorite: false,
    ...overrides,
  } as Cipher;
}

const collections: Collection[] = [
  { id: "col-1", organizationId: "org-1", name: "Engineering", readOnly: false },
  { id: "col-2", organizationId: "org-1", name: "Design", readOnly: false },
];

describe("CollectionsTab (smoke)", () => {
  it("renders each collection's name", () => {
    const cipher = makeCipher();
    const { lastFrame, unmount } = render(
      <CollectionsTab
        isFocused={false}
        selectedCipher={cipher}
        collections={collections}
        onChange={() => {}}
      />
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("Engineering");
    expect(frame).toContain("Design");
    unmount();
  });

  it("shows a checked mark only for collections already on the cipher", () => {
    const cipher = makeCipher({ collectionIds: ["col-2"] });
    const { lastFrame, unmount } = render(
      <CollectionsTab
        isFocused={false}
        selectedCipher={cipher}
        collections={collections}
        onChange={() => {}}
      />
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("[x] Design");
    expect(frame).toContain("[ ] Engineering");
    unmount();
  });

  it("renders a placeholder message when there are no collections", () => {
    const { lastFrame, unmount } = render(
      <CollectionsTab
        isFocused={false}
        selectedCipher={makeCipher()}
        collections={[]}
        onChange={() => {}}
      />
    );
    expect(strip(lastFrame() ?? "")).toContain("No writable collections available.");
    unmount();
  });

  it("toggles the cursored collection with Space when focused", async () => {
    let cipher = makeCipher();
    const { stdin, rerender, unmount } = render(
      <CollectionsTab
        isFocused={true}
        selectedCipher={cipher}
        collections={collections}
        onChange={(c) => {
          cipher = c;
        }}
      />
    );
    await flush();
    stdin.write(" ");
    await flush();
    expect(cipher.collectionIds).toEqual(["col-1"]);
    rerender(
      <CollectionsTab
        isFocused={true}
        selectedCipher={cipher}
        collections={collections}
        onChange={() => {}}
      />
    );
    unmount();
  });
});
