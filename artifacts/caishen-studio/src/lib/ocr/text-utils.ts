import type { Box, OcrLine } from "./types.ts";

const CJK = "\\u2e80-\\u9fff\\u3000-\\u303f\\uff00-\\uffef";
const CJK_GAP = new RegExp(`(?<=[${CJK}])\\s+(?=[${CJK}])`, "g");
const CJK_TEST = new RegExp(`[${CJK}]`);

/** Tesseract puts spaces between every CJK character; remove those but keep real spaces. */
export function cleanText(text: string): string {
  return text.replace(/\r/g, "").replace(CJK_GAP, "").replace(/[ \t]+/g, " ").trim();
}

export function hasCjk(text: string): boolean {
  return CJK_TEST.test(text);
}

export type RawWord = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };

const toBox = (b: RawWord["bbox"]): Box => ({ x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0 });

/**
 * Join words into a line. Chinese engines split almost every character into
 * its own "word", so spaces are decided by the visual gap: between two CJK
 * characters only a gap wider than ~0.6× the line height counts as a space.
 */
function joinWords(words: RawWord[]): string {
  const sorted = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const lineH = Math.max(1, ...sorted.map((w) => w.bbox.y1 - w.bbox.y0));
  let out = "";
  sorted.forEach((w, i) => {
    const t = w.text.trim();
    if (!t) return;
    if (i > 0 && out) {
      const prev = sorted[i - 1];
      const gap = w.bbox.x0 - prev.bbox.x1;
      const cjkPair = hasCjk(out.slice(-1)) && hasCjk(t[0]);
      // Glyph spacing in bold CJK fonts can reach ~0.4em; a real space is wider.
      if (!cjkPair || gap > lineH * 0.6) out += " ";
    }
    out += t;
  });
  return out.replace(/[ \t]+/g, " ").trim();
}

/**
 * Split a recognized line wherever there is a big horizontal gap between
 * words. Tesseract sometimes merges two columns (e.g. "时间 …" and "地点 …"
 * on the same row) into one line; separate layers are far more useful.
 */
export function splitLineByGaps(words: RawWord[], gapFactor = 1.6): RawWord[][] {
  const sorted = words.filter((w) => w.text.trim()).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  if (sorted.length === 0) return [];
  const lineH = Math.max(...sorted.map((w) => w.bbox.y1 - w.bbox.y0), 1);
  const groups: RawWord[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].bbox.x0 - sorted[i - 1].bbox.x1;
    if (gap > lineH * gapFactor) groups.push([sorted[i]]);
    else groups[groups.length - 1].push(sorted[i]);
  }
  return groups;
}

/** Turn a group of words into a line with a union bbox and mean confidence. */
export function wordsToLine(words: RawWord[], id: string): OcrLine | null {
  const text = joinWords(words);
  if (!text) return null;
  const x0 = Math.min(...words.map((w) => w.bbox.x0));
  const y0 = Math.min(...words.map((w) => w.bbox.y0));
  const x1 = Math.max(...words.map((w) => w.bbox.x1));
  const y1 = Math.max(...words.map((w) => w.bbox.y1));
  // Weight confidence by character count so one bad symbol doesn't dominate.
  const total = words.reduce((s, w) => s + w.text.length, 0) || 1;
  const confidence = words.reduce((s, w) => s + w.confidence * w.text.length, 0) / total;
  return { id, text, confidence: Math.round(confidence), bbox: toBox({ x0, y0, x1, y1 }) };
}

/** Drop noise: empty text, tiny boxes, or punctuation-only results with low confidence. */
export function isUsefulLine(line: OcrLine): boolean {
  if (line.bbox.height < 6 || line.bbox.width < 4) return false;
  if (!/[\p{L}\p{N}]/u.test(line.text)) return false;
  if (line.confidence < 15) return false;
  return true;
}

/** Intersection-over-smaller-box: 1 when one box fully contains the other. */
export function overlapRatio(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? (ix * iy) / smaller : 0;
}

/**
 * Merge results from a second recognition pass: add lines that don't overlap
 * an existing one. When they overlap, keep whichever has higher confidence.
 * Returns lines sorted top-to-bottom, then left-to-right.
 */
export function mergeLines<T extends OcrLine>(primary: T[], extra: T[]): T[] {
  const out = [...primary];
  for (const e of extra) {
    const i = out.findIndex((p) => overlapRatio(p.bbox, e.bbox) > 0.5);
    if (i === -1) out.push(e);
    else if (e.confidence > out[i].confidence + 10) out[i] = e;
  }
  return out.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
}

/** Map a box from a scaled/cropped working image back to the full source image. */
export function mapBoxToSource(b: Box, scale: number, offsetX: number, offsetY: number): Box {
  return {
    x: b.x / scale + offsetX,
    y: b.y / scale + offsetY,
    width: b.width / scale,
    height: b.height / scale,
  };
}
