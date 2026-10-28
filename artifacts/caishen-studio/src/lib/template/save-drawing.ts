import { safeThumb } from "./start";
import { saveWork } from "../storage/works";
import {
  exportTemplatePackage,
  importWorkFile,
} from "../storage/template-package";
import { buildPackage, mapImageSources, parseTemplateFile } from "./package";
import { blobToBase64 } from "../storage/encoding";
import type { TemplateDoc } from "../../types/template";
/** Save a separate editable snapshot with embedded local and bundled images. */
export async function saveDrawing(
  doc: TemplateDoc,
  name: string,
  origin: string,
) {
  const packed = await exportTemplatePackage(doc);
  if (packed.missing)
    throw new Error("作品存在缺失图片，请重新读取模板后再保存");
  const parsed = parseTemplateFile(JSON.parse(await packed.blob.text()));
  if (!parsed.ok) throw new Error(parsed.error);
  const assets = [...parsed.assets],
    urls = new Set<string>();
  mapImageSources(doc, (src) => {
    if (src.kind === "url" && src.url.startsWith("/templates/unsplash/"))
      urls.add(src.url);
    return src;
  });
  const replacements = new Map<string, string>();
  for (const url of urls) {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw new Error("模板配图读取失败，请重试");
    const blob = await response.blob(),
      bitmap = await createImageBitmap(blob),
      id = crypto.randomUUID();
    try {
      assets.push({
        id,
        name: `${name} · 配图`,
        mime: blob.type || "image/jpeg",
        width: bitmap.width,
        height: bitmap.height,
        data: await blobToBase64(blob),
      });
      replacements.set(url, id);
    } finally {
      bitmap.close();
    }
  }
  const snapshot = mapImageSources(structuredClone(doc), (src) =>
    src.kind === "url" && replacements.has(src.url)
      ? { kind: "asset", assetId: replacements.get(src.url)! }
      : src,
  );
  const { work } = await importWorkFile(
    new File([JSON.stringify(buildPackage(snapshot, assets))], "drawing.json", {
      type: "application/json",
    }),
    { kind: "project", name, origin, reason: "create" },
  );
  const thumbnail = await safeThumb(work.doc);
  if (thumbnail)
    await saveWork(work.id, work.doc, {
      snapshot: false,
      thumbnail,
      expectedRevision: work.revision ?? 0,
    }).catch(() => undefined);
  return work.id;
}
