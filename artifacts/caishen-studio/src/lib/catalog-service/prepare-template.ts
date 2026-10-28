import { CMS_MAX_PACKAGE_BYTES } from "./contracts";
import { parseTemplateFile, mapImageSources } from "../template/package";
import { renderDoc } from "../canvas/render";
export async function prepareSharedTemplate(file: File) {
  if (file.size > CMS_MAX_PACKAGE_BYTES)
    throw new Error("模板文件不能超过 20MB");
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error("请选择编辑器导出的完整 JSON 模板文件");
  }
  const parsed = parseTemplateFile(raw);
  if (!parsed.ok) throw new Error(parsed.error);
  if (
    parsed.doc.canvas.width > 16000 ||
    parsed.doc.canvas.height > 16000 ||
    parsed.doc.canvas.width * parsed.doc.canvas.height > 40000000
  )
    throw new Error("模板画布尺寸过大，最多 4000 万像素且边长不超过 16000");
  if (
    parsed.assets.length > 200 ||
    parsed.assets.some(
      (a) =>
        !["image/png", "image/jpeg", "image/webp"].includes(a.mime) ||
        a.width > 16000 ||
        a.height > 16000 ||
        a.width * a.height > 40000000,
    )
  )
    throw new Error(
      "模板图片仅支持 PNG、JPEG、WebP，最多 200 张，每张不超过 4000 万像素",
    );
  const images = new Map(
    parsed.assets.map((a) => [a.id, `data:${a.mime};base64,${a.data}`]),
  );
  const doc = mapImageSources(parsed.doc, (src) => {
    if (src.kind === "url" || !images.has(src.assetId))
      throw new Error("请导出包含全部图片的完整模板文件");
    return { kind: "url", url: images.get(src.assetId)! };
  });
  const { canvas } = await renderDoc(doc, {
    multiplier: Math.min(
      1,
      480 / Math.max(doc.canvas.width, doc.canvas.height),
    ),
  });
  try {
    return { doc: parsed.doc, preview: canvas.toDataURL("image/png") };
  } finally {
    canvas.width = canvas.height = 0;
  }
}
