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
