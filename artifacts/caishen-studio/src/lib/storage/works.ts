import type { IDBPTransaction } from "idb";
import { newId } from "@/lib/template/ids.ts";
import { loadTemplateDoc } from "@/lib/template/migrate.ts";
import { referencedAssetIds } from "@/lib/template/doc-ops.ts";
import type { TemplateDoc } from "@/types/template.ts";
import {
  getDb,
  type ExportRecord,
  type VersionRecord,
  type WorkKind,
  type WorkRecord,
  type Schema,
} from "./db.ts";

const MAX_VERSIONS = 30;

type WorkTx = IDBPTransaction<Schema, ["works", "versions"], "readwrite">;
async function writeWork<T>(fn: (tx: WorkTx) => Promise<T>): Promise<T> {
  const db = await getDb();
  const tx = db.transaction(["works", "versions"], "readwrite");
  // Observe aborts immediately even when a request rejects before tx.done is awaited.
  void tx.done.catch(() => {});
  try {
    const value = await fn(tx);
    await tx.done;
    return value;
  } catch (error) {
    try {
      tx.abort();
    } catch {}
    await tx.done.catch(() => {});
    throw error;
  }
}

export async function listWorks(): Promise<WorkRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("works", "by_updated");
  return all.reverse();
}

export async function getWork(id: string): Promise<WorkRecord | undefined> {
  const db = await getDb();
  return db.get("works", id);
}

export async function createWork(input: {
  kind: WorkKind;
  name: string;
  doc: TemplateDoc;
  thumbnail?: string | null;
  origin?: string | null;
  fromUpload?: boolean;
  reason?: VersionMeta["reason"];
}): Promise<WorkRecord> {
  const checked = loadTemplateDoc(input.doc);
  if (!checked.ok) throw new Error(checked.error);
  const now = new Date().toISOString();
  const id = newId(input.kind === "template" ? "tpl" : "work");
  const record: WorkRecord = {
    id,
    kind: input.kind,
    name: input.name,
    doc: { ...checked.doc, templateId: id, name: input.name },
    thumbnail: input.thumbnail ?? null,
    favorite: false,
    version: 1,
    origin: input.origin ?? null,
    fromUpload: input.fromUpload ?? false,
    createdAt: now,
    updatedAt: now,
  };
  return writeWork(async (tx) => {
    await tx.objectStore("works").add(record);
    await addVersion(tx, record, { reason: input.reason ?? "create" });
    return record;
  });
}

type VersionMeta = {
  note?: string;
  reason: NonNullable<VersionRecord["reason"]>;
};

async function addVersion(tx: WorkTx, work: WorkRecord, meta: VersionMeta) {
  const store = tx.objectStore("versions");
  const v: VersionRecord = {
    id: newId("ver"),
    workId: work.id,
    version: work.version,
    name: work.name,
    doc: work.doc,
    createdAt: work.updatedAt,
    thumbnail: work.thumbnail,
    note: meta.note?.trim() || undefined,
    reason: meta.reason,
  };
  await store.add(v);
  const all = await store.index("by_work").getAll(work.id);
  for (const id of versionsToPrune(all, MAX_VERSIONS)) await store.delete(id);
}

/**
 * Pick versions to delete so at most `max` remain. Versions with a note are
 * kept in preference to un-noted ones (the user marked them as important); the
 * newest version is always kept. Within each class, oldest go first.
 */
export function versionsToPrune(
  versions: Pick<VersionRecord, "id" | "version" | "note">[],
  max: number,
): string[] {
  if (versions.length <= max) return [];
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const [newest, ...rest] = sorted;
  const noted = rest.filter((x) => x.note);
  const plain = rest.filter((x) => !x.note);
  // Fill remaining slots: noted first (newest first), then plain (newest first).
  const keep = new Set([
    newest.id,
    ...[...noted, ...plain].slice(0, Math.max(0, max - 1)).map((x) => x.id),
  ]);
  return sorted.filter((x) => !keep.has(x.id)).map((x) => x.id);
}

/** Save the document. `snapshot` creates a new history version (manual save). */
export async function saveWork(
  id: string,
  doc: TemplateDoc,
  opts: {
    thumbnail?: string | null;
    snapshot: boolean;
    note?: string;
    reason?: VersionMeta["reason"];
  },
): Promise<WorkRecord> {
  const checked = loadTemplateDoc(doc);
  if (!checked.ok) throw new Error(checked.error);
  return writeWork(async (tx) => {
    const store = tx.objectStore("works");
    const existing = await store.get(id);
    if (!existing) throw new Error("作品不存在或已被删除");
    const record: WorkRecord = {
      ...existing,
      name: checked.doc.name,
      doc: { ...checked.doc, templateId: id },
      thumbnail:
        opts.thumbnail === undefined ? existing.thumbnail : opts.thumbnail,
      version: opts.snapshot ? existing.version + 1 : existing.version,
      updatedAt: new Date().toISOString(),
    };
    await store.put(record);
    if (opts.snapshot)
      await addVersion(tx, record, {
        note: opts.note,
        reason: opts.reason ?? "save",
      });
    return record;
  });
}

export async function patchWork(
  id: string,
  patch: Partial<Pick<WorkRecord, "name" | "favorite">>,
) {
  return writeWork(async (tx) => {
    const store = tx.objectStore("works");
    const existing = await store.get(id);
    if (!existing) throw new Error("作品不存在");
    const name = patch.name ?? existing.name;
    await store.put({
      ...existing,
      ...patch,
      doc: { ...existing.doc, name },
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function duplicateWork(
  id: string,
  kind?: WorkKind,
): Promise<WorkRecord> {
  const src = await getWork(id);
  if (!src) throw new Error("作品不存在");
  const targetKind = kind ?? src.kind;
  return createWork({
    kind: targetKind,
    name: kind && kind !== src.kind ? src.name : `${src.name} 副本`,
    doc: src.doc,
    thumbnail: src.thumbnail,
    origin: src.id,
    fromUpload: src.fromUpload,
  });
}

export async function deleteWork(id: string) {
  const db = await getDb();
  const versions = await db.getAllFromIndex("versions", "by_work", id);
  const work = await db.get("works", id);
  const tx = db.transaction(["works", "versions"], "readwrite");
  await tx.objectStore("works").delete(id);
  for (const v of versions) await tx.objectStore("versions").delete(v.id);
  await tx.done;
  if (work)
    await cleanupInternalAssets(
      work.doc,
      versions.map((v) => v.doc),
    );
}

/** Remove internal (non-library) assets no longer referenced anywhere. */
async function cleanupInternalAssets(
  doc: TemplateDoc,
  extraDocs: TemplateDoc[],
) {
  const db = await getDb();
  const candidates = new Set([doc, ...extraDocs].flatMap(referencedAssetIds));
  if (candidates.size === 0) return;
  const stillUsed = await assetsInUse();
  for (const id of candidates) {
    if (stillUsed.has(id)) continue;
    const a = await db.get("assets", id);
    if (a && a.scope === "internal") await db.delete("assets", id);
  }
}

/** Every asset id referenced by any work or version. */
export async function assetsInUse(): Promise<Map<string, string[]>> {
  const db = await getDb();
  const works = await db.getAll("works");
  const versions = await db.getAll("versions");
  const nameById = new Map(works.map((w) => [w.id, w.name]));
  const used = new Map<string, string[]>();
  const add = (assetId: string, label: string) => {
    const list = used.get(assetId) ?? [];
    if (!list.includes(label)) list.push(label);
    used.set(assetId, list);
  };
  for (const w of works)
    for (const a of referencedAssetIds(w.doc)) add(a, w.name);
  for (const v of versions) {
    for (const a of referencedAssetIds(v.doc))
      add(a, nameById.get(v.workId) ?? v.name);
  }
  return used;
}

export async function listVersions(workId: string): Promise<VersionRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("versions", "by_work", workId);
  return all.sort((a, b) => b.version - a.version);
}

export async function restoreVersion(
  workId: string,
  versionId: string,
): Promise<WorkRecord> {
  const db = await getDb();
  const v = await db.get("versions", versionId);
  if (!v || v.workId !== workId) throw new Error("历史版本不存在");
  // Restoring never overwrites history: it creates a new version on top.
  return saveWork(
    workId,
    { ...v.doc, name: v.name },
    {
      snapshot: true,
      thumbnail: v.thumbnail ?? undefined,
      reason: "restore",
      note: `恢复自 v${v.version}`,
    },
  );
}

export async function updateVersionNote(versionId: string, note: string) {
  const db = await getDb();
  const v = await db.get("versions", versionId);
  if (!v) throw new Error("历史版本不存在");
  await db.put("versions", { ...v, note: note.trim() || undefined });
}

/** Delete one history version. The newest version cannot be deleted. */
export async function deleteVersion(workId: string, versionId: string) {
  const list = await listVersions(workId);
  if (list[0]?.id === versionId) throw new Error("最新版本不能删除");
  const v = list.find((x) => x.id === versionId);
  if (!v) throw new Error("历史版本不存在");
  const db = await getDb();
  await db.delete("versions", versionId);
  await cleanupInternalAssets(v.doc, []);
}

/** Copy a version out into a brand-new work (the original keeps its history). */
export async function versionToNewWork(
  workId: string,
  versionId: string,
): Promise<WorkRecord> {
  const db = await getDb();
  const [v, work] = await Promise.all([
    db.get("versions", versionId),
    db.get("works", workId),
  ]);
  if (!v || v.workId !== workId || !work) throw new Error("历史版本不存在");
  return createWork({
    kind: work.kind,
    name: `${v.name}（v${v.version}）`,
    doc: v.doc,
    thumbnail: v.thumbnail ?? null,
    origin: work.id,
    fromUpload: work.fromUpload,
  });
}

export async function recordExport(
  rec: Omit<ExportRecord, "id" | "createdAt">,
) {
  const db = await getDb();
  await db.put("exports", {
    ...rec,
    id: newId("exp"),
    createdAt: new Date().toISOString(),
  });
}

export async function listExports(): Promise<ExportRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("exports", "by_created");
  return all.reverse();
}

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const v = await db.get("kv", key);
  return v === undefined ? fallback : (v as T);
}

export async function setKv(key: string, value: unknown) {
  const db = await getDb();
  await db.put("kv", value, key);
}
