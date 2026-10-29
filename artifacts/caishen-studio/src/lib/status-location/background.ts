import type { LocationRect } from "./schema";
/** Reconstruct a bounded smooth patch. Busy boundaries are reported instead of pretending to recover texture. */
export function boundaryBackground(
  canvas: HTMLCanvasElement,
  bounds: LocationRect,
): string | undefined {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  const x = Math.max(0, Math.floor(bounds.x * canvas.width)),
    y = Math.max(0, Math.floor(bounds.y * canvas.height));
  const w = Math.max(
      1,
      Math.min(canvas.width - x, Math.ceil(bounds.width * canvas.width)),
    ),
    h = Math.max(
      1,
      Math.min(canvas.height - y, Math.ceil(bounds.height * canvas.height)),
    );
  const edge = (row: number) =>
    context.getImageData(x, Math.max(0, Math.min(canvas.height - 1, row)), w, 1)
      .data;
  const top = [edge(y - 3), edge(y - 2), edge(y - 1)],
    bottom = [edge(y + h), edge(y + h + 1), edge(y + h + 2)];
  const smooth = (rows: Uint8ClampedArray[]) =>
    Array.from({ length: w }, (_, col) =>
      [0, 1, 2, 3].map((c) => {
        const values: number[] = [];
        for (const data of rows)
          for (let dx = -4; dx <= 4; dx++)
            values.push(data[Math.max(0, Math.min(w - 1, col + dx)) * 4 + c]);
        values.sort((a, b) => a - b);
        return values[Math.floor(values.length / 2)];
      }),
    );
  const a = smooth(top),
    b = smooth(bottom);
  let rough = 0,
    total = 0;
  for (const [rows, filtered] of [
    [top, a],
    [bottom, b],
  ] as const)
    for (const row of rows)
      for (let col = 0; col < w; col++) {
        if (
          Math.hypot(
            ...[0, 1, 2].map((c) => row[col * 4 + c] - filtered[col][c]),
          ) > 65
        )
          rough++;
        total++;
      }
  if (rough / total > 0.2) return;
  const output = document.createElement("canvas");
  output.width = w;
  output.height = h;
  try {
    const ctx = output.getContext("2d")!;
    const image = ctx.createImageData(w, h);
    for (let row = 0; row < h; row++)
      for (let col = 0; col < w; col++)
        for (let c = 0; c < 4; c++)
          image.data[(row * w + col) * 4 + c] = Math.round(
            a[col][c] + (b[col][c] - a[col][c]) * (h < 2 ? 0 : row / (h - 1)),
          );
    const original = context.getImageData(x, y, w, h).data;
    let mismatched = 0,
      opaque = 0;
    for (let i = 0; i < original.length; i += 4)
      if (original[i + 3] > 200) {
        opaque++;
        if (
          Math.hypot(
            original[i] - image.data[i],
            original[i + 1] - image.data[i + 1],
            original[i + 2] - image.data[i + 2],
          ) > 65
        )
          mismatched++;
      }
    if (opaque && mismatched / opaque > 0.25) return;
    ctx.putImageData(image, 0, 0);
    return output.toDataURL("image/png");
  } finally {
    output.width = output.height = 0;
  }
}
