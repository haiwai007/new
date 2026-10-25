import type { Box } from "./types.ts";

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };
type Rgb = [number, number, number];

export function toHex([r, g, b]: Rgb): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Padding around an OCR ink box used for masks and background sampling. Kept small so it doesn't eat neighbouring lines. */
export function maskPad(boxHeight: number): number {
  return Math.min(10, Math.max(2, boxHeight * 0.08));
}

function px(img: Pixels, x: number, y: number): Rgb {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function medianColor(list: Rgb[]): Rgb {
  return [median(list.map((c) => c[0])), median(list.map((c) => c[1])), median(list.map((c) => c[2]))];
}

/** Collect pixels on each side of a rectangle, with a stride so huge images stay cheap. */
function ringSides(img: Pixels, x0: number, y0: number, x1: number, y1: number, maxSamples = 600): Rgb[][] {
  const cx0 = Math.max(0, Math.floor(x0));
  const cy0 = Math.max(0, Math.floor(y0));
  const cx1 = Math.min(img.width - 1, Math.ceil(x1));
  const cy1 = Math.min(img.height - 1, Math.ceil(y1));
  if (cx1 <= cx0 || cy1 <= cy0) return [];
  const perimeter = 2 * (cx1 - cx0 + cy1 - cy0);
  const step = Math.max(1, Math.floor(perimeter / maxSamples));
  const top: Rgb[] = [];
  const bottom: Rgb[] = [];
  const left: Rgb[] = [];
  const right: Rgb[] = [];
  for (let x = cx0; x <= cx1; x += step) {
    top.push(px(img, x, cy0));
    bottom.push(px(img, x, cy1));
  }
  for (let y = cy0; y <= cy1; y += step) {
    left.push(px(img, cx0, y));
    right.push(px(img, cx1, y));
  }
  return [top, bottom, left, right];
}

function ring(img: Pixels, x0: number, y0: number, x1: number, y1: number): Rgb[] {
  return ringSides(img, x0, y0, x1, y1).flat();
}

/** Dominant color along the image's outer edge. */
export function borderColor(img: Pixels): string {
  const inset = Math.max(1, Math.round(Math.min(img.width, img.height) * 0.01));
  return toHex(medianColor(ring(img, inset, inset, img.width - 1 - inset, img.height - 1 - inset)));
}

export type BoxStyle = { color: string; bgColor: string; bgUniform: boolean; bold: boolean };

export type ColorBlock = Box & { color: string };

/**
 * Find solid, roughly rectangular color blocks (buttons, banners, badges) that
 * differ from the page background. Works on a downsampled copy; returned boxes
 * are in the coordinates of `img`. Photos rarely produce a single flat color
 * with a high fill ratio, and text strokes have a low fill ratio, so both are skipped.
 */
export function detectColorBlocks(img: Pixels, opts: { maxBlocks?: number } = {}): ColorBlock[] {
  const maxSide = 240;
  const s = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * s));
  const h = Math.max(1, Math.round(img.height * s));
  const small: Rgb[] = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      small[y * w + x] = px(img, Math.min(img.width - 1, Math.floor(x / s)), Math.min(img.height - 1, Math.floor(y / s)));
    }
  }
  const pageBg = medianColor(ring({ data: img.data, width: img.width, height: img.height }, 1, 1, img.width - 2, img.height - 2));
  const seen = new Uint8Array(w * h);
  const blocks: (ColorBlock & { area: number })[] = [];
  const minArea = w * h * 0.002;
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || dist(small[start], pageBg) < 60) continue;
    const seed = small[start];
    const stack = [start];
    seen[start] = 1;
    let area = 0;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    while (stack.length) {
      const i = stack.pop()!;
      area += 1;
      const x = i % w;
      const y = (i - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const n of nb) {
        if (n >= 0 && !seen[n] && dist(small[n], seed) < 36) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    // Text inside a block leaves holes, so allow a fill ratio a bit below 1.
    const fill = area / (bw * bh);
    const coversAll = bw > w * 0.95 && bh > h * 0.95;
    if (area < minArea || fill < 0.6 || coversAll || bw < 4 || bh < 3) continue;
    blocks.push({ x: x0 / s, y: y0 / s, width: bw / s, height: bh / s, color: toHex(seed), area });
  }
  return blocks.sort((a, b) => b.area - a.area).slice(0, opts.maxBlocks ?? 12).map(({ area: _a, ...b }) => b);
}

/**
 * Estimate text and background colors for a text box:
 * - background = median of a ring just outside the box
 * - text = mean of the inside pixels that differ most from the background
 * - "bold" = share of ink pixels in the box (heuristic; the user can correct it)
 */
export function sampleBoxStyle(img: Pixels, box: Box): BoxStyle {
  const pad = maskPad(box.height);
  const sides = ringSides(img, box.x - pad, box.y - pad, box.x + box.width + pad, box.y + box.height + pad);
  const around = sides.flat();
  const bg = around.length ? medianColor(around) : ([255, 255, 255] as Rgb);
  // Uniform = at least 3 of the 4 sides match the background color. One side is
  // allowed to touch a neighbouring line of text (e.g. a subtitle right below).
  const offRatio = (side: Rgb[]) => (side.length ? side.filter((c) => dist(c, bg) > 30).length / side.length : 1);
  const ratios = sides.map(offRatio).sort((a, b) => a - b);
  const bgUniform = ratios.length === 4 && ratios[2] < 0.12;

  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(img.width, Math.ceil(box.x + box.width));
  const y1 = Math.min(img.height, Math.ceil(box.y + box.height));
  const area = Math.max(1, (x1 - x0) * (y1 - y0));
  const step = Math.max(1, Math.floor(Math.sqrt(area / 4000)));
  const inks: { c: Rgb; d: number }[] = [];
  let total = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      total += 1;
      const c = px(img, x, y);
      const d = dist(c, bg);
      if (d > 60) inks.push({ c, d });
    }
  }
  const bgLum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];
  if (inks.length === 0) {
    return { color: bgLum > 128 ? "#1f1f1f" : "#ffffff", bgColor: toHex(bg), bgUniform, bold: false };
  }
  inks.sort((a, b) => b.d - a.d);
  const core = inks.slice(0, Math.max(1, Math.ceil(inks.length / 2)));
  const mean: Rgb = [0, 1, 2].map((k) => core.reduce((s, p) => s + p.c[k], 0) / core.length) as Rgb;
  const inkRatio = inks.length / Math.max(1, total);
  return { color: toHex(mean), bgColor: toHex(bg), bgUniform, bold: inkRatio > 0.3 };
}
