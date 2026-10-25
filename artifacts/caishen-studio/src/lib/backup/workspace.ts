import { DRAWING_PRESETS_KEY, remapPreset, storedPresets } from "../phone/drawing-preset";
import { getDb, type AssetRecord, type WorkRecord } from "../storage/db";
import { base64ToBlob, blobToBase64 } from "../storage/encoding";
import { newId } from "../template/ids";
import { remapAssetIds } from "../template/package";
import {
  BACKUP_FORMAT,
  MAX_BACKUP_BYTES,
  backupSummary,
  parseWorkspaceBackup,
  type WorkspaceBackup,
} from "./format";
export async function exportWorkspace(): Promise<Blob> {
  const db = await getDb();
  const tx = db.transaction(
    ["works", "versions", "assets", "exports", "kv"],
    "readonly",
  );
  const [works, versions, assets, exports, favorites, presets] = await Promise.all([
    tx.objectStore("works").getAll(),
    tx.objectStore("versions").getAll(),
    tx.objectStore("assets").getAll(),
    tx.objectStore("exports").getAll(),
    tx.objectStore("kv").get("favoriteTemplates"),
    tx.objectStore("kv").get(DRAWING_PRESETS_KEY),
  ]);
  await tx.done;
  const estimatedImages = assets.reduce(
    (n, a) => n + Math.ceil(a.blob.size / 3) * 4,
    0,
  );
  if (estimatedImages > MAX_BACKUP_BYTES)
    throw new Error("整库备份超过 100MB，请分作品导出模板文件");
  const packaged = [];
  for (const { blob, ...asset } of assets)
    packaged.push({
      ...asset,
      size: blob.size,
      mime: blob.type || asset.mime,
      data: await blobToBase64(blob),
    });
  const data = {
    format: BACKUP_FORMAT,
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    works,
    versions,
    assets: packaged,
    exports,
    drawingPresets: storedPresets(presets),
    favoriteTemplates: Array.isArray(favorites) ? favorites : [],
  };
  // Never export a backup that would fail to restore.
  parseWorkspaceBackup(data);
  const result = new Blob([JSON.stringify(data)], { type: "application/json" });
  if (result.size > MAX_BACKUP_BYTES)
    throw new Error("整库备份超过 100MB，请分作品导出模板文件");
  return result;
}
export async function readWorkspaceBackup(
  file: File,
): Promise<WorkspaceBackup> {
  if (file.size > MAX_BACKUP_BYTES)
    throw new Error("备份文件超过 100MB，无法恢复");
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error("文件不是有效的 JSON 备份");
  }
  return parseWorkspaceBackup(raw);
}
/** All stores commit together; add() and fresh IDs guarantee existing records are preserved. */
export async function restoreWorkspace(input: WorkspaceBackup) {
  // Validate again at commit time, since the preview may be held in memory for a while.
  const backup = parseWorkspaceBackup(input);
  const assetIds = new Map(backup.assets.map((a) => [a.id, newId("asset")]));
  const workIds = new Map(
    backup.works.map((w) => [
      w.id,
      newId(w.kind === "template" ? "tpl" : "work"),
    ]),
  );
  const assets: AssetRecord[] = backup.assets.map(({ data, ...a }) => ({
    ...a,
    id: assetIds.get(a.id)!,
    blob: base64ToBlob(data, a.mime),
  }));
  const works: WorkRecord[] = backup.works.map((w) => {
    const id = workIds.get(w.id)!;
    const name = `${w.name}（备份恢复）`;
    return {
      ...w,
      revision: 0,
      id,
      name,
      origin: w.origin ? (workIds.get(w.origin) ?? w.origin) : null,
      doc: { ...remapAssetIds(w.doc, assetIds), templateId: id, name },
    };
  });
  const versions = backup.versions.map((v) => ({
    ...v,
    id: newId("ver"),
    workId: workIds.get(v.workId)!,
    doc: {
      ...remapAssetIds(v.doc, assetIds),
      templateId: workIds.get(v.workId)!,
    },
  }));
  const exports = backup.exports.map((e) => ({
    ...e,
    id: newId("exp"),
    workId: e.workId ? (workIds.get(e.workId) ?? null) : null,
  }));
  const db = await getDb();
  const tx = db.transaction(
    ["works", "versions", "assets", "exports", "kv"],
    "readwrite",
  );
  const requests: Promise<unknown>[] = [];
  try {
    const oldFavorites = await tx.objectStore("kv").get("favoriteTemplates");
    const existing = storedPresets(await tx.objectStore("kv").get(DRAWING_PRESETS_KEY));
    if (existing.length + backup.drawingPresets.length > 100) throw new Error("恢复后作图预设超过 100 个，请先整理已有预设");
    requests.push(tx.objectStore("kv").put([...existing, ...backup.drawingPresets.map(p => ({...remapPreset(p, assetIds), id: newId("preset"), name: `${p.name.slice(0, 72)}（恢复）`}))], DRAWING_PRESETS_KEY));
    for (const row of assets) requests.push(tx.objectStore("assets").add(row));
    for (const row of works) requests.push(tx.objectStore("works").add(row));
    for (const row of versions)
      requests.push(tx.objectStore("versions").add(row));
    for (const row of exports)
      requests.push(tx.objectStore("exports").add(row));
    requests.push(
      tx
        .objectStore("kv")
        .put(
          [
            ...new Set([
              ...(Array.isArray(oldFavorites)
                ? oldFavorites.filter((x) => typeof x === "string")
                : []),
              ...backup.favoriteTemplates,
            ]),
          ],
          "favoriteTemplates",
        ),
    );
    await Promise.all([...requests, tx.done]);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* Already aborted by IndexedDB. */
    }
    await Promise.allSettled([...requests, tx.done]);
    throw error;
  }
  return backupSummary(backup);
}
export async function workspaceSummary() {
  const db = await getDb();
  const tx = db.transaction(["works", "versions", "assets", "exports", "kv"]);
  const [works, versions, assets, exports, presets] = await Promise.all([
    tx.objectStore("works").count(),
    tx.objectStore("versions").count(),
    tx.objectStore("assets").count(),
    tx.objectStore("exports").count(),
    tx.objectStore("kv").get(DRAWING_PRESETS_KEY),
  ]);
  await tx.done;
  return { works, versions, assets, exports, drawingPresets: storedPresets(presets).length };
}
