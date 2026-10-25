import type { PhoneSettings } from "./schema";

type Rgb = { r: number; g: number; b: number };

const toHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export type BarSample = {
  /** Dominant colour of the strip behind the status bar. */
  background: string;
  /** True when the strip is close to a single flat colour. */
  uniform: boolean;
  /** Whether light (white) icons read better than dark ones. */
  lightIcons: boolean;
};

/**
 * Analyse RGBA pixels of the status-bar strip. Pure so it can be unit tested;
 * the caller supplies pixels from a rendered canvas.
 */
export function analyseStrip(data: Uint8ClampedArray): BarSample | null {
  // Bucket colours (4 bits/channel) and pick the most common bucket.
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let count = 0;
  let sumL = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
    const l = luminance({ r, g, b });
    sumL += l;
    count += 1;
  }
  if (count === 0) return null;
  let best = { n: 0, r: 0, g: 0, b: 0 };
  for (const bucket of buckets.values()) if (bucket.n > best.n) best = bucket;
  const dominant = { r: best.r / best.n, g: best.g / best.n, b: best.b / best.n };
  // Judge contrast against the dominant colour (the original status bar text,
  // if any, is a small minority and must not skew it), blended slightly with the
  // average so gradients and photos still get a sensible pick.
  const mean = 0.7 * luminance(dominant) + 0.3 * (sumL / count);
  const vsWhite = 1.05 / (mean + 0.05);
  const vsBlack = (mean + 0.05) / (luminance({ r: 17, g: 17, b: 17 }) + 0.05);
  return {
    background: toHex(dominant),
    uniform: best.n / count > 0.7,
    lightIcons: vsWhite > vsBlack,
  };
}

/** Settings patch that blends the status bar into the design underneath. */
export function matchPatch(sample: BarSample): Partial<PhoneSettings> {
  return {
    theme: sample.lightIcons ? "light" : "dark",
    customColor: null,
    backgroundColor: sample.background,
    // Busy photos look wrong under a flat bar; let the design show through instead.
    transparent: !sample.uniform,
  };
}

/** Render the design without its phone layers and sample the strip under the status bar. */
export async function sampleStatusBar(
  render: () => Promise<HTMLCanvasElement>,
  stripRatio: number,
): Promise<BarSample | null> {
  const canvas = await render();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const height = Math.max(1, Math.round(canvas.height * stripRatio));
  try {
    return analyseStrip(ctx.getImageData(0, 0, canvas.width, height).data);
  } catch {
    // Cross-origin images taint the canvas; fall back to manual settings.
    return null;
  }
}
