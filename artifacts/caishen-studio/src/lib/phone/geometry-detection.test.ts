import { describe, expect, it } from "vitest";
import { analyseTopPixels } from "./fusion";
import { naturalPhoneSettings, applyPhoneLayers } from "./layers";
import {
  phoneGeometry,
  naturalBarRatio,
  resolveFusionSettings,
} from "./fusion-metrics";
import { phoneSettingsSchema } from "./schema";
import { BUILTIN_TEMPLATES } from "../template/builtin";

function screenshot(multiplier = 1, status = true, textured = false) {
  const width = 360 * multiplier,
    height = 200 * multiplier;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const px = x / multiplier,
        py = y / multiplier;
      const clock = px >= 16 && px < 42 && px % 7 < 4;
      const icons = px >= 274 && px < 341 && px % 9 < 5;
      const foreground =
        (status && py >= 8 && py < 16 && (clock || icons)) ||
        (py >= 48 && py < 64 && (clock || icons));
      const color = textured ? ((x + y) % 2 ? 20 : 230) : foreground ? 25 : 245;
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = color;
      data[i + 3] = 255;
    }
  return analyseTopPixels(data, width, height, {
    width,
    height: 800 * multiplier,
    sourceKey: "geometry-fixture",
  });
}

describe("uploaded screenshot status-bar sizing", () => {
  it("measures the first clock/icon row instead of a later navigation row, at both resolutions", () => {
    const a = screenshot(),
      b = screenshot(2);
    expect(a.geometry?.barRatio).toBeCloseTo(24 / 800);
    expect(a.geometry?.glyphRatio).toBeCloseTo(8 / 800);
    expect(a.geometry?.centerRatio).toBeCloseTo(12 / 800);
    expect(b.geometry).toEqual(a.geometry);
    expect(a.suggestedCover).toBeCloseTo(24 / 800);
  });
  it("shrinks iPhone safe-area geometry to the template and keeps font, icons and coverage consistent", () => {
    const settings = naturalPhoneSettings();
    settings.fusion.analysis = screenshot();
    settings.coverRatio = 0.1;
    const canvas = { width: 360, height: 800 };
    const resolved = resolveFusionSettings(settings, canvas);
    expect(resolved.coverRatio).toBeCloseTo(0.03);
    expect(naturalBarRatio(resolved, canvas)).toBeCloseTo(0.03);
    expect(phoneGeometry(resolved, canvas).bar).toBe(24);
    const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
    doc.canvas = { ...doc.canvas, ...canvas };
    const result = applyPhoneLayers(doc, resolved);
    const time = result.layers.find((l) => l.id.endsWith("_time"));
    expect(time?.type).toBe("text");
    if (time?.type === "text") expect(time.fontSize).toBeCloseTo(8 / 0.74);
    const background = result.layers.find((l) => l.id.endsWith("_background"));
    expect(background?.height).toBe(24);
    expect(result.canvas).toEqual(doc.canvas);
    const android = applyPhoneLayers(doc, {
      ...resolved,
      modelId: "galaxys24ultra",
    });
    const androidTime = android.layers.find((l) => l.id.endsWith("_time"));
    if (androidTime?.type === "text")
      expect(androidTime.fontSize).toBeCloseTo(8 / 0.74);
    expect(
      android.layers.find((l) => l.id.endsWith("_background"))?.height,
    ).toBe(24);
    const extendedCoverage = applyPhoneLayers(doc, {
      ...resolved,
      coverRatio: 0.12,
      fusion: { ...resolved.fusion, locks: ["coverage"] },
    });
    const coveredTime = extendedCoverage.layers.find((l) =>
      l.id.endsWith("_time"),
    );
    expect(coveredTime?.y).toBe(time?.y);
    expect(
      extendedCoverage.layers.find((l) => l.id.endsWith("_background"))?.height,
    ).toBe(24);

    const doubled = applyPhoneLayers(
      { ...doc, canvas: { ...doc.canvas, width: 720, height: 1600 } },
      resolved,
    );
    expect(
      doubled.layers.find((l) => l.id.endsWith("_background"))?.height,
    ).toBe(48);
  });
  it("preserves manual sizes but caps coverage at the status boundary, rejecting textured pixels as icons", () => {
    const settings = naturalPhoneSettings();
    settings.fusion.analysis = screenshot();
    settings.fusion.locks = ["geometry", "coverage"];
    settings.scale = 110;
    settings.coverRatio = 0.12;
    const resolved = resolveFusionSettings(settings, {
      width: 360,
      height: 800,
    });
    expect(resolved.scale).toBe(110);
    expect(resolved.coverRatio).toBe(0.03);
    expect(
      phoneGeometry(resolved, { width: 360, height: 800 }).contentScale,
    ).toBe(1);
    expect(screenshot(1, false, true).geometry).toBeUndefined();
    // Old backups without measurement data remain valid.
    expect(
      phoneSettingsSchema.safeParse({
        ...settings,
        fusion: {
          ...settings.fusion,
          analysis: { ...settings.fusion.analysis, geometry: undefined },
        },
      }).success,
    ).toBe(true);
  });
});
