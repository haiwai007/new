import { describe, expect, it } from "vitest";
import { createRng, generateItems, generateValue, isLockedParam, modesFor } from "./rules.ts";
import { makeTemplate, textLayer, titleParam } from "./test-fixtures.ts";
import type { TemplateParameter } from "../../types/template.ts";

const priceParam: TemplateParameter = { ...titleParam, id: "param-price", name: "价格", layerId: "layer-price", required: false, allowEmpty: true, rules: {} };
const textOf = (doc: ReturnType<typeof makeTemplate>, id: string) => {
  const layer = doc.layers.find((l) => l.id === id);
  return layer?.type === "text" ? layer.text : undefined;
};

describe("batch rules", () => {
  it("retains leading plus signs in fixed and random numeric drawings", () => {
    const p: TemplateParameter = { ...priceParam, type: "number", rules: { decimals: 2 } };
    const tpl = makeTemplate({ layers: [textLayer("layer-price", "+1.00")], parameters: [p] });
    const fixed = generateItems(tpl, { [p.id]: { mode: "fixed", value: "+18.8" } }, 2, 42);
    expect(fixed.map(i => textOf(i.doc, "layer-price"))).toEqual(["+18.80", "+18.80"]);
    const random = generateItems(tpl, { [p.id]: { mode: "range", min: 10, max: 20, decimals: 2, prefix: "+", suffix: "" } }, 20, 42);
    for (const item of random) {
      const text = textOf(item.doc, "layer-price")!;
      expect(text).toMatch(/^\+\d+\.\d{2}$/);
      expect(Number(text)).toBeGreaterThanOrEqual(10);
      expect(Number(text)).toBeLessThanOrEqual(20);
    }
  });

  it("keeps random ranges inside bounds with the requested decimals and affixes", () => {
    const rng = createRng(42);
    for (let i = 0; i < 200; i += 1) {
      const v = generateValue(priceParam, { mode: "range", min: 10, max: 20, decimals: 2, prefix: "¥", suffix: "元" }, i, rng);
      expect(typeof v).toBe("string");
      const m = /^¥(\d+\.\d{2})元$/.exec(String(v));
      expect(m).not.toBeNull();
      const n = Number(m![1]);
      expect(n).toBeGreaterThanOrEqual(10);
      expect(n).toBeLessThanOrEqual(20);
    }
  });

  it("returns numbers for non-text numeric properties", () => {
    const opacity: TemplateParameter = { ...priceParam, type: "opacity", property: "opacity" };
    const v = generateValue(opacity, { mode: "range", min: 0.2, max: 0.8, decimals: 2, prefix: "", suffix: "" }, 0, createRng(1));
    expect(typeof v).toBe("number");
  });

  it("formats random dates inside the chosen window", () => {
    const rng = createRng(7);
    for (let i = 0; i < 50; i += 1) {
      const v = String(generateValue(priceParam, { mode: "dateRange", start: "2026-10-01T08:00", end: "2026-10-03T20:00", format: "yyyy-MM-dd HH:mm" }, i, rng));
      expect(v >= "2026-10-01 08:00" && v <= "2026-10-03 20:00").toBe(true);
    }
  });

  it("numbers sequences from the start value with padding", () => {
    const rule = { mode: "sequence", prefix: "A", start: 7, pad: 3, suffix: "" } as const;
    expect(generateValue(titleParam, rule, 0, Math.random)).toBe("A007");
    expect(generateValue(titleParam, rule, 5, Math.random)).toBe("A012");
  });

  it("picks only from the candidate list and skips an empty list", () => {
    const rng = createRng(3);
    const seen = new Set(Array.from({ length: 50 }, (_, i) => generateValue(titleParam, { mode: "list", options: ["甲", "乙", ""] }, i, rng)));
    expect([...seen].sort()).toEqual(["乙", "甲"]);
    expect(generateValue(titleParam, { mode: "list", options: [] }, 0, rng)).toBeUndefined();
  });

  it("is reproducible for the same seed and differs for a new seed", () => {
    const tpl = makeTemplate({ layers: [textLayer("layer-price", "¥1")], parameters: [priceParam] });
    const rules = { [priceParam.id]: { mode: "range", min: 1, max: 9999, decimals: 2, prefix: "", suffix: "" } } as const;
    const a = generateItems(tpl, rules, 5, 99).map((i) => textOf(i.doc, "layer-price"));
    const b = generateItems(tpl, rules, 5, 99).map((i) => textOf(i.doc, "layer-price"));
    const c = generateItems(tpl, rules, 5, 100).map((i) => textOf(i.doc, "layer-price"));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("clamps the count and reports validation errors per item", () => {
    expect(generateItems(makeTemplate(), {}, 999, 1)).toHaveLength(200);
    const items = generateItems(makeTemplate(), { [titleParam.id]: { mode: "fixed", value: "" } }, 2, 1);
    expect(items[0].errors[0]).toContain("不能为空");
  });

  it("never changes status-bar parameters", () => {
    const groupId = "phone_abcdefghij";
    const barParam: TemplateParameter = { ...priceParam, id: "param-bar", layerId: `${groupId}_time` };
    const tpl = { ...makeTemplate({ layers: [textLayer(`${groupId}_time`, "9:41")], parameters: [barParam] }), phone: { groupId } as never };
    expect(isLockedParam(tpl, barParam)).toBe(true);
    const [item] = generateItems(tpl, { [barParam.id]: { mode: "fixed", value: "13:08" } }, 1, 1);
    expect(textOf(item.doc, `${groupId}_time`)).toBe("9:41");
  });

  it("offers type-appropriate modes", () => {
    expect(modesFor("image")).toEqual(["keep", "fixed", "list", "orderedList"]);
    expect(modesFor("order")).toContain("orderRandom");
    expect(modesFor("number")).toContain("range");
    expect(modesFor("date")).toContain("dateRange");
  });
});
