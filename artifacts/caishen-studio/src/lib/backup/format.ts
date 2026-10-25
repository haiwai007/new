import { z } from "zod";
import { loadTemplateDoc } from "../template/migrate";
import { referencedAssetIds } from "../template/doc-ops";
import { isBase64 } from "../storage/encoding";
import type { TemplateDoc } from "../../types/template";
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
export const BACKUP_FORMAT = "caishen-workspace";
const id = z.string().min(1).max(200);
const date = z
  .string()
  .refine((s) => Number.isFinite(Date.parse(s)), "日期无效");
const image = z.string().nullable();
const workSchema = z.object({
  id,
  kind: z.enum(["project", "template"]),
  name: z.string(),
  doc: z.unknown(),
  thumbnail: image,
  favorite: z.boolean(),
  version: z.number().int().positive(),
  origin: z.string().nullable(),
  fromUpload: z.boolean(),
  createdAt: date,
  updatedAt: date,
});
const versionSchema = z.object({
  id,
  workId: id,
  version: z.number().int().positive(),
  name: z.string(),
  doc: z.unknown(),
  createdAt: date,
  note: z.string().optional(),
  thumbnail: image.optional(),
  reason: z.enum(["create", "save", "restore", "import"]).optional(),
});
const assetSchema = z.object({
  id,
  name: z.string(),
  mime: z.string().regex(/^image\//),
  width: z.number().positive(),
  height: z.number().positive(),
  size: z.number().int().nonnegative(),
  category: z.string(),
  scope: z.enum(["library", "internal"]),
  createdAt: date,
  data: z.string().refine(isBase64, "图片数据不是有效 Base64"),
});
const exportSchema = z.object({
  id,
  workId: id.nullable(),
  workName: z.string(),
  fileName: z.string(),
  format: z.enum(["png", "jpeg"]),
  width: z.number().positive(),
  height: z.number().positive(),
  createdAt: date,
});
const archiveSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.literal(1),
  createdAt: date,
  works: z.array(workSchema).max(2000),
  versions: z.array(versionSchema).max(60000),
  assets: z.array(assetSchema).max(5000),
  exports: z.array(exportSchema).max(20000),
  favoriteTemplates: z.array(z.string()).max(2000).default([]),
});
export type WorkspaceBackup = Omit<
  z.infer<typeof archiveSchema>,
  "works" | "versions"
> & {
  works: (Omit<z.infer<typeof workSchema>, "doc"> & { doc: TemplateDoc })[];
  versions: (Omit<z.infer<typeof versionSchema>, "doc"> & {
    doc: TemplateDoc;
  })[];
};
function assertUnique(records: { id: string }[], label: string) {
  if (new Set(records.map((r) => r.id)).size !== records.length)
    throw new Error(`${label}含有重复标识，无法恢复`);
}
function checkedDoc(raw: unknown, label: string): TemplateDoc {
  const result = loadTemplateDoc(raw);
  if (!result.ok) throw new Error(`${label}：${result.error}`);
  if (result.warnings.length)
    throw new Error(`${label}含有不完整的文档数据，请使用原版本重新导出`);
  return result.doc;
}
/** Validate all references before allowing a preview or any writes. */
export function parseWorkspaceBackup(raw: unknown): WorkspaceBackup {
  const parsed = archiveSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      `备份文件格式无效：${parsed.error.issues[0]?.message ?? "不支持的格式"}`,
    );
  const value = parsed.data;
  for (const [rows, label] of [
    [value.works, "作品"],
    [value.versions, "历史版本"],
    [value.assets, "素材"],
    [value.exports, "导出记录"],
  ] as const)
    assertUnique(rows, label);
  const workIds = new Set(value.works.map((w) => w.id));
  const assetIds = new Set(value.assets.map((a) => a.id));
  const works = value.works.map((w) => ({
    ...w,
    doc: checkedDoc(w.doc, w.name),
  }));
  const workById = new Map(works.map((w) => [w.id, w]));
  const versions = value.versions.map((v) => {
    if (!workIds.has(v.workId)) throw new Error("历史版本引用了不存在的作品");
    const parent = workById.get(v.workId)!;
    if (v.version > parent.version) throw new Error("历史版本号高于作品版本号");
    return { ...v, doc: checkedDoc(v.doc, v.name) };
  });
  for (const row of [...works, ...versions]) {
    for (const assetId of referencedAssetIds(row.doc))
      if (!assetIds.has(assetId))
        throw new Error(`「${row.name}」缺少引用的图片，无法完整恢复`);
  }
  for (const a of value.assets) {
    const size =
      (a.data.length / 4) * 3 -
      (a.data.endsWith("==") ? 2 : a.data.endsWith("=") ? 1 : 0);
    if (size !== a.size)
      throw new Error(`图片「${a.name}」大小与备份记录不一致`);
  }
  return { ...value, works, versions };
}
export function backupSummary(backup: WorkspaceBackup) {
  return {
    works: backup.works.length,
    versions: backup.versions.length,
    assets: backup.assets.length,
    exports: backup.exports.length,
  };
}
