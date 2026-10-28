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
  it("groups numeric amounts by thousands while preserving sign, precision, affixes and opt-out", () => {
    const p: TemplateParameter = {
      ...priceParam,
      type: "number",
      rules: { decimals: 2 },
    };
    const tpl = makeTemplate({
      layers: [textLayer("layer-price", "0")],
      parameters: [p],
    });
    const range = {
      mode: "range",
      min: 125000,
      max: 125000,
      decimals: 2,
      prefix: "+",
      suffix: "元",
    } as const;
    const grouped = generateItems(tpl, { [p.id]: range }, 2, 42);
    expect(grouped.map((i) => textOf(i.doc, "layer-price"))).toEqual([
      "+125,000.00元",
      "+125,000.00元",
    ]);
    expect(grouped.every((i) => i.errors.length === 0)).toBe(true);
    const plain = generateItems(
      tpl,
      { [p.id]: { ...range, groupThousands: false } },
      1,
      42,
    );
    expect(textOf(plain[0].doc, "layer-price")).toBe("+125000.00元");
    expect(
      generateValue(
        p,
        {
          ...range,
          min: -1234567.1256,
          max: -1234567.1256,
          decimals: 4,
          prefix: "",
          suffix: "",
        },
        0,
        createRng(1),
      ),
    ).toBe("-1,234,567.1256");
    expect(
      generateValue(
        p,
        { ...range, min: 999.999, max: 999.999, prefix: "", suffix: "" },
        0,
        createRng(1),
      ),
    ).toBe("1,000.00");
    expect(
      generateValue({ ...p, property: "width" }, range, 0, createRng(1)),
    ).toBe(125000);
  });

  it("keeps a plus prefix on rounded numeric layers and their linked layers", () => {
    const p: TemplateParameter = { ...priceParam, type: "number", rules: { decimals: 2 }, linkedLayerIds: ["linked-price"] };
    const tpl = makeTemplate({ layers: [textLayer("layer-price", "0"), textLayer("linked-price", "0")], parameters: [p] });
    for (const suffix of ["", "元"]) {
      const items = generateItems(tpl, { [p.id]: { mode: "range", min: 125000, max: 375000, decimals: 2, prefix: "+", suffix, groupThousands: false } }, 61, 42);
      expect(items.every(item => item.errors.length === 0)).toBe(true);
      for (const item of items) {
        const value = textOf(item.doc, "layer-price")!;
        expect(value).toMatch(suffix ? /^\+\d+\.\d{2}元$/ : /^\+\d+\.\d{2}$/);
        expect(textOf(item.doc, "linked-price")).toBe(value);
        expect(Number(value.replace("元", ""))).toBeGreaterThanOrEqual(125000);
        expect(Number(value.replace("元", ""))).toBeLessThanOrEqual(375000);
      }
    }
    expect(textOf(tpl, "layer-price")).toBe("0");
  });

  it("exports numeric display content with affixes without numeric-only restrictions", () => {
    const p: TemplateParameter = { ...priceParam, type: "number", rules: { min: 1, max: 100 } };
    const tpl = makeTemplate({ layers: [textLayer("layer-price", "0")], parameters: [p] });
    for (const value of ["+18.80", "¥18.80", "18.80元", "****", "200"]) {
      const [item] = generateItems(tpl, { [p.id]: { mode: "fixed", value } }, 1, 42);
      expect(item.errors).toEqual([]);
      expect(textOf(item.doc, "layer-price")).toBe(value);
    }
    const random = generateItems(tpl, { [p.id]: { mode: "range", min: 10, max: 20, decimals: 2, prefix: "+", suffix: "元" } }, 61, 42);
    expect(random.every(item => item.errors.length === 0)).toBe(true);
    expect(random.every(item => /^\+\d+\.\d{2}元$/.test(textOf(item.doc, "layer-price")!))).toBe(true);
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
