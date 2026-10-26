import { describe, expect, it } from "vitest";
import { analyseTopPixels } from "./fusion";
import {
  designKey,
  fusionWarnings,
  gradientStops,
  naturalAppCapacity,
  resolveFusionSettings,
} from "./fusion-metrics";
import {
  defaultPhoneSettings,
  naturalPhoneSettings,
  applyPhoneLayers,
  removePhoneLayers,
} from "./layers";
import { effectiveProfile, settingsForModel } from "./profiles";
import { phoneSettingsSchema } from "./schema";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import { loadTemplateDoc } from "../template/migrate";
const base = () => structuredClone(BUILTIN_TEMPLATES[0].doc);
function pixels(mode: "flat" | "gradient" | "complex", old = false) {
  const w = 160,
    h = 320,
    data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let color =
        mode === "flat"
          ? 230
          : mode === "gradient"
            ? Math.round(25 + y * 0.5)
            : (x + y) % 2
              ? 240
              : 20;
      if (old && x > 8 && x < 25 && y > 15 && y < 35) color = 10;
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = color;
      data[i + 3] = 255;
    }
  return analyseTopPixels(data, w, h, {
    width: 600,
    height: 1280,
    sourceKey: "fixture",
  });
}
describe("natural status-bar fitting", () => {
  it("distinguishes flat, gradient and textured backgrounds instead of painting every image white", () => {
    expect(pixels("flat")).toMatchObject({
      kind: "flat",
      top: "#e6e6e6",
      lightIcons: false,
      suspectedOldBar: false,
    });
    expect(pixels("gradient").kind).toBe("gradient");
    expect(pixels("complex").kind).toBe("complex");
    expect(pixels("flat", true).suspectedOldBar).toBe(true);
    expect(pixels("flat", true).suggestedCover).toBeLessThanOrEqual(0.1);
  });
  it("retains manual color, background, coverage and geometry during automatic fitting", () => {
    const settings = {
      ...naturalPhoneSettings(),
      theme: "light" as const,
      customColor: "#ff0000",
      coverRatio: 0.12,
      backgroundColor: "#332211",
      scale: 110,
    };
    settings.fusion = {
      ...settings.fusion,
      analysis: pixels("flat", true),
      locks: ["color", "background", "coverage", "geometry"],
    };
    const next = resolveFusionSettings(settings, { width: 600, height: 1280 });
    expect(next).toMatchObject({
      theme: "light",
      customColor: "#ff0000",
      backgroundColor: "#332211",
      coverRatio: 0.12,
      scale: 110,
    });
    expect(settingsForModel(next, "pixel9").scale).toBe(110);
    expect(fusionWarnings({...next,customColor:"#332211",backgroundColor:"#332211",transparent:false}).join()).toContain("清晰度");
    const uncertain=naturalPhoneSettings();uncertain.fusion.analysis={...pixels("flat",true),confidence:"low"};
    expect(resolveFusionSettings(uncertain,{width:600,height:1280}).coverRatio).toBe(0);
  });
  it("uses distinct version profiles, constrains incompatible versions and retains original entered values", () => {
    const p = naturalPhoneSettings();
    p.styleId = "oneui6";
    p.modelId = "galaxys24";
    p.time = "13:08";
    expect(effectiveProfile(p).battery).toBe("vertical");
    expect(effectiveProfile({ ...p, styleId: "oneui7" }).battery).toBe(
      "horizontal",
    );
    const switched = settingsForModel(p, "iphone16");
    expect(switched.styleId).toBe("auto");
    expect(switched.time).toBe("13:08");
    expect(effectiveProfile(switched).label).toContain("iOS 18");
  });
  it("only invalidates analysis when visible top pixels can change", () => {
    const a = base();
    const key = designKey(a);
    a.name = "另一个名称";
    a.parameters = a.parameters.map((p) => ({ ...p, name: "自定义名称" }));
    expect(designKey(a)).toBe(key);
    a.canvas.backgroundColor = "#123456";
    expect(designKey(a)).not.toBe(key);
    const b = base();
    b.layers = b.layers.map((l) =>
      l.y > b.canvas.height * 0.5 ? { ...l, opacity: 0.2 } : l,
    );
    expect(designKey(b)).toBe(designKey(base()));
  });
  it("does not change legacy documents just because the new fields exist", () => {
    const legacy = defaultPhoneSettings() as unknown as Record<string, unknown>;
    delete legacy.rendering;
    delete legacy.fusion;
    delete legacy.styleId;
    delete legacy.customAppStyle;
    const loaded = phoneSettingsSchema.parse(legacy);
    expect(loaded.rendering).toBe("legacy");
    expect(loaded.fusion.enabled).toBe(false);
    expect(applyPhoneLayers(base(), loaded).layers).toEqual(
      applyPhoneLayers(base(), {
        ...defaultPhoneSettings(),
        groupId: loaded.groupId,
      }).layers,
    );
  });
  it("serializes gradients and alpha tints as portable ordinary image layers", () => {
    const p = naturalPhoneSettings();
    p.fusion.analysis = pixels("gradient");
    p.appIcons = [
      {
        id: "app_aaaaaaaaaa",
        name: "通知",
        kind: "custom",
        visible: true,
        src: { kind: "asset", assetId: "custom" },
      },
    ];
    p.customAppStyle = "mono";
    const doc = applyPhoneLayers(base(), p);
    const bg = doc.layers.find(
      (l) => l.id === `${doc.phone!.groupId}_background`,
    )!;
    expect(bg.type).toBe("image");
    if (bg.type === "image" && bg.src?.kind === "url")
      expect(decodeURIComponent(bg.src.url)).toContain("linearGradient");
    expect(
      doc.layers.find((l) => l.id.endsWith("_app_app_aaaaaaaaaa")),
    ).toMatchObject({ tint: "#ffffff" });
    const loaded = loadTemplateDoc(JSON.parse(JSON.stringify(doc)));
    expect(loaded.ok).toBe(true);
    expect(removePhoneLayers(doc).layers).toEqual(base().layers);
  });
  it("extends gradients to meet the original top color when adding new space", () => {
    const data = pixels("gradient"),
      stops = gradientStops(data, 0.07, "prepend");
    expect(stops.bottom).toBe(data.top);
    expect(stops.top).not.toBe(stops.bottom);
  });
  it("rejects overcrowded natural layouts while preserving legacy behavior", () => {
    const p = naturalPhoneSettings(),
      capacity = naturalAppCapacity(p);
    p.appIcons = Array.from({ length: capacity + 1 }, (_, i) => ({
      id: `app_${String(i).padStart(10, "0")}`,
      kind: "builtin" as const,
      builtinId: "wechat" as const,
      name: "通知",
      visible: true,
    }));
    expect(() => applyPhoneLayers(base(), p)).toThrow(/容纳/);
    expect(() =>
      applyPhoneLayers(base(), {
        ...p,
        rendering: "legacy",
        fusion: { ...p.fusion, enabled: false },
      }),
    ).not.toThrow();
  });
});

it("preserve mode keeps existing drawn layers without reanalysing or upgrading them", async () => {
  const { drawingRules } = await import("../batch/phone-rules");
  const { generateItems } = await import("../batch/rules");
  const { prepareFusionItems } = await import("../batch/fusion");
  const p = naturalPhoneSettings();
  const doc = applyPhoneLayers(base(), p),
    rules = drawingRules(p);
  rules.setup!.mode = "keep";
  const items = generateItems(doc, {}, 1, 42, rules);
  expect(items[0].preservePhone).toBe(true);
  const ready = await prepareFusionItems(items);
  expect(ready[0].errors).toEqual([]);
  expect(ready[0].doc.layers).toEqual(doc.layers);
  expect(ready[0].doc.phone!.fusion.analysis).toBeNull();
});
