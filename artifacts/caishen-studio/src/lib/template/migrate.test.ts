import { describe, expect, it } from "vitest";
import { loadTemplateDoc } from "./migrate.ts";
import { BUILTIN_TEMPLATES } from "./builtin.ts";

describe("loadTemplateDoc", () => {
  it("accepts every built-in template", () => {
    for (const t of BUILTIN_TEMPLATES) {
      const r = loadTemplateDoc(t.doc);
      expect(r.ok, t.id).toBe(true);
    }
  });

  it("migrates a legacy document without version and fills defaults", () => {
    const r = loadTemplateDoc({
      name: "旧模板",
      canvas: { width: 500, height: 500 },
      layers: [{ id: "a", type: "text", x: 0, y: 0, width: 100, height: 40, text: "hi" }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(1);
    expect(r.doc.canvas.backgroundColor).toBe("#ffffff");
    const l = r.doc.layers[0];
    expect(l.visible).toBe(true);
    expect(l.type === "text" && l.fontSize).toBe(32);
  });

  it("rejects non-objects, future versions, bad layers and duplicate ids", () => {
    expect(loadTemplateDoc(null).ok).toBe(false);
    expect(loadTemplateDoc({ schemaVersion: 99 }).ok).toBe(false);
    const bad = loadTemplateDoc({
      schemaVersion: 1,
      templateId: "x",
      canvas: { width: 100, height: 100 },
      layers: [{ id: "a", type: "text", x: 0, y: 0, width: -5, height: 10, text: "" }],
    });
    expect(bad.ok).toBe(false);
    const dup = loadTemplateDoc({
      schemaVersion: 1,
      templateId: "x",
      canvas: { width: 100, height: 100 },
      layers: [
        { id: "a", type: "rect", x: 0, y: 0, width: 5, height: 5 },
        { id: "a", type: "rect", x: 0, y: 0, width: 5, height: 5 },
      ],
    });
    expect(dup.ok).toBe(false);
  });

  it("drops parameters pointing at missing layers with a warning", () => {
    const r = loadTemplateDoc({
      schemaVersion: 1,
      templateId: "x",
      canvas: { width: 100, height: 100 },
      layers: [],
      parameters: [{ id: "p", name: "标题", type: "text", layerId: "gone", property: "text" }],
    });
    expect(r.ok && r.doc.parameters).toEqual([]);
    expect(r.ok && r.warnings[0]).toMatch(/标题/);
  });
});
