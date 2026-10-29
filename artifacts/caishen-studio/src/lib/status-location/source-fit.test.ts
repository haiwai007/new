import { it, expect } from "vitest";
import { measureSourceGlyphs } from "./source-fit";
it("measures a clear clock footprint but does not invent geometry for blank or busy images", () => {
  const w = 120,
    h = 32,
    data = new Uint8ClampedArray(w * h * 4).fill(255);
  expect(measureSourceGlyphs(data, w, h)).toBeUndefined();
  for (let y = 8; y < 24; y++)
    for (let x = 5; x < 29; x++)
      for (let c = 0; c < 3; c++) data[(y * w + x) * 4 + c] = 17;
  expect(measureSourceGlyphs(data, w, h)).toEqual({
    version: 2,
    inkColor: "#111111",
    baselineRatio: 0.75,
    glyphRatio: 0.5,
    centerRatio: 0.5,
  });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (i * 17) % 255;
    data[i + 1] = (i * 31) % 255;
    data[i + 2] = (i * 59) % 255;
  }
  expect(measureSourceGlyphs(data, w, h)).toBeUndefined();
});
it.each([true, false])(
  "takes clock ink and baseline without including taller APP pixels (coloured=%s)",
  (colored) => {
    const w = 200,
      h = 40,
      data = new Uint8ClampedArray(w * h * 4).fill(247);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    for (let y = 12; y < 25; y++)
      for (let x = 8; x < 37; x++)
        for (let c = 0; c < 3; c++) data[(y * w + x) * 4 + c] = 65;
    for (let y = 4; y < 33; y++)
      for (let x = 43; x < 64; x++) {
        const i = (y * w + x) * 4;
        data[i] = colored ? 20 : 65;
        data[i + 1] = colored ? 130 : 65;
        data[i + 2] = colored ? 250 : 65;
      }
    const fit = measureSourceGlyphs(data, w, h)!;
    expect(fit.inkColor).toBe("#414141");
    expect(fit.glyphRatio).toBe(13 / 40);
    expect(fit.baselineRatio).toBe(25 / 40);
  },
);
it("measures white time lettering on a dark background", () => {
  const w = 160,
    h = 32,
    data = new Uint8ClampedArray(w * h * 4).fill(28);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  for (let y = 9; y < 23; y++)
    for (let x = 6; x < 29; x++)
      for (let c = 0; c < 3; c++) data[(y * w + x) * 4 + c] = 235;
  expect(measureSourceGlyphs(data, w, h)?.inkColor).toBe("#ebebeb");
});
