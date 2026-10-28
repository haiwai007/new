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
