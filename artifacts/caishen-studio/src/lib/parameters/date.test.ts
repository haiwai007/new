import { describe, it, expect } from "vitest";
import { dateParts, dateInput, dateValue } from "./date";
import { validateParamValue } from "../template/params";
import { createRng, generateItems, defaultRule } from "../batch/rules";
import { makeTemplate, titleParam, textLayer } from "../batch/test-fixtures";
import { parseTemplateFile, buildPackage } from "../template/package";
const parameter = {
  ...titleParam,
  type: "date" as const,
  defaultValue: "2026-10-27",
  rules: {},
};
describe("optional date time precision", () => {
  it("accepts existing date formats and optional minutes or seconds, rejects impossible values", () => {
    for (const value of [
      "2026-10-27",
      "2026/10/27",
      "2026年10月27日",
      "2026.10.27",
      "2026-10-27 08:09",
      "2026-10-27T08:09:37",
      "2024-02-29 23:59:59",
    ]) {
      expect(dateParts(value)).not.toBeNull();
      expect(validateParamValue(parameter, value)).toBeNull();
    }
    for (const value of [
      "2026-02-29",
      "2026-10-32",
      "2026-10-27 24:00:00",
      "2026-10-27 08:60:00",
      "2026-10-27 08:09:60",
    ]) {
      expect(validateParamValue(parameter, value)).not.toBeNull();
    }
  });
  it("converts input locally without shifting timezone and seconds stay optional", () => {
    expect(dateInput("2026年10月27日 23:59:37", "second")).toBe(
      "2026-10-27T23:59:37",
    );
    expect(dateValue("2026-10-27T23:59:37", "second")).toBe(
      "2026-10-27 23:59:37",
    );
    expect(dateValue("2026-10-27T23:59:37", "minute")).toBe("2026-10-27 23:59");
    expect(dateValue("2026-10-27T23:59:37", "date")).toBe("2026-10-27");
    expect(dateValue("2026-10-27", "second")).toBe("2026-10-27 00:00:00");
  });
  it("round trips configured precision and produces repeatable valid seconds within a narrow batch interval", () => {
    const param = { ...parameter, rules: { datePrecision: "second" as const } };
    const doc = makeTemplate();
    doc.parameters = [param];
    doc.layers = [textLayer(param.layerId, "2026-10-27 20:06:17")];
    const packed = parseTemplateFile(buildPackage(doc, []));
    expect(packed.ok).toBe(true);
    if (!packed.ok) return;
    expect(packed.doc.parameters[0].rules.datePrecision).toBe("second");
    expect(defaultRule("dateRange", param, param.defaultValue)).toMatchObject({
      format: "yyyy-MM-dd HH:mm:ss",
    });
    expect(
      defaultRule("dateRange", parameter, parameter.defaultValue),
    ).toMatchObject({ format: "yyyy-MM-dd" });
    const rule = {
      mode: "dateRange" as const,
      start: "2026-10-27T20:06:17",
      end: "2026-10-27T20:06:23",
      format: "yyyy-MM-dd HH:mm:ss" as const,
    };
    const generate = () => generateItems(doc, { [param.id]: rule }, 30, 491);
    const a = generate();
    expect(a).toEqual(generate());
    const values = a.map((item) => {
      expect(item.errors).toEqual([]);
      const layer = item.doc.layers[0];
      expect(layer.type).toBe("text");
      return layer.type === "text" ? layer.text : "";
    });
    for (const value of values) {
      expect(
        value >= "2026-10-27 20:06:17" && value <= "2026-10-27 20:06:23",
      ).toBe(true);
    }
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});
