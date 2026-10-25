import type { Layer, TemplateDoc } from "../../types/template.ts";
import { coverMapping } from "../ocr/to-layers.ts";
import type { Rect } from "./inpaint.ts";

// Choosing which canvas areas to repair, and mapping them onto the background image.

export type RepairCandidate = { layerId: string; name: string; kind: "mask" | "text"; box: Rect };

/** Axis-aligned bounds of a (possibly rotated) layer; (x, y) is the rotated top-left corner. */
export function layerBounds(l: Pick<Layer, "x" | "y" | "width" | "height" | "rotation">): Rect {
  const a = (l.rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const pts = [
    [0, 0],
    [l.width, 0],
    [0, l.height],
    [l.width, l.height],
  ].map(([dx, dy]) => [l.x + dx * cos - dy * sin, l.y + dx * sin + dy * cos]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Mask layers always qualify (they exist to hide old content). Visible text
 * layers qualify too: in templates built from a picture, the old text sits
 * right under them on the background.
 */
export function repairCandidates(doc: TemplateDoc): RepairCandidate[] {
  const out: RepairCandidate[] = [];
  for (const l of doc.layers) {
    if (l.type === "text" && l.visible) out.push({ layerId: l.id, name: l.name, kind: "text", box: layerBounds(l) });
    else if (l.type !== "text" && l.type !== "image" && l.isMask) out.push({ layerId: l.id, name: l.name, kind: "mask", box: layerBounds(l) });
  }
  return out;
}

/** Canvas boxes → background-image pixel rects (background is drawn with centered "cover"). */
export function canvasBoxesToImage(boxes: Rect[], image: { width: number; height: number }, canvas: { width: number; height: number }): Rect[] {
  const map = coverMapping(image, canvas);
  return boxes.map((b) => map.toImage(b));
}
