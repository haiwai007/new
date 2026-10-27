import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES, CATEGORIES, findBuiltin } from "./builtin";
import { CATEGORY_COUNTS, templateMatches, paginationWindow } from "./catalog";
const TEMPLATE_EXAMPLE_LABEL = "海神作图 · 设计示例";
import { loadTemplateDoc } from "./migrate";
import { generateItems } from "../batch/rules";
describe("available template catalogue", () => {
  it("retains eleven unmarked templates and seven populated categories", () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(11);
    expect(CATEGORIES).toHaveLength(7);
    expect(new Set(BUILTIN_TEMPLATES.map((t) => t.id)).size).toBe(11);
    expect(CATEGORY_COUNTS).toEqual({
      poster: 2,
      social: 1,
      ecommerce: 1,
      notice: 1,
      festival: 1,
      general: 1,
      blank: 4,
    });
    for (const t of BUILTIN_TEMPLATES) {
      expect(
        t.doc.layers.some(
          (l) => l.type === "text" && l.text.includes(TEMPLATE_EXAMPLE_LABEL),
        ),
      ).toBe(false);
      expect(loadTemplateDoc(t.doc).ok, t.id).toBe(true);
      expect(
        generateItems(t.doc, {}, 2, 123).every((item) => !item.errors.length),
        t.id,
      ).toBe(true);
    }
  });
  it("does not resolve withdrawn templates through old IDs or search terms", () => {
    for (const id of [
      "bt_transfer_personal",
      "bt_flight_international",
      "bt_badge_employee",
      "bt_receipt_retail",
      "bt_ticket_concert",
      "bt_education_completion",
      "bt_pay_wechat_transfer_completed",
      "bt_pay_alipay_transfer_waiting",
      "bt_pay_icbc_personal_transfer",
    ])
      expect(findBuiltin(id), id).toBeUndefined();
    for (const word of [
      TEMPLATE_EXAMPLE_LABEL,
      "微信收款",
      "ICBC 网银",
      "国际航班登机牌",
    ])
      expect(BUILTIN_TEMPLATES.filter((t) => templateMatches(t, word))).toEqual(
        [],
      );
  });
  it("keeps search and pagination working for retained templates", () => {
    const coffee = findBuiltin("bt_coffee")!;
    expect(templateMatches(coffee, "咖啡 价格")).toBe(true);
    expect(templateMatches(coffee, "宣传海报")).toBe(true);
    expect(templateMatches(coffee, "机票")).toBe(false);
    expect(paginationWindow(1, 1)).toEqual([1]);
    expect(paginationWindow(7, 14)).toEqual([1, "gap", 6, 7, 8, "gap", 14]);
  });
});
