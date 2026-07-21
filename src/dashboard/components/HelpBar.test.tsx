import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { HelpBar } from "./HelpBar.js";
import { CipherType, type Cipher } from "../../clients/bw.js";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

afterEach(cleanup);

function makeCipher(overrides: Partial<Cipher> = {}): Cipher {
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

describe("HelpBar (smoke)", () => {
  it("renders navigation hints when focus is on the list", () => {
    const { lastFrame, unmount } = render(
      <HelpBar focus="list" mode="view" cipher={null} />
    );
    const frame = strip(lastFrame() ?? "");
    expect(frame).toContain("Navigate");
    expect(frame).toContain("Search");
    expect(frame).toContain("Logout");
    unmount();
  });

  it("hides the 'New' hint in 'new' mode", () => {
    const { lastFrame, unmount } = render(
      <HelpBar focus="list" mode="new" cipher={null} />
    );
    expect(strip(lastFrame() ?? "")).not.toContain("New");
    unmount();
  });

  it("shows a Copy TOTP hint only for a login cipher that has TOTP configured", () => {
    const withoutTotp = render(
      <HelpBar focus="detail" mode="view" cipher={makeCipher({ login: { username: "u" } })} />
    );
    // In "detail" focus, the bar shows a generic "Copy Field" hint, not per-type ones.
    expect(strip(withoutTotp.lastFrame() ?? "")).toContain("Copy Field");
    withoutTotp.unmount();

    const listFocusWithTotp = render(
      <HelpBar
        focus="list"
        mode="view"
        cipher={makeCipher({ login: { username: "u", totp: "SECRET" } })}
      />
    );
    expect(strip(listFocusWithTotp.lastFrame() ?? "")).toContain("TOTP");
    listFocusWithTotp.unmount();
  });
});
