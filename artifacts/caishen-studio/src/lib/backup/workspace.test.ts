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
    expect(counts).toEqual({ works: 1, versions: 2, assets: 2, exports: 1, drawingPresets: 0 });
    expect(await workspaceSummary()).toEqual({
      works: 2,
      versions: 4,
      assets: 4,
      exports: 2,
      drawingPresets: 0,
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

it("backs up drawing presets with candidate-only custom icons and remaps them on repeated restore", async () => {
  const { saveDrawingPreset, listDrawingPresets } = await import("../storage/drawing-presets");
  const { drawingRules } = await import("../batch/phone-rules");
  const { defaultPhoneSettings } = await import("../phone/layers");
  const { presetAssetIds } = await import("../phone/drawing-preset");
  const a = await saveAsset(new Blob(["only-preset"], {type: "image/png"}), {name: "候选通知", width: 128, height: 128, scope: "internal"});
  const rules = drawingRules(defaultPhoneSettings());
  rules.models = {enabled: true, ids: ["iphone16", "pixel9"], distribution: "balanced"};
  rules.apps = {mode: "random", fixed: [], candidates: [{id: "app_aaaaaaaaaa", name: "仅预设图标", kind: "custom", src: {kind: "asset", assetId: a.id}, visible: true}], min: 0, max: 1, order: "list"};
  await saveDrawingPreset("通知预设", rules);
  const data = await backup();
  expect(data.drawingPresets).toHaveLength(1);
  expect(data.works).toHaveLength(0);
  await restoreWorkspace(data);
  const presets = await listDrawingPresets();
  expect(presets).toHaveLength(2);
  expect(presets[1].rules.models).toEqual(rules.models);
  const restoredId = presetAssetIds([presets[1]])[0];
  expect(restoredId).not.toBe(a.id);
  expect(await (await getDb()).get("assets", restoredId)).toBeDefined();
  await expect(exportWorkspace()).resolves.toBeInstanceOf(Blob);
});

it("protects preset-only assets during manual deletion and work cleanup", async () => {
  const { saveDrawingPreset, deleteDrawingPreset } = await import("../storage/drawing-presets");
  const { deleteAsset } = await import("../storage/assets");
  const { deleteWork } = await import("../storage/works");
  const { drawingRules } = await import("../batch/phone-rules");
  const { defaultPhoneSettings, applyPhoneLayers } = await import("../phone/layers");
  const a = await saveAsset(new Blob(["icon"], {type: "image/png"}), {name: "预设图标", width: 128, height: 128, scope: "internal"});
  const rules = drawingRules({...defaultPhoneSettings(), appIcons: [{id: "app_aaaaaaaaaa", name: "通知", kind: "custom", src: {kind: "asset", assetId: a.id}, visible: true}]});
  const work = await createWork({kind: "project", name: "共用图标", doc: applyPhoneLayers(BUILTIN_TEMPLATES[0].doc, rules.setup!.settings)});
  const preset = await saveDrawingPreset("保护", rules);
  await expect(deleteAsset(a.id)).rejects.toThrow(/使用/);
  await deleteWork(work.id);
  expect(await (await getDb()).get("assets", a.id)).toBeDefined();
  await expect(deleteAsset(a.id)).rejects.toThrow(/使用/);
  await deleteDrawingPreset(preset.id);
  await expect(deleteAsset(a.id)).resolves.toBeUndefined();
});

it("rejects missing preset assets before writing and accepts old backups without presets", async () => {
  const { saveDrawingPreset, listDrawingPresets } = await import("../storage/drawing-presets");
  const { drawingRules } = await import("../batch/phone-rules");
  const { defaultPhoneSettings } = await import("../phone/layers");
  const rules = drawingRules({...defaultPhoneSettings(), appIcons: [{id: "app_aaaaaaaaaa", name: "丢失", kind: "custom", src: {kind: "asset", assetId: "missing"}, visible: true}]});
  await expect(saveDrawingPreset("失败", rules)).rejects.toThrow(/丢失/);
  expect(await listDrawingPresets()).toHaveLength(0);
  const old = JSON.parse(await (await exportWorkspace()).text()); delete old.drawingPresets;
  expect(parseWorkspaceBackup(old).drawingPresets).toEqual([]);
  old.drawingPresets = [{id: "bad-preset", name: "损坏", createdAt: new Date().toISOString(), rules}];
  expect(() => parseWorkspaceBackup(old)).toThrow(/自定义图标/);
});

it("roundtrips natural layout versions, analysis and manual locks in drawing presets",async()=>{
  const {saveDrawingPreset,listDrawingPresets}=await import("../storage/drawing-presets");
  const {drawingRules}=await import("../batch/phone-rules");
  const {naturalPhoneSettings}=await import("../phone/layers");
  const {analyseTopPixels}=await import("../phone/fusion");
  const p=naturalPhoneSettings();p.modelId="galaxys24";p.styleId="oneui7";p.customAppStyle="mono";p.scale=110;
  const pixels=new Uint8ClampedArray(160*320*4).fill(255);
  p.fusion={...p.fusion,locks:["geometry","color"],analysis:analyseTopPixels(pixels,160,320,{width:600,height:1280,sourceKey:"preset-analysis"})};
  await saveDrawingPreset("自然融合设置",drawingRules(p));
  const data=await backup();await restoreWorkspace(data);
  const restored=(await listDrawingPresets())[1].rules.setup!.settings;
  expect(restored).toMatchObject({rendering:"natural",styleId:"oneui7",customAppStyle:"mono",scale:110,fusion:{locks:["geometry","color"],analysis:{sourceKey:"preset-analysis",kind:"flat"}}});
  await expect(exportWorkspace()).resolves.toBeInstanceOf(Blob);
});
