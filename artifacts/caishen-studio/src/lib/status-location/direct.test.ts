import { describe, expect, it, vi } from "vitest";
vi.mock("../canvas/render", () => ({
  renderDoc: vi.fn().mockRejectedValue(new Error("sampling unavailable")),
}));
import { BUILTIN_TEMPLATES } from "../template/builtin";
import {
  defaultStatusLocation,
  isLocationConfirmed,
  locationAppCapacity,
} from "./model";
import { confirmStatusLocation } from "./engine";
import { applyPhoneLayers, naturalPhoneSettings } from "../phone/layers";
import { phoneScreenContent } from "../phone/export";
import { hasLocationPixelMask } from "./pixel-mask";
import { loadTemplateDoc } from "../template/migrate";
const original = () =>
  structuredClone(
    BUILTIN_TEMPLATES.find((t) => t.id === "blank_portrait")!.doc,
  );
describe("direct user-selected status regions", () => {
  it("confirms without testing, foreground recognition or background sampling", async () => {
    const doc = original(),
      draft = defaultStatusLocation(doc);
    draft.protected = [{ ...draft.time }];
    draft.system = { ...draft.time };
    const saved = await confirmStatusLocation(doc, draft);
    expect(saved).toMatchObject({
      approval: "direct",
      state: "confirmed",
      bounds: draft.bounds,
      time: draft.time,
      system: draft.system,
    });
    expect(isLocationConfirmed({ ...doc, statusLocation: saved })).toBe(true);
    expect(doc.statusLocation).toBeUndefined();
  });
  it("does not veto narrow slots, overlapping protection, APP quantity or missing optional slots", async () => {
    const doc = original(),
      draft = defaultStatusLocation(doc);
    draft.time.width = 0.004;
    draft.system.width = 0.004;
    draft.apps!.width = 0.01;
    draft.protected = [{ ...draft.time }];
    doc.statusLocation = await confirmStatusLocation(doc, draft);
    const phone = naturalPhoneSettings();
    phone.showDate = true;
    phone.showCarrier = true;
    phone.appIcons = Array.from({ length: 8 }, (_, i) => ({
      id: `app_direct000${i}`,
      kind: "builtin" as const,
      builtinId: "wechat" as const,
      name: "微信",
      visible: true,
    }));
    expect(locationAppCapacity(doc)).toBe(8);
    const result = applyPhoneLayers(doc, phone);
    expect(result.layers.filter((l) => l.id.includes("_app_"))).toHaveLength(8);
    expect(hasLocationPixelMask(result)).toBe(true);
    expect(hasLocationPixelMask(phoneScreenContent(result))).toBe(true);
    expect(loadTemplateDoc(JSON.parse(JSON.stringify(result))).ok).toBe(true);
  });
  it("continues with the saved coordinates after the source changes", async () => {
    const doc = original();
    doc.statusLocation = await confirmStatusLocation(
      doc,
      defaultStatusLocation(doc),
    );
    const next = {
      ...doc,
      canvas: {
        ...doc.canvas,
        width: 400,
        height: 900,
        backgroundColor: "#223344",
      },
    };
    expect(isLocationConfirmed(next)).toBe(true);
    expect(() => applyPhoneLayers(next, naturalPhoneSettings())).not.toThrow();
  });
});
