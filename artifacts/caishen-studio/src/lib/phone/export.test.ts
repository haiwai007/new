import { describe, expect, it } from "vitest";
import { applyPhoneLayers, defaultPhoneSettings } from "./layers";
import { phoneScreenContent } from "./export";
import { BUILTIN_TEMPLATES } from "../template/builtin";

describe("screen-only image output", () => {
  it("removes hardware decoration while retaining status UI and the home indicator", () => {
    const original = applyPhoneLayers(
      structuredClone(BUILTIN_TEMPLATES[0].doc),
      {
        ...defaultPhoneSettings(),
        showCutout: true,
        showDate: true,
        battery: 67,
      },
    );
    const snapshot = structuredClone(original);
    const exported = phoneScreenContent(original);
    const prefix = original.phone!.groupId;
    expect(exported.layers.some((l) => l.id === `${prefix}_cutout`)).toBe(
      false,
    );
    for (const role of ["time", "date", "icons", "home", "background"])
      expect(
        exported.layers.find((l) => l.id === `${prefix}_${role}`)?.visible,
      ).toBe(true);
    expect(exported.canvas).toEqual(original.canvas);
    expect(original).toEqual(snapshot);
    expect(original.phone!.showCutout).toBe(true);
  });
  it("keeps unrelated artwork and removes only parameters bound to omitted hardware", () => {
    const original = applyPhoneLayers(
      structuredClone(BUILTIN_TEMPLATES[0].doc),
      defaultPhoneSettings(),
    );
    const prefix = original.phone!.groupId;
    original.parameters = [
      ...original.parameters,
      {
        ...original.parameters[0],
        id: "cutout-param",
        layerId: `${prefix}_cutout`,
      },
      {
        ...original.parameters[0],
        id: "time-param",
        layerId: `${prefix}_time`,
      },
    ];
    const output = phoneScreenContent(original);
    expect(output.parameters.some((p) => p.id === "cutout-param")).toBe(false);
    expect(output.parameters.some((p) => p.id === "time-param")).toBe(true);
    expect(output.layers.filter((l) => !l.id.startsWith(prefix))).toEqual(
      original.layers.filter((l) => !l.id.startsWith(prefix)),
    );
  });
  it("leaves ordinary documents unchanged", () => {
    const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
    expect(phoneScreenContent(doc)).toBe(doc);
  });
});
