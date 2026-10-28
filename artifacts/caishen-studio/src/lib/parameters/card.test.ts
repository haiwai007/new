import { describe, it, expect } from "vitest";
import {
  cardRuleSchema,
  defaultCardRule,
  inferCardRule,
  cardCapacity,
  cardFromRank,
  cardError,
  generateCards,
  randomCard,
} from "./card";
import { createRng, generateItems, preserveUniqueOrders } from "../batch/rules";
import { makeTemplate } from "../batch/test-fixtures";
import { createRegionParameter } from "./document";
import { getParamValue } from "../template/params";
import { buildPackage, parseTemplateFile } from "../template/package";
describe("masked card parameters", () => {
  it("uses only configured fixed heads, fixed stars and numeric tails with leading zeroes", () => {
    const rule = {
      ...defaultCardRule(),
      prefixes: ["6205", "006222"],
      maskCount: 4,
      tailLength: 4,
    };
    expect(cardFromRank(rule, 0n)).toBe("6205****0000");
    expect(cardFromRank(rule, 10000n)).toBe("006222****0000");
    expect(cardCapacity(rule)).toBe(20000n);
    const values = generateCards(rule, 200, createRng(29));
    expect(new Set(values).size).toBe(200);
    expect(values).toEqual(generateCards(rule, 200, createRng(29)));
    expect(values.some((v) => v.startsWith("6205"))).toBe(true);
    expect(values.some((v) => v.startsWith("006222"))).toBe(true);
    for (const value of values) {
      expect(value).toMatch(/^(6205|006222)\*{4}\d{4}$/);
      expect(cardError(rule, value)).toBeNull();
    }
    expect(cardError(rule, "9999****1234")).not.toBeNull();
    expect(cardError(rule, "6205***1234")).not.toBeNull();
    expect(cardError(rule, "6205****123A")).not.toBeNull();
  });
  it("deduplicates heads and enforces visible-space limits without retry storms", () => {
    const rule = {
      prefixes: ["6205", "6205 ", ""],
      maskCount: 2,
      tailLength: 1,
    };
    expect(cardRuleSchema.parse(rule).prefixes).toEqual(["6205"]);
    expect(cardCapacity(rule)).toBe(10n);
    expect(new Set(generateCards(rule, 10, () => 0)).size).toBe(10);
    expect(() => generateCards(rule, 11)).toThrow("最多生成 10");
    const excluded = Array.from({ length: 9 }, (_, i) => `6205**${i}`);
    expect(randomCard(rule, "6205**9", excluded, () => 0)).toBe("6205**9");
    expect(() => randomCard(rule, "6205**9", [...excluded, "6205**9"])).toThrow(
      "已用完",
    );
    expect(cardRuleSchema.safeParse({ ...rule, prefixes: [] }).success).toBe(
      false,
    );
    expect(
      cardRuleSchema.safeParse({ ...rule, prefixes: ["62*5"] }).success,
    ).toBe(false);
    expect(cardRuleSchema.safeParse({ ...rule, maskCount: 0 }).success).toBe(
      false,
    );
  });
  it("round trips card templates, generates linked values and rerolls one row without changing others", () => {
    const made = createRegionParameter(
        makeTemplate(),
        { x: 10, y: 80, width: 300, height: 40 },
        "card",
      ),
      p = made.doc.parameters.at(-1)!;
    p.card = { prefixes: ["6205", "6222"], maskCount: 4, tailLength: 4 };
    const linked = createRegionParameter(
      made.doc,
      { x: 10, y: 140, width: 300, height: 40 },
      "card",
      p.id,
    );
    const packed = parseTemplateFile(buildPackage(linked.doc, []));
    expect(packed.ok).toBe(true);
    if (!packed.ok) return;
    const parameter = packed.doc.parameters.find((q) => q.id === p.id)!;
    expect(parameter.type).toBe("card");
    expect(parameter.card?.prefixes).toEqual(["6205", "6222"]);
    const items = generateItems(packed.doc, {}, 20, 79);
    for (const item of items) {
      expect(item.errors).toEqual([]);
      const value = getParamValue(item.doc, parameter);
      expect(String(value)).toMatch(/^(6205|6222)\*{4}\d{4}$/);
      expect(
        item.doc.layers.find((l) => l.id === linked.layerId),
      ).toMatchObject({ text: value });
    }
    const before = items.map((item) => getParamValue(item.doc, parameter));
    expect(new Set(before).size).toBe(20);
    const rerolled = preserveUniqueOrders(
      generateItems(packed.doc, {}, 20, 123)[0],
      items,
      {},
      createRng(8),
    );
    expect(before.slice(1)).not.toContain(
      getParamValue(rerolled.doc, parameter),
    );
    expect(items.map((item) => getParamValue(item.doc, parameter))).toEqual(
      before,
    );
    expect(inferCardRule("6205****5522")).toEqual({
      prefixes: ["6205"],
      maskCount: 4,
      tailLength: 4,
    });
  });
});
