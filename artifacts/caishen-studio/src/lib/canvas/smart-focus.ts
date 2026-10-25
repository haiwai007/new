import type { Pixels } from "../repair/inpaint.ts";

// Finds where the "interesting" part of a picture is, so cover-cropping keeps
// it in frame. Uses local contrast (gradient energy) on a small copy with a
// mild center bias. Not a face/object detector: it follows detail and edges.

export type FocusPoint = { x: number; y: number };

/** Energy-weighted centroid of image detail, as fractions of width/height. */
export function detailCenter(img: Pixels): FocusPoint {
  const { width: w, height: h, data } = img;
  if (w < 3 || h < 3) return { x: 0.5, y: 0.5 };
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  let sx = 0;
  let sy = 0;
  let sum = 0;
  let max = 0;
  const energy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + w] - lum[i - w];
      const e = gx * gx + gy * gy;
      energy[i] = e;
      if (e > max) max = e;
    }
  }
  if (max === 0) return { x: 0.5, y: 0.5 };
  // Ignore weak texture (noise, gradients) so strong subject edges dominate.
  const floor = max * 0.04;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const e = energy[y * w + x];
      if (e <= floor) continue;
      const dx = x / w - 0.5;
      const dy = y / h - 0.5;
      const k = e * (1 - 0.6 * (dx * dx + dy * dy) * 2);
      sx += x * k;
      sy += y * k;
      sum += k;
    }
  }
  if (sum <= 0) return { x: 0.5, y: 0.5 };
  return { x: sx / sum / (w - 1), y: sy / sum / (h - 1) };
}

/**
 * Convert a point of interest (fractions of the image) into the cover-crop
 * focus values used by `computeImageGeometry`, so the point lands as close
 * to the box center as the crop allows.
 */
export function focusForPoint(p: FocusPoint, boxW: number, boxH: number, natW: number, natH: number, zoom = 1): FocusPoint {
  const boxAR = boxW / boxH;
  let sw = natW;
  let sh = natH;
  if (natW / natH > boxAR) sw = natH * boxAR;
  else sh = natW / boxAR;
  const z = Math.max(1, zoom);
  sw /= z;
  sh /= z;
  const axis = (pt: number, nat: number, crop: number) => {
    const free = nat - crop;
    if (free <= 0.5) return 0.5;
    return Math.min(1, Math.max(0, (pt * nat - crop / 2) / free));
  };
  return { x: axis(p.x, natW, sw), y: axis(p.y, natH, sh) };
}

const cache = new WeakMap<HTMLImageElement, FocusPoint>();

/** Detail center of a loaded image element (cached per element). */
export function imageDetailCenter(el: HTMLImageElement): FocusPoint {
  const hit = cache.get(el);
  if (hit) return hit;
  let p: FocusPoint = { x: 0.5, y: 0.5 };
  try {
    const natW = el.naturalWidth || el.width;
    const natH = el.naturalHeight || el.height;
    const s = Math.min(1, 96 / Math.max(natW, natH));
    const w = Math.max(3, Math.round(natW * s));
    const h = Math.max(3, Math.round(natH * s));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(el, 0, 0, w, h);
      p = detailCenter(ctx.getImageData(0, 0, w, h));
    }
  } catch {
    // Cross-origin images without CORS can't be read; fall back to center.
  }
  cache.set(el, p);
  return p;
}
