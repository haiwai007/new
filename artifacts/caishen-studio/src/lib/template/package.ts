import { z } from "zod";
import { isBase64 } from "../storage/encoding";
import type { ImageSource, Layer, TemplateDoc } from "@/types/template.ts";
import { loadTemplateDoc } from "./migrate.ts";
import { referencedAssetIds } from "./doc-ops.ts";

// Self-contained template file: the template JSON plus every local image it
// references, embedded as base64. Plain template JSON (no assets) is also
// accepted on import for backwards compatibility.

export const PACKAGE_FORMAT = "caishen-template";
export const PACKAGE_VERSION = 1;
/** Above this the browser may struggle to build/parse the file. */
export const MAX_PACKAGE_BYTES = 80 * 1024 * 1024;

export type PackagedAsset = {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  data: string;
};

export type TemplatePackage = {
  format: typeof PACKAGE_FORMAT;
  formatVersion: typeof PACKAGE_VERSION;
  exportedAt: string;
  doc: TemplateDoc;
  assets: PackagedAsset[];
};

const assetSchema = z.object({
  id: z.string().min(1),
  name: z.string().default("图片"),
  mime: z.string().regex(/^image\//, "素材不是图片"),
  width: z.number().positive(),
  height: z.number().positive(),
  data: z.string().refine(isBase64, "图片编码无效"),
});

const packageSchema = z.object({
  format: z.literal(PACKAGE_FORMAT),
  formatVersion: z.number().int().positive(),
  exportedAt: z.string().default(""),
  doc: z.unknown(),
  assets: z.array(assetSchema).default([]),
});

export type ParsedPackage =
  | { ok: true; doc: TemplateDoc; assets: PackagedAsset[]; warnings: string[] }
  | { ok: false; error: string };

/** Parse a template file: either a package or a bare template document. */
export function parseTemplateFile(raw: unknown): ParsedPackage {
  const isPackage = typeof raw === "object" && raw !== null && "format" in raw;
  if (!isPackage) {
    const res = loadTemplateDoc(raw);
    if (!res.ok) return res;
    const missing = referencedAssetIds(res.doc);
    const warnings = [...res.warnings];
    if (missing.length)
      warnings.push(
        `文件不含图片数据，${missing.length} 张本地图片可能显示为占位框`,
      );
    return { ok: true, doc: res.doc, assets: [], warnings };
  }
  const pkg = packageSchema.safeParse(raw);
  if (!pkg.success) {
    const first = pkg.error.issues[0];
    return {
      ok: false,
      error: `模板文件格式错误${first ? `（${first.path.join(".")}）：${first.message}` : ""}`,
    };
  }
  if (pkg.data.formatVersion > PACKAGE_VERSION) {
    return {
      ok: false,
      error: `模板文件版本 ${pkg.data.formatVersion} 高于当前支持的版本 ${PACKAGE_VERSION}`,
    };
  }
  const res = loadTemplateDoc(pkg.data.doc);
  if (!res.ok) return res;
  const have = new Set(pkg.data.assets.map((a) => a.id));
  if (have.size !== pkg.data.assets.length)
    return { ok: false, error: "模板文件含有重复的图片标识" };
  const missing = referencedAssetIds(res.doc).filter((id) => !have.has(id));
  const warnings = [...res.warnings];
  if (missing.length)
    warnings.push(`${missing.length} 张图片未包含在文件中，会显示为占位框`);
  return { ok: true, doc: res.doc, assets: pkg.data.assets, warnings };
}

/** Replace asset ids everywhere in a document. Ids without a mapping are kept. */
export function remapAssetIds(
  doc: TemplateDoc,
  map: Map<string, string>,
): TemplateDoc {
  const src = <T extends ImageSource | null>(s: T): T =>
    s && s.kind === "asset" && map.has(s.assetId)
      ? ({ ...s, assetId: map.get(s.assetId)! } as T)
      : s;
  return {
    ...doc,
    canvas: { ...doc.canvas, backgroundImage: src(doc.canvas.backgroundImage) },
    source: doc.source
      ? {
          ...doc.source,
          originalAssetId:
            map.get(doc.source.originalAssetId) ?? doc.source.originalAssetId,
        }
      : null,
    layers: doc.layers.map((l): Layer =>
      l.type === "image" ? { ...l, src: src(l.src) } : l,
    ),
    parameters: doc.parameters.map((p) => {
      const v = p.defaultValue;
      return v && typeof v === "object" && v.kind === "asset"
        ? { ...p, defaultValue: src(v) }
        : p;
    }),
  };
}

export function buildPackage(
  doc: TemplateDoc,
  assets: PackagedAsset[],
  now = new Date(),
): TemplatePackage {
  return {
    format: PACKAGE_FORMAT,
    formatVersion: PACKAGE_VERSION,
    exportedAt: now.toISOString(),
    doc,
    assets,
  };
}

/** Map every user-visible image source (layers, background and parameter defaults). */
export function mapImageSources(
  doc: TemplateDoc,
  replace: (src: ImageSource) => ImageSource,
): TemplateDoc {
  return {
    ...doc,
    canvas: {
      ...doc.canvas,
      backgroundImage: doc.canvas.backgroundImage
        ? replace(doc.canvas.backgroundImage)
        : null,
    },
    layers: doc.layers.map((layer): Layer =>
      layer.type === "image"
        ? { ...layer, src: layer.src ? replace(layer.src) : null }
        : layer,
    ),
    parameters: doc.parameters.map((parameter) => {
      const value = parameter.defaultValue;
      return value &&
        typeof value === "object" &&
        (value.kind === "url" || value.kind === "asset")
        ? { ...parameter, defaultValue: replace(value) }
        : parameter;
    }),
  };
}
