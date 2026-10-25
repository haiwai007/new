import type { Layer, TemplateDoc } from "../../types/template.ts";
import { newId } from "./ids.ts";
import { resizeDoc } from "./smart-resize.ts";

// Pure document operations. Every function returns a new document.

export function updateLayer(
  doc: TemplateDoc,
  id: string,
  patch: Partial<Layer>,
): TemplateDoc {
  return {
    ...doc,
    layers: doc.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
  };
}

export function updateLayers(
  doc: TemplateDoc,
  patches: Record<string, Partial<Layer>>,
): TemplateDoc {
  return {
    ...doc,
    layers: doc.layers.map((l) =>
      patches[l.id] ? ({ ...l, ...patches[l.id] } as Layer) : l,
    ),
  };
}

export function addLayers(doc: TemplateDoc, layers: Layer[]): TemplateDoc {
  return { ...doc, layers: [...doc.layers, ...layers] };
}

export function removeLayers(doc: TemplateDoc, ids: string[]): TemplateDoc {
  const set = new Set(ids);
  return {
    ...doc,
    layers: doc.layers.filter((l) => !set.has(l.id)),
    // Parameters bound to removed layers would dangle, so drop them too.
    parameters: doc.parameters.filter((p) => !set.has(p.layerId)),
  };
}

/** Clone layers with fresh ids and an offset. Groups get new group ids. */
export function cloneLayers(layers: Layer[], offset = 20): Layer[] {
  const groupMap = new Map<string, string>();
  return layers.map((l) => {
    let groupId = l.groupId;
    if (groupId) {
      const mapped = groupMap.get(groupId) ?? newId("group");
      groupMap.set(groupId, mapped);
      groupId = mapped;
    }
    return {
      ...l,
      id: newId(l.type),
      name: `${l.name} 副本`,
      x: l.x + offset,
      y: l.y + offset,
      groupId,
      locked: false,
    };
  });
}

export type ReorderAction = "front" | "back" | "forward" | "backward";

export function reorderLayer(
  doc: TemplateDoc,
  id: string,
  action: ReorderAction,
): TemplateDoc {
  const idx = doc.layers.findIndex((l) => l.id === id);
  if (idx < 0) return doc;
  const layers = [...doc.layers];
  const [item] = layers.splice(idx, 1);
  const target =
    action === "front"
      ? layers.length
      : action === "back"
        ? 0
        : action === "forward"
          ? Math.min(layers.length, idx + 1)
          : Math.max(0, idx - 1);
  layers.splice(target, 0, item);
  return { ...doc, layers };
}

/** Move a layer to an explicit index (used by drag in the layer list). */
export function moveLayerTo(doc: TemplateDoc, id: string, index: number): TemplateDoc {
  const idx = doc.layers.findIndex((l) => l.id === id);
  if (idx < 0) return doc;
  const layers = [...doc.layers];
  const [item] = layers.splice(idx, 1);
  layers.splice(Math.max(0, Math.min(layers.length, index)), 0, item);
  return { ...doc, layers };
}

export function groupLayers(doc: TemplateDoc, ids: string[]): TemplateDoc {
  if (ids.length < 2) return doc;
  const groupId = newId("group");
  const set = new Set(ids);
  return {
    ...doc,
    layers: doc.layers.map((l) => (set.has(l.id) ? { ...l, groupId } : l)),
  };
}

export function ungroupLayers(doc: TemplateDoc, ids: string[]): TemplateDoc {
  const set = new Set(ids);
  const groups = new Set(
    doc.layers.filter((l) => set.has(l.id) && l.groupId).map((l) => l.groupId),
  );
  return {
    ...doc,
    layers: doc.layers.map((l) => (groups.has(l.groupId) ? { ...l, groupId: null } : l)),
  };
}

/** Expand a selection to include every layer in the same groups. */
export function expandToGroups(doc: TemplateDoc, ids: string[]): string[] {
  const set = new Set(ids);
  const groups = new Set(
    doc.layers.filter((l) => set.has(l.id) && l.groupId).map((l) => l.groupId),
  );
  return doc.layers
    .filter((l) => set.has(l.id) || (l.groupId !== null && groups.has(l.groupId)))
    .map((l) => l.id);
}

/**
 * Resize the canvas. Layers with "relative" layout keep their proportional
 * position and scale; "fixed" layers keep their absolute coordinates.
 * See `resizeDoc` for the smart (edge-anchored) strategy.
 */
export function resizeCanvas(
  doc: TemplateDoc,
  width: number,
  height: number,
  scaleContent: boolean,
): TemplateDoc {
  return resizeDoc(doc, width, height, scaleContent ? "scale" : "none");
}

export type AlignAction = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

/**
 * Align layers. With one layer, aligns to the canvas; with several, aligns to
 * the selection's bounding box. Rotation is ignored for simplicity.
 */
export function alignLayers(
  doc: TemplateDoc,
  ids: string[],
  action: AlignAction,
): TemplateDoc {
  const targets = doc.layers.filter((l) => ids.includes(l.id) && !l.locked);
  if (targets.length === 0) return doc;
  const bounds =
    targets.length === 1
      ? { x1: 0, y1: 0, x2: doc.canvas.width, y2: doc.canvas.height }
      : {
          x1: Math.min(...targets.map((l) => l.x)),
          y1: Math.min(...targets.map((l) => l.y)),
          x2: Math.max(...targets.map((l) => l.x + l.width)),
          y2: Math.max(...targets.map((l) => l.y + l.height)),
        };
  const patches: Record<string, Partial<Layer>> = {};
  for (const l of targets) {
    switch (action) {
      case "left":
        patches[l.id] = { x: bounds.x1 };
        break;
      case "right":
        patches[l.id] = { x: bounds.x2 - l.width };
        break;
      case "hcenter":
        patches[l.id] = { x: (bounds.x1 + bounds.x2 - l.width) / 2 };
        break;
      case "top":
        patches[l.id] = { y: bounds.y1 };
        break;
      case "bottom":
        patches[l.id] = { y: bounds.y2 - l.height };
        break;
      case "vcenter":
        patches[l.id] = { y: (bounds.y1 + bounds.y2 - l.height) / 2 };
        break;
    }
  }
  return updateLayers(doc, patches);
}

/** Asset ids referenced anywhere in the document. */
export function referencedAssetIds(doc: TemplateDoc): string[] {
  const ids = new Set<string>();
  if (doc.canvas.backgroundImage?.kind === "asset") ids.add(doc.canvas.backgroundImage.assetId);
  if (doc.source) ids.add(doc.source.originalAssetId);
  for (const l of doc.layers) {
    if (l.type === "image" && l.src?.kind === "asset") ids.add(l.src.assetId);
  }
  for (const p of doc.parameters) {
    const v = p.defaultValue;
    if (v && typeof v === "object" && v.kind === "asset") ids.add(v.assetId);
  }
  return [...ids];
}
