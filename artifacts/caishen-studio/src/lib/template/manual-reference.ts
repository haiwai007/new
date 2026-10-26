import type { ImageLayer, TemplateDoc } from "../../types/template";
export const MANUAL_REFERENCE_NAME = "原图参考（可隐藏或删除）";
/** Identify the generated reference, never unrelated translucent design elements. */
export function fadedManualReferences(doc: TemplateDoc): ImageLayer[] {
  if (doc.source?.mode !== "manual") return [];
  const originalId = doc.source.originalAssetId;
  return doc.layers.filter(
    (layer): layer is ImageLayer =>
      layer.type === "image" &&
      layer.name === MANUAL_REFERENCE_NAME &&
      layer.visible &&
      layer.src?.kind === "asset" &&
      layer.src.assetId === originalId &&
      layer.opacity < 1,
  );
}
/** An explicit, undoable repair for templates created with the old 35% default. */
export function restoreManualReference(doc: TemplateDoc): TemplateDoc {
  const ids = new Set(fadedManualReferences(doc).map((layer) => layer.id));
  if (!ids.size) return doc;
  return {
    ...doc,
    layers: doc.layers.map((layer) =>
      ids.has(layer.id) ? { ...layer, opacity: 1 } : layer,
    ),
  };
}
