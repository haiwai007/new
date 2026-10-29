import { analyseStrip } from "../phone/match";
/** Measure a neutral clock cluster, excluding coloured notification icons and noisy backgrounds. */
export function measureSourceGlyphs(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const sample = analyseStrip(data);
  if (!sample?.uniform || height < 6 || width < 20) return;
  const bg = [1, 3, 5].map((i) =>
    parseInt(sample.background.slice(i, i + 2), 16),
  );
  const foreground = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const channels = [data[i], data[i + 1], data[i + 2]];
    return (
      data[i + 3] > 200 &&
      Math.max(...channels) - Math.min(...channels) < 32 &&
      Math.hypot(...channels.map((v, c) => v - bg[c])) > 80
    );
  };
  const columns = Array.from({ length: width }, () => 0);
  const left = Math.floor(width * 0.015),
    right = Math.floor(width * 0.35);
  for (let x = left; x < right; x++)
    for (let y = 0; y < height; y++) if (foreground(x, y)) columns[x]++;
  let start = left;
  while (start < right && columns[start] < 2) start++;
  if (start === right) return;
  let firstEnd = start;
  while (firstEnd < right && columns[firstEnd] > 0) firstEnd++;
  let glyphTop = height,
    glyphBottom = 0;
  for (let y = 0; y < height; y++)
    for (let x = start; x < firstEnd; x++)
      if (foreground(x, y)) {
        glyphTop = Math.min(glyphTop, y);
        glyphBottom = Math.max(glyphBottom, y + 1);
      }
  let end = start,
    last = start;
  const gap = Math.max(2, Math.round(height * 0.35));
  for (let x = start; x < right; x++) {
    if (columns[x]) last = x;
    if (x - last > gap) break;
    end = last + 1;
  }
  if (end - start > width * 0.28) return;
  const rows = Array.from({ length: height }, () => 0);
  for (let y = 0; y < height; y++)
    for (let x = start; x < end; x++) if (foreground(x, y)) rows[y]++;
  let run = -1,
    bestStart = 0,
    bestEnd = 0;
  for (let y = 0; y <= height; y++)
    if (y < height && y >= glyphTop && y < glyphBottom && rows[y] >= 2) {
      if (run < 0) run = y;
    } else if (run >= 0) {
      if (y - run > bestEnd - bestStart) {
        bestStart = run;
        bestEnd = y;
      }
      run = -1;
    }
  const h = bestEnd - bestStart;
  if (h < 4 || h / height < 0.18 || h / height > 0.85) return;
  const colors: number[][] = [[], [], []];
  for (let y = bestStart; y < bestEnd; y++)
    for (let x = start; x < end; x++)
      if (foreground(x, y)) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) colors[c].push(data[i + c]);
      }
  const inkColor =
    "#" +
    colors
      .map((values) => {
        values.sort((a, b) => a - b);
        return values[
          Math.min(
            values.length - 1,
            Math.floor(values.length * (sample.lightIcons ? 0.75 : 0.25)),
          )
        ]
          .toString(16)
          .padStart(2, "0");
      })
      .join("");
  return {
    version: 2 as const,
    glyphRatio: h / height,
    centerRatio: (bestStart + bestEnd) / (2 * height),
    baselineRatio: bestEnd / height,
    inkColor,
  };
}

/** One colour adjustment shared by the editor preview and the exported layers. */
export function adjustInkTone(color: string, tone = 0) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.max(
          0,
          Math.min(
            255,
            Math.round(parseInt(color.slice(i, i + 2), 16) + tone * 2.55),
          ),
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
