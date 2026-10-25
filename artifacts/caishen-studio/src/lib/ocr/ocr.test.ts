import { describe, expect, it } from "vitest";
import { cleanText, isUsefulLine, mapBoxToSource, splitLineByGaps, wordsToLine, type RawWord } from "./text-utils.ts";
import { borderColor, sampleBoxStyle, type Pixels } from "./colors.ts";
import { coverMapping, estimateFontSize, linesToLayers } from "./to-layers.ts";
import type { AnalyzedLine } from "./types.ts";

const w = (text: string, x0: number, x1: number, confidence = 90, y0 = 10, y1 = 30): RawWord => ({
  text,
  confidence,
  bbox: { x0, y0, x1, y1 },
});

describe("text utils", () => {
  it("removes spaces Tesseract inserts between CJK characters but keeps Latin spaces", () => {
    expect(cleanText("春 季 新 品  发布会")).toBe("春季新品发布会");
    expect(cleanText("Hello  World 2026")).toBe("Hello World 2026");
    expect(cleanText("时间 2026-03-15 14:00")).toBe("时间 2026-03-15 14:00");
  });

  it("splits a row into separate lines at large gaps", () => {
    const groups = splitLineByGaps([w("时间", 0, 40), w("14:00", 50, 100), w("地点", 400, 440), w("中心", 445, 490)]);
    expect(groups.map((g) => g.map((x) => x.text).join(""))).toEqual(["时间14:00", "地点中心"]);
  });

  it("builds a union bbox with length-weighted confidence", () => {
    const line = wordsToLine([w("春季", 0, 40, 90), w("x", 45, 50, 30)], "id")!;
    expect(line.bbox).toEqual({ x: 0, y: 10, width: 50, height: 20 });
    expect(line.text).toBe("春季 x");
    expect(line.confidence).toBe(70);
    expect(wordsToLine([w("  ", 0, 1)], "id")).toBeNull();
  });

  it("keeps real gaps between CJK words as spaces", () => {
    // 2px gaps are glued; a 14px gap (> 0.6 × 20px line height) is a space, 8px is not.
    const line = wordsToLine([w("地", 0, 20), w("点", 22, 42), w("城", 56, 76), w("市", 84, 104)], "id")!;
    expect(line.text).toBe("地点 城市");
  });

  it("filters noise lines", () => {
    const base = { id: "a", text: "标题", confidence: 80, bbox: { x: 0, y: 0, width: 50, height: 20 } };
    expect(isUsefulLine(base)).toBe(true);
    expect(isUsefulLine({ ...base, text: "—|" })).toBe(false);
    expect(isUsefulLine({ ...base, confidence: 5 })).toBe(false);
    expect(isUsefulLine({ ...base, bbox: { ...base.bbox, height: 3 } })).toBe(false);
  });

  it("maps boxes from a scaled crop back to source pixels", () => {
    expect(mapBoxToSource({ x: 20, y: 40, width: 100, height: 50 }, 2, 100, 200)).toEqual({ x: 110, y: 220, width: 50, height: 25 });
  });
});

function makeImage(w: number, h: number, bg: [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...bg, 255], i * 4);
  return { data, width: w, height: h };
}
function fill(img: Pixels, x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img.data.set([...c, 255], (y * img.width + x) * 4);
}

describe("color sampling", () => {
  it("detects border color", () => {
    expect(borderColor(makeImage(100, 100, [247, 239, 226]))).toBe("#f7efe2");
  });

  it("finds text color, background color and uniformity", () => {
    const img = makeImage(200, 100, [255, 255, 255]);
    // "Glyph" strokes in dark red inside the box (40,40)-(160,60).
    for (let x = 40; x < 160; x += 8) fill(img, x, 40, x + 3, 60, [180, 20, 30]);
    const s = sampleBoxStyle(img, { x: 40, y: 40, width: 120, height: 20 });
    expect(s.bgColor).toBe("#ffffff");
    expect(s.color).toBe("#b4141e");
    expect(s.bgUniform).toBe(true);
    expect(s.bold).toBe(true);
  });

  it("flags a busy background as non-uniform", () => {
    const img = makeImage(200, 100, [255, 255, 255]);
    for (let x = 0; x < 200; x += 4) fill(img, x, 0, x + 2, 100, [0, 0, 0]);
    expect(sampleBoxStyle(img, { x: 60, y: 40, width: 80, height: 20 }).bgUniform).toBe(false);
  });

  it("falls back to a contrasting color when no ink is found", () => {
    const s = sampleBoxStyle(makeImage(50, 50, [10, 10, 10]), { x: 10, y: 10, width: 20, height: 10 });
    expect(s.color).toBe("#ffffff");
  });
});

const line = (over: Partial<AnalyzedLine> = {}): AnalyzedLine => ({
  id: "l1",
  text: "春季新品发布会",
  confidence: 90,
  bbox: { x: 100, y: 100, width: 600, height: 72 },
  color: "#b4141e",
  bgColor: "#f7efe2",
  bgUniform: true,
  bold: true,
  ...over,
});

describe("lines to layers", () => {
  it("maps image pixels to a resized canvas with cover scaling", () => {
    const m = coverMapping({ width: 800, height: 1000 }, { width: 400, height: 400 });
    // 800×1000 scales by 0.5 to 400×500, centered → 50px cropped off the top.
    expect(m.toCanvas({ x: 0, y: 500, width: 800, height: 10 })).toEqual({ x: 0, y: 200, width: 400, height: 5 });
    expect(m.toImage(m.toCanvas({ x: 10, y: 20, width: 30, height: 40 }))).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it("estimates font size from ink height and width", () => {
    expect(estimateFontSize("春季", 72)).toBe(80);
    expect(estimateFontSize("2026", 39)).toBe(50);
    // A tall box but narrow text: width wins (7 CJK chars in 779px ≈ 111px).
    expect(estimateFontSize("春季新品发布会", 149, 779)).toBe(111);
  });

  it("creates masks below text layers with sampled styles", () => {
    const res = linesToLayers([line(), line({ id: "l2", text: "地点", bgUniform: false, bbox: { x: 10, y: 900, width: 80, height: 20 } })], { width: 800, height: 1000 }, { width: 800, height: 1000 }, { addMasks: true });
    expect(res.textCount).toBe(2);
    expect(res.maskCount).toBe(1);
    expect(res.maskSkipped).toBe(1);
    expect(res.layers.map((l) => l.type)).toEqual(["rect", "text", "text"]);
    const mask = res.layers[0];
    expect(mask.type === "rect" && mask.isMask && mask.fill).toBe("#f7efe2");
    const t = res.layers[1];
    expect(t.type === "text" && [t.text, t.fill, t.fontWeight, t.textAlign]).toEqual(["春季新品发布会", "#b4141e", "bold", "center"]);
    const t2 = res.layers[2];
    expect(t2.type === "text" && t2.textAlign).toBe("left");
  });

  it("skips lines outside the canvas and honors addMasks=false", () => {
    const res = linesToLayers([line({ bbox: { x: 100, y: 0, width: 50, height: 20 } })], { width: 800, height: 1000 }, { width: 800, height: 400 }, { addMasks: false });
    expect(res.outside).toBe(1);
    expect(res.layers).toHaveLength(0);
  });
});
