import { afterEach, describe, expect, it, vi } from "vitest";

const { mockHasImages, mockReadImages, mockReadFile, mockUnlink, mockPngRead, mockJsQR } =
  vi.hoisted(() => ({
    mockHasImages: vi.fn(),
    mockReadImages: vi.fn(),
    mockReadFile: vi.fn(),
    mockUnlink: vi.fn(),
    mockPngRead: vi.fn(),
    mockJsQR: vi.fn(),
  }));

vi.mock("clipboardy", () => ({
  default: { hasImages: mockHasImages, readImages: mockReadImages },
}));

vi.mock("fs", () => ({
  default: { promises: { readFile: mockReadFile, unlink: mockUnlink } },
}));

vi.mock("pngjs", () => ({
  PNG: { sync: { read: mockPngRead } },
}));

// qrcode.ts loads jsqr via `createRequire(import.meta.url)` (a real Node.js
// CJS require, bypassing Vite/Vitest's module graph) rather than a static
// import — a plain `vi.mock("jsqr", ...)` does NOT intercept that call (verified
// empirically: the real jsqr package ran and returned null for our fake 1x1
// pixel buffer). Intercepting `createRequire` itself, which IS a static import
// from "module", works instead.
vi.mock("module", () => ({
  createRequire: () => (id: string) => {
    if (id === "jsqr") return mockJsQR;
    throw new Error(`unexpected require(${id}) in test`);
  },
}));

import { decodeQrFromClipboardImage } from "./qrcode.js";

function fakePng(tag: string) {
  const data = Buffer.from(tag);
  return { data, width: 1, height: 1 };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("decodeQrFromClipboardImage", () => {
  it("returns null when the clipboard has no images", async () => {
    mockHasImages.mockResolvedValue(false);

    const result = await decodeQrFromClipboardImage();

    expect(result).toBeNull();
    expect(mockReadImages).not.toHaveBeenCalled();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockJsQR).not.toHaveBeenCalled();
  });

  it("returns null when hasImages() is true but readImages() yields no files", async () => {
    mockHasImages.mockResolvedValue(true);
    mockReadImages.mockResolvedValue([]);

    const result = await decodeQrFromClipboardImage();

    expect(result).toBeNull();
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("decodes a single image and cleans up the temp file", async () => {
    mockHasImages.mockResolvedValue(true);
    mockReadImages.mockResolvedValue(["/tmp/clip-1.png"]);
    mockReadFile.mockResolvedValue(Buffer.from("png-bytes"));
    mockPngRead.mockReturnValue(fakePng("A"));
    mockJsQR.mockReturnValue({ data: "otpauth://totp/Example:me?secret=ABC" });
    mockUnlink.mockResolvedValue(undefined);

    const result = await decodeQrFromClipboardImage();

    expect(result).toBe("otpauth://totp/Example:me?secret=ABC");
    expect(mockUnlink).toHaveBeenCalledWith("/tmp/clip-1.png");
  });

  it("falls back to the next file when the first fails to parse/decode, and unlinks both", async () => {
    mockHasImages.mockResolvedValue(true);
    mockReadImages.mockResolvedValue(["/tmp/bad.png", "/tmp/good.png"]);
    mockReadFile.mockImplementation(async (file: string) => {
      if (file === "/tmp/bad.png") throw new Error("not a png");
      return Buffer.from("png-bytes");
    });
    mockPngRead.mockReturnValue(fakePng("B"));
    mockJsQR.mockReturnValue({ data: "decoded-from-good-file" });
    mockUnlink.mockResolvedValue(undefined);

    const result = await decodeQrFromClipboardImage();

    expect(result).toBe("decoded-from-good-file");
    expect(mockReadFile).toHaveBeenCalledTimes(2);
    expect(mockUnlink).toHaveBeenCalledWith("/tmp/bad.png");
    expect(mockUnlink).toHaveBeenCalledWith("/tmp/good.png");
  });

  it("returns null when no file decodes, still unlinking every file", async () => {
    mockHasImages.mockResolvedValue(true);
    mockReadImages.mockResolvedValue(["/tmp/one.png", "/tmp/two.png"]);
    mockReadFile.mockResolvedValue(Buffer.from("png-bytes"));
    mockPngRead.mockReturnValue(fakePng("C"));
    mockJsQR.mockReturnValue(null);
    mockUnlink.mockResolvedValue(undefined);

    const result = await decodeQrFromClipboardImage();

    expect(result).toBeNull();
    expect(mockUnlink).toHaveBeenCalledWith("/tmp/one.png");
    expect(mockUnlink).toHaveBeenCalledWith("/tmp/two.png");
  });

  it("swallows an unlink failure without throwing or affecting the result", async () => {
    mockHasImages.mockResolvedValue(true);
    mockReadImages.mockResolvedValue(["/tmp/one.png"]);
    mockReadFile.mockResolvedValue(Buffer.from("png-bytes"));
    mockPngRead.mockReturnValue(fakePng("D"));
    mockJsQR.mockReturnValue({ data: "some-secret" });
    mockUnlink.mockRejectedValue(new Error("permission denied"));

    const result = await decodeQrFromClipboardImage();

    expect(result).toBe("some-secret");
  });

  it("treats a jsQR result with no .data as a non-decode and keeps trying", async () => {
    mockHasImages.mockResolvedValue(true);
    mockReadImages.mockResolvedValue(["/tmp/empty-result.png", "/tmp/good.png"]);
    mockReadFile.mockResolvedValue(Buffer.from("png-bytes"));
    mockPngRead.mockReturnValue(fakePng("E"));
    mockJsQR
      .mockReturnValueOnce({ data: "" })
      .mockReturnValueOnce({ data: "final-secret" });
    mockUnlink.mockResolvedValue(undefined);

    const result = await decodeQrFromClipboardImage();

    expect(result).toBe("final-secret");
  });
});
