import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import path from "node:path";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_FONT = "Noto Sans Bengali";

const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansBengali.ttf");

if (!GlobalFonts.registerFromPath(fontPath, OG_FONT)) {
  throw new Error(`Unable to load Open Graph font: ${fontPath}`);
}

export function createOgTextOverlay() {
  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
  const context = canvas.getContext("2d");
  context.textBaseline = "alphabetic";
  context.fillStyle = "#fff";
  return { canvas, context };
}
