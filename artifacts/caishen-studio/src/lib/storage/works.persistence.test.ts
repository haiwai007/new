// @vitest-environment node
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "./db";
import { createWork, getWork, listVersions, saveWork } from "./works";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import * as ids from "../template/ids";
beforeEach(async () => {
  const db = await getDb();
  await db.clear("works");
  await db.clear("versions");
});
afterEach(() => vi.restoreAllMocks());
describe("atomic work persistence", () => {
  it("serializes concurrent snapshot transactions into distinct versions", async () => {
    const work = await createWork({
      name: "initial",
      kind: "project",
      doc: BUILTIN_TEMPLATES[0].doc,
    });
    const [a, b] = await Promise.all([
      saveWork(work.id, { ...work.doc, name: "a" }, { snapshot: true }),
      saveWork(work.id, { ...work.doc, name: "b" }, { snapshot: true }),
    ]);
    expect(new Set([a.version, b.version])).toEqual(new Set([2, 3]));
    expect(await listVersions(work.id)).toHaveLength(3);
    expect((await getWork(work.id))!.version).toBe(3);
  });
  it("rolls back document changes if writing the corresponding version fails", async () => {
    const work = await createWork({
      name: "original",
      kind: "project",
      doc: BUILTIN_TEMPLATES[0].doc,
    });
    const firstVersion = (await listVersions(work.id))[0];
    vi.spyOn(ids, "newId").mockReturnValue(firstVersion.id);
    await expect(
      saveWork(
        work.id,
        { ...work.doc, name: "should not persist" },
        { snapshot: true },
      ),
    ).rejects.toThrow();
    expect((await getWork(work.id))!.name).toBe("original");
    expect(await listVersions(work.id)).toHaveLength(1);
  });
});

describe("concurrent editor and asset integrity", () => {
  it("rejects stale tabs without overwriting the winning revision", async () => {
    const work = await createWork({ kind: "project", name: "initial", doc: BUILTIN_TEMPLATES[0].doc });
    const results = await Promise.allSettled(["tab A", "tab B"].map(name =>
      saveWork(work.id, { ...work.doc, name }, { snapshot: false, expectedRevision: 0 })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    expect((await getWork(work.id))?.revision).toBe(1);
    expect((await getWork(work.id))?.version).toBe(1);
  });
  it("serializes deleting and saving history without orphan versions", async () => {
    const { deleteWork } = await import("./works");
    const work = await createWork({ kind: "project", name: "initial", doc: BUILTIN_TEMPLATES[0].doc });
    await Promise.allSettled([
      saveWork(work.id, work.doc, { snapshot: true }), deleteWork(work.id),
      saveWork(work.id, work.doc, { snapshot: true }),
    ]);
    expect(await getWork(work.id)).toBeUndefined();
    expect(await listVersions(work.id)).toEqual([]);
  });
  it("retains referenced assets, or rejects a save if collection already won", async () => {
    const { saveAsset, getAsset, deleteAsset } = await import("./assets");
    const { deleteWork } = await import("./works");
    const asset = await saveAsset(new Blob(["x"], { type: "image/png" }), { name: "x", width: 1, height: 1, scope: "internal" });
    const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
    doc.canvas.backgroundImage = { kind: "asset", assetId: asset.id };
    const first = await createWork({ kind: "project", name: "first", doc });
    const second = await createWork({ kind: "project", name: "second", doc: BUILTIN_TEMPLATES[0].doc });
    const results = await Promise.allSettled([
      deleteWork(first.id), saveWork(second.id, doc, { snapshot: false, expectedRevision: 0 }),
    ]);
    const saved = results[1].status === "fulfilled";
    expect(!!(await getAsset(asset.id))).toBe(saved);
    expect((await getWork(second.id))?.doc.canvas.backgroundImage?.kind === "asset").toBe(saved);
    if (saved) await expect(deleteAsset(asset.id)).rejects.toThrow(/使用/);
  });
  it("collects internal images only when no work or history references them", async () => {
    const { saveAsset, getAsset } = await import("./assets");
    const { deleteWork } = await import("./works");
    const asset = await saveAsset(new Blob(["x"], { type: "image/png" }), { name: "x", width: 1, height: 1, scope: "internal" });
    const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
    doc.canvas.backgroundImage = { kind: "asset", assetId: asset.id };
    const first = await createWork({ kind: "project", name: "first", doc });
    const second = await createWork({ kind: "project", name: "second", doc });
    await deleteWork(first.id);
    expect(await getAsset(asset.id)).toBeDefined();
    await deleteWork(second.id);
    expect(await getAsset(asset.id)).toBeUndefined();
    await expect(createWork({ kind: "project", name: "stale copy", doc })).rejects.toThrow(/图片素材已被删除/);
  });
});
