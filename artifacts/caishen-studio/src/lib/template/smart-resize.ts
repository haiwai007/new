import {createShapeLayer} from "./layers";
import { invalidateLocation } from "../status-location/model";
import { refreshPhoneLayers } from "../phone/layers";
import type { Layer, Shadow, TemplateDoc } from "../../types/template.ts";

// Canvas resizing strategies. All functions are pure.

export type ResizeMode = "smart" | "scale" | "none";

export const RESIZE_MODE_LABEL: Record<ResizeMode, string> = {
  smart: "智能适配",
  scale: "等比缩放",
  none: "不调整元素",
};

/** A layer covering at least this share of an axis is treated as full-width/height and stretched. */
const SPAN = 0.9;

type Anchor = "start" | "center" | "end";

/** Which edge a layer sticks to, judged by where its center sits (thirds). */
export function anchorFor(pos: number, size: number, total: number): Anchor {
  const c = (pos + size / 2) / total;
  if (c < 1 / 3) return "start";
  if (c > 2 / 3) return "end";
  return "center";
}

function place(anchor: Anchor, pos: number, size: number, total: number, newSize: number, newTotal: number, s: number) {
  if (anchor === "start") return pos * s;
  if (anchor === "end") return newTotal - (total - pos - size) * s - newSize;
  return ((pos + size / 2) / total) * newTotal - newSize / 2;
}

const scaleShadow = (sh: Shadow | null, s: number): Shadow | null =>
  sh ? { ...sh, blur: sh.blur * s, offsetX: sh.offsetX * s, offsetY: sh.offsetY * s } : null;

/** Scale size-dependent style values (font, stroke, radius, shadow) by `s`. */
export function scaleLayerStyle(l: Layer, s: number): Layer {
  if (l.type === "text") {
    return {
      ...l,
      fontSize: Math.max(1, l.fontSize * s),
      minFontSize: Math.max(1, l.minFontSize * s),
      letterSpacing: l.letterSpacing * s,
      shadow: scaleShadow(l.shadow, s),
    };
  }
  if (l.type === "image") return { ...l, radius: l.radius * s };
  return { ...l, strokeWidth: l.strokeWidth * s, radius: l.radius * s, shadow: scaleShadow(l.shadow, s) };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function round(l: Layer): Layer {
  return { ...l, x: r2(l.x), y: r2(l.y), width: Math.max(1, r2(l.width)), height: Math.max(1, r2(l.height)) };
}

/** Uniform scale, content centered in the new canvas (old behaviour). */
function scaleLayer(l: Layer, sx: number, sy: number): Layer {
  const s = Math.min(sx, sy);
  return scaleLayerStyle(
    {
      ...l,
      x: l.x * sx + (l.width * sx - l.width * s) / 2,
      y: l.y * sy + (l.height * sy - l.height * s) / 2,
      width: l.width * s,
      height: l.height * s,
    },
    s,
  );
}

/**
 * Adapt a layer to a new aspect ratio:
 * - full-width/height elements (backgrounds, banners) stretch along that axis
 * - everything else scales uniformly and keeps its distance to the nearest edge
 *   (left/right/top/bottom) or stays centered
 */
function smartLayer(l: Layer, W: number, H: number, W2: number, H2: number): Layer {
  const sx = W2 / W;
  const sy = H2 / H;
  const s = Math.min(sx, sy);
  const spanX = l.width >= W * SPAN;
  const spanY = l.height >= H * SPAN;
  const w = spanX ? l.width * sx : l.width * s;
  const h = spanY ? l.height * sy : l.height * s;
  const x = spanX ? l.x * sx : place(anchorFor(l.x, l.width, W), l.x, l.width, W, w, W2, s);
  const y = spanY ? l.y * sy : place(anchorFor(l.y, l.height, H), l.y, l.height, H, h, H2, s);
  return scaleLayerStyle({ ...l, x, y, width: w, height: h }, s);
}

export function resizeDoc(doc: TemplateDoc, width: number, height: number, mode: ResizeMode): TemplateDoc {
  const W2 = Math.round(width);
  const H2 = Math.round(height);
  const { width: W, height: H } = doc.canvas;
  const canvas = { ...doc.canvas, width: W2, height: H2 };
  if (mode === "none" || (W === W2 && H === H2)) return refreshPhoneLayers(invalidateLocation({ ...doc, canvas }), doc);
  const layers = doc.layers.map((l) => {
    if (l.layout === "fixed") return l;
    return round(mode === "smart" ? smartLayer(l, W, H, W2, H2) : scaleLayer(l, W2 / W, H2 / H));
  });
  const parameters=doc.parameters.map(p=>{
    if(!p.cleanup||p.cleanup.follow)return p;
    const frame=createShapeLayer("rect",p.cleanup.rect);
    const moved=mode === "smart" ? smartLayer(frame,W,H,W2,H2) : scaleLayer(frame,W2/W,H2/H);
    return {...p,cleanup:{...p.cleanup,rect:{x:moved.x,y:moved.y,width:moved.width,height:moved.height}}};
  });
  return refreshPhoneLayers(invalidateLocation({ ...doc, canvas, layers, parameters }), doc);
}
