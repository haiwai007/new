import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/stores/editor";
import {
  createRegionParameter,
  type RegionKind,
} from "@/lib/parameters/document";
export default function ParameterRegionToolbar() {
  const box = useEditor((s) => s.parameterBox),
    doc = useEditor((s) => s.doc),
    continuous = useEditor((s) => s.continuousDraw);
  const [binding, setBinding] = useState("");
  if (!box || !doc) return null;
  const finish = (kind: RegionKind, bindingId?: string) => {
    const state = useEditor.getState();
    if (!state.doc) return;
    const created = createRegionParameter(state.doc, box, kind, bindingId);
    state.commit(created.doc);
    state.select([created.layerId]);
    state.setActiveParam(created.paramId);
    state.setRightTab("props");
    state.setLeftPanel("params");
    state.setParameterBox(null);
    if (continuous) state.setTool("draw-parameter");
    else window.dispatchEvent(new CustomEvent("haishen:parameter-settings"));
  };
  return (
    <div
      className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-lg border bg-background p-2 shadow-xl"
      aria-label="框选参数工具条"
    >
      <span className="w-full text-xs text-muted-foreground">
        区域 {Math.round(box.width)} × {Math.round(box.height)} px ·
        选择参数类型
      </span>
      {(
        [
          { kind: "text", label: "文字" },
          { kind: "number", label: "数字／金额" },
          { kind: "order", label: "订单号" },
          {kind:"card",label:"卡号"},
          { kind: "avatar", label: "头像" },
          { kind: "logo", label: "Logo" },
          { kind: "image", label: "普通图片" },
        ] as const
      ).map((x) => (
        <Button
          key={x.kind}
          size="sm"
          variant="secondary"
          onClick={() => finish(x.kind)}
        >
          {x.label}
        </Button>
      ))}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          useEditor.getState().setParameterBox(null);
          useEditor.getState().setTool("draw-parameter");
        }}
      >
        重画
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          useEditor.getState().setParameterBox(null);
          useEditor.getState().setTool("select");
        }}
      >
        取消
      </Button>
      {doc.parameters.length > 0 && (
        <div className="flex w-full gap-1">
          <select
            aria-label="绑定已有参数"
            className="min-w-0 flex-1 rounded border bg-background px-1 text-xs"
            value={binding}
            onChange={(e) => setBinding(e.target.value)}
          >
            <option value="">选择已有参数，同步显示同一个值</option>
            {doc.parameters
              .filter((p) => p.property === "text" || p.property === "src")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!binding}
            onClick={() => finish("text", binding)}
          >
            绑定到此区域
          </Button>
        </div>
      )}
    </div>
  );
}
