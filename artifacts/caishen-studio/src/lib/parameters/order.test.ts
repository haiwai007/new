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
