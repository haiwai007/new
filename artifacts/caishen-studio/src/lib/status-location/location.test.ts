import { designKey } from "../phone/fusion-metrics";
import { fusionReady } from "../phone/fusion";
import { describe, it, expect } from "vitest";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import { createTextLayer, createImageLayer } from "../template/layers";
import { loadTemplateDoc } from "../template/migrate";
import {
  remapAssetIds,
  buildPackage,
  parseTemplateFile,
} from "../template/package";
import { resizeDoc } from "../template/smart-resize";
import {
  applyPhoneLayers,
  naturalPhoneSettings,
  removePhoneLayers,
} from "../phone/layers";
import { generateItems } from "../batch/rules";
import { drawingRules } from "../batch/phone-rules";
import {
  defaultStatusLocation,
  isLocationConfirmed,
  invalidateLocation,
  locationSourceKey,
  locationTestKey,
  locationAppCapacity,
} from "./model";
import { locationGeometryErrors } from "./schema";
import { useEditor } from "@/stores/editor";
function confirmed() {
  const doc = structuredClone(
    BUILTIN_TEMPLATES.find((t) => t.id === "blank_portrait")!.doc,
  );
  doc.canvas = {
    ...doc.canvas,
    width: 400,
    height: 800,
    backgroundImage: { kind: "asset", assetId: "original" },
  };
  const l = defaultStatusLocation(doc);
  l.bounds = { x: 0, y: 0.03, width: 1, height: 0.05 };
  l.time = { x: 0.025, y: 0.035, width: 0.13, height: 0.03 };
  l.apps = { x: 0.17, y: 0.035, width: 0.26, height: 0.03 };
  l.system = { x: 0.6, y: 0.035, width: 0.375, height: 0.03 };
  l.sourceKey = locationSourceKey(doc, l.bounds);
  l.fills = ["time", "apps", "system"].map((role) => ({
    role: role as "time" | "apps" | "system",
    top: "#f7f7f7",
    bottom: "#f7f7f7",
  }));
  l.state = "confirmed";
  l.testKey = locationTestKey(l);
  doc.statusLocation = l;
  return doc;
}
describe("template-bound status locations", () => {
  it("keeps old templates readable without adding phone layers", () => {
    const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
    const result = loadTemplateDoc(doc);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc.statusLocation).toBeUndefined();
  });
  it("rejects overlapping, protected, out-of-bound and untested replacements", () => {
    const doc = confirmed();
    expect(isLocationConfirmed(doc)).toBe(true);
    const overlap = {
      ...doc.statusLocation!,
      system: doc.statusLocation!.time,
    };
    expect(locationGeometryErrors(overlap).length).toBeGreaterThan(0);
    const protectedTime = {
      ...doc.statusLocation!,
      protected: [doc.statusLocation!.time],
    };
    expect(locationGeometryErrors(protectedTime).length).toBeGreaterThan(0);
    expect(() =>
      applyPhoneLayers(
        { ...doc, statusLocation: { ...doc.statusLocation!, testKey: "fake" } },
        naturalPhoneSettings(),
      ),
    ).toThrow("定位未确认");
    expect(() =>
      applyPhoneLayers(
        {
          ...doc,
          statusLocation: { ...doc.statusLocation!, state: "pending" },
        },
        naturalPhoneSettings(),
      ),
    ).toThrow("定位未确认");
  });
  it("places time at the saved original row and never changes canvas or source pixels", () => {
    const doc = confirmed(),
      before = structuredClone(doc),
      settings = naturalPhoneSettings();
    settings.modelId = "galaxys24ultra";
    const result = applyPhoneLayers(doc, settings),
      time = result.layers.find((l) => l.id.endsWith("_time"))!;
    expect(time.y).toBeCloseTo(28);
    expect(time.height).toBeCloseTo(24);
    expect(time.x).toBeCloseTo(10);
    expect(result.canvas).toEqual(doc.canvas);
    expect(doc).toEqual(before);
    expect(removePhoneLayers(result)).toEqual(doc);
    const second = applyPhoneLayers(result, { ...settings, time: "22:30" });
    expect(second.layers.filter((l) => l.id.endsWith("_time"))).toHaveLength(1);
    expect(second.layers.find((l) => l.id.endsWith("_time"))!.y).toBe(time.y);
  });
  it("invalidates source changes in the region but retains body edits and names", () => {
    const doc = confirmed();
    const outside = {
      ...doc,
      name: "renamed",
      layers: [
        createTextLayer(
          { x: 10, y: 500, width: 200, height: 50 },
          { text: "正文变化" },
        ),
      ],
    };
    expect(isLocationConfirmed(outside)).toBe(true);
    const changed = {
      ...doc,
      layers: [
        createTextLayer(
          { x: 10, y: 28, width: 80, height: 24 },
          { text: "改动原时间" },
        ),
      ],
    };
    expect(invalidateLocation(changed).statusLocation!.state).toBe("stale");
    expect(() => applyPhoneLayers(changed, naturalPhoneSettings())).toThrow(
      "失效",
    );
    expect(
      isLocationConfirmed({
        ...doc,
        canvas: {
          ...doc.canvas,
          backgroundImage: { kind: "asset", assetId: "new-image" },
        },
      }),
    ).toBe(false);
  });
  it("keeps uniform scale bindings and invalidates changed aspect ratios", () => {
    const doc = confirmed();
    const larger = resizeDoc(doc, 800, 1600, "scale");
    expect(isLocationConfirmed(larger)).toBe(true);
    const rendered = applyPhoneLayers(larger, naturalPhoneSettings());
    expect(rendered.layers.find((l) => l.id.endsWith("_time"))!.y).toBeCloseTo(
      56,
    );
    expect(resizeDoc(doc, 800, 1200, "scale").statusLocation!.state).toBe(
      "stale",
    );
  });
  it("preserves confirmations through portable files and trusted asset ID remapping", () => {
    const doc = confirmed();
    const parsed = parseTemplateFile(
      JSON.parse(JSON.stringify(buildPackage(doc, []))),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(isLocationConfirmed(parsed.doc)).toBe(true);
    const restored = remapAssetIds(
      doc,
      new Map([["original", "restored-image"]]),
    );
    expect(isLocationConfirmed(restored)).toBe(true);
    expect(restored.statusLocation!.sourceKey).not.toBe(
      doc.statusLocation!.sourceKey,
    );
  });
  it("supports undo and redo of confirmation without changing template source", () => {
    const doc = confirmed();
    useEditor.getState().load("test-locator", doc);
    useEditor.getState().commit({
      ...doc,
      statusLocation: {
        ...doc.statusLocation!,
        state: "pending",
        testKey: "",
      },
    });
    expect(useEditor.getState().doc!.statusLocation!.state).toBe("pending");
    useEditor.getState().undo();
    expect(isLocationConfirmed(useEditor.getState().doc!)).toBe(true);
    useEditor.getState().redo();
    expect(useEditor.getState().doc!.statusLocation!.state).toBe("pending");
    useEditor.getState().reset();
  });
  it("reuses confirmed positions for seeded batch rules without moving or mutating the template", () => {
    const doc = confirmed(),
      before = structuredClone(doc),
      rules = drawingRules(naturalPhoneSettings());
    rules.enabled = true;
    rules.time = { enabled: true, start: "22:00", end: "02:00" };
    rules.battery = { enabled: true, min: 30, max: 90 };
    const items = generateItems(doc, {}, 8, 17, rules);
    expect(items.every((item) => !item.errors.length)).toBe(true);
    expect(new Set(items.map((i) => i.doc.phone!.time)).size).toBeGreaterThan(
      1,
    );
    for (const item of items)
      expect(
        item.doc.layers.find((l) => l.id.endsWith("_time"))!.y,
      ).toBeCloseTo(28);
    expect(doc).toEqual(before);
    expect(locationAppCapacity(doc)).toBeGreaterThan(0);
  });
});

it("keeps confirmations after schema field reordering for image and text source layers", () => {
  const doc = confirmed();
  doc.layers = [
    createImageLayer(
      { x: 0, y: 0, width: 400, height: 800 },
      { kind: "asset", assetId: "layer-image" },
    ),
    createTextLayer({ x: 12, y: 28, width: 45, height: 24 }, { text: "20:06" }),
  ];
  doc.statusLocation!.sourceKey = locationSourceKey(
    doc,
    doc.statusLocation!.bounds,
  );
  doc.statusLocation!.testKey = locationTestKey(doc.statusLocation!);
  const parsed = loadTemplateDoc(JSON.parse(JSON.stringify(doc)));
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(isLocationConfirmed(parsed.doc)).toBe(true);
});

it("rejects exports when phone settings or generated pixels no longer match the confirmed render", () => {
  const located = applyPhoneLayers(confirmed(), naturalPhoneSettings());
  expect(fusionReady(located)).toBe(true);
  expect(
    fusionReady({ ...located, phone: { ...located.phone!, time: "23:59" } }),
  ).toBe(false);
  expect(
    fusionReady({
      ...located,
      layers: located.layers.map((l) =>
        l.id.endsWith("_time") ? { ...l, y: l.y + 40 } : l,
      ),
    }),
  ).toBe(false);
  const restored = remapAssetIds(located, new Map([["original", "fresh-id"]]));
  expect(fusionReady(restored)).toBe(true);
  const old = structuredClone(located);
  delete old.statusLocation;
  old.phone!.fusion.analysis = {
    sourceKey: designKey(removePhoneLayers(old)),
    width: 400,
    height: 800,
    kind: "flat",
    top: "#f7f7f7",
    bottom: "#f7f7f7",
    lightIcons: false,
    contrast: 18,
    suspectedOldBar: true,
    suggestedCover: 0.08,
    confidence: "high",
    bands: Array.from({ length: 4 }, () => ({
      color: "#f7f7f7",
      uniformity: 1,
      noise: 0,
    })),
  };
  expect(fusionReady(old)).toBe(false);
});

it("rejects enlarged APP icons that would leave their authorized small region", () => {
  const doc = confirmed();
  doc.statusLocation!.apps!.width = 0.12;
  doc.statusLocation!.testKey = locationTestKey(doc.statusLocation!);
  const phone = naturalPhoneSettings();
  phone.appIconSize = 20;
  phone.appIcons = ["wechat", "qq"].map((id, i) => ({
    id: `app_capacity0${i}`,
    kind: "builtin" as const,
    builtinId: id as "wechat" | "qq",
    name: id,
    visible: true,
  }));
  expect(locationAppCapacity(doc, 100, phone.appIconGap / 20, 20 / 12)).toBe(1);
  expect(() => applyPhoneLayers(doc, phone)).toThrow("超出模板定位空间");
  phone.appIcons = phone.appIcons.slice(0, 1);
  const result = applyPhoneLayers(doc, phone);
  const app = result.layers.find((l) => l.id.includes("_app_"))!;
  expect(app.x + app.width).toBeLessThanOrEqual(
    (doc.statusLocation!.apps!.x + doc.statusLocation!.apps!.width) *
      doc.canvas.width,
  );
  expect(() => applyPhoneLayers(doc, { ...phone, showDate: true })).toThrow(
    "没有日期区域",
  );
  expect(() => applyPhoneLayers(doc, { ...phone, showCarrier: true })).toThrow(
    "没有运营商区域",
  );
});
