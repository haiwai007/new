import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/canvas/render.ts", () => ({
  renderDoc: vi.fn(async () => ({ canvas: document.createElement("canvas"), warnings: [] })),
  canvasToBlob: vi.fn(async () => new Blob(["png-data"], { type: "image/png" })),
}));

import {
  createBatchArchive,
  parseBatchCsv,
  prepareBatchRow,
  suggestColumnMapping,
} from "./generation.ts";
import type { TemplateDoc, TemplateParameter, TextLayer } from "@/types/template.ts";

const titleParameter: TemplateParameter = {
  id: "param-title",
  name: "主标题",
  type: "text",
  layerId: "layer-title",
  property: "text",
  defaultValue: "默认标题",
  required: true,
  editable: true,
  allowEmpty: false,
  rules: { maxLength: 32 },
  group: "内容",
  description: "",
  placeholder: "",
};

const titleLayer: TextLayer = {
  id: "layer-title",
  name: "主标题",
  type: "text",
  x: 0,
  y: 0,
  width: 280,
  height: 60,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  editable: true,
  groupId: null,
  layout: "fixed",
  text: "默认标题",
  fontFamily: "Arial",
  fontSize: 32,
  fontWeight: "normal",
  fontStyle: "normal",
  fill: "#222222",
  textAlign: "left",
  verticalAlign: "top",
  lineHeight: 1,
  letterSpacing: 0,
  wrap: true,
  autoShrink: false,
  autoGrow: false,
  minFontSize: 10,
  maxLines: 1,
  shadow: null,
};

const template: TemplateDoc = {
  schemaVersion: 1,
  templateId: "template-1",
  name: "测试模板",
  canvas: {
    width: 600,
    height: 400,
    backgroundColor: "#ffffff",
    backgroundImage: null,
  },
  layers: [titleLayer],
  parameters: [titleParameter],
  source: null,
};

describe("batch generation helpers", () => {
  it("parses CSV headers and rows without coercing text values", async () => {
    const content = "主标题,编号\n春日上新,001\n夏日促销,002\n";
    const file = {
      name: "items.csv",
      type: "text/csv",
      size: content.length,
      text: async () => content,
    } as File;

    const parsed = await parseBatchCsv(file);

    expect(parsed.headers).toEqual(["主标题", "编号"]);
    expect(parsed.rows).toEqual([
      { sourceLine: 2, cells: { 主标题: "春日上新", 编号: "001" } },
      { sourceLine: 3, cells: { 主标题: "夏日促销", 编号: "002" } },
    ]);
  });

  it("rejects empty and duplicate CSV headers", async () => {
    const file = (content: string) =>
      ({
        name: "items.csv",
        type: "text/csv",
        size: content.length,
        text: async () => content,
      }) as File;

    await expect(parseBatchCsv(file("标题,,价格\n春日,促销,20"))).rejects.toThrow("空列名");
    await expect(parseBatchCsv(file("标题, 标题\n春日,促销"))).rejects.toThrow("重复的列名");
  });

  it("suggests mappings and applies row values to the document", () => {
    const mapping = suggestColumnMapping(template.parameters, ["主标题", "编号"]);
    const row = {
      sourceLine: 2,
      cells: { 主标题: "夏日上新", 编号: "001" },
    };

    expect(mapping["param-title"]).toBe("主标题");
    const prepared = prepareBatchRow(template, row, mapping, []);
    expect(prepared.errors).toEqual([]);
    expect(prepared.doc.layers[0]).toMatchObject({ type: "text", text: "夏日上新" });
  });

  it("renders valid rows into a ZIP and disambiguates duplicate filenames", async () => {
    const csv = {
      headers: ["主标题", "商品名"],
      rows: [
        { sourceLine: 2, cells: { 主标题: "春日上新", 商品名: "同名商品" } },
        { sourceLine: 3, cells: { 主标题: "夏日上新", 商品名: "同名商品" } },
      ],
    };
    const result = await createBatchArchive({
      template,
      csv,
      mapping: { "param-title": "主标题" },
      assets: [],
      filenameColumn: "商品名",
    });

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.archive).not.toBeNull();
    const files = unzipSync(new Uint8Array(await result.archive!.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(["同名商品-2.png", "同名商品.png"]);
    expect(new TextDecoder().decode(files["同名商品.png"])).toBe("png-data");
  });

  it("returns row failures without exposing an empty ZIP", async () => {
    const emptyTemplate: TemplateDoc = {
      ...template,
      layers: [{ ...titleLayer, text: "" }],
      parameters: [{ ...titleParameter, defaultValue: "" }],
    };
    const result = await createBatchArchive({
      template: emptyTemplate,
      csv: {
        headers: ["主标题"],
        rows: [{ sourceLine: 2, cells: { 主标题: "" } }],
      },
      mapping: { "param-title": "主标题" },
      assets: [],
    });

    expect(result.archive).toBeNull();
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.outcomes[0]?.message).toContain("不能为空");
  });
});
