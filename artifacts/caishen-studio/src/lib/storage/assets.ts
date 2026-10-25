import { DRAWING_PRESETS_KEY, presetAssetIds, storedPresets } from "../phone/drawing-preset";
import { referencedAssetIds } from "../template/doc-ops";
import { newId } from "../template/ids.ts";
import type { ImageSource } from "../../types/template.ts";
import { getDb, type AssetRecord } from "./db.ts";

const urlCache = new Map<string, string>();

export async function saveAsset(
  blob: Blob,
  meta: {
    name: string;
    width: number;
    height: number;
    category?: string;
    scope?: AssetRecord["scope"];
  },
): Promise<AssetRecord> {
  const db = await getDb();
  const record: AssetRecord = {
    id: newId("asset"),
    name: meta.name,
    blob,
    mime: blob.type,
    size: blob.size,
    width: meta.width,
    height: meta.height,
    category: meta.category ?? "未分类",
    scope: meta.scope ?? "library",
    createdAt: new Date().toISOString(),
  };
  await db.put("assets", record);
  return record;
}

export async function getAsset(id: string): Promise<AssetRecord | undefined> {
  const db = await getDb();
  return db.get("assets", id);
}

export async function listAssets(): Promise<AssetRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("assets", "by_created");
  return all.filter((a) => a.scope === "library").reverse();
}

export async function updateAsset(
  id: string,
  patch: Partial<Pick<AssetRecord, "name" | "category">>,
) {
  const db = await getDb();
  const rec = await db.get("assets", id);
  if (!rec) throw new Error("素材不存在");
  await db.put("assets", { ...rec, ...patch });
}

export async function deleteAsset(id: string) {
  const db = await getDb();
  const tx = db.transaction(["works", "versions", "assets", "kv"], "readwrite");
  const rows = [
    ...(await tx.objectStore("works").getAll()),
    ...(await tx.objectStore("versions").getAll()),
  ];
  const presetRefs = presetAssetIds(storedPresets(await tx.objectStore("kv").get(DRAWING_PRESETS_KEY)));
  if (presetRefs.includes(id) || rows.some((row) => referencedAssetIds(row.doc).includes(id))) {
    await tx.done;
    throw new Error("该素材仍被作品或历史版本使用，请先移除引用后再删除");
  }
  await tx.objectStore("assets").delete(id);
  await tx.done;
  evictAssetUrl(id);
}

export function evictAssetUrl(id: string) {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
}

/** Resolve an image source to a URL the browser can load. */
export async function resolveImageUrl(src: ImageSource): Promise<string> {
  if (src.kind === "url") return src.url;
  const cached = urlCache.get(src.assetId);
  if (cached) return cached;
  const rec = await getAsset(src.assetId);
  if (!rec) throw new Error(`图片素材丢失（${src.assetId}）`);
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(src.assetId, url);
  return url;
}
