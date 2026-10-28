import { fusionReady } from "../phone/fusion";
import { phoneScreenContent } from "../phone/export";
import { Zip, ZipPassThrough } from "fflate";
import { canvasToBlob, renderDoc } from "../canvas/render.ts";
import type { GeneratedItem } from "./rules.ts";

export type BatchItemOutcome = {
  index: number;
  fileName: string | null;
  status: "success" | "failed";
  message?: string;
  warnings?: string[];
};

export type BatchProgress = {
  completed: number;
  total: number;
  succeeded: number;
  failed: number;
  latest: BatchItemOutcome;
};

export type BatchArchiveResult = {
  archive: Blob | null;
  outcomes: BatchItemOutcome[];
  succeeded: number;
  failed: number;
};

export type BatchGenerationOptions = {
  name: string;
  items: GeneratedItem[];
  onProgress?: (progress: BatchProgress) => void;
};

export function safeFileName(raw: string, fallback: string): string {
  const clean = raw
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/./gsu, (ch) => (ch.charCodeAt(0) < 0x20 ? "-" : ch))
    .replace(/\s+/g, "-")
    .replace(/^\.+|[. ]+$/g, "")
    .slice(0, 80);
  return clean || fallback;
}

function zipToBlob(chunks: Uint8Array[]): Blob {
  const parts = chunks.map((chunk) => {
    const copy = new ArrayBuffer(chunk.byteLength);
    new Uint8Array(copy).set(chunk);
    return copy;
  });
  return new Blob(parts, { type: "application/zip" });
}

/** Render the frozen preview once for either a single PNG or a ZIP entry. */
export async function renderGeneratedImage(item: GeneratedItem) {
  if (item.errors.length) throw new Error(item.errors.join("；"));
  if (!item.preservePhone && !fusionReady(item.doc))
    throw new Error("自然融合尚未准备，请重新生成预览");
  const { canvas, warnings } = await renderDoc(phoneScreenContent(item.doc), {
    multiplier: 1,
  });
  try {
    return { image: await canvasToBlob(canvas, "image/png"), warnings };
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export async function createBatchArchive(
  options: BatchGenerationOptions,
): Promise<BatchArchiveResult> {
  const outcomes: BatchItemOutcome[] = [];
  const outputChunks: Uint8Array[] = [];
  let zipError: Error | null = null;
  let finishZip: (() => void) | undefined;
  let rejectZip: ((error: Error) => void) | undefined;
  const zipFinished = new Promise<void>((resolve, reject) => {
    finishZip = resolve;
    rejectZip = reject;
  });
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      zipError = error;
      rejectZip?.(error);
      return;
    }
    if (chunk?.byteLength) outputChunks.push(chunk);
    if (final) finishZip?.();
  });
  const base = safeFileName(options.name, "image");
  const width = Math.max(3, String(options.items.length).length);
  let succeeded = 0;
  let failed = 0;

  for (const [position, item] of options.items.entries()) {
    let outcome: BatchItemOutcome;
    if (item.errors.length) {
      outcome = {
        index: item.index,
        fileName: null,
        status: "failed",
        message: item.errors.join("；"),
      };
      failed += 1;
    } else {
      try {
        const { image, warnings } = await renderGeneratedImage(item);
        const fileName = `${base}-${String(item.index + 1).padStart(width, "0")}.png`;
        const entry = new ZipPassThrough(fileName);
        zip.add(entry);
        entry.push(new Uint8Array(await image.arrayBuffer()), true);
        outcome = {
          index: item.index,
          fileName,
          status: "success",
          warnings: warnings.length ? warnings : undefined,
        };
        succeeded += 1;
      } catch (error) {
        outcome = {
          index: item.index,
          fileName: null,
          status: "failed",
          message: error instanceof Error ? error.message : "图片生成失败。",
        };
        failed += 1;
      }
    }

    outcomes.push(outcome);
    options.onProgress?.({
      completed: position + 1,
      total: options.items.length,
      succeeded,
      failed,
      latest: outcome,
    });
    // Yield between images so the progress indicator stays responsive.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  zip.end();
  await zipFinished;
  if (succeeded === 0) return { archive: null, outcomes, succeeded, failed };
  if (zipError) throw zipError;
  return { archive: zipToBlob(outputChunks), outcomes, succeeded, failed };
}
