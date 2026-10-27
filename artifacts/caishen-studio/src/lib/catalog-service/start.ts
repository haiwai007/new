import {
  importWorkFile,
  importTemplateFile,
} from "../storage/template-package";
import { startFromBuiltin, safeThumb } from "../template/start";
import { saveWork } from "../storage/works";
import type { SharedGalleryTemplate } from "./provider";
import { CMS_MAX_PACKAGE_BYTES, type ManagedTemplate } from "./contracts";
async function download(shared: ManagedTemplate) {
  const url = new URL(shared.packageUrl, location.origin);
  if (
    url.origin !== location.origin ||
    !url.pathname.startsWith("/api/public/templates/")
  )
    throw new Error("共享模板文件地址无效");
  const response = await fetch(url, {
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("共享模板已下架或读取失败，请刷新模板库");
  if (
    Number(response.headers.get("content-length") ?? 0) > CMS_MAX_PACKAGE_BYTES
  )
    throw new Error("共享模板文件过大");
  const blob = await response.blob();
  if (blob.size > CMS_MAX_PACKAGE_BYTES) throw new Error("共享模板文件过大");
  return new File([blob], "shared-template.json", { type: "application/json" });
}
export async function startGalleryTemplate(
  id: string,
  templates: SharedGalleryTemplate[],
) {
  const t = templates.find((t) => t.id === id);
  if (!t) {
    if (id.startsWith("blank_")) return startFromBuiltin(id);
    throw new Error("模板不存在或已下架");
  }
  if (!t.shared) return startFromBuiltin(id);
  const { work } = await importWorkFile(await download(t.shared), {
    kind: "project",
    name: t.name,
    strict: true,
    origin: `shared:${t.id}`,
    reason: "create",
  });
  const thumbnail = await safeThumb(work.doc);
  if (thumbnail)
    await saveWork(work.id, work.doc, {
      snapshot: false,
      thumbnail,
      expectedRevision: work.revision ?? 0,
    }).catch(() => undefined);
  return work.id;
}
export async function sharedTemplateDocument(t: ManagedTemplate) {
  return (await importTemplateFile(await download(t), "library")).doc;
}
