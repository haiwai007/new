import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES, CATEGORIES } from "./builtin";
import { EXTENDED_TEMPLATES } from "./collection";
import { CATEGORY_COUNTS, templateMatches } from "./catalog";
import { loadTemplateDoc } from "./migrate";
import { generateItems } from "../batch/rules";
import { getParamValue, validateParamValue } from "./params";

describe("expanded editable template catalogue", () => {
  it("contains 120 original scenarios with stable unique ids and 15 populated categories", () => {
    expect(EXTENDED_TEMPLATES).toHaveLength(120);
    expect(BUILTIN_TEMPLATES).toHaveLength(131);
    expect(CATEGORIES).toHaveLength(15);
    expect(new Set(BUILTIN_TEMPLATES.map((t) => t.id)).size).toBe(131);
    expect(new Set(BUILTIN_TEMPLATES.map((t) => t.name)).size).toBe(131);
    expect(CATEGORY_COUNTS).toMatchObject({
      transfer: 20,
      flight: 20,
      credential: 20,
      receipt: 12,
      ticket: 12,
      business: 12,
      education: 12,
      life: 12,
    });
    for (const c of CATEGORIES)
      expect(CATEGORY_COUNTS[c.id]).toBeGreaterThan(0);
  });
  it("loads every new scenario, has valid defaults and keeps editable regions inside the canvas", () => {
    for (const t of EXTENDED_TEMPLATES) {
      const loaded = loadTemplateDoc(t.doc);
      expect(loaded.ok, t.id).toBe(true);
      if (!loaded.ok) continue;
      expect(loaded.warnings, t.id).toEqual([]);
      for (const p of t.doc.parameters) {
        expect(
          validateParamValue(p, p.defaultValue),
          `${t.id}: ${p.name}`,
        ).toBeNull();
        const l = t.doc.layers.find((l) => l.id === p.layerId)!;
        expect(l, `${t.id}: ${p.name}`).toBeDefined();
        expect(l.x).toBeGreaterThanOrEqual(0);
        expect(l.y).toBeGreaterThanOrEqual(0);
        expect(l.x + l.width, `${t.id}: ${p.name}`).toBeLessThanOrEqual(
          t.doc.canvas.width,
        );
        expect(l.y + l.height, `${t.id}: ${p.name}`).toBeLessThanOrEqual(
          t.doc.canvas.height - 82,
        );
      }
      const editable = t.doc.layers.filter((l) =>
        t.doc.parameters.some((p) => p.layerId === l.id),
      );
      for (let i = 0; i < editable.length; i++)
        for (let j = i + 1; j < editable.length; j++) {
          const a = editable[i],
            b = editable[j];
          const overlap =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
          expect(overlap, `${t.id}: ${a.id} overlaps ${b.id}`).toBe(false);
        }
    }
  });
  it("searches categories, descriptions, tags and parameter names together", () => {
    const flight = BUILTIN_TEMPLATES.find(
      (t) => t.id === "bt_flight_international",
    )!;
    expect(templateMatches(flight, "机票 东京")).toBe(true);
    expect(templateMatches(flight, "机票 订单头像")).toBe(false);
    expect(templateMatches(flight, "登机口")).toBe(true);
    expect(
      templateMatches(
        BUILTIN_TEMPLATES.find((t) => t.id === "bt_badge_employee")!,
        "证件 头像",
      ),
    ).toBe(true);
    expect(templateMatches(flight, "   ")).toBe(true);
  });
  it("generates every new template in batches with valid exact order strings and frozen sample labels", () => {
    for (const t of EXTENDED_TEMPLATES) {
      const items = generateItems(t.doc, {}, 3, 123);
      expect(
        items.every((item) => item.errors.length === 0),
        t.id,
      ).toBe(true);
      for (const p of t.doc.parameters.filter((p) => p.type === "order")) {
        const values = items.map((item) => getParamValue(item.doc, p));
        expect(new Set(values).size, t.id).toBe(3);
        for (const value of values) expect(value).toMatch(/^DEMO-\d{10}$/);
      }
      if (t.sample) {
        const label = t.doc.layers.find((l) => l.id === "sample_footer")!;
        expect(label.editable).toBe(false);
        for (const item of items)
          expect(item.doc.layers.find((l) => l.id === label.id)).toEqual(label);
      }
    }
  });
});
