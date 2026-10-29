import { describe, expect, it } from "vitest";
import {
  applyPhoneLayers,
  defaultPhoneSettings,
  phoneDate,
  phoneTime,
  removePhoneLayers,
  statusIconsSvg,
} from "./layers";
import { phoneSettingsSchema } from "./schema";
import { PHONE_MODELS } from "./models";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import { loadTemplateDoc } from "../template/migrate";
import { buildPackage, parseTemplateFile } from "../template/package";
import { resizeDoc } from "../template/smart-resize";
const doc = () => structuredClone(BUILTIN_TEMPLATES[0].doc);
describe("phone status bar", () => {
  it("validates real dates, times and battery bounds", () => {
    const s = defaultPhoneSettings();
    expect(phoneSettingsSchema.safeParse(s).success).toBe(true);
    for (const patch of [
      { time: "24:00" },
      { time: "12:99" },
      { date: "2025-02-29" },
      { date: "2026-04-31" },
      { battery: -1 },
      { battery: 101 },
      { battery: 10.5 },
      { signal: 5 },
      { backgroundColor: 'red"/>' },
    ])
      expect(phoneSettingsSchema.safeParse({ ...s, ...patch }).success).toBe(
        false,
      );
    expect(
      phoneSettingsSchema.safeParse({ ...s, date: "2024-02-29", battery: 0 })
        .success,
    ).toBe(true);
  });
  it("formats midnight, noon and weekday dates independently of timezone", () => {
    const s = {
      ...defaultPhoneSettings(),
      date: "2026-10-25",
      timeFormat: "12h" as const,
    };
    expect(phoneTime({ ...s, time: "00:05" })).toBe("12:05 AM");
    expect(phoneTime({ ...s, time: "12:00" })).toBe("12:00 PM");
    expect(phoneTime({ ...s, time: "23:59" })).toBe("11:59 PM");
    expect(phoneDate(s)).toBe("10月25日 星期日");
    expect(phoneDate({ ...s, dateFormat: "iso" })).toBe("2026-10-25");
  });
  it("uses the reviewed model/version period format while respecting 24-hour and legacy choices", () => {
    const base = {
      ...defaultPhoneSettings(),
      modelId: "xiaomi15pro" as const,
      rendering: "natural" as const,
      styleId: "hyperos2" as const,
      timeFormat: "12h" as const,
    };
    for (const [time, label] of [
      ["00:05", "12:05"],
      ["12:00", "12:00"],
      ["13:38", "1:38"],
      ["23:59", "11:59"],
    ])
      expect(phoneTime({ ...base, time })).toBe(label);
    expect(phoneTime({ ...base, time: "13:38", timeFormat: "24h" })).toBe(
      "13:38",
    );
    expect(phoneTime({ ...base, time: "13:38", styleId: "hyperos3" })).toBe(
      "1:38 PM",
    );
    expect(phoneTime({ ...base, time: "13:38", rendering: "legacy" })).toBe(
      "1:38 PM",
    );
  });
  it("preserves ordinary content, replaces status layers without duplication and persists settings", () => {
    const original = doc();
    const s = { ...defaultPhoneSettings(), battery: 67, showDate: true };
    const first = applyPhoneLayers(original, s);
    const second = applyPhoneLayers(first, { ...s, time: "13:08", battery: 0 });
    expect(second.layers).toHaveLength(original.layers.length + 7);
    expect(second.layers.slice(0, original.layers.length)).toEqual(
      original.layers,
    );
    expect(second.layers.find((l) => l.id.endsWith("_time"))).toMatchObject({
      text: "13:08",
      locked: true,
    });
    const loaded = loadTemplateDoc(JSON.parse(JSON.stringify(second)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw Error(loaded.error);
    expect(loaded.doc.phone?.battery).toBe(0);
    const packaged = parseTemplateFile(buildPackage(second, []));
    expect(packaged.ok).toBe(true);
    if (packaged.ok) expect(packaged.doc.phone?.time).toBe("13:08");
  });
  it("anchors overlays after any canvas resize and supports every preset", () => {
    for (const model of PHONE_MODELS) {
      const withPhone = applyPhoneLayers(doc(), {
        ...defaultPhoneSettings(),
        modelId: model.id,
        showDate: true,
      });
      for (const mode of ["none", "smart", "scale"] as const) {
        const resized = resizeDoc(withPhone, model.width, model.height, mode);
        const bg = resized.layers.find((l) => l.id.endsWith("_background"))!;
        expect(bg.x).toBe(0);
        expect(bg.width).toBe(model.width);
        const icons = resized.layers.find((l) => l.id.endsWith("_icons"))!;
        expect(icons.x + icons.width).toBeLessThan(model.width);
        const home = resized.layers.find((l) => l.id.endsWith("_home"))!;
        expect(home.y + home.height).toBeLessThan(model.height);
        expect(home.visible).toBe(model.style !== "classic");
      }
    }
  });
  it("removes only its own layers and associated parameters", () => {
    const original = doc();
    const generated = applyPhoneLayers(original, defaultPhoneSettings());
    generated.parameters = [
      ...generated.parameters,
      {
        ...original.parameters[0],
        id: "phone-time-param",
        layerId: `${generated.phone!.groupId}_time`,
      },
    ];
    const removed = removePhoneLayers(generated);
    expect(removed.phone).toBeUndefined();
    expect(removed.layers).toEqual(original.layers);
    expect(removed.parameters).toEqual(original.parameters);
  });
  it("renders charge, low battery and connectivity without including untrusted text in SVG", () => {
    const s = {
      ...defaultPhoneSettings(),
      battery: 10,
      wifi: 0,
      network: "5G" as const,
      carrier: "<script>",
    };
    expect(statusIconsSvg(s)).toContain("#ef4444");
    expect(statusIconsSvg(s)).toContain("5G");
    expect(statusIconsSvg({ ...s, airplane: true })).not.toContain(">5G<");
    expect(statusIconsSvg({ ...s, charging: true })).toContain("#22c55e");
    expect(statusIconsSvg(s)).not.toContain("<script>");
    expect(statusIconsSvg({ ...s, battery: 0 })).not.toContain(
      'width="0" height="8"',
    );
  });
  it("loads older documents without adding a phone preset", () => {
    const loaded = loadTemplateDoc(doc());
    expect(loaded.ok && loaded.doc.phone).toBeUndefined();
  });
});

it("preserves manually edited phone contents when resizing in every mode", () => {
  const original = applyPhoneLayers(doc(), {
    ...defaultPhoneSettings(),
    showDate: true,
  });
  original.layers = original.layers.map((l) =>
    l.type === "text" && l.id.endsWith("_time")
      ? { ...l, text: "13:08", locked: false }
      : l,
  );
  for (const mode of ["none", "smart", "scale"] as const) {
    const next = resizeDoc(original, 750, 1600, mode);
    expect(next.phone?.time).toBe("13:08");
    expect(next.layers.find((l) => l.id.endsWith("_time"))).toMatchObject({
      text: "13:08",
      locked: false,
    });
  }
});
