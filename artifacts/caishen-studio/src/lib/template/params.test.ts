import { describe, expect, it } from "vitest";
import { findBuiltin } from "./builtin.ts";
import {
  applyParamValue,
  applyParamValues,
  createParameter,
  getParamValue,
  resetParamsToDefault,
  suggestParameters,
  validateParamValue,
} from "./params.ts";
import { moveLayerTo } from "./doc-ops.ts";
import { createImageLayer, createTextLayer } from "./layers.ts";
import { SCHEMA_VERSION, type TemplateDoc, type TemplateParameter } from "../../types/template.ts";

const coffee = findBuiltin("bt_coffee")!.doc;
const param = (id: string): TemplateParameter => coffee.parameters.find((p) => p.id === id)!;

function emptyDoc(): TemplateDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    templateId: "t",
    name: "t",
    canvas: { width: 1000, height: 1000, backgroundColor: "#fff", backgroundImage: null },
    layers: [],
    parameters: [],
    source: null,
  };
}

describe("parameter binding", () => {
  it("updates only the bound layer", () => {
    const next = applyParamValue(coffee, param("p_title"), "生椰冷萃");
    const title = next.layers.find((l) => l.id === "text_title");
    expect(title?.type === "text" && title.text).toBe("生椰冷萃");
    const others = next.layers.filter((l) => l.id !== "text_title");
    others.forEach((l) => expect(l).toBe(coffee.layers.find((o) => o.id === l.id)));
  });

  it("binds by layer id, so reordering layers does not break bindings", () => {
    const reordered = moveLayerTo(coffee, "text_title", 0);
    const next = applyParamValue(reordered, param("p_title"), "新标题");
    expect(getParamValue(next, param("p_title"))).toBe("新标题");
    expect(next.layers[0].id).toBe("text_title");
  });

  it("toggles visibility and coerces color/opacity values", () => {
    const hidden = applyParamValue(coffee, param("p_tag_show"), false);
    expect(hidden.layers.find((l) => l.id === "text_tag")?.visible).toBe(false);
    const recolored = applyParamValue(coffee, param("p_band"), "#000000");
    expect(getParamValue(recolored, param("p_band"))).toBe("#000000");
  });

  it("ignores non-positive width/height", () => {
    const p: TemplateParameter = { ...param("p_title"), id: "w", type: "width", property: "width" };
    expect(applyParamValue(coffee, p, 0)).toEqual(coffee);
  });

  it("resets all parameters to defaults", () => {
    const changed = applyParamValues(coffee, { p_title: "A", p_price: "¥1" });
    const reset = resetParamsToDefault(changed);
    expect(getParamValue(reset, param("p_title"))).toBe("桂花燕麦拿铁");
    expect(getParamValue(reset, param("p_price"))).toBe("¥28");
  });

  it("does not leak values between two templates", () => {
    const travel = findBuiltin("bt_travel")!.doc;
    const next = applyParamValues(travel, { p_title: "污染" });
    expect(next).toEqual(travel);
  });
});

describe("validateParamValue", () => {
  const base = param("p_title");
  it("enforces required and max length (by characters)", () => {
    expect(validateParamValue(base, "")).toMatch(/不能为空/);
    expect(validateParamValue(base, "一二三四五六七八九十一二")).toBeNull();
    expect(validateParamValue(base, "一二三四五六七八九十一二三")).toMatch(/最多 12/);
  });
  it("checks numbers, ranges, dates and select options", () => {
    const num: TemplateParameter = { ...base, type: "number", required: false, rules: { min: 0, max: 10 } };
    expect(validateParamValue(num, "abc")).toMatch(/数字/);
    expect(validateParamValue(num, "11")).toMatch(/不能大于 10/);
    expect(validateParamValue(num, "5")).toBeNull();
    const date: TemplateParameter = { ...base, type: "date", required: false, rules: {} };
    expect(validateParamValue(date, "2026-10-01")).toBeNull();
    expect(validateParamValue(date, "明天")).toMatch(/日期/);
    const sel: TemplateParameter = { ...base, type: "select", required: false, rules: { options: ["A", "B"] } };
    expect(validateParamValue(sel, "C")).toMatch(/可选值/);
  });
  it("allows empty optional values", () => {
    expect(validateParamValue({ ...base, required: false, allowEmpty: true }, "")).toBeNull();
  });
});

describe("suggestParameters", () => {
  it("names the largest text 主标题, detects dates, uses neutral names otherwise", () => {
    const doc = emptyDoc();
    doc.layers = [
      createTextLayer({ x: 0, y: 0, width: 100, height: 50 }, { text: "大标题", fontSize: 80 }),
      createTextLayer({ x: 0, y: 0, width: 100, height: 50 }, { text: "2026-10-01", fontSize: 20 }),
      createTextLayer({ x: 0, y: 0, width: 100, height: 50 }, { text: "说明", fontSize: 20 }),
      createImageLayer({ x: 0, y: 0, width: 100, height: 100 }, null),
    ];
    const s = suggestParameters(doc);
    expect(s.map((p) => [p.name, p.type])).toEqual([
      ["主标题", "text"],
      ["日期 2", "date"],
      ["文本 3", "text"],
      ["图片 1", "image"],
    ]);
    expect(s[0].defaultValue).toBe("大标题");
    expect(new Set(s.map((p) => p.id)).size).toBe(4);
  });

  it("skips layers already bound", () => {
    const doc = emptyDoc();
    const t = createTextLayer({ x: 0, y: 0, width: 10, height: 10 }, { text: "x" });
    doc.layers = [t];
    doc.parameters = [createParameter(doc, t, "text", "已有")];
    expect(suggestParameters(doc)).toHaveLength(0);
  });
});

describe("untrusted parameter patterns", () => {
  const base = param("p_title");
  it("handles nested quantifiers without exponential backtracking", () => {
    const p = { ...base, rules: { pattern: "(a+)+" } };
    expect(validateParamValue(p, "a".repeat(9000) + "!")).toMatch(/格式不正确/);
  });
  it("rejects invalid/unsupported imported rules instead of silently skipping validation", () => {
    for (const pattern of ["[", "(a)\\1", "(?=a)a", "a".repeat(501)])
      expect(validateParamValue({ ...base, rules: { pattern } }, "a")).toMatch(/不受支持/);
  });
  it("supports full matches, Unicode and the existing phone/email/price presets", async () => {
    const { PATTERN_PRESETS } = await import("./params");
    const examples = ["13800138000", "a@example.com", "https://example.com", "123", "¥19.9"];
    PATTERN_PRESETS.forEach((preset, i) => {
      const p = { ...base, rules: { pattern: preset.pattern } };
      expect(validateParamValue(p, examples[i])).toBeNull();
      expect(validateParamValue(p, examples[i] + "\nINVALID")).not.toBeNull();
    });
    expect(validateParamValue({ ...base, rules: { pattern: "[海神]+" } }, "海神")).toBeNull();
  });
});
