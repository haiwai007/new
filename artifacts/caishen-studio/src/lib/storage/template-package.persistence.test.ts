// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "./db";
import { createWork, listVersions } from "./works";
import { importWorkFile } from "./template-package";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import { buildPackage } from "../template/package";
import * as ids from "../template/ids";
beforeEach(async () => {
  const db = await getDb();
  await db.clear("works");
  await db.clear("versions");
  await db.clear("assets");
});
afterEach(() => vi.restoreAllMocks());
function source() {
  const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
  doc.canvas.backgroundImage = { kind: "asset", assetId: "original-image" };
  return buildPackage(doc, [
    {
      id: "original-image",
      name: "image",
      mime: "image/png",
      width: 1,
      height: 1,
      data: "AA==",
    },
  ]);
}
function file(raw: unknown) {
  return new File([JSON.stringify(raw)], "template.json");
}
describe("atomic template import and cloud restore", () => {
  it("imports image data, a fresh work and its initial history together", async () => {
    const result = await importWorkFile(file(source()), {
      kind: "project",
      name: "恢复副本",
      strict: true,
    });
    expect(result.work.name).toBe("恢复副本");
    expect(result.work.doc.templateId).toBe(result.work.id);
    const src = result.work.doc.canvas.backgroundImage!;
    if (src.kind !== "asset") throw Error("asset expected");
    expect(src.assetId).not.toBe("original-image");
    const db = await getDb();
    expect((await db.get("assets", src.assetId))!.blob.size).toBe(1);
    expect((await listVersions(result.work.id))[0].reason).toBe("import");
  });
  it("does not leave orphan images or a partial work on a failed history write", async () => {
    const previous = await createWork({
      kind: "project",
      name: "original",
      doc: BUILTIN_TEMPLATES[0].doc,
    });
    const version = (await listVersions(previous.id))[0];
    const originalId = ids.newId;
    vi.spyOn(ids, "newId").mockImplementation((prefix) =>
      prefix === "ver" ? version.id : originalId(prefix),
    );
    await expect(
      importWorkFile(file(source()), { kind: "project", strict: true }),
    ).rejects.toThrow();
    const db = await getDb();
    expect(await db.count("works")).toBe(1);
    expect(await db.count("versions")).toBe(1);
    expect(await db.count("assets")).toBe(0);
  });
  it("rejects corrupted, duplicate and incomplete image data before storing anything", async () => {
    const raw = source();
    await expect(
      importWorkFile(
        file({ ...raw, assets: [{ ...raw.assets[0], data: "!!!!" }] }),
        { kind: "project" },
      ),
    ).rejects.toThrow("编码");
    await expect(
      importWorkFile(file({ ...raw, assets: [raw.assets[0], raw.assets[0]] }), {
        kind: "project",
      }),
    ).rejects.toThrow("重复");
    await expect(
      importWorkFile(file({ ...raw, assets: [] }), {
        kind: "project",
        strict: true,
      }),
    ).rejects.toThrow("图片");
    const db = await getDb();
    expect(await db.count("works")).toBe(0);
    expect(await db.count("assets")).toBe(0);
  });
});
