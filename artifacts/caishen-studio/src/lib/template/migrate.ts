import { SCHEMA_VERSION, type TemplateDoc } from "@/types/template.ts";
import { templateDocSchema } from "./schema.ts";

export type LoadResult =
  | { ok: true; doc: TemplateDoc; warnings: string[] }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Upgrade legacy (version 0 / missing version) documents to the current shape. */
function upgrade(raw: Record<string, unknown>): Record<string, unknown> {
  const version = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
  if (version === 0) {
    return {
      ...raw,
      schemaVersion: SCHEMA_VERSION,
      templateId:
        typeof raw.templateId === "string" ? raw.templateId : `template_${Date.now()}`,
      parameters: Array.isArray(raw.parameters) ? raw.parameters : [],
    };
  }
  return raw;
}

/**
 * Validate and migrate any template JSON. Removes parameters that point at
 * missing layers instead of failing, and reports them as warnings.
 */
export function loadTemplateDoc(raw: unknown): LoadResult {
  if (!isRecord(raw)) return { ok: false, error: "模板数据格式错误：不是有效的对象" };
  const version = raw.schemaVersion;
  if (typeof version === "number" && version > SCHEMA_VERSION) {
    return { ok: false, error: `模板版本 ${version} 高于当前支持的版本 ${SCHEMA_VERSION}` };
  }
  const parsed = templateDocSchema.safeParse(upgrade(raw));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first ? first.path.join(".") : "";
    return {
      ok: false,
      error: `模板数据校验失败${path ? `（${path}）` : ""}：${first?.message ?? "未知错误"}`,
    };
  }
  const doc = parsed.data;
  const warnings: string[] = [];

  const ids = new Set<string>();
  for (const l of doc.layers) {
    if (ids.has(l.id)) return { ok: false, error: `图层 ID 重复：${l.id}` };
    ids.add(l.id);
  }
  const params = doc.parameters.filter((p) => {
    if (ids.has(p.layerId)) return true;
    warnings.push(`参数「${p.name}」关联的图层不存在，已移除`);
    return false;
  });
  return { ok: true, doc: { ...doc, parameters: params }, warnings };
}
