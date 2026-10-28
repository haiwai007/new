import { analyseStrip } from "../phone/match";
/** Conservative foreground measurement, used only on a predominantly plain background. */
export function measureSourceGlyphs(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { glyphRatio: number; centerRatio: number } | undefined {
  const sample = analyseStrip(data);
  if (!sample?.uniform || height < 6 || width < 20) return;
  const bg = [1, 3, 5].map((i) =>
    parseInt(sample.background.slice(i, i + 2), 16),
  );
  const rows: number[] = [];
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = Math.floor(width * 0.015); x < Math.floor(width * 0.35); x++) {
      const i = (y * width + x) * 4;
      if (
        data[i + 3] > 200 &&
        Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]) >
          80
      )
        n++;
    }
    rows.push(n);
  }
  let start = -1,
    bestStart = 0,
    bestEnd = 0;
  for (let y = 0; y <= height; y++) {
    if (y < height && rows[y] >= Math.max(2, width * 0.003)) {
      if (start < 0) start = y;
    } else if (start >= 0) {
      if (y - start > bestEnd - bestStart) {
        bestStart = start;
        bestEnd = y;
      }
      start = -1;
    }
  }
  const h = bestEnd - bestStart;
  if (h < 4 || h / height < 0.18 || h / height > 0.85) return;
  return {
    glyphRatio: h / height,
    centerRatio: (bestStart + bestEnd) / (2 * height),
  };
}
