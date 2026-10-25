import { toast } from "sonner";
import type { ImageLayer, Layer, ShapeKind, TemplateDoc } from "@/types/template.ts";
import { addLayers } from "@/lib/template/doc-ops.ts";
import { createImageLayer, createShapeLayer, createTextLayer } from "@/lib/template/layers.ts";
import { importImageFile } from "@/lib/image/import.ts";
import { saveAsset } from "@/lib/storage/assets.ts";
import { edit, useEditor } from "@/stores/editor.ts";
import type { DrawBox } from "./canvas-controller.ts";

function center(doc: TemplateDoc, w: number, h: number) {
  return { x: (doc.canvas.width - w) / 2, y: (doc.canvas.height - h) / 2, width: w, height: h };
}

function addAndSelect(layers: Layer[]) {
  edit((d) => addLayers(d, layers));
  useEditor.getState().select(layers.map((l) => l.id));
}

export type TextPreset = "title" | "subtitle" | "body";

export function addText(preset: TextPreset) {
  const doc = useEditor.getState().doc;
  if (!doc) return;
  const W = doc.canvas.width;
  const conf = {
    title: { text: "添加标题", fontSize: Math.round(W * 0.08), fontWeight: "bold" as const, h: W * 0.12 },
    subtitle: { text: "添加副标题", fontSize: Math.round(W * 0.045), fontWeight: "bold" as const, h: W * 0.07 },
    body: { text: "添加一段正文内容", fontSize: Math.round(W * 0.03), fontWeight: "normal" as const, h: W * 0.05 },
  }[preset];
  const layer = createTextLayer(center(doc, W * 0.7, conf.h), {
    name: { title: "标题", subtitle: "副标题", body: "正文" }[preset],
    text: conf.text,
    fontSize: conf.fontSize,
    fontWeight: conf.fontWeight,
    textAlign: "center",
  });
  addAndSelect([layer]);
}

export function addShape(kind: ShapeKind) {
  const doc = useEditor.getState().doc;
  if (!doc) return;
  const s = Math.min(doc.canvas.width, doc.canvas.height) * 0.3;
  const box = kind === "line" ? center(doc, s * 1.5, Math.max(2, s * 0.02)) : center(doc, s, s);
  addAndSelect([createShapeLayer(kind, box)]);
}

export function addImageFrame(box?: DrawBox) {
  const doc = useEditor.getState().doc;
  if (!doc) return;
  const s = Math.min(doc.canvas.width, doc.canvas.height) * 0.4;
  addAndSelect([createImageLayer(box ?? center(doc, s, s), null, { name: "图片框", lockAspect: false })]);
}

/** Handle a box drawn on the canvas with one of the draw tools. */
export function handleDrawnBox(box: DrawBox): string | null {
  const { tool, doc, setTool } = useEditor.getState();
  if (!doc) return null;
  let layer: Layer | null = null;
  if (tool === "draw-text") {
    layer = createTextLayer(box, {
      name: "文字",
      text: "输入文字",
      fontSize: Math.max(12, Math.round(box.height * 0.6)),
      verticalAlign: "middle",
      autoShrink: true,
    });
  } else if (tool === "draw-image") {
    layer = createImageLayer(box, null, { name: "图片框", lockAspect: false });
  } else if (tool === "draw-mask") {
    layer = createShapeLayer("rect", box, { name: "遮罩", fill: "#ffffff", isMask: true });
  } else if (tool === "draw-rect") {
    layer = createShapeLayer("rect", box);
  } else if (tool === "draw-ocr") {
    useEditor.getState().setOcrRequest({ ...box, full: false });
  }
  setTool("select");
  if (!layer) return null;
  addAndSelect([layer]);
  return layer.type === "text" ? layer.id : null;
}

export async function storeImageFile(file: File) {
  const img = await importImageFile(file);
  URL.revokeObjectURL(img.previewUrl);
  const asset = await saveAsset(img.blob, {
    name: img.name,
    width: img.width,
    height: img.height,
    category: "上传",
  });
  return asset;
}

/** Upload a new image layer sized to fit within the canvas. */
export async function addImageFromFile(file: File) {
  try {
    const asset = await storeImageFile(file);
    addImageFromAsset(asset.id, asset.width, asset.height, asset.name);
  } catch (e) {
    toast.error("图片上传失败", { description: e instanceof Error ? e.message : undefined });
  }
}

export function addImageFromAsset(assetId: string, w: number, h: number, name: string) {
  const doc = useEditor.getState().doc;
  if (!doc) return;
  const max = Math.min(doc.canvas.width, doc.canvas.height) * 0.6;
  const s = Math.min(1, max / Math.max(w, h));
  const layer = createImageLayer(center(doc, w * s, h * s), { kind: "asset", assetId }, {
    name: name.replace(/\.[a-z]+$/i, "").slice(0, 20) || "图片",
  });
  addAndSelect([layer]);
}

/** Replace the picture inside an image layer, keeping its frame/layout. */
export async function replaceImage(layerId: string, file: File) {
  try {
    const asset = await storeImageFile(file);
    edit((d) => ({
      ...d,
      layers: d.layers.map((l) =>
        l.id === layerId && l.type === "image"
          ? ({ ...l, src: { kind: "asset", assetId: asset.id }, focusX: 0.5, focusY: 0.5, cropZoom: 1 } satisfies ImageLayer)
          : l,
      ),
    }));
    return asset;
  } catch (e) {
    toast.error("替换图片失败", { description: e instanceof Error ? e.message : undefined });
    return null;
  }
}

export async function setBackgroundImage(file: File) {
  try {
    const asset = await storeImageFile(file);
    edit((d) => ({ ...d, canvas: { ...d.canvas, backgroundImage: { kind: "asset", assetId: asset.id } } }));
  } catch (e) {
    toast.error("设置背景失败", { description: e instanceof Error ? e.message : undefined });
  }
}

export function pickFile(accept = "image/png,image/jpeg,image/webp"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
