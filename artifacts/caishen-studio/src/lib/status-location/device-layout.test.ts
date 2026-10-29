import { describe, it, expect } from "vitest";
import { DEVICE_LAYOUTS } from "../phone/device-layouts";
import { PHONE_MODELS } from "../phone/models";
import type { SystemStyleId } from "../phone/system-styles";
import { naturalPhoneSettings, applyPhoneLayers } from "../phone/layers";
import { settingsForModel } from "../phone/profiles";
import {
  defaultStatusLocation,
  locationTestKey,
  isLocationConfirmed,
} from "./model";
import { locationPixelMask, restoreOutsideLocation } from "./pixel-mask";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import { loadTemplateDoc } from "../template/migrate";

function fixture() {
  const doc = structuredClone(
    BUILTIN_TEMPLATES.find((t) => t.id === "blank_portrait")!.doc,
  );
  doc.canvas = { ...doc.canvas, width: 400, height: 800 };
  const l = defaultStatusLocation(doc);
  l.bounds = { x: 0.02, y: 0.015, width: 0.96, height: 0.045 };
  l.layout = "device";
  l.approval = "direct";
  l.state = "confirmed";
  l.fills = ["time", "apps", "system"].map((role) => ({
    role: role as "time" | "apps" | "system",
    top: "#ffffff",
    bottom: "#eeeeee",
  }));
  l.testKey = locationTestKey(l);
  doc.statusLocation = l;
  return doc;
}
describe("per-device outer-frame layouts", () => {
  it("has 100 explicit independent model records, supported versions and honest calibration status", () => {
    expect(PHONE_MODELS).toHaveLength(100);
    expect(Object.keys(DEVICE_LAYOUTS)).toHaveLength(100);
    for (const model of PHONE_MODELS) {
      const record = DEVICE_LAYOUTS[model.id];
      expect(record.modelId).toBe(model.id);
      expect(record.referenceSize).toEqual([model.width, model.height]);
      expect(record.versions[record.defaultStyle]).toBeDefined();
      expect(["reference", "partial", "calibrated"]).toContain(record.calibration);
    }
    expect(new Set(Object.values(DEVICE_LAYOUTS)).size).toBe(100);
  });
  it("fits every model/version inside narrow and tall frames, even with eight APPs and extra rows", () => {
    for (const model of PHONE_MODELS)
      for (const styleId of Object.keys(
        DEVICE_LAYOUTS[model.id].versions,
      ) as SystemStyleId[])
        for (const height of [0.018, 0.06]) {
          const doc = fixture();
          doc.statusLocation!.bounds.height = height;
          doc.statusLocation!.testKey = locationTestKey(doc.statusLocation!);
          const phone = {
            ...settingsForModel(naturalPhoneSettings(), model.id),
            styleId,
            offsetY: 30,
            showDate: true,
            showCarrier: true,
            carrier: "中国移动",
            timeFormat: "12h" as const,
            time: "23:59",
            showHomeIndicator: true,
            appIcons: Array.from({ length: 8 }, (_, i) => ({
              id: `app_device000${i}`,
              kind: "builtin" as const,
              builtinId: "wechat" as const,
              name: "微信",
              visible: true,
            })),
          };
          const result = applyPhoneLayers(doc, phone),
            frame = doc.statusLocation!.bounds;
          const generated = result.layers.filter(
            (l) => l.groupId === result.phone!.groupId,
          );
          expect(generated.filter((l) => l.id.includes("_app_"))).toHaveLength(
            8,
          );
          expect(generated.some((l) => l.id.endsWith("_home"))).toBe(false);
          for (const l of generated) {
            expect(
              l.x,
              `${model.id}/${styleId}/${l.name}`,
            ).toBeGreaterThanOrEqual(frame.x * 400 - 1e-6);
            expect(l.y).toBeGreaterThanOrEqual(frame.y * 800 - 1e-6);
            expect(l.x + l.width).toBeLessThanOrEqual(
              (frame.x + frame.width) * 400 + 1e-6,
            );
            expect(l.y + l.height).toBeLessThanOrEqual(
              (frame.y + frame.height) * 800 + 1e-6,
            );
          }
          expect(result.canvas).toEqual(doc.canvas);
        }
  });
  it("ignores obsolete inner slots, preserves the source and round-trips outer-frame metadata", () => {
    const doc = fixture(),
      original = structuredClone(doc);
    const a = applyPhoneLayers(doc, naturalPhoneSettings());
    const changed = structuredClone(doc);
    changed.statusLocation!.time = {
      x: 0.9,
      y: 0.8,
      width: 0.001,
      height: 0.001,
    };
    changed.statusLocation!.system = { ...changed.statusLocation!.time };
    changed.statusLocation!.apps = null;
    changed.statusLocation!.testKey = locationTestKey(changed.statusLocation!);
    const b = applyPhoneLayers(changed, {
      ...naturalPhoneSettings(),
      groupId: a.phone!.groupId,
    });
    expect(b.layers).toEqual(a.layers);
    expect(doc).toEqual(original);
    expect(loadTemplateDoc(JSON.parse(JSON.stringify(a))).ok).toBe(true);
    const legacy = structuredClone(doc);
    delete legacy.statusLocation!.layout;
    legacy.statusLocation!.testKey = locationTestKey(legacy.statusLocation!);
    expect(isLocationConfirmed(legacy)).toBe(true);
    expect(
      applyPhoneLayers(legacy, {
        ...naturalPhoneSettings(),
        groupId: a.phone!.groupId,
      }).layers,
    ).toEqual(a.layers);
  });
  it("allows the complete frame while restoring every outside pixel, including fractional boundaries", () => {
    const doc = fixture(),
      mask = locationPixelMask(doc, 400, 800);
    const before = new Uint8ClampedArray(mask.width * mask.height * 4).fill(37),
      after = new Uint8ClampedArray(before.length).fill(255);
    restoreOutsideLocation(before, after, mask);
    for (let y = 0; y < mask.height; y++)
      for (let x = 0; x < mask.width; x++) {
        const px = mask.x + x,
          py = mask.y + y,
          r = mask.allowed[0];
        expect(after[(y * mask.width + x) * 4]).toBe(
          px >= r.left && px < r.right && py >= r.top && py < r.bottom
            ? 255
            : 37,
        );
      }
  });
});
