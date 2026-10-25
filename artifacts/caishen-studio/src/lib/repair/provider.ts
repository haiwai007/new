import { canvasToBlob } from "../canvas/render.ts";
import { clusterMask, inpaint, planClusters, type Rect } from "./inpaint.ts";

// Background repair is a replaceable provider, like OCR. The default runs in the
// browser; an AI inpainting service could implement the same contract later.

export type RepairRequest = {
  image: HTMLImageElement;
  /** Regions to repair, in source-image pixels. */
  regions: Rect[];
  mime: "image/png" | "image/jpeg";
  onProgress?: (done: number, total: number) => void;
};

export type RepairResult = { blob: Blob; width: number; height: number; pixels: number; durationMs: number };

export type RepairProvider = {
  id: string;
  label: string;
  processing: "local" | "cloud";
  /** Plain-language limitation shown before running. */
  limitation: string;
  repair: (req: RepairRequest) => Promise<RepairResult>;
};

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

export const localRepairProvider: RepairProvider = {
  id: "local-diffusion",
  label: "本地背景修复（浏览器内运行）",
  processing: "local",
  limitation: "根据周围颜色平滑填补，适合纯色、渐变和简单纹理背景；照片中细节丰富的区域修复后会显得模糊。",
  async repair({ image, regions, mime, onProgress }) {
    const t0 = performance.now();
    const w = image.naturalWidth || image.width;
    const h = image.naturalHeight || image.height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("浏览器无法创建画布");
    ctx.drawImage(image, 0, 0);
    const clusters = planClusters(regions, w, h);
    if (clusters.length === 0) throw new Error("修复区域不在背景图片范围内");
    let pixels = 0;
    for (const [i, c] of clusters.entries()) {
      let data: ImageData;
      try {
        data = ctx.getImageData(c.crop.x, c.crop.y, c.crop.width, c.crop.height);
      } catch {
        throw new Error("这张背景图片来自不允许读取像素的网站，无法修复。请改用本地上传的图片。");
      }
      pixels += inpaint(data, clusterMask(c));
      ctx.putImageData(data, c.crop.x, c.crop.y);
      onProgress?.(i + 1, clusters.length);
      // Yield so the progress indicator can repaint between clusters.
      await nextFrame();
    }
    const blob = await canvasToBlob(canvas, mime, mime === "image/jpeg" ? 0.93 : undefined);
    return { blob, width: w, height: h, pixels, durationMs: Math.round(performance.now() - t0) };
  },
};

export function getRepairProvider(): RepairProvider {
  return localRepairProvider;
}
