import { renderDoc } from "../canvas/render";
import type { TemplateDoc } from "../../types/template";
import type { FusionAnalysis } from "./fusion-schema";
import { analyseStrip, luminance } from "./match";
import { applyPhoneLayers, removePhoneLayers } from "./layers";
import {
  designKey,
  regionBackground,
  rgb,
  resolveFusionSettings,
} from "./fusion-metrics";
import { phoneScreenContent } from "./export";
import type { PhoneSettings } from "./schema";
export function analyseTopPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  source: { width: number; height: number; sourceKey: string },
): FusionAnalysis {
  if (width < 1 || height < 32 || data.length < width * height * 4)
    throw new Error("原图采样区域不足，无法自动分析");
  const bands: FusionAnalysis["bands"] = [];
  for (let band = 0; band < 32; band++) {
    const y0 = Math.floor((height * band) / 32),
      y1 = Math.max(y0 + 1, Math.floor((height * (band + 1)) / 32));
    const pixels = data.slice(y0 * width * 4, y1 * width * 4);
    const sample = analyseStrip(pixels);
    if (!sample) throw new Error("顶部没有可见背景，请手动选择配色");
    const color = rgb(sample.background);
    let near = 0,
      noise = 0,
      count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 128) continue;
      count++;
      const d = Math.hypot(
        pixels[i] - color.r,
        pixels[i + 1] - color.g,
        pixels[i + 2] - color.b,
      );
      if (d < 28) near++;
      const x = (i / 4) % width;
      if (d > 85 && (x < width * 0.42 || x > width * 0.65)) noise++;
    }
    bands.push({
      color: sample.background,
      uniformity: near / Math.max(1, count),
      noise: noise / Math.max(1, count),
    });
  }
  const portrait = source.height / source.width;
  const probable =
    bands.slice(0, 11).filter((b) => b.noise > 0.003 && b.noise < 0.25)
      .length >= 2;
  let last = 0;
  bands.slice(0, 14).forEach((b, i) => {
    if (b.noise > 0.003 && b.noise < 0.25) last = i + 1;
  });
  const origin = rgb(bands[0].color);
  const boundary = bands.findIndex((band, i) => {
    const c = rgb(band.color);
    return (
      i > 2 && Math.hypot(c.r - origin.r, c.g - origin.g, c.b - origin.b) > 35
    );
  });
  const cover = Math.min(
    0.1,
    ((last + 0.5) / 32) * 0.25,
    boundary > 2 ? (boundary / 32) * 0.25 : 0.1,
  );
  const result: FusionAnalysis = {
    ...source,
    kind: "flat",
    top: bands[0].color,
    bottom: bands[8].color,
    lightIcons: false,
    contrast: 1,
    suspectedOldBar: probable,
    suggestedCover: probable ? Math.max(0.025, cover) : 0,
    confidence: portrait < 1.5 || portrait > 2.6 ? "low" : "medium",
    bands,
  };
  const region = regionBackground(result, probable && boundary > 2 ? boundary / 32 * .25 : .08);
  result.kind = region.kind;
  result.bottom = region.bottom;
  const mean = (luminance(rgb(region.top)) + luminance(rgb(region.bottom))) / 2;
  result.lightIcons = 1.05 / (mean + 0.05) > (mean + 0.05) / 0.0556;
  result.contrast = Math.min(
    21,
    Math.max(
      1,
      result.lightIcons
        ? Math.min(
            ...bands
              .slice(0, 10)
              .map((b) => 1.05 / (luminance(rgb(b.color)) + 0.05)),
          )
        : Math.min(
            ...bands
              .slice(0, 10)
              .map((b) => (luminance(rgb(b.color)) + 0.05) / 0.0556),
          ),
    ),
  );
  if (region.kind === "flat" && portrait >= 1.5 && portrait <= 2.6)
    result.confidence = "high";
  return result;
}
const cache = new Map<string, Promise<FusionAnalysis>>();
export function analysePhoneBackground(
  doc: TemplateDoc,
  force = false,
): Promise<FusionAnalysis> {
  const base = removePhoneLayers(doc),
    sourceKey = designKey(base);
  if (force) cache.delete(sourceKey);
  const existing = cache.get(sourceKey);
  if (existing) return existing;
  const promise = (async () => {
    const { canvas, warnings } = await renderDoc(base, {
      multiplier: Math.min(1, 480 / base.canvas.width),
    });
    try {
      if (warnings.some((w) => w.includes("加载失败") || w.includes("丢失")))
        throw new Error("原图资源未完整加载，无法可靠自动适配");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("无法读取原图");
      const h = Math.min(
        canvas.height,
        Math.max(32, Math.round(canvas.height * 0.25)),
      );
      const pixels = ctx.getImageData(0, 0, canvas.width, h).data;
      return analyseTopPixels(pixels, canvas.width, h, {
        width: base.canvas.width,
        height: base.canvas.height,
        sourceKey,
      });
    } finally {
      canvas.width = canvas.height = 0;
    }
  })().catch((error) => {
    cache.delete(sourceKey);
    throw error;
  });
  cache.set(sourceKey, promise);
  if (cache.size > 12) cache.delete(cache.keys().next().value!);
  return promise;
}
export function fusionReady(doc: TemplateDoc) {
  return (
    !doc.phone?.fusion.enabled ||
    doc.phone.rendering !== "natural" ||
    doc.phone.fusion.analysis?.sourceKey === designKey(removePhoneLayers(doc))
  );
}
export async function fitPhoneToImage(
  doc: TemplateDoc,
  settings: PhoneSettings,
): Promise<TemplateDoc> {
  if (!settings.fusion.enabled || settings.rendering !== "natural")
    return applyPhoneLayers(doc, settings);
  const analysis = await analysePhoneBackground(doc);
  return applyPhoneLayers(
    doc,
    resolveFusionSettings(
      { ...settings, fusion: { ...settings.fusion, analysis } },
      removePhoneLayers(doc).canvas,
    ),
  );
}
export function suggestedPlacement(
  analysis: FusionAnalysis,
): "overlay" | "prepend" | null {
  if (
    analysis.kind === "flat" &&
    analysis.suspectedOldBar &&
    analysis.confidence === "high"
  )
    return "overlay";
  if (
    !analysis.suspectedOldBar &&
    analysis.kind !== "complex" &&
    analysis.confidence === "high"
  )
    return "prepend";
  return null;
}
export async function topPreview(doc: TemplateDoc, settings: PhoneSettings) {
  const source = removePhoneLayers(doc);
  const rendered = await renderDoc(phoneScreenContent(doc), {
    multiplier: Math.min(1, 720 / doc.canvas.width),
  });
  const original = await renderDoc(source, {
    multiplier: Math.min(1, 720 / source.canvas.width),
  });
  try {
    const height = Math.min(
      rendered.canvas.height,
      Math.max(40, Math.ceil(rendered.canvas.height * 0.16)),
    );
    const crop = (canvas: HTMLCanvasElement) => {
      const result = document.createElement("canvas");
      result.width = canvas.width;
      result.height = height;
      const ctx = result.getContext("2d")!;
      ctx.drawImage(canvas, 0, 0);
      return result.toDataURL("image/png");
    };
    return {
      original: crop(original.canvas),
      result: crop(rendered.canvas),
      ratio: Math.min(0.25, Math.max(settings.coverRatio, 0.02)) / 0.16,
    };
  } finally {
    original.canvas.width =
      original.canvas.height =
      rendered.canvas.width =
      rendered.canvas.height =
        0;
  }
}
