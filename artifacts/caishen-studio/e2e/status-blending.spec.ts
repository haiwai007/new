import { test, expect } from "@playwright/test";
import { boundaryBackground } from "../src/lib/status-location/background";
import { normalizeIconCanvas } from "../src/lib/phone/app-icon-normalize";
test("smooth background patches follow gradients, remove isolated edge ink and flag complex texture without touching the source", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async (source) => {
    const reconstruct = new Function("__name", `return (${source})`)(
      (fn: unknown) => fn,
    ) as typeof boundaryBackground;
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 90;
    const ctx = c.getContext("2d")!;
    const data = ctx.createImageData(200, 90);
    for (let y = 0; y < 90; y++)
      for (let x = 0; x < 200; x++) {
        const i = (y * 200 + x) * 4;
        data.data[i] = 220 + x * 0.05 + y * 0.15;
        data.data[i + 1] = 230 + y * 0.1;
        data.data[i + 2] = 240;
        data.data[i + 3] = 255;
      }
    ctx.putImageData(data, 0, 0);
    ctx.fillStyle = "#111";
    ctx.fillRect(70, 17, 2, 1);
    const before = ctx.getImageData(0, 0, 200, 90).data;
    const patch = reconstruct(c, { x: 0, y: 0.2, width: 1, height: 0.4 })!;
    const image = new Image();
    image.src = patch;
    await image.decode();
    const out = document.createElement("canvas");
    out.width = 200;
    out.height = 36;
    out.getContext("2d")!.drawImage(image, 0, 0);
    const pixels = out.getContext("2d")!.getImageData(0, 0, 200, 36).data;
    let error = 0;
    for (let y = 0; y < 36; y++)
      for (let x = 0; x < 200; x++)
        for (let k = 0; k < 3; k++)
          error = Math.max(
            error,
            Math.abs(
              pixels[(y * 200 + x) * 4 + k] -
                before[((y + 18) * 200 + x) * 4 + k],
            ),
          );
    const after = ctx.getImageData(0, 0, 200, 90).data;
    const unchanged = before.every((v, i) => v === after[i]);
    for (let y = 20; y < 52; y++)
      for (let x = 0; x < 200; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#111" : "#eee";
        ctx.fillRect(x, y, 1, 1);
      }
    return {
      error,
      unchanged,
      complex:
        reconstruct(c, { x: 0, y: 0.2, width: 1, height: 0.4 }) === undefined,
    };
  }, boundaryBackground.toString());
  expect(result.unchanged).toBe(true);
  expect(result.error).toBeLessThanOrEqual(4);
  expect(result.complex).toBe(true);
});
test("custom notification icons keep their colour and aspect ratio while transparent padding is normalized", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate((source) => {
    const normalize = new Function("__name", `return (${source})`)(
      (fn: unknown) => fn,
    ) as typeof normalizeIconCanvas;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const empty = normalize(c) === undefined;
    ctx.fillStyle = "#e73c53";
    ctx.fillRect(50, 40, 10, 20);
    const out = normalize(c)!;
    const data = out.getContext("2d")!.getImageData(0, 0, 128, 128).data;
    let l = 128,
      t = 128,
      r = 0,
      b = 0;
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++)
        if (data[(y * 128 + x) * 4 + 3] > 200) {
          l = Math.min(l, x);
          t = Math.min(t, y);
          r = Math.max(r, x + 1);
          b = Math.max(b, y + 1);
        }
    const mid = (64 * 128 + 64) * 4;
    return {
      empty,
      width: r - l,
      height: b - t,
      color: Array.from(data.slice(mid, mid + 4)),
      originalAlpha: ctx
        .getImageData(0, 0, 128, 128)
        .data.filter((_, i) => i % 4 === 3)
        .filter((v) => v > 200).length,
    };
  }, normalizeIconCanvas.toString());
  expect(result.empty).toBe(true);
  expect(result.width / result.height).toBeCloseTo(0.5, 1);
  expect(result.height).toBeGreaterThan(110);
  expect(result.height).toBeLessThanOrEqual(128);
  expect(result.color).toEqual([231, 60, 83, 255]);
  expect(result.originalAlpha).toBe(200);
});
