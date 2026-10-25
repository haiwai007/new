import { describe, expect, it } from "vitest";
import { analyseStrip, matchPatch } from "./match";

function strip(colors: [number, number, number][]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(colors.length * 4);
  colors.forEach(([r, g, b], i) => data.set([r, g, b, 255], i * 4));
  return data;
}

describe("status bar colour matching", () => {
  it("covers a flat light background with an opaque bar and dark icons, ignoring old text pixels", () => {
    const pixels: [number, number, number][] = [
      ...Array.from({ length: 90 }, () => [248, 248, 248] as [number, number, number]),
      ...Array.from({ length: 10 }, () => [20, 20, 20] as [number, number, number]),
    ];
    const sample = analyseStrip(strip(pixels))!;
    expect(sample.uniform).toBe(true);
    expect(sample.lightIcons).toBe(false);
    expect(sample.background).toBe("#f8f8f8");
    expect(matchPatch(sample)).toMatchObject({ theme: "dark", transparent: false, backgroundColor: "#f8f8f8" });
  });

  it("uses white icons on dark backgrounds", () => {
    const sample = analyseStrip(strip(Array.from({ length: 50 }, () => [17, 24, 39])))!;
    expect(sample.lightIcons).toBe(true);
    expect(matchPatch(sample).theme).toBe("light");
  });

  it("keeps busy photos visible with a transparent bar", () => {
    const pixels = Array.from({ length: 200 }, (_, i) => [(i * 37) % 256, (i * 91) % 256, (i * 53) % 256] as [number, number, number]);
    const sample = analyseStrip(strip(pixels))!;
    expect(sample.uniform).toBe(false);
    expect(matchPatch(sample).transparent).toBe(true);
  });

  it("returns null for fully transparent pixels", () => {
    expect(analyseStrip(new Uint8ClampedArray(16))).toBeNull();
  });
});
