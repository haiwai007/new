import { describe, expect, it } from "vitest";
import { anchorFor, resizeDoc } from "../template/smart-resize.ts";
import { resizeCanvas } from "../template/doc-ops.ts";
import { createImageLayer, createShapeLayer, createTextLayer } from "../template/layers.ts";
import { clusterMask, inpaint, planClusters } from "./inpaint.ts";
import { canvasBoxesToImage, layerBounds, repairCandidates } from "./regions.ts";
import { detailCenter, focusForPoint } from "../canvas/smart-focus.ts";
import { loadTemplateDoc } from "../template/migrate.ts";
import { SCHEMA_VERSION, type Layer, type TemplateDoc } from "../../types/template.ts";

function docOf(layers: Layer[], w = 1000, h = 1000): TemplateDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    templateId: "t",
    name: "t",
    canvas: { width: w, height: h, backgroundColor: "#fff", backgroundImage: null },
    layers,
    parameters: [],
    source: null,
  };
}

/** Solid-color RGBA image, optionally with a vertical gradient on red. */
function image(w: number, h: number, fn: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const o = (y * w + x) * 4;
      data.set([r, g, b, 255], o);
    }
  }
  return { data, width: w, height: h };
}

describe("smart resize", () => {
  it("anchors by which third the center falls in", () => {
    expect(anchorFor(0, 100, 1000)).toBe("start");
    expect(anchorFor(450, 100, 1000)).toBe("center");
    expect(anchorFor(900, 100, 1000)).toBe("end");
  });

  it("stretches full-bleed layers and keeps edge distances for others", () => {
    const bg = createShapeLayer("rect", { x: 0, y: 0, width: 1000, height: 1000 });
    const logo = createShapeLayer("rect", { x: 40, y: 40, width: 100, height: 100 });
    const badge = createShapeLayer("rect", { x: 860, y: 860, width: 100, height: 100 });
    const title = createTextLayer({ x: 300, y: 450, width: 400, height: 100 }, { fontSize: 60 });
    const out = resizeDoc(docOf([bg, logo, badge, title]), 1000, 2000, "smart");
    const [b, l, k, t] = out.layers;
    // Background covers the whole new canvas.
    expect(b).toMatchObject({ x: 0, y: 0, width: 1000, height: 2000 });
    // Scale = min(1, 2) = 1, so the logo stays put and the badge keeps 40px to the bottom-right.
    expect(l).toMatchObject({ x: 40, y: 40, width: 100, height: 100 });
    expect(k).toMatchObject({ x: 860, y: 2000 - 40 - 100 });
    // Centered title stays centered vertically.
    expect(t.y + t.height / 2).toBeCloseTo(1000);
    expect(t.type === "text" && t.fontSize).toBe(60);
  });

  it("scales fonts, strokes and radius with the uniform factor", () => {
    const rect = { ...createShapeLayer("rect", { x: 0, y: 0, width: 100, height: 100 }), strokeWidth: 4, radius: 10 };
    const text = createTextLayer({ x: 100, y: 100, width: 200, height: 50 }, { fontSize: 40, minFontSize: 20, letterSpacing: 2 });
    const out = resizeDoc(docOf([rect, text]), 500, 500, "smart");
    const [r, t] = out.layers;
    expect(r.type === "rect" && [r.strokeWidth, r.radius]).toEqual([2, 5]);
    expect(t.type === "text" && [t.fontSize, t.minFontSize, t.letterSpacing]).toEqual([20, 10, 1]);
  });

  it("leaves fixed layers alone and 'none' only changes the canvas", () => {
    const fixed = { ...createShapeLayer("rect", { x: 10, y: 10, width: 50, height: 50 }), layout: "fixed" as const };
    const d = docOf([fixed]);
    expect(resizeDoc(d, 300, 300, "smart").layers[0]).toBe(fixed);
    const none = resizeDoc(docOf([createShapeLayer("rect", { x: 1, y: 2, width: 3, height: 4 })]), 300, 200, "none");
    expect(none.canvas).toMatchObject({ width: 300, height: 200 });
    expect(none.layers[0]).toMatchObject({ x: 1, y: 2, width: 3, height: 4 });
  });

  it("keeps the old resizeCanvas behaviour", () => {
    const out = resizeCanvas(docOf([createTextLayer({ x: 200, y: 100, width: 200, height: 50 }, { fontSize: 40 })]), 2000, 2000, true);
    expect(out.layers[0]).toMatchObject({ x: 400, width: 400 });
  });
});

describe("inpaint", () => {
  it("restores a flat background exactly", () => {
    const img = image(40, 30, () => [200, 30, 40]);
    const mask = new Uint8Array(40 * 30);
    for (let y = 10; y < 20; y++) for (let x = 10; x < 30; x++) {
      mask[y * 40 + x] = 1;
      img.data.set([0, 0, 0, 255], (y * 40 + x) * 4); // "old text"
    }
    expect(inpaint(img, mask)).toBe(200);
    for (let i = 0; i < 40 * 30; i++) expect([img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]]).toEqual([200, 30, 40]);
  });

  it("follows a linear gradient closely", () => {
    const img = image(30, 60, (_x, y) => [y * 4, 100, 100]);
    const mask = new Uint8Array(30 * 60);
    for (let y = 20; y < 40; y++) for (let x = 8; x < 22; x++) {
      mask[y * 30 + x] = 1;
      img.data[(y * 30 + x) * 4] = 255;
    }
    inpaint(img, mask, { iterations: 400 });
    for (let y = 20; y < 40; y++) expect(Math.abs(img.data[(y * 30 + 15) * 4] - y * 4)).toBeLessThan(6);
  });

  it("does nothing without holes and rejects bad masks", () => {
    const img = image(4, 4, () => [1, 2, 3]);
    expect(inpaint(img, new Uint8Array(16))).toBe(0);
    expect(() => inpaint(img, new Uint8Array(3))).toThrow();
  });

  it("merges regions whose margins overlap and drops ones outside the image", () => {
    const c = planClusters(
      [
        { x: 10, y: 10, width: 20, height: 10 },
        { x: 35, y: 10, width: 20, height: 10 },
        { x: 300, y: 300, width: 20, height: 10 },
        { x: 5000, y: 5000, width: 10, height: 10 },
      ],
      400,
      400,
    );
    expect(c).toHaveLength(2);
    expect(c[0].holes).toHaveLength(2);
    const mask = clusterMask(c[1]);
    expect(mask.reduce((s, v) => s + v, 0)).toBe(200);
  });
});

describe("repair regions", () => {
  it("lists masks and visible text, not images or hidden text", () => {
    const mask = createShapeLayer("rect", { x: 0, y: 0, width: 10, height: 10 }, { isMask: true });
    const text = createTextLayer({ x: 0, y: 0, width: 10, height: 10 });
    const hidden = { ...createTextLayer({ x: 0, y: 0, width: 10, height: 10 }), visible: false };
    const img = createImageLayer({ x: 0, y: 0, width: 10, height: 10 }, null);
    const shape = createShapeLayer("rect", { x: 0, y: 0, width: 10, height: 10 });
    expect(repairCandidates(docOf([mask, text, hidden, img, shape])).map((c) => c.kind)).toEqual(["mask", "text"]);
  });

  it("uses rotated bounds", () => {
    const b = layerBounds({ x: 0, y: 0, width: 100, height: 20, rotation: 90 });
    expect(b.x).toBeCloseTo(-20);
    expect(b.width).toBeCloseTo(20);
    expect(b.height).toBeCloseTo(100);
  });

  it("maps canvas boxes onto a cover-fitted background", () => {
    // 2000×1000 image covering a 1000×1000 canvas: scale 1, 500px cropped on the left.
    const [r] = canvasBoxesToImage([{ x: 0, y: 100, width: 100, height: 50 }], { width: 2000, height: 1000 }, { width: 1000, height: 1000 });
    expect(r).toEqual({ x: 500, y: 100, width: 100, height: 50 });
  });
});

describe("smart focus", () => {
  it("finds detail on one side of a plain image", () => {
    const img = image(60, 40, (x, y) => (x > 44 && (x + y) % 2 === 0 ? [0, 0, 0] : [240, 240, 240]));
    const p = detailCenter(img);
    expect(p.x).toBeGreaterThan(0.7);
    expect(Math.abs(p.y - 0.5)).toBeLessThan(0.15);
    expect(detailCenter(image(10, 10, () => [9, 9, 9]))).toEqual({ x: 0.5, y: 0.5 });
  });

  it("converts a point to crop focus, clamped to the image", () => {
    // 2000×1000 image into a square box: crop is 1000 wide, 1000px of horizontal play.
    expect(focusForPoint({ x: 0.75, y: 0.5 }, 100, 100, 2000, 1000)).toEqual({ x: 1, y: 0.5 });
    expect(focusForPoint({ x: 0.5, y: 0.5 }, 100, 100, 2000, 1000).x).toBeCloseTo(0.5);
    expect(focusForPoint({ x: 0.4, y: 0.9 }, 100, 100, 2000, 1000).x).toBeCloseTo(0.3);
  });

  it("is off for documents saved before the option existed", () => {
    const legacy = createImageLayer({ x: 0, y: 0, width: 10, height: 10 }, null) as Partial<Layer>;
    delete (legacy as { autoFocus?: boolean }).autoFocus;
    const res = loadTemplateDoc(docOf([legacy as Layer]));
    const l = res.ok ? res.doc.layers[0] : null;
    expect(l?.type === "image" && l.autoFocus).toBe(false);
  });
});
