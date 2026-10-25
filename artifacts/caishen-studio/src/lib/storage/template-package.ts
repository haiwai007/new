import { getAsset } from "./assets.ts";
import { referencedAssetIds } from "@/lib/template/doc-ops.ts";
import {
  MAX_PACKAGE_BYTES,
  buildPackage,
  parseTemplateFile,
  remapAssetIds,
  type PackagedAsset,
} from "@/lib/template/package.ts";
import type { TemplateDoc } from "@/types/template.ts";

// Browser side of template packages: reads/writes images in IndexedDB.

import { base64ToBlob, blobToBase64 } from "./encoding";
import {
  getDb,
  type AssetRecord,
  type WorkKind,
  type WorkRecord,
  type VersionRecord,
} from "./db";
import { newId } from "../template/ids";

/** Build a downloadable template file with every referenced local image embedded. */
export async function exportTemplatePackage(
  doc: TemplateDoc,
): Promise<{ blob: Blob; assetCount: number; missing: number }> {
  const assets: PackagedAsset[] = [];
  let missing = 0;
  for (const id of referencedAssetIds(doc)) {
    const a = await getAsset(id);
    if (!a) {
      missing += 1;
      continue;
    }
    assets.push({
      id,
      name: a.name,
      mime: a.mime || a.blob.type,
      width: a.width,
      height: a.height,
      data: await blobToBase64(a.blob),
    });
  }
  const blob = new Blob([JSON.stringify(buildPackage(doc, assets))], {
    type: "application/json",
  });
  if (blob.size > MAX_PACKAGE_BYTES)
    throw new Error("模板包含的图片过大（超过 80MB），无法导出为单个文件");
  return { blob, assetCount: assets.length, missing };
}

/**
 * Read a template file and store its images locally under fresh ids (so an
 * import never overwrites existing images). Returns the remapped document.
 */
async function prepareTemplateFile(file: File) {
  if (file.size > MAX_PACKAGE_BYTES) throw new Error("文件过大（超过 80MB）");
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error("文件不是有效的 JSON");
  }
  const parsed = parseTemplateFile(raw);
  if (!parsed.ok) throw new Error(parsed.error);
  const now = new Date().toISOString();
  const map = new Map(parsed.assets.map((a) => [a.id, newId("asset")]));
  const assets: AssetRecord[] = parsed.assets.map((a) => {
    const blob = base64ToBlob(a.data, a.mime);
    return {
      id: map.get(a.id)!,
      name: a.name,
      blob,
      mime: a.mime,
      size: blob.size,
      width: a.width,
      height: a.height,
      category: "未分类",
      scope: "internal",
      createdAt: now,
    };
  });
  return {
    doc: remapAssetIds(parsed.doc, map),
    assets,
    warnings: parsed.warnings,
    assetCount: assets.length,
  };
}
export async function importTemplateFile(
  file: File,
): Promise<{ doc: TemplateDoc; warnings: string[]; assetCount: number }> {
  const prepared = await prepareTemplateFile(file);
  const db = await getDb();
  const tx = db.transaction("assets", "readwrite");
  await Promise.all([...prepared.assets.map((a) => tx.store.add(a)), tx.done]);
  return prepared;
}
/** Import images, the work and initial history together, or leave all stores unchanged. */
export async function importWorkFile(
  file: File,
  options: {
    kind: WorkKind;
    name?: string;
    strict?: boolean;
    origin?: string;
    reason?: VersionRecord["reason"];
  },
) {
  const prepared = await prepareTemplateFile(file);
  if (options.strict && prepared.warnings.length)
    throw new Error(prepared.warnings.join("；"));
  const id = newId(options.kind === "template" ? "tpl" : "work");
  const now = new Date().toISOString();
  const name = options.name ?? prepared.doc.name;
  const doc = { ...prepared.doc, templateId: id, name };
  const work: WorkRecord = {
    id,
    kind: options.kind,
    name,
    doc,
    thumbnail: null,
    favorite: false,
    version: 1,
    origin: options.origin ?? null,
    fromUpload: false,
    createdAt: now,
    updatedAt: now,
  };
  const version: VersionRecord = {
    id: newId("ver"),
    workId: id,
    version: 1,
    name,
    doc,
    createdAt: now,
    reason: options.reason ?? "import",
    thumbnail: null,
  };
  const db = await getDb();
  const tx = db.transaction(["assets", "works", "versions"], "readwrite");
  const requests: Promise<unknown>[] = [];
  try {
    for (const a of prepared.assets)
      requests.push(tx.objectStore("assets").add(a));
    requests.push(
      tx.objectStore("works").add(work),
      tx.objectStore("versions").add(version),
    );
    await Promise.all([...requests, tx.done]);
  } catch (error) {
    try {
      tx.abort();
    } catch {}
    await Promise.allSettled([...requests, tx.done]);
    throw error;
  }
  return { work, warnings: prepared.warnings, assetCount: prepared.assetCount };
}

export function downloadFile(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
