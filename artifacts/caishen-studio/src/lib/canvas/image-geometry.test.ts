import { describe, expect, it } from "vitest";
import { computeImageGeometry } from "./image-geometry.ts";

describe("computeImageGeometry", () => {
  it("cover crops a wide image to a square box, centered", () => {
    const g = computeImageGeometry(100, 100, 400, 200, "cover", 0.5, 0.5, 1);
    expect(g).toMatchObject({ width: 200, height: 200, cropX: 100, cropY: 0, scaleX: 0.5 });
  });
  it("cover honors focus and zoom", () => {
    const g = computeImageGeometry(100, 100, 400, 200, "cover", 0, 0.5, 2);
    expect(g).toMatchObject({ width: 100, height: 100, cropX: 0, cropY: 50, scaleX: 1 });
  });
  it("contain fits the whole image", () => {
    const g = computeImageGeometry(100, 100, 400, 200, "contain", 0.5, 0.5, 1);
    expect(g).toMatchObject({ cropX: 0, width: 400, scaleX: 0.25, scaleY: 0.25 });
  });
  it("stretch scales each axis independently", () => {
    const g = computeImageGeometry(100, 50, 400, 200, "stretch", 0.5, 0.5, 1);
    expect(g).toMatchObject({ scaleX: 0.25, scaleY: 0.25 });
    expect(computeImageGeometry(100, 100, 400, 200, "stretch", 0, 0, 1).scaleY).toBe(0.5);
  });
});
