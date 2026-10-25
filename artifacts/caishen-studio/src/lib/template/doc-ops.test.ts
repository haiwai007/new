import { describe, expect, it } from "vitest";
import {
  alignLayers,
  cloneLayers,
  expandToGroups,
  groupLayers,
  referencedAssetIds,
  removeLayers,
  reorderLayer,
  resizeCanvas,
  ungroupLayers,
} from "./doc-ops.ts";
import { createImageLayer, createShapeLayer, createTextLayer } from "./layers.ts";
import { createParameter } from "./params.ts";
import { SCHEMA_VERSION, type TemplateDoc } from "@/types/template.ts";

function doc(): TemplateDoc {
  const a = createShapeLayer("rect", { x: 0, y: 0, width: 100, height: 100 });
  const b = createTextLayer({ x: 200, y: 100, width: 200, height: 50 }, { fontSize: 40 });
  const c = { ...createShapeLayer("ellipse", { x: 500, y: 500, width: 100, height: 100 }), layout: "fixed" as const };
  const d: TemplateDoc = {
    schemaVersion: SCHEMA_VERSION,
    templateId: "t",
    name: "t",
    canvas: { width: 1000, height: 1000, backgroundColor: "#fff", backgroundImage: null },
    layers: [a, b, c],
    parameters: [],
    source: null,
  };
  d.parameters = [createParameter(d, b, "text")];
  return d;
}

describe("doc operations", () => {
  it("reorders layers", () => {
    const d = doc();
    const [a, b, c] = d.layers.map((l) => l.id);
    expect(reorderLayer(d, a, "front").layers.map((l) => l.id)).toEqual([b, c, a]);
    expect(reorderLayer(d, c, "back").layers.map((l) => l.id)).toEqual([c, a, b]);
    expect(reorderLayer(d, a, "forward").layers.map((l) => l.id)).toEqual([b, a, c]);
  });

  it("removing a layer removes its parameters", () => {
    const d = doc();
    const next = removeLayers(d, [d.layers[1].id]);
    expect(next.layers).toHaveLength(2);
    expect(next.parameters).toHaveLength(0);
  });

  it("clones with fresh ids and remaps groups consistently", () => {
    const d = groupLayers(doc(), [doc().layers[0].id]);
    const grouped = groupLayers(d, d.layers.slice(0, 2).map((l) => l.id));
    const clones = cloneLayers(grouped.layers.slice(0, 2));
    expect(clones[0].id).not.toBe(grouped.layers[0].id);
    expect(clones[0].groupId).toBe(clones[1].groupId);
    expect(clones[0].groupId).not.toBe(grouped.layers[0].groupId);
  });

  it("groups and expands selection to whole group, then ungroups", () => {
    const d = doc();
    const g = groupLayers(d, [d.layers[0].id, d.layers[1].id]);
    expect(expandToGroups(g, [d.layers[0].id]).sort()).toEqual([d.layers[0].id, d.layers[1].id].sort());
    const u = ungroupLayers(g, [d.layers[0].id]);
    expect(u.layers.every((l) => l.groupId === null)).toBe(true);
  });

  it("resizes canvas proportionally but keeps fixed layers", () => {
    const d = doc();
    const r = resizeCanvas(d, 2000, 2000, true);
    expect(r.layers[0]).toMatchObject({ x: 0, width: 200 });
    const text = r.layers[1];
    expect(text.type === "text" && text.fontSize).toBe(80);
    expect(r.layers[2]).toMatchObject({ x: 500, width: 100 });
    expect(resizeCanvas(d, 2000, 2000, false).layers).toBe(d.layers);
  });

  it("aligns single layer to canvas and multiple to selection bounds", () => {
    const d = doc();
    const single = alignLayers(d, [d.layers[0].id], "right");
    expect(single.layers[0].x).toBe(900);
    const multi = alignLayers(d, [d.layers[0].id, d.layers[1].id], "bottom");
    expect(multi.layers[0].y + multi.layers[0].height).toBe(150);
  });

  it("collects referenced asset ids", () => {
    const d = doc();
    d.layers.push(createImageLayer({ x: 0, y: 0, width: 1, height: 1 }, { kind: "asset", assetId: "asset_a" }));
    d.canvas.backgroundImage = { kind: "asset", assetId: "asset_b" };
    expect(referencedAssetIds(d).sort()).toEqual(["asset_a", "asset_b"]);
  });
});
