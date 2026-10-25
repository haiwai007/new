import { describe, expect, it } from "vitest";
import { findBuiltin } from "./builtin.ts";
import { createImageLayer, createTextLayer } from "./layers.ts";
import {
  compilePattern,
  createParameter,
  groupParameters,
  moveParameter,
  PATTERN_PRESETS,
  validateAll,
  validateParamValue,
} from "./params.ts";
import { buildPackage, parseTemplateFile, remapAssetIds } from "./package.ts";
import { describeDiff, diffDocs } from "./version-diff.ts";
import { loadTemplateDoc } from "./migrate.ts";
import { versionsToPrune } from "@/lib/storage/works.ts";
import { SCHEMA_VERSION, type TemplateDoc, type TemplateParameter } from "@/types/template.ts";

function docWith(): TemplateDoc {
  const t = createTextLayer({ x: 0, y: 0, width: 100, height: 40 }, { text: "标题" });
  const img = createImageLayer({ x: 0, y: 50, width: 100, height: 100 }, { kind: "asset", assetId: "asset_a" });
  return {
    schemaVersion: SCHEMA_VERSION,
    templateId: "t",
    name: "测试",
    canvas: { width: 400, height: 400, backgroundColor: "#fff", backgroundImage: { kind: "asset", assetId: "asset_bg" } },
    layers: [t, img],
    parameters: [],
    source: { originalAssetId: "asset_bg", mode: "smart", originalWidth: 400, originalHeight: 400 },
  };
}

const textParam = (rules: TemplateParameter["rules"]): TemplateParameter => {
  const d = docWith();
  return { ...createParameter(d, d.layers[0], "text", "电话"), rules };
};

describe("parameter rules", () => {
  it("checks min length by characters", () => {
    const p = textParam({ minLength: 2 });
    expect(validateParamValue(p, "一")).toMatch(/至少 2/);
    expect(validateParamValue(p, "一二")).toBeNull();
  });

  it("applies format presets as full matches", () => {
    const phone = PATTERN_PRESETS.find((x) => x.id === "phone")!;
    const p = textParam({ pattern: phone.pattern, patternMessage: phone.message });
    expect(validateParamValue(p, "13800138000")).toBeNull();
    // A valid number with extra text must fail (full match, not substring).
    expect(validateParamValue(p, "电话13800138000")).toMatch(/11 位手机号/);
    const email = PATTERN_PRESETS.find((x) => x.id === "email")!;
    expect(validateParamValue(textParam({ pattern: email.pattern }), "a@b.cn")).toBeNull();
    expect(validateParamValue(textParam({ pattern: email.pattern }), "a@b")).toMatch(/格式不正确/);
  });

  it("fails closed on invalid stored patterns instead of crashing", () => {
    expect(compilePattern("(")).toBeNull();
    expect(validateParamValue(textParam({ pattern: "(" }), "任意")).toMatch(/不受支持/);
  });

  it("groups parameters in first-seen order and defaults new ones by type", () => {
    const d = docWith();
    const a = createParameter(d, d.layers[0], "text");
    const b = createParameter(d, d.layers[0], "color");
    const c = createParameter(d, d.layers[1], "image");
    expect([a.group, b.group, c.group]).toEqual(["内容", "样式", "图片"]);
    const g = groupParameters([b, a, { ...c, group: "" }]);
    expect(g.map((x) => x.group)).toEqual(["样式", "内容", "未分组"]);
  });

  it("reorders parameters and stops at the ends", () => {
    const d = docWith();
    const a = createParameter(d, d.layers[0], "text", "A");
    const b = createParameter(d, d.layers[0], "color", "B");
    const doc = { ...d, parameters: [a, b] };
    expect(moveParameter(doc, b.id, -1).parameters.map((p) => p.name)).toEqual(["B", "A"]);
    expect(moveParameter(doc, a.id, -1)).toBe(doc);
  });

  it("collects all validation errors", () => {
    const d = docWith();
    const p = { ...createParameter(d, d.layers[0], "text", "标题"), rules: { maxLength: 1 } };
    expect(validateAll({ ...d, parameters: [p] })).toEqual([{ paramId: p.id, message: "「标题」最多 1 个字符" }]);
  });

  it("upgrades older parameters without group/description fields", () => {
    const d = docWith();
    const p = createParameter(d, d.layers[0], "text");
    const legacy: Record<string, unknown> = { ...p };
    delete legacy.group;
    delete legacy.description;
    delete legacy.placeholder;
    const res = loadTemplateDoc({ ...d, parameters: [legacy] });
    expect(res.ok && res.doc.parameters[0].group).toBe("");
  });
});

describe("template package", () => {
  it("round-trips a package and reports missing images", () => {
    const d = docWith();
    const pkg = buildPackage(d, [{ id: "asset_a", name: "a", mime: "image/png", width: 1, height: 1, data: "AA==" }]);
    const parsed = parseTemplateFile(JSON.parse(JSON.stringify(pkg)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.assets).toHaveLength(1);
    expect(parsed.warnings.join()).toMatch(/1 张图片未包含/);
  });

  it("accepts bare template JSON from older exports", () => {
    const parsed = parseTemplateFile(JSON.parse(JSON.stringify(docWith())));
    expect(parsed.ok && parsed.warnings.join()).toMatch(/不含图片数据/);
  });

  it("rejects newer formats and broken files", () => {
    expect(parseTemplateFile({ ...buildPackage(docWith(), []), formatVersion: 99 }).ok).toBe(false);
    expect(parseTemplateFile({ format: "caishen-template", formatVersion: 1, doc: { foo: 1 } }).ok).toBe(false);
    expect(parseTemplateFile("x").ok).toBe(false);
  });

  it("remaps every asset reference", () => {
    const d = docWith();
    const p = { ...createParameter(d, d.layers[1], "image"), defaultValue: { kind: "asset" as const, assetId: "asset_a" } };
    const out = remapAssetIds({ ...d, parameters: [p] }, new Map([["asset_a", "new_a"], ["asset_bg", "new_bg"]]));
    expect(out.canvas.backgroundImage).toEqual({ kind: "asset", assetId: "new_bg" });
    expect(out.source?.originalAssetId).toBe("new_bg");
    const img = out.layers[1];
    expect(img.type === "image" && img.src).toEqual({ kind: "asset", assetId: "new_a" });
    expect(out.parameters[0].defaultValue).toEqual({ kind: "asset", assetId: "new_a" });
  });
});

describe("version history", () => {
  const v = (version: number, note?: string) => ({ id: `v${version}`, version, note });

  it("prunes oldest plain versions first and always keeps the newest", () => {
    expect(versionsToPrune([v(1), v(2), v(3)], 3)).toEqual([]);
    expect(versionsToPrune([v(1), v(2), v(3), v(4)], 3)).toEqual(["v1"]);
  });

  it("keeps noted versions in preference to plain ones", () => {
    const list = [v(1, "定稿"), v(2), v(3), v(4)];
    expect(versionsToPrune(list, 3).sort()).toEqual(["v2"]);
    // When only noted versions remain, the oldest noted one goes.
    expect(versionsToPrune([v(1, "a"), v(2, "b"), v(3, "c")], 2)).toEqual(["v1"]);
  });

  it("describes changes between versions", () => {
    const coffee = findBuiltin("bt_coffee")!.doc;
    const title = coffee.layers.find((l) => l.id === "text_title")!;
    const next: TemplateDoc = {
      ...coffee,
      name: "改名",
      layers: [...coffee.layers.map((l) => (l.id === title.id && l.type === "text" ? { ...l, text: "新标题" } : l)), { ...title, id: "extra", name: "新文字" }],
    };
    const lines = describeDiff(diffDocs(coffee, next));
    expect(lines).toContain("修改了名称");
    expect(lines).toContain("新增图层：新文字");
    expect(lines.some((x) => x.startsWith("修改参数值："))).toBe(true);
    expect(lines.some((x) => x.includes("调整了"))).toBe(false);
    expect(describeDiff(diffDocs(coffee, coffee))).toEqual([]);
  });
});
