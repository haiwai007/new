import type { FusionAnalysis } from "./fusion-schema";
import { rgb } from "./fusion-metrics";

/** Measure the first coherent foreground row shared by the clock and right-hand icons.
 * Work in screenshot pixels, never in the selected model's screen dimensions. */
export function detectStatusGeometry(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  source: { width: number; height: number },
  bands: FusionAnalysis["bands"],
): FusionAnalysis["geometry"] {
  const limit = Math.min(height, Math.floor(width * 0.17));
  const rows: number[] = [];
  for (let y = 0; y < limit; y++) {
    const band =
      bands[
        Math.min(bands.length - 1, Math.floor((y / height) * bands.length))
      ];
    if (band.uniformity < 0.72) continue;
    const bg = rgb(band.color);
    let left = 0,
      right = 0;
    for (let x = Math.floor(width * 0.02); x < width * 0.98; x++) {
      if (x > width * 0.32 && x < width * 0.7) continue;
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      if (
        Math.hypot(data[i] - bg.r, data[i + 1] - bg.g, data[i + 2] - bg.b) < 65
      )
        continue;
      if (x < width * 0.32) left++;
      else right++;
    }
    if (
      left >= Math.max(2, width * 0.008) &&
      right >= Math.max(3, width * 0.012) &&
      left < width * 0.2 &&
      right < width * 0.23
    )
      rows.push(y);
  }
  const gap = Math.max(2, Math.round(width * 0.005));
  for (let i = 0; i < rows.length;) {
    const start = rows[i];
    let end = start,
      count = 1;
    while (++i < rows.length && rows[i] - end <= gap) {
      end = rows[i];
      count++;
    }
    const glyph = end - start + 1,
      center = (start + end + 1) / 2;
    if (
      count < Math.max(3, width * 0.008) ||
      glyph < width * 0.012 ||
      glyph > width * 0.065 ||
      center > width * 0.12
    )
      continue;
    // A back arrow or a pill control is not a clock: require several separated
    // foreground columns on the left, with the proportions of a time string.
    const widths: number[] = [];
    let groupWidth = 0;
    let groups = 0,
      active = false,
      first = width,
      last = 0;
    for (let x = Math.floor(width * 0.02); x < width * 0.25; x++) {
      let hits = 0;
      for (let y = start; y <= end; y++) {
        const band =
          bands[
            Math.min(bands.length - 1, Math.floor((y / height) * bands.length))
          ];
        const bg = rgb(band.color),
          i = (y * width + x) * 4;
        if (
          data[i + 3] >= 128 &&
          Math.hypot(data[i] - bg.r, data[i + 1] - bg.g, data[i + 2] - bg.b) >
            65
        )
          hits++;
      }
      const on = hits >= Math.max(1, Math.floor(glyph * 0.12));
      if (on) {
        if (!active) groups++;
        first = Math.min(first, x);
        last = x;
        groupWidth++;
      } else if (active) {
        widths.push(groupWidth);
        groupWidth = 0;
      }
      active = on;
    }
    if (active) widths.push(groupWidth);
    if (
      groups < 3 ||
      widths.filter((w) => w <= glyph * 0.9).length < 3 ||
      (last - first + 1) / glyph < 1.6
    )
      continue;
    const toRatio = source.width / width / source.height;
    if (Math.max(center * 2, glyph * 1.6) * toRatio > 0.25) continue;
    return {
      barRatio: Math.max(center * 2, glyph * 1.6) * toRatio,
      glyphRatio: glyph * toRatio,
      centerRatio: center * toRatio,
    };
  }
  return undefined;
}

/** Locate application content independently of the status-row measurement.
 * Without a clock match, every foreground row is protected. With a clock match,
 * central navigation content below the clock protects titles from overpainting. */
export function detectContentTop(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  source: { width: number; height: number },
  bands: FusionAnalysis["bands"],
  geometry: FusionAnalysis["geometry"],
): number | undefined {
  const from = geometry
    ? Math.ceil(
        ((geometry.centerRatio + geometry.glyphRatio / 2) *
          source.height *
          width) /
          source.width,
      )
    : 0;
  const limit = Math.min(height, Math.ceil(width * 0.18));
  let first = -1,
    run = 0;
  for (let y = from; y < limit; y++) {
    const band =
        bands[
          Math.min(bands.length - 1, Math.floor((y / height) * bands.length))
        ],
      bg = rgb(band.color);
    let count = 0;
    const x0 = Math.floor(width * (geometry ? 0.34 : 0.015)),
      x1 = Math.ceil(width * (geometry ? 0.68 : 0.985));
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if (
        data[i + 3] >= 128 &&
        Math.hypot(data[i] - bg.r, data[i + 1] - bg.g, data[i + 2] - bg.b) > 55
      )
        count++;
    }
    if (count >= Math.max(3, width * 0.012)) {
      if (!run) first = y;
      if (++run >= 2)
        return Math.min(0.25, (first * source.width) / width / source.height);
    } else run = 0;
  }
  return undefined;
}
