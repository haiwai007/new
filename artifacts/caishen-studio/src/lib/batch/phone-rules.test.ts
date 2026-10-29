import { describe, expect, it } from "vitest";
import {
  applyPhoneLayers,
  defaultPhoneSettings,
  phoneTime,
} from "../phone/layers";
import { phoneSettingsSchema } from "../phone/schema";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import {
  applyPhoneBatchRules,
  drawingRules,
  defaultPhoneBatchRules,
  RANDOM_PHONE_ICONS,
  validatePhoneBatchRules,
} from "./phone-rules";
import { createRng, generateItems, type BatchRules } from "./rules";
const template = () =>
  applyPhoneLayers(
    structuredClone(BUILTIN_TEMPLATES[0].doc),
    defaultPhoneSettings(),
  );
const enabled = () => ({ ...defaultPhoneBatchRules(), enabled: true });

describe("batch status-bar randomization", () => {
  it("keeps existing behavior by default and never adds a phone to an ordinary design", () => {
    const doc = template();
    expect(
      applyPhoneBatchRules(doc, defaultPhoneBatchRules(), createRng(1)),
    ).toBe(doc);
    const poster = structuredClone(BUILTIN_TEMPLATES[0].doc);
    expect(applyPhoneBatchRules(poster, enabled(), createRng(1))).toBe(poster);
  });
  it("is repeatable, updates actual layers, and never mutates the source template", () => {
    const doc = template();
    const before = structuredClone(doc);
    const rules = enabled();
    const a = generateItems(doc, {}, 20, 42, rules);
    expect(a).toEqual(generateItems(doc, {}, 20, 42, rules));
    expect(a.map((i) => i.doc.phone)).not.toEqual(
      generateItems(doc, {}, 20, 43, rules).map((i) => i.doc.phone),
    );
    expect(new Set(a.map((i) => i.doc.phone!.time)).size).toBeGreaterThan(1);
    for (const { doc: item, errors } of a) {
      expect(errors).toEqual([]);
      expect(
        item.layers.find((l) => l.id === `${item.phone!.groupId}_time`),
      ).toMatchObject({ text: phoneTime(item.phone!) });
      expect(item.phone).toMatchObject({
        modelId: before.phone!.modelId,
        groupId: before.phone!.groupId,
        theme: before.phone!.theme,
      });
      expect(phoneSettingsSchema.safeParse(item.phone).success).toBe(true);
      expect(item.layers.slice(0, before.layers.length - 7)).toEqual(
        before.layers.slice(0, -7),
      );
    }
    expect(doc).toEqual(before);
  });
  it("samples inclusive integer battery bounds, including empty/full battery", () => {
    const doc = template();
    const rules = enabled();
    rules.battery = { enabled: true, min: 0, max: 100 };
    expect(applyPhoneBatchRules(doc, rules, () => 0).phone!.battery).toBe(0);
    expect(
      applyPhoneBatchRules(doc, rules, () => 0.999999).phone!.battery,
    ).toBe(100);
    rules.battery = { enabled: true, min: 67, max: 67 };
    expect(applyPhoneBatchRules(doc, rules, createRng(1)).phone!.battery).toBe(
      67,
    );
  });
  it("handles time windows crossing midnight and equal endpoints", () => {
    const rules = enabled();
    rules.time = { enabled: true, start: "23:55", end: "00:05" };
    const values = generateItems(template(), {}, 100, 7, rules).map(
      (i) => i.doc.phone!.time,
    );
    expect(values.every((v) => v >= "23:55" || v <= "00:05")).toBe(true);
    expect(values.some((v) => v.startsWith("00:"))).toBe(true);
    expect(values.some((v) => v.startsWith("23:"))).toBe(true);
    rules.time = { enabled: true, start: "13:08", end: "13:08" };
    expect(
      generateItems(template(), {}, 10, 7, rules).every(
        (i) => i.doc.phone!.time === "13:08",
      ),
    ).toBe(true);
  });
  it("samples real calendar days including leap day and enables the date layer", () => {
    const rules = enabled();
    rules.date = { enabled: true, start: "2024-02-28", end: "2024-03-01" };
    const items = generateItems(template(), {}, 100, 42, rules);
    expect(new Set(items.map((i) => i.doc.phone!.date))).toEqual(
      new Set(["2024-02-28", "2024-02-29", "2024-03-01"]),
    );
    expect(
      items.every(
        (i) =>
          i.doc.phone!.showDate &&
          i.doc.layers.find((l) => l.id.endsWith("_date"))?.visible,
      ),
    ).toBe(true);
  });
  it("limits network candidates and optional flags without changing unchecked fields", () => {
    const doc = template();
    const rules = enabled();
    rules.time.enabled = rules.battery.enabled = false;
    rules.signal = rules.wifi = true;
    rules.network = { enabled: true, options: ["4G", "5G"] };
    rules.icons = Object.fromEntries(
      RANDOM_PHONE_ICONS.map(([key]) => [key, true]),
    );
    const items = generateItems(doc, {}, 100, 12, rules);
    for (const { doc: item } of items) {
      expect(["4G", "5G"]).toContain(item.phone!.network);
      expect(item.phone!.time).toBe(doc.phone!.time);
      expect(item.phone!.battery).toBe(
        item.phone!.lowPower
          ? Math.min(20, doc.phone!.battery)
          : doc.phone!.battery,
      );
      expect(phoneSettingsSchema.safeParse(item.phone).success).toBe(true);
    }
    for (const [key] of RANDOM_PHONE_ICONS)
      expect(new Set(items.map((i) => i.doc.phone![key]))).toEqual(
        new Set([true, false]),
      );
  });
  it("rejects invalid ranges before export instead of silently replacing them", () => {
    for (const rules of [
      { ...enabled(), battery: { enabled: true, min: 80, max: 20 } },
      { ...enabled(), battery: { enabled: true, min: NaN, max: 100 } },
      { ...enabled(), battery: { enabled: true, min: 0.5, max: 101 } },
      { ...enabled(), time: { enabled: true, start: "24:00", end: "12:00" } },
      {
        ...enabled(),
        date: { enabled: true, start: "2025-02-29", end: "2025-03-01" },
      },
      {
        ...enabled(),
        date: { enabled: true, start: "2026-03-02", end: "2026-03-01" },
      },
      { ...enabled(), network: { enabled: true, options: [] } },
    ]) {
      expect(validatePhoneBatchRules(rules).length).toBeGreaterThan(0);
      expect(
        generateItems(template(), {}, 2, 1, rules).every(
          (i) => i.errors.length > 0,
        ),
      ).toBe(true);
    }
  });
  it("does not change content random values when phone randomization is enabled", () => {
    const doc = template();
    const param = doc.parameters.find((p) => p.property === "text")!;
    const rules: BatchRules = {
      [param.id]: { mode: "list", options: ["甲", "乙", "丙"] },
    };
    const texts = (phone?: ReturnType<typeof enabled>) =>
      generateItems(doc, rules, 10, 5, phone).map((i) =>
        i.doc.layers.find((l) => l.id === param.layerId),
      );
    expect(texts(enabled())).toEqual(texts());
  });
});

it("generates phone-only templates without requiring content parameters", () => {
  const doc = { ...template(), parameters: [] };
  const items = generateItems(doc, {}, 3, 9, enabled());
  expect(items).toHaveLength(3);
  expect(
    items.every((item) => item.errors.length === 0 && item.doc.phone),
  ).toBe(true);
});

describe("low power batch constraints", () => {
  it("caps fixed battery only on pictures whose low-power state is enabled", () => {
    const doc = template();
    const rules = enabled();
    rules.time.enabled = rules.battery.enabled = false;
    rules.icons = { lowPower: true };
    const items = generateItems(doc, {}, 80, 985, rules);
    expect(items.some((i) => i.doc.phone!.lowPower)).toBe(true);
    expect(items.some((i) => !i.doc.phone!.lowPower)).toBe(true);
    for (const item of items)
      expect(item.doc.phone!.battery).toBe(item.doc.phone!.lowPower ? 20 : 100);
    expect(doc.phone!.battery).toBe(100);
  });
  it("samples 0–20 for low-power outcomes and retains the selected range for other outcomes", () => {
    const doc = template();
    const rules = enabled();
    rules.battery = { enabled: true, min: 80, max: 100 };
    rules.icons = { lowPower: true };
    const items = generateItems(doc, {}, 100, 177, rules);
    const low = items
      .filter((i) => i.doc.phone!.lowPower)
      .map((i) => i.doc.phone!.battery);
    expect(new Set(low).size).toBeGreaterThan(5);
    expect(low.every((n) => n >= 0 && n <= 20)).toBe(true);
    expect(
      items
        .filter((i) => !i.doc.phone!.lowPower)
        .every(
          (i) => i.doc.phone!.battery >= 80 && i.doc.phone!.battery <= 100,
        ),
    ).toBe(true);
    expect(generateItems(doc, {}, 100, 177, rules)).toEqual(items);
  });
  it("keeps chosen battery values already within the low-power limit", () => {
    const doc = template();
    doc.phone!.lowPower = true;
    const rules = enabled();
    rules.battery = { enabled: true, min: 7, max: 12 };
    const items = generateItems(doc, {}, 40, 5, rules);
    expect(
      items.every(
        (i) =>
          i.doc.phone!.lowPower &&
          i.doc.phone!.battery >= 7 &&
          i.doc.phone!.battery <= 12,
      ),
    ).toBe(true);
  });
});

it("ignores inactive blank fixed values when valid random rules are selected", () => {
  const doc = template();
  const settings = { ...doc.phone!, time: "", battery: NaN };
  const rules = {
    ...enabled(),
    setup: { mode: "overlay" as const, settings },
    time: { enabled: true, start: "22:00", end: "02:00" },
    battery: { enabled: true, min: 30, max: 90 },
  };
  expect(validatePhoneBatchRules(rules)).toEqual([]);
  const next = applyPhoneBatchRules(doc, rules, createRng(7));
  expect(phoneSettingsSchema.safeParse(next.phone).success).toBe(true);
  expect(next.phone!.battery).toBeGreaterThanOrEqual(30);
  expect(
    validatePhoneBatchRules({
      ...rules,
      time: { ...rules.time, enabled: false },
    }),
  ).toContain("请检查固定状态栏设置");
});

it("retains existing single-drawing fixed preset values when batch rules are disabled", () => {
  const doc = template();
  doc.phone!.lowPower = true;
  doc.phone!.battery = 80;
  const rules = drawingRules(doc.phone!);
  expect(rules.enabled).toBe(false);
  const next = applyPhoneBatchRules(doc, rules, createRng(7));
  expect(next.phone!.battery).toBe(80);
  expect(next.phone!.lowPower).toBe(true);
});

it("samples the target model's actual Wi-Fi range after a random model switch", async () => {
  const { naturalPhoneSettings } = await import("../phone/layers");
  const { settingsForModel } = await import("../phone/profiles");
  const phone = settingsForModel(naturalPhoneSettings(), "pixel9");
  const doc = applyPhoneLayers(
    structuredClone(BUILTIN_TEMPLATES[0].doc),
    phone,
  );
  const rules = { ...defaultPhoneBatchRules(phone), enabled: true, wifi: true };
  expect(
    applyPhoneBatchRules(doc, rules, () => 0.999, "pixel9").phone!.wifi,
  ).toBe(4);
  expect(
    applyPhoneBatchRules(doc, rules, () => 0.999, "galaxys25").phone!.wifi,
  ).toBe(3);
});
