import fs from "fs";
import { createRequire } from "module";
import clipboard from "clipboardy";
import { PNG } from "pngjs";

// jsqr ships a webpack CJS bundle whose types don't line up with Node's
// ESM/CJS interop under `moduleResolution: nodenext`, so load it directly.
const require = createRequire(import.meta.url);
const jsQR: (
  data: Uint8ClampedArray,
  width: number,
  height: number
) => { data: string } | null = require("jsqr");

export async function decodeQrFromClipboardImage(): Promise<string | null> {
  if (!(await clipboard.hasImages())) return null;

  const files = await clipboard.readImages();
  if (!files.length) return null;

  try {
    for (const file of files) {
      try {
        const buffer = await fs.promises.readFile(file);
        const png = PNG.sync.read(buffer);
        const result = jsQR(
          new Uint8ClampedArray(
            png.data.buffer,
            png.data.byteOffset,
            png.data.length
          ),
          png.width,
          png.height
        );
        if (result?.data) return result.data;
      } catch {
        // Not a readable/decodable image, try the next one.
      }
    }
    return null;
  } finally {
    await Promise.all(files.map((file) => fs.promises.unlink(file).catch(() => {})));
  }
}
