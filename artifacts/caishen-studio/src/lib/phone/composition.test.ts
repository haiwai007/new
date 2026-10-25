import { drawingRules } from "../batch/phone-rules";
import { describe, expect, it } from "vitest";
import {
  applyPhoneLayers,
  defaultPhoneSettings,
  removePhoneLayers,
} from "./layers";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import { loadTemplateDoc } from "../template/migrate";
const original = () => structuredClone(BUILTIN_TEMPLATES[0].doc);
describe("reversible status-bar placement", () => {
  it("shifts content once, preserves dimensions, and restores background when removed", () => {
    const base = original();
    base.canvas.backgroundImage = { kind: "url", url: "/templates/image.png" };
    const next = applyPhoneLayers(base, {
      ...defaultPhoneSettings(),
      placement: "prepend",
      coverRatio: 0.25,
    });
    expect(next.canvas.height).toBeGreaterThan(base.canvas.height);
    expect(next.canvas.width).toBe(base.canvas.width);
    expect(
      next.layers.find((l) => l.id === `${next.phone!.groupId}_background`)!
        .height,
    ).toBeLessThanOrEqual(next.phone!.addedHeight);
    expect(next.layers.find((l) => l.id === base.layers[0].id)!.y).toBe(
      base.layers[0].y + next.phone!.addedHeight,
    );
    expect(removePhoneLayers(next)).toEqual(base);
    expect(drawingRules(next.phone!).setup!.mode).toBe("prepend");
    const again = applyPhoneLayers(next, next.phone!);
    expect(again.canvas).toEqual(next.canvas);
    expect(again.layers).toEqual(next.layers);
  });
  it("switches models and overlay without accumulating height or moving user-created layers", () => {
    const base = original(),
      p = { ...defaultPhoneSettings(), placement: "prepend" as const };
    let next = applyPhoneLayers(base, p);
    for (const modelId of ["pixel9", "iphone16", "galaxys24ultra"] as const) {
      next = applyPhoneLayers(next, { ...next.phone!, modelId });
      expect(removePhoneLayers(next)).toEqual(base);
    }
    next = applyPhoneLayers(next, { ...next.phone!, placement: "overlay" });
    expect(next.canvas).toEqual(base.canvas);
    expect(removePhoneLayers(next)).toEqual(base);
  });
  it("roundtrips new placement fields through document validation", () => {
    const next = applyPhoneLayers(original(), {
      ...defaultPhoneSettings(),
      placement: "prepend",
    });
    const loaded = loadTemplateDoc(JSON.parse(JSON.stringify(next)));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(removePhoneLayers(loaded.doc)).toEqual(original());
  });
  it("defaults old settings to overlay without shifting old content", () => {
    const raw = { ...defaultPhoneSettings() } as Record<string, unknown>;
    delete raw.placement;
    delete raw.addedHeight;
    const next = applyPhoneLayers(
      original(),
      raw as ReturnType<typeof defaultPhoneSettings>,
    );
    expect(next.phone!.placement).toBe("overlay");
    expect(next.phone!.addedHeight).toBe(0);
    expect(drawingRules(raw as ReturnType<typeof defaultPhoneSettings>).setup!.mode).toBe("overlay");
    expect(next.canvas.height).toBe(original().canvas.height);
  });
});
