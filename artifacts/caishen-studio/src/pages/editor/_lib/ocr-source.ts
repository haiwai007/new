import { getAsset } from "@/lib/storage/assets.ts";
import { canvasToBlob, renderDoc } from "@/lib/canvas/render.ts";
import { coverMapping } from "@/lib/ocr/to-layers.ts";
import type { Box } from "@/lib/ocr/index.ts";
import type { TemplateDoc } from "@/types/template.ts";

export type OcrSource = {
  blob: Blob;
  /** Size of the image the OCR boxes are measured in. */
  image: { width: number; height: number };
  /** Region (in image pixels) to recognize; undefined = whole image. */
  region?: Box;
  label: string;
};

/**
 * Pick what to run OCR on. Prefer the untouched original reference image so
 * masks and new text layers do not interfere; otherwise render the canvas
 * without its text layers (we want text that is part of pictures/background).
 */
export async function resolveOcrSource(doc: TemplateDoc, canvasBox: Box | null): Promise<OcrSource> {
  const canvas = { width: doc.canvas.width, height: doc.canvas.height };
  if (doc.source) {
    const asset = await getAsset(doc.source.originalAssetId);
    if (asset) {
      const image = { width: asset.width, height: asset.height };
      return {
        blob: asset.blob,
        image,
        region: canvasBox ? coverMapping(image, canvas).toImage(canvasBox) : undefined,
        label: "上传的原图",
      };
    }
  }
  const { canvas: rendered } = await renderDoc({ ...doc, layers: doc.layers.filter((l) => l.type !== "text") }, { multiplier: 1 });
  const blob = await canvasToBlob(rendered, "image/png");
  return { blob, image: canvas, region: canvasBox ?? undefined, label: "当前画布（不含文字图层）" };
}
