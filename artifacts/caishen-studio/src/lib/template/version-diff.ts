import type { Layer, TemplateDoc } from "../../types/template.ts";
import { getParamValue } from "./params.ts";

// Human-readable summary of what changed between two versions.

export type DocDiff = {
  added: string[];
  removed: string[];
  changed: string[];
  paramsAdded: number;
  paramsRemoved: number;
  valuesChanged: string[];
  canvasChanged: boolean;
  renamed: boolean;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function diffDocs(before: TemplateDoc, after: TemplateDoc): DocDiff {
  const prev = new Map<string, Layer>(before.layers.map((l) => [l.id, l]));
  const next = new Map<string, Layer>(after.layers.map((l) => [l.id, l]));
  const added = after.layers.filter((l) => !prev.has(l.id)).map((l) => l.name);
  const removed = before.layers.filter((l) => !next.has(l.id)).map((l) => l.name);
  const changed = after.layers.filter((l) => prev.has(l.id) && !same(prev.get(l.id), l)).map((l) => l.name);
  const prevParams = new Set(before.parameters.map((p) => p.id));
  const nextParams = new Set(after.parameters.map((p) => p.id));
  const valuesChanged = after.parameters
    .filter((p) => prevParams.has(p.id) && !same(getParamValue(before, p), getParamValue(after, p)))
    .map((p) => p.name);
  return {
    added,
    removed,
    changed,
    paramsAdded: after.parameters.filter((p) => !prevParams.has(p.id)).length,
    paramsRemoved: before.parameters.filter((p) => !nextParams.has(p.id)).length,
    valuesChanged,
    canvasChanged: !same(before.canvas, after.canvas),
    renamed: before.name !== after.name,
  };
}

const list = (names: string[], max = 3) =>
  names.length <= max ? names.join("、") : `${names.slice(0, max).join("、")} 等 ${names.length} 个`;

/** Short lines describing the diff; empty when nothing changed. */
export function describeDiff(d: DocDiff): string[] {
  const out: string[] = [];
  if (d.renamed) out.push("修改了名称");
  if (d.canvasChanged) out.push("修改了画布尺寸或背景");
  if (d.added.length) out.push(`新增图层：${list(d.added)}`);
  if (d.removed.length) out.push(`删除图层：${list(d.removed)}`);
  if (d.valuesChanged.length) out.push(`修改参数值：${list(d.valuesChanged)}`);
  // Parameter value edits also change their layer; don't double-report those.
  const extra = d.changed.length - d.valuesChanged.length;
  if (extra > 0) out.push(`调整了 ${extra} 个图层的属性`);
  if (d.paramsAdded) out.push(`新增 ${d.paramsAdded} 个参数`);
  if (d.paramsRemoved) out.push(`删除 ${d.paramsRemoved} 个参数`);
  return out;
}
