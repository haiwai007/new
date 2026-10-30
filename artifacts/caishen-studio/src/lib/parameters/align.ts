import type { TemplateDoc } from "@/types/template";
import {
  alignLayers,
  updateLayers,
  type AlignAction,
} from "@/lib/template/doc-ops";
import { parameterLayerIds } from "./document";

export type ParameterAlignAction =
  AlignAction | "width" | "height" | "distribute-x" | "distribute-y";
export function selectedParameterLayers(doc: TemplateDoc, ids: string[]) {
  const bound = new Set(doc.parameters.flatMap(parameterLayerIds));
  return ids.flatMap((id) => {
    const layer = doc.layers.find((l) => l.id === id);
    return layer && bound.has(id) && layer.visible && !layer.locked
      ? [layer]
      : [];
  });
}

/** Only editable parameter regions participate; never aligns a lone region to the canvas. */
export function alignParameterRegions(
  doc: TemplateDoc,
  ids: string[],
  action: ParameterAlignAction,
  referenceId?: string,
): TemplateDoc {
  const layers = selectedParameterLayers(doc, [...new Set(ids)]);
  if (layers.length < 2) return doc;
  const reference = layers.find((l) => l.id === referenceId) ?? layers[0];
  if (action === "distribute-x" || action === "distribute-y") {
    if (layers.length < 3) return doc;
    const axis = action === "distribute-x" ? "x" : "y";
    const size = axis === "x" ? "width" : "height";
    const sorted = [...layers].sort((a, b) => a[axis] - b[axis]);
    const first = sorted[0],
      last = sorted[sorted.length - 1];
    const gap =
      (last[axis] +
        last[size] -
        first[axis] -
        sorted.reduce((sum, l) => sum + l[size], 0)) /
      (sorted.length - 1);
    // Do not introduce overlap when the selected span cannot fit these regions.
    if (gap < 0) return doc;
    let position = first[axis] + first[size] + gap;
    const patches: Parameters<typeof updateLayers>[1] = {};
    for (const l of sorted.slice(1, -1)) {
      patches[l.id] = { [axis]: position };
      position += l[size] + gap;
    }
    return updateLayers(doc, patches);
  }
  if (action === "width" || action === "height") {
    return updateLayers(
      doc,
      Object.fromEntries(
        layers.map((l) => [l.id, { [action]: reference[action] }]),
      ),
    );
  }
  if (!referenceId)
    return alignLayers(
      doc,
      layers.map((l) => l.id),
      action,
    );
  const aligned = alignLayers(
    doc,
    layers.map((l) => l.id),
    action,
  );
  const target = aligned.layers.find((l) => l.id === reference.id)!;
  const axis = ["left", "right", "hcenter"].includes(action) ? "x" : "y";
  const delta = reference[axis] - target[axis];
  return updateLayers(
    doc,
    Object.fromEntries(
      layers.map((l) => {
        const moved = aligned.layers.find((x) => x.id === l.id)!;
        return [l.id, { [axis]: moved[axis] + delta }];
      }),
    ),
  );
}
