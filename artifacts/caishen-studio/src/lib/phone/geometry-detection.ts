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
  const portrait = source.height / source.width;
  if (portrait < 1.35 || portrait > 2.8) return;
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
    const toRatio = source.width / width / source.height;
    return {
      barRatio: Math.max(center * 2, glyph * 1.6) * toRatio,
      glyphRatio: glyph * toRatio,
      centerRatio: center * toRatio,
    };
  }
  return undefined;
}
