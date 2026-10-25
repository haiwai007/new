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

import { notifyWorkChange } from "./work-events";
import { workName } from "./names";
import { evictAssetUrl } from "./assets";

export class WorkConflictError extends Error {
  constructor() {
    super("作品已在其他标签页修改或删除，本次修改将保存为冲突副本");
  }
}
const MAX_VERSIONS = 30;

type WorkTx = IDBPTransaction<
  Schema,
  ["works", "versions", "assets"],
  "readwrite"
>;
async function writeWork<T>(fn: (tx: WorkTx) => Promise<T>): Promise<T> {
  const db = await getDb();
  const tx = db.transaction(["works", "versions", "assets"], "readwrite");
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
  const name = workName(input.name);
  const now = new Date().toISOString();
  const id = newId(input.kind === "template" ? "tpl" : "work");
  const record: WorkRecord = {
    id,
    kind: input.kind,
    name,
    doc: { ...checked.doc, templateId: id, name },
    thumbnail: input.thumbnail ?? null,
    favorite: false,
    version: 1,
    revision: 0,
    origin: input.origin ?? null,
    fromUpload: input.fromUpload ?? false,
    createdAt: now,
    updatedAt: now,
  };
  return writeWork(async (tx) => {
    await assertAssets(tx, record.doc);
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
    expectedRevision?: number;
  },
): Promise<WorkRecord> {
  const checked = loadTemplateDoc(doc);
  if (!checked.ok) throw new Error(checked.error);
  const saved = await writeWork(async (tx) => {
    const store = tx.objectStore("works");
    const existing = await store.get(id);
    if (
      opts.expectedRevision !== undefined &&
      (!existing || (existing.revision ?? 0) !== opts.expectedRevision)
    )
      throw new WorkConflictError();
    if (!existing) throw new Error("作品不存在或已被删除");
    await assertAssets(tx, checked.doc);
    // Preserve an unchanged legacy long name; constrain only newly entered names.
    const name =
      checked.doc.name === existing.name
        ? existing.name
        : workName(checked.doc.name);
    const record: WorkRecord = {
      ...existing,
      name,
      doc: { ...checked.doc, templateId: id, name },
      revision: (existing.revision ?? 0) + 1,
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
  notifyWorkChange(id, saved.revision ?? 0);
  return saved;
}

export async function patchWork(
  id: string,
  patch: Partial<Pick<WorkRecord, "name" | "favorite">>,
) {
  const revision = await writeWork(async (tx) => {
    const store = tx.objectStore("works");
    const existing = await store.get(id);
    if (!existing) throw new Error("作品不存在");
    const name =
      patch.name === undefined ? existing.name : workName(patch.name);
    const revision = (existing.revision ?? 0) + 1;
    await store.put({
      ...existing,
      ...patch,
      name,
      revision,
      doc: { ...existing.doc, name },
      updatedAt: new Date().toISOString(),
    });
    return revision;
  });
  notifyWorkChange(id, revision);
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

/** Writers and collectors lock the same stores. A later writer must reject deleted references. */
async function assertAssets(tx: WorkTx, doc: TemplateDoc) {
  for (const id of referencedAssetIds(doc))
    if (!(await tx.objectStore("assets").get(id)))
      throw new Error("引用的图片素材已被删除，请重新添加图片后保存");
}
async function cleanupInternalAssets(tx: WorkTx, docs: TemplateDoc[]) {
  const candidates = new Set(docs.flatMap(referencedAssetIds));
  const rows = [
    ...(await tx.objectStore("works").getAll()),
    ...(await tx.objectStore("versions").getAll()),
  ];
  const used = new Set(rows.flatMap((row) => referencedAssetIds(row.doc)));
  const removed: string[] = [];
  for (const id of candidates) {
    if (used.has(id)) continue;
    const asset = await tx.objectStore("assets").get(id);
    if (asset?.scope === "internal") {
      await tx.objectStore("assets").delete(id);
      removed.push(id);
    }
  }
  return removed;
}
export async function deleteWork(id: string) {
  const removed = await writeWork(async (tx) => {
    const work = await tx.objectStore("works").get(id);
    const versions = await tx
      .objectStore("versions")
      .index("by_work")
      .getAll(id);
    await tx.objectStore("works").delete(id);
    for (const version of versions)
      await tx.objectStore("versions").delete(version.id);
    return cleanupInternalAssets(tx, [
      ...(work ? [work.doc] : []),
      ...versions.map((v) => v.doc),
    ]);
  });
  for (const assetId of removed) evictAssetUrl(assetId);
  notifyWorkChange(id, null);
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
  const tx = db.transaction(["works", "versions"], "readonly");
  const [v, current] = await Promise.all([
    tx.objectStore("versions").get(versionId),
    tx.objectStore("works").get(workId),
  ]);
  await tx.done;
  if (!current) throw new Error("作品不存在");
  if (!v || v.workId !== workId) throw new Error("历史版本不存在");
  // Restoring never overwrites history: it creates a new version on top.
  return saveWork(
    workId,
    { ...v.doc, name: v.name },
    {
      snapshot: true,
      expectedRevision: current.revision ?? 0,
      thumbnail: v.thumbnail ?? undefined,
      reason: "restore",
      note: `恢复自 v${v.version}`,
    },
  );
}

export async function updateVersionNote(versionId: string, note: string) {
  await writeWork(async (tx) => {
    const store = tx.objectStore("versions");
    const version = await store.get(versionId);
    if (!version) throw new Error("历史版本不存在");
    await store.put({ ...version, note: note.trim() || undefined });
  });
}

/** Check newest and delete in the same transaction as snapshot writers. */
export async function deleteVersion(workId: string, versionId: string) {
  const removed = await writeWork(async (tx) => {
    const list = await tx
      .objectStore("versions")
      .index("by_work")
      .getAll(workId);
    list.sort((a, b) => b.version - a.version);
    if (list[0]?.id === versionId) throw new Error("最新版本不能删除");
    const version = list.find((v) => v.id === versionId);
    if (!version) throw new Error("历史版本不存在");
    await tx.objectStore("versions").delete(versionId);
    return cleanupInternalAssets(tx, [version.doc]);
  });
  for (const id of removed) evictAssetUrl(id);
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
