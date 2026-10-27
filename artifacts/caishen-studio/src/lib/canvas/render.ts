import { parameterRenderDoc } from "../parameters/document";
import { hasLocationPixelMask, locationPixelMask, restoreOutsideLocation, type LocationPixelMask } from "../status-location/pixel-mask";
import {
  FabricImage,
  Rect,
  Ellipse,
  Triangle,
  Textbox,
  Shadow as FabricShadow,
  StaticCanvas,
  util,
  type FabricObject,
} from "fabric";
import type { Layer, Shadow, ShapeLayer, TemplateDoc, TextLayer, ImageLayer } from "../../types/template.ts";
import { ensureFont, isFontAvailable } from "./fonts.ts";
import { loadImage } from "./image-cache.ts";
import { computeImageGeometry } from "./image-geometry.ts";
import { focusForPoint, imageDetailCenter } from "./smart-focus.ts";

// Translates template layers into Fabric objects and back. Every object is
// placed with a top-left origin; (x, y) is the rotated top-left corner.

export type ObjectMeta = {
  layerId: string;
  /** Stroke included in Fabric's dimensions. */
  sw: number;
  /** Offset of the displayed object inside the layer box (unscaled, local). */
  offX: number;
  offY: number;
  baseScaleX: number;
  baseScaleY: number;
  overflow: boolean;
  missing: boolean;
};

export type BuiltObject = { obj: FabricObject; meta: ObjectMeta };

const ACCENT = "#c8102e";

function rot(dx: number, dy: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

function toFabricShadow(s: Shadow | null) {
  return s ? new FabricShadow({ color: s.color, blur: s.blur, offsetX: s.offsetX, offsetY: s.offsetY }) : null;
}

function commonProps(layer: Layer, interactive: boolean) {
  const canInteract = interactive && !layer.locked;
  return {
    originX: "left" as const,
    originY: "top" as const,
    angle: layer.rotation,
    opacity: layer.opacity,
    visible: layer.visible,
    selectable: canInteract,
    evented: canInteract,
    hoverCursor: canInteract ? "move" : "default",
    lockScalingFlip: true,
    borderColor: ACCENT,
    cornerColor: "#ffffff",
    cornerStrokeColor: ACCENT,
    cornerStyle: "circle" as const,
    cornerSize: 11,
    touchCornerSize: 44,
    transparentCorners: false,
    borderScaleFactor: 1.5,
    padding: 0,
  };
}

function meta(layerId: string, partial: Partial<ObjectMeta> = {}): ObjectMeta {
  return {
    layerId,
    sw: 0,
    offX: 0,
    offY: 0,
    baseScaleX: 1,
    baseScaleY: 1,
    overflow: false,
    missing: false,
    ...partial,
  };
}

async function buildText(layer: TextLayer, interactive: boolean): Promise<BuiltObject> {
  await ensureFont(layer.fontFamily, layer.fontWeight, layer.fontStyle, layer.text);
  let fontSize = layer.fontSize;
  const tb = new Textbox(layer.text.length ? layer.text : " ", {
    ...commonProps(layer, interactive),
    width: layer.wrap ? layer.width : 100000,
    fontSize,
    fontFamily: layer.fontFamily,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle,
    fill: layer.fill,
    textAlign: layer.textAlign,
    lineHeight: layer.lineHeight,
    charSpacing: (layer.letterSpacing / Math.max(1, fontSize)) * 1000,
    // CJK text has no spaces, so wrapping must be per character.
    splitByGrapheme: true,
    shadow: toFabricShadow(layer.shadow),
    editable: interactive && layer.editable && !layer.locked,
    lockScalingY: false,
  });
  if (!layer.wrap) {
    tb.set({ width: Math.max(layer.width, tb.calcTextWidth() + 2) });
    tb.initDimensions();
  }
  const tooTall = () => tb.height > layer.height + 0.5;
  const tooManyLines = () => layer.maxLines > 0 && tb.textLines.length > layer.maxLines;
  const exceeds = () => tooTall() || tooManyLines();
  if (layer.autoShrink) {
    let guard = 0;
    while (exceeds() && fontSize > layer.minFontSize && guard < 80) {
      fontSize = Math.max(layer.minFontSize, fontSize - Math.max(0.5, fontSize * 0.05));
      tb.set({ fontSize, charSpacing: (layer.letterSpacing / fontSize) * 1000 });
      tb.initDimensions();
      guard += 1;
    }
  }
  // With auto-grow the box simply extends downwards, so extra height is not an overflow.
  const overflow = layer.autoGrow ? tooManyLines() : exceeds();
  const factor = layer.verticalAlign === "middle" ? 0.5 : layer.verticalAlign === "bottom" ? 1 : 0;
  const offY = Math.max(0, (layer.height - tb.height) * factor);
  const p = rot(0, offY, layer.rotation);
  tb.set({ left: layer.x + p.x, top: layer.y + p.y });
  tb.setCoords();
  return { obj: tb, meta: meta(layer.id, { offY, overflow }) };
}

function placeholder(layer: ImageLayer | Layer, interactive: boolean, missing: boolean): BuiltObject {
  const r = new Rect({
    ...commonProps(layer, interactive),
    left: layer.x,
    top: layer.y,
    width: layer.width - 2,
    height: layer.height - 2,
    fill: missing ? "rgba(200,16,46,0.08)" : "rgba(120,110,90,0.12)",
    stroke: missing ? ACCENT : "#a0947c",
    strokeWidth: 2,
    strokeDashArray: [12, 8],
    rx: layer.type === "image" ? layer.radius : 0,
    ry: layer.type === "image" ? layer.radius : 0,
  });
  r.setCoords();
  return { obj: r, meta: meta(layer.id, { sw: 2, missing }) };
}

async function buildImage(layer: ImageLayer, interactive: boolean): Promise<BuiltObject> {
  if (!layer.src) return placeholder(layer, interactive, false);
  let el: HTMLImageElement;
  try {
    el = await loadImage(layer.src);
  } catch {
    return placeholder(layer, interactive, true);
  }
  const natW = el.naturalWidth || el.width;
  const natH = el.naturalHeight || el.height;
  // Auto focus follows the picture's detail so replaced images stay well framed.
  const focus =
    layer.autoFocus && layer.fit === "cover"
      ? focusForPoint(imageDetailCenter(el), layer.width, layer.height, natW, natH, layer.cropZoom)
      : { x: layer.focusX, y: layer.focusY };
  const g = computeImageGeometry(
    layer.width,
    layer.height,
    natW,
    natH,
    layer.fit,
    focus.x,
    focus.y,
    layer.cropZoom,
  );
  if(layer.fit==="contain"&&layer.containAlign){g.scaleX*=layer.containScale??1;g.scaleY*=layer.containScale??1;}
  const dispW = g.width * g.scaleX;
  const dispH = g.height * g.scaleY;
  const offX = (layer.width - dispW) * (layer.fit==="contain"&&layer.containAlign?layer.focusX:.5);
  const offY = (layer.height - dispH) * (layer.fit==="contain"&&layer.containAlign?layer.focusY:.5);
  const p = rot(offX, offY, layer.rotation);
  let displayed: HTMLImageElement | HTMLCanvasElement = el;
  if (layer.tint) {
    const tint = document.createElement("canvas"); tint.width = natW; tint.height = natH;
    const ctx = tint.getContext("2d");
    if (ctx) {ctx.drawImage(el,0,0); ctx.globalCompositeOperation = "source-in"; ctx.fillStyle = layer.tint; ctx.fillRect(0,0,natW,natH); displayed = tint;}
  }
  const img = new FabricImage(displayed, {
    ...commonProps(layer, interactive),
    left: layer.x + p.x,
    top: layer.y + p.y,
    cropX: g.cropX,
    cropY: g.cropY,
    width: g.width,
    height: g.height,
    scaleX: g.scaleX,
    scaleY: g.scaleY,
  });
  if (layer.radius > 0) {
    img.clipPath = new Rect({
      originX: "center",
      originY: "center",
      width: g.width,
      height: g.height,
      rx: layer.radius / g.scaleX,
      ry: layer.radius / g.scaleY,
    });
  }
  img.setCoords();
  return {
    obj: img,
    meta: meta(layer.id, { offX, offY, baseScaleX: g.scaleX, baseScaleY: g.scaleY }),
  };
}

function buildShape(layer: ShapeLayer, interactive: boolean): BuiltObject {
  const sw = layer.type === "line" ? 0 : layer.strokeWidth;
  const w = Math.max(1, layer.width - sw);
  const h = Math.max(1, layer.height - sw);
  const props = {
    ...commonProps(layer, interactive),
    left: layer.x,
    top: layer.y,
    fill: layer.fill,
    stroke: sw > 0 ? layer.stroke : undefined,
    strokeWidth: sw,
    shadow: toFabricShadow(layer.shadow),
  };
  let obj: FabricObject;
  if (layer.type === "ellipse") {
    obj = new Ellipse({ ...props, rx: w / 2, ry: h / 2 });
  } else if (layer.type === "triangle") {
    obj = new Triangle({ ...props, width: w, height: h });
  } else {
    obj = new Rect({ ...props, width: w, height: h, rx: layer.radius, ry: layer.radius });
  }
  obj.setCoords();
  return { obj, meta: meta(layer.id, { sw }) };
}

export async function buildObject(layer: Layer, interactive: boolean): Promise<BuiltObject> {
  if (layer.type === "text") return buildText(layer, interactive);
  if (layer.type === "image") return buildImage(layer, interactive);
  return buildShape(layer, interactive);
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Read an object's scene geometry back into layer fields. */
export function readGeometry(obj: FabricObject, m: ObjectMeta, layer: Layer): Partial<Layer> {
  const d = util.qrDecompose(obj.calcTransformMatrix());
  const w = ((obj.width ?? 0) + m.sw) * d.scaleX;
  const h = ((obj.height ?? 0) + m.sw) * d.scaleY;
  const c = rot(-w / 2, -h / 2, d.angle);
  const cornerX = d.translateX + c.x;
  const cornerY = d.translateY + c.y;
  const angle = round(((d.angle % 360) + 360) % 360);

  if (layer.type === "text") {
    const sy = d.scaleY;
    const off = rot(0, m.offY * sy, d.angle);
    const tbHeight = (obj.height ?? 0) * sy;
    return {
      x: round(cornerX - off.x),
      y: round(cornerY - off.y),
      width: round((obj.width ?? 0) * d.scaleX),
      height: round(Math.max(layer.height * sy, tbHeight)),
      fontSize: round(layer.fontSize * sy),
      rotation: angle,
    };
  }
  if (layer.type === "image" && !m.missing && layer.src) {
    const fx = d.scaleX / m.baseScaleX;
    const fy = d.scaleY / m.baseScaleY;
    const off = rot(m.offX * fx, m.offY * fy, d.angle);
    return {
      x: round(cornerX - off.x),
      y: round(cornerY - off.y),
      width: round(Math.max(1, layer.width * fx)),
      height: round(Math.max(1, layer.height * fy)),
      rotation: angle,
    };
  }
  return {
    x: round(cornerX),
    y: round(cornerY),
    width: round(Math.max(1, w)),
    height: round(Math.max(1, h)),
    rotation: angle,
  };
}

export async function buildBackground(doc: TemplateDoc): Promise<FabricImage | null> {
  const src = doc.canvas.backgroundImage;
  if (!src) return null;
  try {
    const el = await loadImage(src);
    const natW = el.naturalWidth || el.width;
    const natH = el.naturalHeight || el.height;
    const g = computeImageGeometry(doc.canvas.width, doc.canvas.height, natW, natH, "cover", 0.5, 0.5, 1);
    return new FabricImage(el, {
      originX: "left",
      originY: "top",
      left: 0,
      top: 0,
      cropX: g.cropX,
      cropY: g.cropY,
      width: g.width,
      height: g.height,
      scaleX: g.scaleX,
      scaleY: g.scaleY,
    });
  } catch {
    return null;
  }
}

export type RenderResult = { canvas: HTMLCanvasElement; warnings: string[] };

/**
 * Render a document at full resolution, independent of the editor's zoom.
 * Used for export, preview, thumbnails and batch generation.
 */
export async function renderDoc(
  doc: TemplateDoc,
  opts: { multiplier: number; transparent?: boolean },
): Promise<RenderResult> {
  doc = parameterRenderDoc(doc);
  const warnings: string[] = [];
  const el = document.createElement("canvas");
  const sc = new StaticCanvas(el, {
    width: doc.canvas.width,
    height: doc.canvas.height,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  try {
    sc.backgroundColor = opts.transparent ? "" : doc.canvas.backgroundColor;
    if (!opts.transparent && doc.canvas.backgroundImage) {
      const bg = await buildBackground(doc);
      if (bg) sc.backgroundImage = bg;
      else warnings.push("画布背景图片加载失败");
    }
    const built = await Promise.all(
      doc.layers.filter((l) => l.visible).map((l) => buildObject(l, false)),
    );
    for (const [i, b] of built.entries()) {
      const layer = doc.layers.filter((l) => l.visible)[i];
      if (b.meta.missing) warnings.push(`图片「${layer.name}」无法加载，导出时显示为占位框`);
      if (layer.type === "image" && !layer.src) warnings.push(`图片框「${layer.name}」尚未放入图片`);
      if (b.meta.overflow) warnings.push(`文字「${layer.name}」超出文本框`);
      if (layer.type === "text" && !isFontAvailable(layer.fontFamily, layer.fontWeight, layer.text)) {
        warnings.push(`字体「${layer.fontFamily}」未完全加载，将使用系统字体代替`);
      }
      sc.add(b.obj);
    }
    let original: { mask: LocationPixelMask; pixels: ImageData }[] = [];
    if (hasLocationPixelMask(doc)) {
      const generated = built.filter(b => {
        const layer = doc.layers.find(l => l.id === b.meta.layerId)!;
        return layer.groupId === doc.phone!.groupId && layer.id.startsWith(`${doc.phone!.groupId}_`);
      });
      for (const b of generated) b.obj.visible = false;
      let baseline: HTMLCanvasElement | undefined;
      try {
        sc.renderAll();
        baseline = sc.toCanvasElement(opts.multiplier);
        const mask = locationPixelMask(doc, baseline.width, baseline.height);
        original = mask.tiles.map(tile => ({
          mask: { ...mask, ...tile },
          pixels: baseline!.getContext("2d")!.getImageData(tile.x, tile.y, tile.width, tile.height),
        }));
      } finally {
        if (baseline) baseline.width = baseline.height = 0;
        for (const b of generated) b.obj.visible = true;
      }
    }
    sc.renderAll();
    const out = sc.toCanvasElement(opts.multiplier);
    for (const { mask, pixels } of original) {
      const ctx = out.getContext("2d")!;
      const result = ctx.getImageData(mask.x, mask.y, mask.width, mask.height);
      restoreOutsideLocation(pixels.data, result.data, mask);
      ctx.putImageData(result, mask.x, mask.y);
    }
    return { canvas: out, warnings: [...new Set(warnings)] };
  } finally {
    sc.dispose();
  }
}

export function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("图片生成失败"))), type, quality);
    } catch {
      reject(new Error("画布包含跨域图片，浏览器禁止导出。请改用本地上传的图片。"));
    }
  });
}

export async function renderThumbnail(doc: TemplateDoc, size = 360): Promise<string> {
  const mult = size / Math.max(doc.canvas.width, doc.canvas.height);
  const { canvas } = await renderDoc(doc, { multiplier: mult });
  try {
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return "";
  }
}
