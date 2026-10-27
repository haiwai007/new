import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import {
  createRegionParameter,
  duplicateParameter,
  parameterRenderDoc,
  parameterPreviewDoc,
  setParameterDefault,
  normalizeParameterGeometry,
  resetParameter,
  removeParameterBinding,
} from "./document";
import { applyParamValue, getParamValue } from "../template/params";
import { loadTemplateDoc } from "../template/migrate";
import { referencedAssetIds, removeLayers } from "../template/doc-ops";
import { remapAssetIds } from "../template/package";
const base = () =>
  structuredClone(
    BUILTIN_TEMPLATES.find((t) => t.id === "blank_portrait")!.doc,
  );
describe("editable region parameters", () => {
  it("shares one parameter across positions and keeps independent copies separate", () => {
    let made = createRegionParameter(
      base(),
      { x: 10, y: 10, width: 300, height: 40 },
      "order",
    );
    const p = made.doc.parameters.at(-1)!;
    made = createRegionParameter(
      made.doc,
      { x: 10, y: 100, width: 300, height: 40 },
      "text",
      p.id,
    );
    let doc = applyParamValue(
      made.doc,
      made.doc.parameters.at(-1)!,
      "0012345678",
    );
    expect(
      doc.layers
        .filter((l) => l.type === "text")
        .map((l) => (l.type === "text" ? l.text : "")),
    ).toEqual(["0012345678", "0012345678"]);
    doc = duplicateParameter(doc, p.id);
    const copy = doc.parameters.at(-1)!;
    doc = applyParamValue(doc, copy, "9999999999");
    expect(getParamValue(doc, p)).toBe("0012345678");
    const removed = removeLayers(doc, [p.layerId]);
    expect(removed.parameters.find((q) => q.id === p.id)?.layerId).toBe(
      made.layerId,
    );
  });
  it("keeps temporary content out of the saved document and only promotes the selected image crop", () => {
    let doc = createRegionParameter(
      base(),
      { x: 10, y: 10, width: 100, height: 100 },
      "avatar",
    ).doc;
    doc = createRegionParameter(
      doc,
      { x: 300, y: 10, width: 150, height: 80 },
      "logo",
    ).doc;
    const [a, b] = doc.parameters;
    const patches = {
      [a.layerId]: { focusX: 0.2, cropZoom: 2 },
      [b.layerId]: { focusX: 0.9, cropZoom: 3 },
    };
    const view = parameterPreviewDoc(
      doc,
      { [a.id]: { kind: "asset", assetId: "trial" } },
      patches,
    );
    expect(getParamValue(view, a)).toEqual({ kind: "asset", assetId: "trial" });
    expect(getParamValue(doc, a)).toBeNull();
    const saved = setParameterDefault(
      doc,
      a,
      { kind: "asset", assetId: "trial" },
      patches,
    );
    expect(saved.layers.find((l) => l.id === a.layerId)).toMatchObject({
      focusX: 0.2,
      cropZoom: 2,
    });
    expect(saved.layers.find((l) => l.id === b.layerId)).toMatchObject({
      focusX: 0.5,
      cropZoom: 1,
    });
  });
  it("renders cleanup and transparent image defaults without modifying source assets and remaps backup references", () => {
    let doc = createRegionParameter(
      base(),
      { x: 10, y: 10, width: 100, height: 100 },
      "logo",
    ).doc;
    doc.canvas.backgroundImage = { kind: "asset", assetId: "source" };
    const p = doc.parameters[0];
    p.cleanup = {
      mode: "image",
      color: "#ffffff",
      src: { kind: "asset", assetId: "repair" },
      follow: true,
      rect: { x: 10, y: 10, width: 100, height: 100 },
    };
    const untouched = JSON.stringify(doc);
    expect(
      parameterRenderDoc(doc).layers.find((l) => l.id === p.layerId)?.visible,
    ).toBe(false);
    doc = applyParamValue(doc, p, { kind: "asset", assetId: "logo" });
    expect(
      parameterRenderDoc(doc).layers.some((l) => l.id.includes("_cleanup_")),
    ).toBe(true);
    expect(referencedAssetIds(doc).sort()).toEqual([
      "logo",
      "repair",
      "source",
    ]);
    const restored = remapAssetIds(
      doc,
      new Map([
        ["repair", "repair-new"],
        ["source", "source-new"],
        ["logo", "logo-new"],
      ]),
    );
    expect(restored.parameters[0].cleanup?.src).toEqual({
      kind: "asset",
      assetId: "repair-new",
    });
    expect(loadTemplateDoc(JSON.parse(JSON.stringify(restored))).ok).toBe(true);
    expect(untouched).not.toContain("_cleanup_");
  });
  it("keeps resized avatar geometry while restoring the original picture and crop", () => {
    const initial = createRegionParameter(
      base(),
      { x: 10, y: 10, width: 100, height: 100 },
      "avatar",
    ).doc;
    const p = initial.parameters[0];
    const formal = setParameterDefault(
      initial,
      p,
      { kind: "asset", assetId: "default" },
      { [p.layerId]: { focusX: 0.2, cropZoom: 2 } },
    );
    const changed = applyParamValue(formal, formal.parameters[0], {
      kind: "asset",
      assetId: "replacement",
    });
    const resized = normalizeParameterGeometry(
      {
        ...changed,
        layers: changed.layers.map((l) =>
          l.id === p.layerId ? { ...l, width: 200, height: 200 } : l,
        ),
      },
      changed,
      false,
    );
    const restored = resetParameter(resized, resized.parameters[0]);
    expect(restored.layers.find((l) => l.id === p.layerId)).toMatchObject({
      width: 200,
      height: 200,
      radius: 100,
      focusX: 0.2,
      cropZoom: 2,
      src: { kind: "asset", assetId: "default" },
    });
    expect(loadTemplateDoc(restored).ok).toBe(true);
  });
  it("removing a binding keeps its cleanup artwork and the remaining parameter editable", () => {
    let doc = createRegionParameter(
      base(),
      { x: 10, y: 10, width: 200, height: 40 },
      "order",
    ).doc;
    const p = doc.parameters[0];
    p.cleanup = { ...p.cleanup!, mode: "solid", color: "#abcdef" };
    doc = createRegionParameter(
      doc,
      { x: 10, y: 100, width: 200, height: 40 },
      "text",
    ).doc;
    const before = parameterRenderDoc(doc);
    const removed = removeParameterBinding(doc, p.id);
    expect(removed.parameters).toHaveLength(1);
    expect(parameterRenderDoc(removed).layers).toEqual(before.layers);
    const edited = applyParamValue(
      removed,
      removed.parameters[0],
      "still editable",
    );
    expect(getParamValue(edited, edited.parameters[0])).toBe("still editable");
  });
});
