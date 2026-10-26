import { fusionReady } from "@/lib/phone/fusion";
import { phoneScreenContent } from "@/lib/phone/export";
import { renderDoc, canvasToBlob } from "@/lib/canvas/render.ts";
import type { TemplateDoc } from "@/types/template.ts";

export type ExportFormat = "png" | "jpeg";

export type ExportOptions = {
  format: ExportFormat;
  width: number;
  quality: number;
  transparent: boolean;
  fileName: string;
};

export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return cleaned.length ? cleaned.slice(0, 80) : "海神作图";
}

/**
 * Render at the requested pixel width from the template data (not the
 * zoomed editor canvas), so exports stay sharp at any editor zoom.
 */
export async function exportDoc(doc: TemplateDoc, opts: ExportOptions) {
  if(!fusionReady(doc)) throw new Error("自然融合尚未完成，请先重新自动适配并预览");
  const multiplier = opts.width / doc.canvas.width;
  const transparent = opts.format === "png" && opts.transparent;
  const { canvas, warnings } = await renderDoc(phoneScreenContent(doc), { multiplier, transparent });
  let source = canvas;
  if (opts.format === "jpeg") {
    // JPEG has no alpha; flatten onto the background color (white if transparent).
    const flat = document.createElement("canvas");
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext("2d");
    if (!ctx) throw new Error("浏览器无法创建画布");
    ctx.fillStyle = doc.canvas.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    source = flat;
  }
  const blob = await canvasToBlob(source, opts.format === "png" ? "image/png" : "image/jpeg", opts.quality);
  return { blob, warnings, width: source.width, height: source.height };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
