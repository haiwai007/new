import type { Layer, ShapeLayer, TextLayer } from "../../types/template.ts";
import { createShapeLayer, createTextLayer } from "../template/layers.ts";
import type { AnalyzedLine, Box } from "./types.ts";
import { hasCjk } from "./text-utils.ts";
import { maskPad } from "./colors.ts";

type Size = { width: number; height: number };

/** The original image is drawn with "cover" on the canvas; map image pixels to canvas units. */
export function coverMapping(image: Size, canvas: Size) {
  const s = Math.max(canvas.width / image.width, canvas.height / image.height);
  const offX = (canvas.width - image.width * s) / 2;
  const offY = (canvas.height - image.height * s) / 2;
  return {
    scale: s,
    toCanvas: (b: Box): Box => ({ x: b.x * s + offX, y: b.y * s + offY, width: b.width * s, height: b.height * s }),
    toImage: (b: Box): Box => ({ x: (b.x - offX) / s, y: (b.y - offY) / s, width: b.width / s, height: b.height / s }),
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Approximate advance width in em for a string (CJK ≈ 1em, Latin/digits ≈ 0.56em, spaces ≈ 0.3em). */
export function emWidth(text: string): number {
  let em = 0;
  for (const ch of text) {
    if (hasCjk(ch)) em += 1;
    else if (ch === " ") em += 0.3;
    else em += 0.56;
  }
  return em;
}

/**
 * Estimate a font size from the measured box. OCR boxes are often taller than
 * the glyphs, so also derive a size from the box width and the text's em width,
 * and take the smaller of the two.
 */
export function estimateFontSize(text: string, inkHeight: number, inkWidth?: number): number {
  const fromHeight = inkHeight / (hasCjk(text) ? 0.9 : 0.78);
  const em = emWidth(text);
  const fromWidth = inkWidth !== undefined && em > 0 ? inkWidth / em : Infinity;
  return Math.max(8, Math.round(Math.min(fromHeight, fromWidth)));
}

export function textLayerFromLine(line: AnalyzedLine, box: Box, canvas: Size): TextLayer {
  const fontSize = estimateFontSize(line.text, box.height, box.width);
  const centerX = box.x + box.width / 2;
  const centered = Math.abs(centerX - canvas.width / 2) < canvas.width * 0.03;
  // Leave some slack so the restored font (which may differ from the original) still fits on one line.
  const width = box.width * 1.15 + fontSize * 0.5;
  const height = fontSize * 1.3;
  const x = centered ? centerX - width / 2 : box.x - fontSize * 0.1;
  const y = box.y + box.height / 2 - height / 2;
  return createTextLayer(
    { x: r1(x), y: r1(y), width: r1(width), height: r1(height) },
    {
      name: `识别：${line.text.slice(0, 10)}`,
      text: line.text,
      fontSize,
      fontWeight: line.bold ? "bold" : "normal",
      fill: line.color,
      textAlign: centered ? "center" : "left",
      verticalAlign: "middle",
      lineHeight: 1.15,
      wrap: true,
      autoShrink: true,
      minFontSize: Math.max(8, Math.round(fontSize * 0.5)),
      maxLines: 1,
    },
  );
}

/** `box` is the line in canvas units; `scale` converts source pixels to canvas units. */
export function maskFromLine(line: AnalyzedLine, box: Box, scale: number): ShapeLayer {
  // Pad is defined in source pixels (same as background sampling) and converted to canvas units.
  const pad = maskPad(line.bbox.height) * scale;
  return createShapeLayer(
    "rect",
    { x: r1(box.x - pad), y: r1(box.y - pad), width: r1(box.width + pad * 2), height: r1(box.height + pad * 2) },
    { name: `遮罩：${line.text.slice(0, 8)}`, fill: line.bgColor, isMask: true },
  );
}

export type LinesToLayersResult = {
  layers: Layer[];
  textCount: number;
  maskCount: number;
  /** Solid color blocks rebuilt as editable rectangles. */
  shapeCount: number;
  /** Lines on a non-uniform background where a flat mask would look wrong, so none was added. */
  maskSkipped: number;
  /** Lines entirely outside the canvas (e.g. cropped away by a custom size). */
  outside: number;
};

/**
 * Convert recognized lines (and optional solid color blocks) into editable
 * layers. Order, bottom to top: rebuilt color blocks → masks → text. Masks hide
 * the original text pixels; text always sits above them so moving it never
 * re-reveals old text. Lines inside a rebuilt block need no mask: the block
 * itself covers the original text.
 */
export function linesToLayers(
  lines: AnalyzedLine[],
  image: Size,
  canvas: Size,
  opts: { addMasks: boolean; blocks?: (Box & { color: string })[] },
): LinesToLayersResult {
  const map = coverMapping(image, canvas);
  const shapes: Layer[] = (opts.blocks ?? []).map((b, i) => {
    const c = map.toCanvas(b);
    return createShapeLayer("rect", { x: r1(c.x), y: r1(c.y), width: r1(c.width), height: r1(c.height) }, {
      name: `色块 ${i + 1}`,
      fill: b.color,
    });
  });
  const insideBlock = (box: Box) =>
    (opts.blocks ?? []).some((b) => {
      const c = map.toCanvas(b);
      return box.x >= c.x - 1 && box.y >= c.y - 1 && box.x + box.width <= c.x + c.width + 1 && box.y + box.height <= c.y + c.height + 1;
    });
  const masks: Layer[] = [];
  const texts: Layer[] = [];
  let maskSkipped = 0;
  let outside = 0;
  for (const line of lines) {
    const box = map.toCanvas(line.bbox);
    if (box.x + box.width <= 0 || box.y + box.height <= 0 || box.x >= canvas.width || box.y >= canvas.height) {
      outside += 1;
      continue;
    }
    if (opts.addMasks && !insideBlock(box)) {
      if (line.bgUniform) masks.push(maskFromLine(line, box, map.scale));
      else maskSkipped += 1;
    }
    texts.push(textLayerFromLine(line, box, canvas));
  }
  return {
    layers: [...shapes, ...masks, ...texts],
    textCount: texts.length,
    maskCount: masks.length,
    shapeCount: shapes.length,
    maskSkipped,
    outside,
  };
}
