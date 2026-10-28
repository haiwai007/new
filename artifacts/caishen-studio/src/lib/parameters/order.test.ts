import { describe, expect, it } from "vitest";
import {
  defaultOrderRule,
  generateOrders,
  orderError,
  orderCapacity,
  orderFromRank,
  randomOrder,
} from "./order";
import { createRng, generateItems, preserveUniqueOrders } from "../batch/rules";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import { createRegionParameter } from "./document";
import { getParamValue } from "../template/params";
describe("template order rules", () => {
  it("preserves leading zeroes and exact length without numeric conversion", () => {
    const rule = defaultOrderRule();
    expect(orderFromRank(rule, 0n)).toBe("0000000000");
    const long = { ...rule, length: 64, prefix: "DD", suffix: "Z" };
    const values = generateOrders(long, 200, createRng(22));
    expect(new Set(values).size).toBe(200);
    for (const value of values) {
      expect(value).toHaveLength(67);
      expect(orderError(long, value)).toBeNull();
    }
  });
  it("honors alphabet, case and first character and terminates in exhausted small spaces", () => {
    for (const alphabet of ["digits", "letters", "mixed"] as const) {
      const rule = {
        ...defaultOrderRule(),
        length: 4,
        alphabet,
        letterCase: "lower" as const,
        leadingZero: false,
      };
      for (const value of generateOrders(rule, 200, createRng(3))) {
        expect(orderError(rule, value)).toBeNull();
        expect(value[0]).not.toBe("0");
      }
    }
    const small = { ...defaultOrderRule(), length: 1 };
    expect(new Set(generateOrders(small, 10, () => 0)).size).toBe(10);
    expect(() => generateOrders(small, 11, () => 0)).toThrow("最多生成 10");
    expect(orderCapacity({ ...small, leadingZero: false })).toBe(9n);
    expect(
      randomOrder(
        small,
        "9",
        ["0", "1", "2", "3", "4", "5", "6", "7", "8"],
        () => 0,
      ),
    ).toBe("9");
  });
  it("keeps batch previews deterministic and distinct, including single-row rerandomization", () => {
    let doc = structuredClone(
      BUILTIN_TEMPLATES.find((t) => t.id === "blank_portrait")!.doc,
    );
    const created = createRegionParameter(
      doc,
      { x: 10, y: 10, width: 400, height: 50 },
      "order",
    );
    doc = created.doc;
    const p = doc.parameters.at(-1)!;
    const batch = generateItems(doc, {}, 200, 33),
      again = generateItems(doc, {}, 200, 33);
    const values = batch.map((item) => getParamValue(item.doc, p));
    expect(new Set(values).size).toBe(200);
    expect(again.map((i) => getParamValue(i.doc, p))).toEqual(values);
    const next = preserveUniqueOrders(
      generateItems(doc, {}, 200, 44)[0],
      batch,
      {},
      createRng(16),
    );
    expect(values.slice(1)).not.toContain(getParamValue(next.doc, p));
    expect(batch.map((i) => getParamValue(i.doc, p))).toEqual(values);
  });
});

describe("masked order numbers", () => {
  it("accepts manually entered stars as characters without relaxing alphabet or length rules", () => {
    const rule = { ...defaultOrderRule(), length: 12 };
    expect(orderError(rule, "6205****5522")).toBeNull();
    expect(orderError(rule, "6205***5522")).toContain("12 位");
    expect(orderError(rule, "620A****5522")).not.toBeNull();
    expect(
      orderError({ ...rule, prefix: "DD", suffix: "Z" }, "DD6205****5522Z"),
    ).toBeNull();
    expect(
      orderError({ ...rule, leadingZero: false }, "*205****5522"),
    ).toBeNull();
  });
  it("retains masks, exact length and seeded unique visible results", () => {
    const rule = {
      ...defaultOrderRule(),
      length: 12,
      maskPattern: "6205****5522",
    };
    const a = generateOrders(rule, 200, createRng(34));
    expect(a).toEqual(generateOrders(rule, 200, createRng(34)));
    expect(new Set(a).size).toBe(200);
    for (const value of a) {
      expect(value).toMatch(/^\d{4}\*{4}\d{4}$/);
      expect(orderError(rule, value)).toBeNull();
    }
    expect(orderFromRank(rule, 0n)).toBe("0000****0000");
    expect(orderCapacity(rule)).toBe(100000000n);
    expect(orderCapacity({ ...rule, leadingZero: false })).toBe(90000000n);
    expect(orderError(rule, "620555****22")).not.toBeNull();
  });
  it("counts only visible combinations and does not treat manual masks as blocked generated values", () => {
    const tiny = {
      ...defaultOrderRule(),
      length: 2,
      maskPattern: "*0",
      leadingZero: false,
    };
    expect(orderCapacity(tiny)).toBe(10n);
    expect(new Set(generateOrders(tiny, 10, createRng(1))).size).toBe(10);
    expect(() => generateOrders(tiny, 11)).toThrow("最多生成 10");
    const full = { ...tiny, maskPattern: "**" };
    expect(orderCapacity(full)).toBe(1n);
    expect(() => generateOrders(full, 2)).toThrow("最多生成 1");
    expect(generateOrders(full, 3, createRng(1), false)).toEqual([
      "**",
      "**",
      "**",
    ]);
    expect(
      randomOrder(
        { ...defaultOrderRule(), length: 1 },
        "*",
        ["*", "0", "1", "2", "3", "4", "5", "6", "7", "8"],
        () => 0,
      ),
    ).toBe("9");
  });
  it("infers and round trips a masked template and keeps per-row rerandomization unique", async () => {
    const { createParameter } = await import("../template/params");
    const { makeTemplate, textLayer, titleParam } =
      await import("../batch/test-fixtures");
    const { buildPackage, parseTemplateFile } =
      await import("../template/package");
    const doc = makeTemplate();
    doc.layers = [textLayer(titleParam.layerId, "6205****5522")];
    const param = createParameter(doc, doc.layers[0], "order", "订单号");
    doc.parameters = [param];
    expect(param.order).toMatchObject({
      length: 12,
      maskPattern: "6205****5522",
    });
    const packed = parseTemplateFile(buildPackage(doc, []));
    expect(packed.ok).toBe(true);
    if (!packed.ok) return;
    const items = generateItems(packed.doc, {}, 20, 382);
    for (const item of items) expect(item.errors).toEqual([]);
    const values = items.map((item) => getParamValue(item.doc, param));
    expect(new Set(values).size).toBe(20);
    const next = preserveUniqueOrders(
      generateItems(packed.doc, {}, 20, 991)[0],
      items,
      {},
      createRng(122),
    );
    const value = getParamValue(next.doc, param);
    expect(String(value)).toMatch(/^\d{4}\*{4}\d{4}$/);
    expect(values.slice(1)).not.toContain(value);
  });
});
