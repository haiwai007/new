import { describe, expect, it } from "vitest";
import { detectStatusGeometry } from "./geometry-detection";
import { analyseTopPixels } from "./fusion";
import { applyPhoneLayers, naturalPhoneSettings } from "./layers";
import { naturalBarRatio, resolveFusionSettings } from "./fusion-metrics";
import { settingsForModel } from "./profiles";
import { BUILTIN_TEMPLATES } from "../template/builtin";

function header(clock = true, fullHeight = 800, topContent = false) {
  const width = 400,
    height = Math.ceil(fullHeight * 0.25),
    data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const time = x >= 16 && x < 52 && x % 9 < 5;
      const icons = x >= 296 && x < 379 && x % 10 < 5;
      const status = clock && y >= 8 && y < 16 && (time || icons);
      const title = x >= 145 && x < 255 && y >= 40 && y < 55;
      const control =
        x >= 290 &&
        x < 377 &&
        y >= 30 &&
        y < 58 &&
        (y < 33 || y >= 55 || x < 293 || x > 373);
      const back = !clock && x >= 16 && x < 25 && y >= 30 && y < 46;
      const top = topContent && x >= 35 && x < 75 && y < 9;
      const i = (y * width + x) * 4,
        c = status || title || control || back || top ? 20 : 247;
      data[i] = data[i + 1] = data[i + 2] = c;
      data[i + 3] = 255;
    }
  return analyseTopPixels(data, width, height, {
    width,
    height: fullHeight,
    sourceKey: "header-fixture",
  });
}
function work() {
  const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
  doc.canvas = { ...doc.canvas, width: 400, height: 800 };
  return doc;
}
describe("protect application content below the status bar", () => {
  it("recognizes clock/icon rows in cropped templates without absorbing the title and capsule", () => {
    const analysis = header(true, 300);
    expect(analysis.geometry).toBeDefined();
    expect(analysis.confidence).toBe("high");
    expect(analysis.geometry!.barRatio * 300).toBe(24);
    expect(analysis.contentTopRatio! * 300).toBe(40);
  });
  it("does not treat a navigation back button and right-hand capsule as a clock", () => {
    const analysis = header(false);
    expect(analysis.geometry).toBeUndefined();
    expect(analysis.suggestedCover).toBe(0);
    expect(analysis.contentTopRatio! * 800).toBe(30);
    const settings = naturalPhoneSettings();
    settings.fusion.analysis = analysis;
    settings.coverRatio = 0.15;
    const result = applyPhoneLayers(work(), settings);
    expect(
      result.layers.find((l) => l.id.endsWith("_background"))!.height,
    ).toBe(24);
  });
  it("bounds saved large coverage and manual locks even when stale analysis suggests ten percent", () => {
    const doc = work(),
      before = structuredClone(doc),
      settings = naturalPhoneSettings();
    settings.fusion.analysis = { ...header(), suggestedCover: 0.1 };
    settings.coverRatio = 0.15;
    settings.fusion.locks = ["coverage", "geometry"];
    settings.scale = 150;
    settings.offsetY = 24;
    const resolved = resolveFusionSettings(settings, doc.canvas);
    expect(resolved.coverRatio).toBe(0.03);
    expect(naturalBarRatio(resolved, doc.canvas)).toBe(0.03);
    const result = applyPhoneLayers(doc, resolved);
    expect(
      result.layers.find((l) => l.id.endsWith("_background"))!.height,
    ).toBe(24);
    expect(doc).toEqual(before);
    expect(result.canvas).toEqual(doc.canvas);
  });
  it("fits optional date and carrier text inside the protected status region", () => {
    const settings = naturalPhoneSettings();
    settings.fusion.analysis = header();
    settings.showDate = settings.showCarrier = true;
    settings.showHomeIndicator = false;
    const result = applyPhoneLayers(work(), settings);
    const generated = result.layers.filter(
      (l) =>
        l.groupId === result.phone!.groupId &&
        l.visible &&
        !l.id.endsWith("_cutout"),
    );
    expect(generated.length).toBeGreaterThan(3);
    for (const layer of generated) {
      expect(layer.y).toBeGreaterThanOrEqual(0);
      expect(layer.y + layer.height).toBeLessThanOrEqual(24.001);
    }
  });
  it("refuses to overwrite content touching the top and allows explicit prepend instead", () => {
    const doc = work(),
      settings = naturalPhoneSettings();
    settings.fusion.analysis = header(false, 800, true);
    expect(settings.fusion.analysis.contentTopRatio).toBe(0);
    expect(() => applyPhoneLayers(doc, settings)).toThrow("安全状态栏区域");
    expect(
      applyPhoneLayers(doc, { ...settings, placement: "prepend" }).canvas
        .height,
    ).toBeGreaterThan(doc.canvas.height);
  });
});

it("does not automatically add a bottom gesture indicator when replacing only a status bar", () => {
  const settings = naturalPhoneSettings();
  expect(settings.showHomeIndicator).toBe(false);
  expect(settingsForModel(settings, "galaxys24ultra").showHomeIndicator).toBe(
    false,
  );
  expect(
    settingsForModel({ ...settings, showHomeIndicator: true }, "pixel9")
      .showHomeIndicator,
  ).toBe(true);
});

it("does not classify wide square navigation glyphs as clock digits", () => {
  const width = 400,
    height = 200,
    data = new Uint8ClampedArray(width * height * 4);
  data.fill(247);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  for (let y = 8; y < 22; y++)
    for (let x = 0; x < width; x++) {
      const label = x >= 16 && x < 88 && (x - 16) % 18 < 14;
      const control = x >= 300 && x < 380;
      if (label || control) {
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 20;
      }
    }
  const bands = Array.from({ length: 32 }, () => ({
    color: "#f7f7f7",
    uniformity: 1,
    noise: 0,
  }));
  expect(
    detectStatusGeometry(data, width, height, { width, height: 800 }, bands),
  ).toBeUndefined();
});

it("allocates all extra text inside the new header when prepend is explicitly selected", () => {
  for (const modelId of ["iphone16", "pixel9", "galaxys24ultra"] as const) {
    const settings = settingsForModel(naturalPhoneSettings(), modelId);
    settings.fusion.analysis = header();
    settings.scale = 150;
    settings.fusion.locks = ["geometry"];
    settings.fusion.analysis = {
      ...header(),
      geometry: { barRatio: 0.05, glyphRatio: 0.03, centerRatio: 0.025 },
    };
    settings.placement = "prepend";
    settings.showDate = settings.showCarrier = true;
    const result = applyPhoneLayers(work(), settings),
      limit = result.phone!.addedHeight;
    for (const layer of result.layers.filter(
      (l) =>
        l.groupId === result.phone!.groupId &&
        l.visible &&
        !l.id.endsWith("_cutout"),
    ))
      expect(layer.y + layer.height).toBeLessThanOrEqual(limit + 0.001);
  }
});
