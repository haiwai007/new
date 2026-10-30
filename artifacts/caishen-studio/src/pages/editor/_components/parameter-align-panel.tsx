import { useState } from "react";
import { Button } from "@/components/ui/button";
import { edit, useEditor } from "@/stores/editor";
import {
  alignParameterRegions,
  selectedParameterLayers,
  type ParameterAlignAction,
} from "@/lib/parameters/align";

const actions: [ParameterAlignAction, string][] = [
  ["left", "左对齐"],
  ["hcenter", "水平居中"],
  ["right", "右对齐"],
  ["top", "顶对齐"],
  ["vcenter", "垂直居中"],
  ["bottom", "底对齐"],
  ["width", "等宽"],
  ["height", "等高"],
  ["distribute-x", "水平等间距"],
  ["distribute-y", "垂直等间距"],
];
export default function ParameterAlignPanel() {
  const doc = useEditor((s) => s.doc),
    ids = useEditor((s) => s.selectedIds);
  const [reference, setReference] = useState("");
  if (!doc) return null;
  const layers = selectedParameterLayers(doc, ids);
  const referenceId = layers.some((l) => l.id === reference) ? reference : "";
  return (
    <section className="space-y-3 border-b p-3" aria-label="参数框对齐">
      <h3 className="text-sm font-semibold">
        参数框一键对齐 · 已选 {layers.length} 个
      </h3>
      <p className="text-xs text-muted-foreground">
        勾选列表中的参数，或按住 Shift 点击画布多选。隐藏、锁定的框不参与。
      </p>
      <label className="block space-y-1 text-xs">
        对齐基准
        <select
          aria-label="参数框对齐基准"
          className="block w-full rounded border bg-background p-2"
          value={referenceId}
          onChange={(e) => setReference(e.target.value)}
        >
          <option value="">所选区域边界</option>
          {layers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}（固定此框）
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-1">
        {actions.map(([action, label]) => (
          <Button
            key={action}
            size="sm"
            variant="outline"
            disabled={layers.length < (action.startsWith("distribute") ? 3 : 2)}
            onClick={() =>
              edit((d) =>
                alignParameterRegions(d, ids, action, referenceId || undefined),
              )
            }
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        等宽等高采用基准框尺寸，未指定时采用首选框。等间距保持两端位置，空间不足时不移动。每次操作均可撤销。
      </p>
    </section>
  );
}
