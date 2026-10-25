import type { OcrLine, OcrProgress, OcrProvider, OcrRequest, OcrResult, Box } from "./types.ts";
import { isUsefulLine, mapBoxToSource, mergeLines, splitLineByGaps, wordsToLine, type RawWord } from "./text-utils.ts";
import { borderColor, detectColorBlocks, sampleBoxStyle, type Pixels } from "./colors.ts";

// Tesseract.js runs in a Web Worker inside the browser. The engine and the
// Chinese + English models (~15MB, cached by the browser after the first run)
// are served from this site, prepared from integrity-locked npm packages. Images never leave the device.

type TesseractModule = typeof import("tesseract.js");
type Worker = Awaited<ReturnType<TesseractModule["createWorker"]>>;

const LANGS = "chi_sim+eng";
/** Tesseract is most accurate when text is ~20–60px tall; keep large images below this. */
const MAX_WORK_SIDE = 2600;
/** Small user-drawn regions are upscaled so their text is big enough to read. */
const MIN_REGION_SIDE = 900;
/** Pixel buffer used for color sampling. */
const MAX_SAMPLE_SIDE = 2000;

const STAGE_LABEL: Record<string, string> = {
  "loading tesseract core": "加载识别引擎",
  "initializing tesseract": "初始化识别引擎",
  "loading language traineddata": "下载中英文识别模型",
  "loaded language traineddata": "识别模型已就绪",
  "initializing api": "准备识别",
  "recognizing text": "正在识别文字",
};

let workerPromise: Promise<Worker> | null = null;
let progressCb: ((p: OcrProgress) => void) | null = null;
let lineSeq = 0;
let cancelled = false;

async function loadModule(): Promise<TesseractModule> {
  const mod = await import("tesseract.js");
  // The package is CommonJS; depending on the bundler the API sits on `default`.
  return (mod as TesseractModule & { default?: TesseractModule }).default ?? mod;
}

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = loadModule()
      .then((T) =>
        T.createWorker(LANGS, T.OEM.LSTM_ONLY, {
          workerPath: `${import.meta.env.BASE_URL}ocr/worker.min.js`,
          corePath: `${import.meta.env.BASE_URL}ocr/core`,
          langPath: `${import.meta.env.BASE_URL}ocr/lang`,
          logger: (m) => progressCb?.({ stage: STAGE_LABEL[m.status] ?? m.status, progress: m.progress }),
        }),
      )
      .catch((e: unknown) => {
        workerPromise = null;
        throw new Error(
          `识别引擎加载失败，请检查网络后重试（首次使用需要从本站加载识别引擎和模型）。${e instanceof Error ? e.message : ""}`,
        );
      });
  }
  return workerPromise;
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function getPixels(bitmap: ImageBitmap): { pixels: Pixels; scale: number } {
  const scale = Math.min(1, MAX_SAMPLE_SIDE / Math.max(bitmap.width, bitmap.height));
  const c = newCanvas(bitmap.width * scale, bitmap.height * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("浏览器不支持画布读取");
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { pixels: { data: d.data, width: d.width, height: d.height }, scale };
}

type Contrast = "none" | "auto" | "invert";

/** Crop + rescale the source so text is a good size for the engine. */
function prepareWorkImage(bitmap: ImageBitmap, region: Box | undefined, contrast: Contrast) {
  const r = region
    ? {
        x: Math.max(0, Math.floor(region.x)),
        y: Math.max(0, Math.floor(region.y)),
        width: Math.min(bitmap.width, Math.ceil(region.x + region.width)) - Math.max(0, Math.floor(region.x)),
        height: Math.min(bitmap.height, Math.ceil(region.y + region.height)) - Math.max(0, Math.floor(region.y)),
      }
    : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  if (r.width < 4 || r.height < 4) throw new Error("框选区域太小，无法识别");
  const longSide = Math.max(r.width, r.height);
  const scale = region
    ? Math.min(4, Math.max(1, MIN_REGION_SIDE / longSide), MAX_WORK_SIDE / longSide)
    : Math.min(1, MAX_WORK_SIDE / longSide);
  // A small white margin helps Tesseract with text touching the edge of a crop.
  const margin = region ? 16 : 0;
  const c = newCanvas(r.width * scale + margin * 2, r.height * scale + margin * 2);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持画布");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, r.x, r.y, r.width, r.height, margin, margin, r.width * scale, r.height * scale);
  if (contrast !== "none") normalizeContrast(ctx, c.width, c.height, contrast === "invert", margin + 2);
  return { canvas: c, scale, offsetX: r.x - margin / scale, offsetY: r.y - margin / scale };
}

/**
 * Tesseract reads dark-on-light text best. Convert to grayscale and invert
 * when forced (second pass for light text on dark shapes) or when a region's
 * background is darker than its text (e.g. white text on a red banner).
 */
function normalizeContrast(ctx: CanvasRenderingContext2D, w: number, h: number, force: boolean, inset: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  let invert = force;
  if (!force) {
    // Background luminance = median of the pixels just inside the margin.
    const edge: number[] = [];
    for (let x = inset; x < w - inset; x += 3) edge.push(lum[inset * w + x], lum[(h - inset - 1) * w + x]);
    for (let y = inset; y < h - inset; y += 3) edge.push(lum[y * w + inset], lum[y * w + w - inset - 1]);
    edge.sort((a, b) => a - b);
    const bg = edge.length ? edge[Math.floor(edge.length / 2)] : 255;
    let inkSum = 0;
    let inkN = 0;
    for (let i = 0; i < lum.length; i++) {
      if (Math.abs(lum[i] - bg) > 50) {
        inkSum += lum[i];
        inkN += 1;
      }
    }
    invert = inkN > 0 && inkSum / inkN > bg;
  }
  for (let i = 0; i < lum.length; i++) {
    const v = invert ? 255 - lum[i] : lum[i];
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

type RawLine = { words: RawWord[] };
type RawPage = { blocks: { paragraphs: { lines: RawLine[] }[] }[] | null };

function extractLines(page: RawPage, map: (b: Box) => Box): OcrLine[] {
  const out: OcrLine[] = [];
  for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        for (const group of splitLineByGaps(line.words)) {
          lineSeq += 1;
          const l = wordsToLine(group, `ocr_${Date.now().toString(36)}_${lineSeq}`);
          if (l) out.push({ ...l, bbox: map(l.bbox) });
        }
      }
    }
  }
  return out.filter(isUsefulLine);
}

async function recognize(req: OcrRequest): Promise<OcrResult> {
  const started = performance.now();
  cancelled = false;
  progressCb = req.onProgress ?? null;
  req.onProgress?.({ stage: "读取图片", progress: 0 });
  const bitmap = await createImageBitmap(req.image).catch(() => {
    throw new Error("图片无法解码");
  });
  try {
    const T = await loadModule();
    const worker = await getWorker();
    type Psm = Parameters<Worker["setParameters"]>[0]["tessedit_pageseg_mode"];
    const runPass = async (contrast: Contrast, psm: Psm, region: Box | undefined) => {
      await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: "1" });
      const work = prepareWorkImage(bitmap, region, contrast);
      const { data } = await worker.recognize(work.canvas, {}, { blocks: true, text: false });
      return extractLines(data, (b) => mapBoxToSource(b, work.scale, work.offsetX, work.offsetY));
    };
    let lines = await runPass(req.region ? "auto" : "none", req.singleBlock ? T.PSM.SINGLE_BLOCK : T.PSM.AUTO, req.region);

    const { pixels, scale } = getPixels(bitmap);
    const toSource = (b: Box): Box => ({ x: b.x / scale, y: b.y / scale, width: b.width / scale, height: b.height / scale });
    const blocks = req.region ? [] : detectColorBlocks(pixels).map((b) => ({ ...toSource(b), color: b.color }));
    // Full-page layout analysis often treats solid buttons/banners as pictures and
    // skips their text (especially light-on-dark). Recognize each block separately.
    for (const [i, block] of blocks.entries()) {
      if (cancelled) throw new Error("已取消");
      req.onProgress?.({ stage: `识别色块中的文字（${i + 1}/${blocks.length}）`, progress: i / blocks.length });
      const extra = await runPass("auto", T.PSM.SINGLE_BLOCK, block).catch(() => []);
      lines = mergeLines(lines, extra);
    }

    req.onProgress?.({ stage: "分析文字颜色", progress: 1 });
    const analyzed = lines.map((l) => {
      const style = sampleBoxStyle(pixels, {
        x: l.bbox.x * scale,
        y: l.bbox.y * scale,
        width: l.bbox.width * scale,
        height: l.bbox.height * scale,
      });
      return { ...l, ...style };
    });
    return {
      engine: "Tesseract.js（浏览器本地）",
      lines: analyzed,
      blocks,
      backgroundColor: borderColor(pixels),
      imageWidth: bitmap.width,
      imageHeight: bitmap.height,
      durationMs: Math.round(performance.now() - started),
    };
  } finally {
    bitmap.close();
    progressCb = null;
  }
}

async function cancel() {
  cancelled = true;
  const p = workerPromise;
  workerPromise = null;
  progressCb = null;
  if (p) {
    const w = await p.catch(() => null);
    await w?.terminate();
  }
}

export const tesseractProvider: OcrProvider = {
  id: "tesseract-local",
  label: "本地文字识别（Tesseract.js）",
  processing: "local",
  recognize,
  cancel,
};
