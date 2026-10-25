import { newId } from "@/lib/template/ids.ts";
import type { ImageSource } from "@/types/template.ts";
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
  await db.delete("assets", id);
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
