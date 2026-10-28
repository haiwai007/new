import type { LocationRect } from "./schema";
/** Reconstruct only a bounded patch using neighbouring edge colours; no remote service. */
export function boundaryBackground(
  canvas: HTMLCanvasElement,
  bounds: LocationRect,
): string | undefined {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  const x = Math.max(0, Math.floor(bounds.x * canvas.width));
  const y = Math.max(0, Math.floor(bounds.y * canvas.height));
  const w = Math.max(
    1,
    Math.min(canvas.width - x, Math.ceil(bounds.width * canvas.width)),
  );
  const h = Math.max(
    1,
    Math.min(canvas.height - y, Math.ceil(bounds.height * canvas.height)),
  );
  const top = context.getImageData(x, Math.max(0, y - 1), w, 1).data;
  const bottom = context.getImageData(
    x,
    Math.min(canvas.height - 1, y + h),
    w,
    1,
  ).data;
  const output = document.createElement("canvas");
  output.width = w;
  output.height = h;
  try {
    const ctx = output.getContext("2d")!;
    const image = ctx.createImageData(w, h);
    // A local median removes isolated glyph pixels from the sampled edges.
    const sample = (data: Uint8ClampedArray, at: number, channel: number) => {
      const values = [];
      for (let dx = -2; dx <= 2; dx++)
        values.push(data[Math.max(0, Math.min(w - 1, at + dx)) * 4 + channel]);
      return values.sort((a, b) => a - b)[2];
    };
    const a = Array.from({ length: w }, (_, i) =>
      [0, 1, 2, 3].map((c) => sample(top, i, c)),
    );
    const b = Array.from({ length: w }, (_, i) =>
      [0, 1, 2, 3].map((c) => sample(bottom, i, c)),
    );
    for (let row = 0; row < h; row++)
      for (let col = 0; col < w; col++)
        for (let c = 0; c < 4; c++)
          image.data[(row * w + col) * 4 + c] = Math.round(
            a[col][c] + (b[col][c] - a[col][c]) * (h < 2 ? 0 : row / (h - 1)),
          );
    ctx.putImageData(image, 0, 0);
    return output.toDataURL("image/png");
  } finally {
    output.width = output.height = 0;
  }
}
