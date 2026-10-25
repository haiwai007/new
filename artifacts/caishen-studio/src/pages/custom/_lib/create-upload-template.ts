import { saveAsset } from "@/lib/storage/assets.ts";
import { createWork } from "@/lib/storage/works.ts";
import { createImageLayer } from "@/lib/template/layers.ts";
import { safeThumb } from "@/lib/template/start.ts";
import { suggestParameters } from "@/lib/template/params.ts";
import { linesToLayers } from "@/lib/ocr/to-layers.ts";
import { maskPad } from "@/lib/ocr/colors.ts";
import { getRepairProvider } from "@/lib/repair/provider.ts";
import type { AnalyzedLine, Box } from "@/lib/ocr/index.ts";
import { SCHEMA_VERSION, type ImageSource, type Layer, type TemplateDoc } from "@/types/template.ts";
import type { ImportedImage } from "@/lib/image/import.ts";

export type SizeMode = "original" | "fit" | "custom";
export type UploadMode = "background" | "manual" | "smart";

const FIT_MAX = 2000;

export function fitSize(w: number, h: number): { width: number; height: number } {
  const s = Math.min(1, FIT_MAX / Math.max(w, h));
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

export type SmartInput = {
  lines: AnalyzedLine[];
  addMasks: boolean;
  /** Repair the background behind the text instead of covering it with masks. */
  repair: boolean;
  backgroundColor: string;
  blocks: (Box & { color: string })[];
};

function loadElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("图片加载失败"));
    el.src = url;
  });
}

/** Repair the original behind every recognized line (lines inside rebuilt blocks are already covered). */
async function repairBehindText(image: ImportedImage, smart: SmartInput) {
  const inBlock = (b: Box) =>
    smart.blocks.some((k) => b.x >= k.x - 1 && b.y >= k.y - 1 && b.x + b.width <= k.x + k.width + 1 && b.y + b.height <= k.y + k.height + 1);
  const regions = smart.lines
    .filter((l) => !inBlock(l.bbox))
    .map((l) => {
      // OCR boxes hug the glyphs; widen a bit so anti-aliased edges don't leave a ghost outline.
      const p = maskPad(l.bbox.height) + l.bbox.height * 0.15;
      return { x: l.bbox.x - p, y: l.bbox.y - p, width: l.bbox.width + p * 2, height: l.bbox.height + p * 2 };
    });
  if (regions.length === 0) return null;
  const el = await loadElement(image.previewUrl);
  const res = await getRepairProvider().repair({ image: el, regions, mime: image.mime === "image/jpeg" ? "image/jpeg" : "image/png" });
  return { ...res, count: regions.length };
}

/**
 * Store the original image and create an initial editable template.
 * The original is always kept as an internal asset so it can be restored.
 *
 * Smart mode keeps the original as the background (OCR cannot restore pixels
 * hidden behind text), covers recognized text with masks where the background
 * is flat, and adds an editable text layer + parameter for every line.
 */
export async function createUploadTemplate(input: {
  image: ImportedImage;
  size: { width: number; height: number };
  mode: UploadMode;
  name: string;
  smart?: SmartInput;
}): Promise<{ workId: string; stats: { textCount: number; maskCount: number; shapeCount: number; maskSkipped: number; outside: number; repaired: number } | null }> {
  const { image, size, mode } = input;
  if (mode === "smart" && !input.smart) throw new Error("请先完成文字识别");
  const asset = await saveAsset(image.blob, {
    name: image.name,
    width: image.width,
    height: image.height,
    category: "参考原图",
    scope: "internal",
  });
  const src = { kind: "asset" as const, assetId: asset.id };
  let background: ImageSource = src;

  let layers: Layer[] = [];
  let stats = null;
  if (mode === "manual") {
    layers = [
      createImageLayer({ x: 0, y: 0, width: size.width, height: size.height }, src, {
        name: "原图参考（可隐藏或删除）",
        opacity: 0.35,
        locked: true,
        editable: false,
        fit: "cover",
      }),
    ];
  } else if (mode === "smart" && input.smart) {
    const smart = input.smart;
    // A repaired background replaces masks: the old text pixels are already gone.
    const repaired = smart.repair ? await repairBehindText(image, smart) : null;
    if (repaired) {
      const fixed = await saveAsset(repaired.blob, { name: `${image.name}-修复背景`, width: repaired.width, height: repaired.height, category: "背景修复", scope: "internal" });
      background = { kind: "asset", assetId: fixed.id };
    }
    const res = linesToLayers(smart.lines, image, size, { addMasks: smart.addMasks && !repaired, blocks: smart.blocks });
    layers = res.layers;
    stats = { textCount: res.textCount, maskCount: res.maskCount, shapeCount: res.shapeCount, maskSkipped: res.maskSkipped, outside: res.outside, repaired: repaired?.count ?? 0 };
  }

  const base: TemplateDoc = {
    schemaVersion: SCHEMA_VERSION,
    templateId: "pending",
    name: input.name,
    canvas: {
      width: size.width,
      height: size.height,
      backgroundColor: mode === "smart" && input.smart ? input.smart.backgroundColor : "#ffffff",
      backgroundImage: mode === "manual" ? null : background,
    },
    layers,
    parameters: [],
    source: {
      originalAssetId: asset.id,
      mode,
      originalWidth: image.width,
      originalHeight: image.height,
    },
  };
  // Recognized text becomes parameters right away so the template is reusable immediately.
  const doc = mode === "smart" ? { ...base, parameters: suggestParameters(base) } : base;
  const work = await createWork({
    kind: "template",
    name: input.name,
    doc,
    thumbnail: await safeThumb(doc),
    fromUpload: true,
  });
  return { workId: work.id, stats };
}
