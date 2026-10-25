// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../storage/db";
import { createWork, saveWork, listVersions } from "../storage/works";
import { saveAsset } from "../storage/assets";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import * as ids from "../template/ids";
import {
  exportWorkspace,
  readWorkspaceBackup,
  restoreWorkspace,
  workspaceSummary,
} from "./workspace";
import { parseWorkspaceBackup } from "./format";
beforeEach(async () => {
  const db = await getDb();
  const tx = db.transaction(
    ["works", "versions", "assets", "exports", "kv"],
    "readwrite",
  );
  await Promise.all(
    ["works", "versions", "assets", "exports", "kv"].map((s) =>
      tx.objectStore(s as "works").clear(),
    ),
  );
  await tx.done;
});
afterEach(() => vi.restoreAllMocks());
async function seed() {
  const asset = await saveAsset(
    new Blob([new Uint8Array([0])], { type: "image/png" }),
    { name: "背景", width: 1, height: 1, scope: "internal" },
  );
  await saveAsset(new Blob([new Uint8Array([1])], { type: "image/png" }), {
    name: "独立素材",
    width: 1,
    height: 1,
  });
  const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
  doc.canvas.backgroundImage = { kind: "asset", assetId: asset.id };
  const work = await createWork({ kind: "project", name: "设计", doc });
  await saveWork(
    work.id,
    { ...work.doc, name: "第二版" },
    { snapshot: true, note: "定稿" },
  );
  const db = await getDb();
  await db.put("exports", {
    id: "export1",
    workId: work.id,
    workName: work.name,
    fileName: "image.png",
    format: "png",
    width: 100,
    height: 100,
    createdAt: new Date().toISOString(),
  });
  await db.put("kv", ["builtin-one"], "favoriteTemplates");
  return { work, asset };
}
async function backup() {
  const blob = await exportWorkspace();
  return readWorkspaceBackup(new File([blob], "backup.json"));
}
describe("complete workspace backup", () => {
  it("roundtrips images, history, library metadata, exports and favorites without overwriting originals", async () => {
    const { work, asset } = await seed();
    const data = await backup();
    expect(data.versions).toHaveLength(2);
    expect(data.assets).toHaveLength(2);
    const counts = await restoreWorkspace(data);
    expect(counts).toEqual({ works: 1, versions: 2, assets: 2, exports: 1 });
    expect(await workspaceSummary()).toEqual({
      works: 2,
      versions: 4,
      assets: 4,
      exports: 2,
    });
    const db = await getDb();
    const works = await db.getAll("works");
    const restored = works.find((w) => w.id !== work.id)!;
    expect(restored.name).toBe("第二版（备份恢复）");
    expect(restored.doc.templateId).toBe(restored.id);
    expect(restored.doc.canvas.backgroundImage).not.toEqual({
      kind: "asset",
      assetId: asset.id,
    });
    const image = restored.doc.canvas.backgroundImage!;
    if (image.kind !== "asset") throw Error("expected local image");
    expect(
      new Uint8Array(
        await (await db.get("assets", image.assetId))!.blob.arrayBuffer(),
      ),
    ).toEqual(new Uint8Array([0]));
    const history = await listVersions(restored.id);
    expect(history[0].note).toBe("定稿");
    expect(history[0].doc.templateId).toBe(restored.id);
    expect((await db.get("works", work.id))!.name).toBe("第二版");
    await restoreWorkspace(data);
    expect((await workspaceSummary()).works).toBe(3);
  });
  it("validates all references and duplicate IDs before writing", async () => {
    await seed();
    const data = await backup();
    expect(() => parseWorkspaceBackup({ ...data, assets: [] })).toThrow("缺少");
    expect(() =>
      parseWorkspaceBackup({ ...data, works: [...data.works, data.works[0]] }),
    ).toThrow("重复");
    expect(() =>
      parseWorkspaceBackup({
        ...data,
        versions: [{ ...data.versions[0], workId: "missing" }],
      }),
    ).toThrow("不存在");
    expect(() =>
      parseWorkspaceBackup({
        ...data,
        assets: [{ ...data.assets[0], data: "!@#$" }],
      }),
    ).toThrow("Base64");
    expect(() =>
      parseWorkspaceBackup({
        ...data,
        assets: [{ ...data.assets[0], size: 2 }, data.assets[1]],
      }),
    ).toThrow("不一致");
    expect(() => parseWorkspaceBackup({ ...data, formatVersion: 99 })).toThrow(
      "格式",
    );
    expect((await workspaceSummary()).works).toBe(1);
  });
  it("rolls back all stores if any IDB write fails", async () => {
    await seed();
    const data = await backup();
    const before = await workspaceSummary();
    vi.spyOn(ids, "newId").mockImplementation(
      (prefix) => `${prefix}_collision`,
    );
    await expect(restoreWorkspace(data)).rejects.toThrow();
    expect(await workspaceSummary()).toEqual(before);
  });
  it("refuses export when referenced images have been lost", async () => {
    const { asset } = await seed();
    await (await getDb()).delete("assets", asset.id);
    await expect(exportWorkspace()).rejects.toThrow("缺少");
  });
  it("rejects wrong, oversized and malformed files without modifying local data", async () => {
    await expect(
      readWorkspaceBackup(new File(["no"], "bad.json")),
    ).rejects.toThrow("JSON");
    await expect(
      readWorkspaceBackup({ size: 100 * 1024 * 1024 + 1 } as File),
    ).rejects.toThrow("100MB");
    await expect(
      readWorkspaceBackup(new File(["{}"], "bad.json")),
    ).rejects.toThrow("格式");
    expect((await workspaceSummary()).works).toBe(0);
  });
  it("preserves existing favorite choices and clears dangling export links", async () => {
    await seed();
    const data = await backup();
    data.exports[0].workId = "deleted-work";
    const db = await getDb();
    await db.put("kv", ["local-favorite"], "favoriteTemplates");
    await restoreWorkspace(data);
    expect(await db.get("kv", "favoriteTemplates")).toEqual([
      "local-favorite",
      "builtin-one",
    ]);
    expect(
      (await db.getAll("exports")).filter((e) => e.id !== "export1")[0].workId,
    ).toBeNull();
  });
});

it("limits new names but roundtrips legacy long names through repeated backup/restores", async () => {
  const created = await createWork({ kind: "project", name: "新".repeat(1001), doc: BUILTIN_TEMPLATES[0].doc });
  expect(created.name.length).toBe(200);
  const db = await getDb();
  const legacyName = "旧".repeat(1001);
  await db.put("works", { ...created, name: legacyName, doc: { ...created.doc, name: legacyName } });
  const first = await backup();
  expect(first.works[0].name).toBe(legacyName);
  await restoreWorkspace(first);
  const second = await backup();
  expect(second.works.some(w => w.name === legacyName + "（备份恢复）")).toBe(true);
  await restoreWorkspace(second);
  await expect(exportWorkspace()).resolves.toBeInstanceOf(Blob);
});

it("packages hidden custom APP icon assets and remaps their settings on restore", async () => {
  const { applyPhoneLayers, defaultPhoneSettings } = await import("../phone/layers");
  const { referencedAssetIds } = await import("../template/doc-ops");
  const asset = await saveAsset(new Blob(["icon"], {type:"image/png"}), {name:"custom-app", width:128, height:128, scope:"internal"});
  const doc = applyPhoneLayers(structuredClone(BUILTIN_TEMPLATES[0].doc), { ...defaultPhoneSettings(), appIcons:[{id:"app_aaaaaaaaaa",kind:"custom",name:"自定义",src:{kind:"asset",assetId:asset.id},visible:false}] });
  const work = await createWork({kind:"template",name:"APP 模板",doc});
  const backup = await readWorkspaceBackup(new File([await exportWorkspace()], "backup.json"));
  expect(backup.assets.map(a => a.id)).toContain(asset.id);
  await restoreWorkspace(backup);
  const db = await getDb();
  const restored = (await db.getAll("works")).find(w => w.id !== work.id)!;
  const icon = restored.doc.phone!.appIcons[0];
  if (icon.kind !== "custom" || icon.src.kind !== "asset") throw new Error("Expected a local custom icon");
  expect(icon.src.assetId).not.toBe(asset.id);
  expect(await db.get("assets",icon.src.assetId)).toBeDefined();
  expect(referencedAssetIds(restored.doc)).not.toContain(asset.id);
  const refreshed = applyPhoneLayers(restored.doc, restored.doc.phone!);
  expect(refreshed.layers.find(l => l.id.endsWith(icon.id))).toMatchObject({src:{kind:"asset",assetId:icon.src.assetId},visible:false});
});
