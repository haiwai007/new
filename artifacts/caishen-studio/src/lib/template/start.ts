import { renderThumbnail } from "@/lib/canvas/render.ts";
import { importWorkFile } from "@/lib/storage/template-package";
import { blobToBase64 } from "@/lib/storage/encoding";
import { buildPackage, mapImageSources, type PackagedAsset } from "./package";
import { createWork, saveWork } from "@/lib/storage/works.ts";
import { findBuiltin } from "@/lib/template/builtin.ts";
import type { TemplateDoc } from "@/types/template.ts";

async function safeThumb(doc: TemplateDoc): Promise<string | null> {
  try {
    return (await renderThumbnail(doc)) || null;
  } catch {
    return null;
  }
}

/** Create a new editable project from a built-in template. Returns the work id. */
export async function startFromBuiltin(builtinId: string): Promise<string> {
  const t = findBuiltin(builtinId);
  if (!t) throw new Error("模板不存在");
  // Materialize bundled photos so a created work is portable and does not depend on URLs.
  const sources = new Set<string>();
  mapImageSources(t.doc, (source) => {
    if (source.kind === "url") sources.add(source.url);
    return source;
  });
  const assets: PackagedAsset[] = [];
  const replacements = new Map<string, string>();
  for (const url of sources) {
    if (!url.startsWith("/templates/unsplash/"))
      throw new Error("内置模板包含未支持的图片地址");
    const response = await fetch(url);
    if (!response.ok)
      throw new Error("内置模板图片加载失败，请检查站点资源部署后重试");
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const id = `builtin_image_${assets.length}`;
    assets.push({
      id,
      name: `${t.name} · 图片`,
      mime: blob.type || "image/jpeg",
      width: bitmap.width,
      height: bitmap.height,
      data: await blobToBase64(blob),
    });
    bitmap.close();
    replacements.set(url, id);
  }
  const doc = mapImageSources(t.doc, (source) =>
    source.kind === "url" && replacements.has(source.url)
      ? { kind: "asset", assetId: replacements.get(source.url)! }
      : source,
  );
  const imported = await importWorkFile(
    new File([JSON.stringify(buildPackage(doc, assets))], "builtin.json"),
    {
      kind: "project",
      name: t.name,
      strict: true,
      origin: t.id,
      reason: "create",
    },
  );
  const work = imported.work;
  // A preview is optional; the document and its images have already committed atomically.
  const thumbnail = await safeThumb(work.doc);
  if (thumbnail) {
    try {
      await saveWork(work.id, work.doc, { snapshot: false, thumbnail });
    } catch {}
  }

  return work.id;
}

/** Create a project from a document (e.g. a custom template). Templates are copied, not linked. */
export async function startFromDoc(
  doc: TemplateDoc,
  name: string,
  origin: string | null,
): Promise<string> {
  const work = await createWork({
    kind: "project",
    name,
    doc: structuredClone(doc),
    thumbnail: await safeThumb(doc),
    origin,
  });
  return work.id;
}

export { safeThumb };
