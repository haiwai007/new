import { phoneScreenContent } from "@/lib/phone/export";
import { Zip, ZipPassThrough } from "fflate";
import Papa from "papaparse";
import { applyParamValues, getParamValue, validateParamValue } from "@/lib/template/params.ts";
import { canvasToBlob, renderDoc } from "@/lib/canvas/render.ts";
import type { AssetRecord } from "@/lib/storage/db.ts";
import type { TemplateDoc, TemplateParameter, ParamValue } from "@/types/template.ts";

export const MAX_BATCH_ROWS = 200;
export const MAX_CSV_BYTES = 5 * 1024 * 1024;

export type BatchCsvRow = {
  sourceLine: number;
  cells: Record<string, string>;
  parseError?: string;
};

export type ParsedBatchCsv = {
  headers: string[];
  rows: BatchCsvRow[];
};

export type BatchMapping = Record<string, string | undefined>;

export type PreparedBatchRow = {
  doc: TemplateDoc;
  errors: string[];
};

export type BatchRowOutcome = {
  sourceLine: number;
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
  latest: BatchRowOutcome;
};

export type BatchArchiveResult = {
  archive: Blob | null;
  outcomes: BatchRowOutcome[];
  succeeded: number;
  failed: number;
};

export type BatchGenerationOptions = {
  template: TemplateDoc;
  csv: ParsedBatchCsv;
  mapping: BatchMapping;
  assets: AssetRecord[];
  filenameColumn?: string;
  onProgress?: (progress: BatchProgress) => void;
};

function normalizeKey(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function csvErrorMessage(error: Papa.ParseError): string {
  const line = typeof error.row === "number" ? `第 ${error.row + 1} 行` : "CSV";
  return `${line}：${error.message}`;
}

export async function parseBatchCsv(file: File): Promise<ParsedBatchCsv> {
  if (file.size === 0) throw new Error("CSV 文件为空。");
  if (file.size > MAX_CSV_BYTES) throw new Error("CSV 文件不能超过 5 MB。");
  if (file.name && !file.name.toLocaleLowerCase().endsWith(".csv") && !file.type.includes("csv")) {
    throw new Error("请选择 CSV 文件。");
  }

  const parsed = Papa.parse<string[]>(await file.text(), {
    header: false,
    skipEmptyLines: "greedy",
    delimiter: "",
    dynamicTyping: false,
  });
  const fatalError = parsed.errors.find(
    (error) =>
      error.code === "MissingQuotes" ||
      error.code === "InvalidQuotes" ||
      error.code === "UndetectableDelimiter",
  );
  if (fatalError) throw new Error(csvErrorMessage(fatalError));

  const table = parsed.data;
  const rawHeaders = table[0]?.map((header) => String(header ?? "").replace(/^\uFEFF/, "").trim());
  if (!rawHeaders?.length || rawHeaders.every((header) => header === "")) {
    throw new Error("CSV 缺少表头。");
  }
  if (rawHeaders.some((header) => !header)) throw new Error("表头中有空列名，请补全后重新上传。");

  const headerKeys = rawHeaders.map(normalizeKey);
  if (new Set(headerKeys).size !== headerKeys.length) {
    throw new Error("CSV 中有重复的列名，请先修改表头。");
  }

  const body = table.slice(1);
  if (body.length === 0) throw new Error("CSV 中没有可生成的数据行。");
  if (body.length > MAX_BATCH_ROWS) {
    throw new Error(`单次最多处理 ${MAX_BATCH_ROWS} 行数据，请拆分 CSV 后再生成。`);
  }

  const rows = body.map((cells, index): BatchCsvRow => {
    const values = Array.isArray(cells) ? cells : [];
    const parseError =
      values.length > rawHeaders.length
        ? `这一行有 ${values.length - rawHeaders.length} 个多余单元格。`
        : undefined;
    const record: Record<string, string> = {};
    rawHeaders.forEach((header, column) => {
      record[header] = String(values[column] ?? "").trim();
    });
    return { sourceLine: index + 2, cells: record, parseError };
  });

  return { headers: rawHeaders, rows };
}

export function suggestColumnMapping(
  parameters: TemplateParameter[],
  headers: string[],
): BatchMapping {
  const byNormalizedHeader = new Map(headers.map((header) => [normalizeKey(header), header]));
  const mapping: BatchMapping = {};
  for (const parameter of parameters) {
    if (!parameter.editable) continue;
    const candidates = [parameter.name, parameter.id].map(normalizeKey).filter(Boolean);
    mapping[parameter.id] = candidates.map((key) => byNormalizedHeader.get(key)).find(Boolean);
  }
  return mapping;
}

function makeAssetLookup(assets: AssetRecord[]) {
  const names = new Map<string, AssetRecord | null>();
  const add = (key: string, asset: AssetRecord) => {
    const normalized = normalizeKey(key);
    if (!normalized) return;
    const current = names.get(normalized);
    if (!names.has(normalized)) names.set(normalized, asset);
    else if (current?.id !== asset.id) names.set(normalized, null);
  };

  for (const asset of assets) {
    add(asset.name, asset);
    const lastPart = asset.name.split(/[\\/]/).pop() ?? asset.name;
    const stem = lastPart.replace(/\.[^.]+$/, "");
    add(stem, asset);
  }
  return names;
}

function parseToggle(value: string): boolean | null {
  const key = normalizeKey(value);
  if (["true", "1", "yes", "y", "on", "是", "显示", "开启"].includes(key)) return true;
  if (["false", "0", "no", "n", "off", "否", "隐藏", "关闭"].includes(key)) return false;
  return null;
}

function valueForCell(
  parameter: TemplateParameter,
  raw: string,
  assetsByName: Map<string, AssetRecord | null>,
): { value?: ParamValue; error?: string } {
  const value = raw.trim();
  // Empty cells intentionally preserve the value already present in the template.
  if (!value) return {};

  if (parameter.type === "image") {
    const asset = assetsByName.get(normalizeKey(value));
    if (!asset) {
      return {
        error: assetsByName.has(normalizeKey(value))
          ? `图片素材「${value}」有重名，请在素材库中改名。`
          : `素材库中找不到图片「${value}」。请填写素材文件名，或先将图片加入素材库。`,
      };
    }
    return { value: { kind: "asset", assetId: asset.id } };
  }

  if (parameter.type === "toggle") {
    const toggle = parseToggle(value);
    return toggle === null
      ? { error: `「${parameter.name}」请使用 是/否、true/false 或 1/0。` }
      : { value: toggle };
  }

  if (["width", "height", "x", "y", "rotation", "opacity", "fontSize"].includes(parameter.type)) {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? { value: numeric }
      : { error: `「${parameter.name}」必须是有效数字。` };
  }

  return { value };
}

export function prepareBatchRow(
  template: TemplateDoc,
  row: BatchCsvRow,
  mapping: BatchMapping,
  assets: AssetRecord[],
): PreparedBatchRow {
  const errors = row.parseError ? [row.parseError] : [];
  const assetsByName = makeAssetLookup(assets);
  const values: Record<string, ParamValue> = {};

  for (const parameter of template.parameters) {
    const header = mapping[parameter.id];
    if (!header) continue;
    if (!(header in row.cells)) {
      errors.push(`找不到 CSV 列「${header}」。`);
      continue;
    }
    const converted = valueForCell(parameter, row.cells[header] ?? "", assetsByName);
    if (converted.error) {
      errors.push(converted.error);
      continue;
    }
    if (converted.value !== undefined) values[parameter.id] = converted.value;
  }

  const doc = applyParamValues(template, values);
  for (const parameter of doc.parameters) {
    const message = validateParamValue(parameter, getParamValue(doc, parameter));
    if (message) errors.push(message);
  }
  return { doc, errors: [...new Set(errors)] };
}

function safeFileName(raw: string, fallback: string): string {
  const clean = raw
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^\.+|[. ]+$/g, "")
    .slice(0, 80);
  return clean || fallback;
}

function uniquePngName(base: string, used: Set<string>): string {
  const root = safeFileName(base, "image");
  let candidate = `${root}.png`;
  let suffix = 2;
  while (used.has(candidate.toLocaleLowerCase())) {
    candidate = `${root}-${suffix}.png`;
    suffix += 1;
  }
  used.add(candidate.toLocaleLowerCase());
  return candidate;
}

function zipToBlob(chunks: Uint8Array[]): Blob {
  const parts = chunks.map((chunk) => {
    const copy = new ArrayBuffer(chunk.byteLength);
    new Uint8Array(copy).set(chunk);
    return copy;
  });
  return new Blob(parts, { type: "application/zip" });
}

export async function createBatchArchive(
  options: BatchGenerationOptions,
): Promise<BatchArchiveResult> {
  const outcomes: BatchRowOutcome[] = [];
  const usedNames = new Set<string>();
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
  let succeeded = 0;
  let failed = 0;

  for (const [index, row] of options.csv.rows.entries()) {
    let outcome: BatchRowOutcome;
    const prepared = prepareBatchRow(options.template, row, options.mapping, options.assets);
    if (prepared.errors.length) {
      outcome = {
        sourceLine: row.sourceLine,
        fileName: null,
        status: "failed",
        message: prepared.errors.join("；"),
      };
      failed += 1;
    } else {
      try {
        const { canvas, warnings } = await renderDoc(phoneScreenContent(prepared.doc), { multiplier: 1 });
        const image = await canvasToBlob(canvas, "image/png");
        const filenameValue = options.filenameColumn
          ? row.cells[options.filenameColumn]
          : undefined;
        const fileName = uniquePngName(
          filenameValue || `${options.template.name}-${String(index + 1).padStart(3, "0")}`,
          usedNames,
        );

        const entry = new ZipPassThrough(fileName);
        zip.add(entry);
        entry.push(new Uint8Array(await image.arrayBuffer()), true);

        outcome = {
          sourceLine: row.sourceLine,
          fileName,
          status: "success",
          warnings: warnings.length ? warnings : undefined,
        };
        succeeded += 1;
      } catch (error) {
        outcome = {
          sourceLine: row.sourceLine,
          fileName: null,
          status: "failed",
          message: error instanceof Error ? error.message : "图片生成失败。",
        };
        failed += 1;
      }
    }

    outcomes.push(outcome);
    options.onProgress?.({
      completed: index + 1,
      total: options.csv.rows.length,
      succeeded,
      failed,
      latest: outcome,
    });
    // Yield between rows so the progress indicator and cancel/navigation UI stay responsive.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  if (succeeded === 0) {
    zip.end();
    await zipFinished;
    return { archive: null, outcomes, succeeded, failed };
  }

  zip.end();
  await zipFinished;
  if (zipError) throw zipError;

  return {
    archive: zipToBlob(outputChunks),
    outcomes,
    succeeded,
    failed,
  };
}
