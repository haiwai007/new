import ParameterAlignPanel from "./parameter-align-panel";
import {defaultCardRule,cardSummary} from "@/lib/parameters/card";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { edit, useEditor } from "@/stores/editor";
import {
  PARAM_TYPE_LABEL,
  moveParameter,
  suggestParameters,
} from "@/lib/template/params";
import {
  duplicateParameter,
  parameterLayerIds,
  removeParameterBinding,
} from "@/lib/parameters/document";
import { defaultOrderRule, orderSummary } from "@/lib/parameters/order";
import ParamEditorDialog from "./param-editor-dialog";
export default function ParameterManager() {
  const doc = useEditor((s) => s.doc),
    selected = useEditor((s) => s.selectedIds),
    active = useEditor((s) => s.activeParamId);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [drag, setDrag] = useState<string | null>(null);
  if (!doc) return null;
  const pick = (id: string) => {
    const p = doc.parameters.find((p) => p.id === id);
    if (!p) return;
    const state = useEditor.getState();
    state.setActiveParam(id);
    state.select([p.layerId]);
    state.setRightTab("props");
    window.dispatchEvent(new CustomEvent("haishen:parameter-settings"));
    window.dispatchEvent(
      new CustomEvent("haishen:focus-layer", {
        detail: { id: p.layerId, zoom: false },
      }),
    );
  };
  const items = doc.parameters.filter(
    (p) =>
      (!query || p.name.toLowerCase().includes(query.toLowerCase())) &&
      (filter === "all" || p.type === filter),
  );
  return (
    <div className="space-y-3 p-3" aria-label="模板参数管理">
      <Button
        size="sm"
        className="w-full"
        onClick={() => {
          useEditor.getState().setTool("draw-parameter");
          useEditor.getState().setParameterBox(null);
        }}
      >
        新增参数 · 框选区域
      </Button>
      <ParameterAlignPanel />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { useEditor.getState().setTool("select"); useEditor.getState().select(items.flatMap(p => parameterLayerIds(p)).filter(id => doc.layers.some(l => l.id === id && !l.locked && l.visible))); }}>全选当前列表</Button>
        <Button size="sm" variant="ghost" onClick={() => useEditor.getState().select([])}>取消选择</Button>
      </div>
      <Input
        aria-label="搜索模板参数"
        placeholder="搜索参数名称"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-1">
        {[
          { value: "all", label: "全部" },
          { value: "order", label: "订单号" },
          {value:"card",label:"卡号"},
          { value: "image", label: "图片" },
          { value: "text", label: "文字" },
          { value: "number", label: "数字" },
        ].map((x) => (
          <Button
            key={x.value}
            size="sm"
            variant={filter === x.value ? "secondary" : "ghost"}
            onClick={() => setFilter(x.value)}
          >
            {x.label}
          </Button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        共 {doc.parameters.length}{" "}
        个；点击选中，拖动排序。表单顺序与图层前后独立。
      </p>
      <div className="space-y-2" role="list" aria-label="模板参数列表">
        {items.map((p) => {
          const layer = doc.layers.find((l) => l.id === p.layerId),
            on =
              active === p.id ||
              parameterLayerIds(p).some((id) => selected.includes(id));
          return (
            <div
              key={p.id}
              role="listitem"
              draggable
              onDragStart={() => setDrag(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!drag || drag === p.id) return;
                edit((d) => {
                  const parameters = d.parameters.filter((q) => q.id !== drag);
                  const index = parameters.findIndex((q) => q.id === p.id);
                  const source = d.parameters.find((q) => q.id === drag);
                  if (source) parameters.splice(index, 0, source);
                  return { ...d, parameters };
                });
                setDrag(null);
              }}
              className={`space-y-2 rounded-lg border p-2 ${on ? "border-primary bg-primary/5" : ""}`}
            >
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" aria-label={`多选参数${p.name}`} checked={parameterLayerIds(p).every(id => selected.includes(id))} disabled={!layer?.visible || layer.locked} onChange={e => {
                  const state = useEditor.getState(); const ids = parameterLayerIds(p);
                  state.setTool("select");
                  state.select(e.target.checked ? [...new Set([...selected, ...ids])] : selected.filter(id => !ids.includes(id)));
                }} />加入对齐选择
              </label>
              <button
                className="w-full cursor-pointer text-left"
                onClick={() => pick(p.id)}
                aria-label={`选择参数${p.name}`}
              >
                <strong className="block truncate text-sm">{p.name}</strong>
                <span className="block text-[11px] text-muted-foreground">
                  {p.type === "card"?cardSummary(p.card??defaultCardRule()):p.type === "order"
                    ? orderSummary(p.order ?? defaultOrderRule())
                    : p.type === "image"
                      ? `${p.imageRole === "avatar" ? "头像" : p.imageRole === "logo" ? "Logo" : "图片"} · ${layer?.type === "image" && layer.fit === "contain" ? "完整显示" : "铺满裁剪"}`
                      : PARAM_TYPE_LABEL[p.type]}
                  {p.linkedLayerIds?.length
                    ? ` · ${p.linkedLayerIds.length + 1} 个位置`
                    : ""}
                </span>
              </button>
              <div className="flex flex-wrap gap-1">
                {[
                  {
                    label: layer?.visible ? "隐藏" : "显示",
                    run: () =>
                      edit((d) => ({
                        ...d,
                        layers: d.layers.map((l) =>
                          parameterLayerIds(p).includes(l.id)
                            ? { ...l, visible: !layer?.visible }
                            : l,
                        ),
                      })),
                  },
                  {
                    label: layer?.locked ? "解锁" : "锁定",
                    run: () =>
                      edit((d) => ({
                        ...d,
                        layers: d.layers.map((l) =>
                          parameterLayerIds(p).includes(l.id)
                            ? { ...l, locked: !layer?.locked }
                            : l,
                        ),
                      })),
                  },
                  {
                    label: "上移",
                    run: () => edit((d) => moveParameter(d, p.id, -1)),
                  },
                  {
                    label: "下移",
                    run: () => edit((d) => moveParameter(d, p.id, 1)),
                  },
                ].map((x) => (
                  <button
                    className="min-h-8 rounded px-1.5 text-[11px] hover:bg-muted"
                    key={x.label}
                    aria-label={`${x.label}参数${p.name}`}
                    onClick={x.run}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
              <details>
                <summary className="cursor-pointer text-[11px] text-muted-foreground">
                  复制与更多
                </summary>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => edit((d) => duplicateParameter(d, p.id))}
                  >
                    创建独立参数副本
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      edit((d) => duplicateParameter(d, p.id, true))
                    }
                  >
                    新增同参数显示位置
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => edit((d) => removeParameterBinding(d, p.id))}
                  >
                    删除参数绑定
                  </Button>
                </div>
              </details>
            </div>
          );
        })}
      </div>
      {!items.length && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {doc.parameters.length
            ? "没有匹配的参数"
            : "先框选一个区域，再选择参数类型。"}
        </p>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          edit((d) => ({
            ...d,
            parameters: [...d.parameters, ...suggestParameters(d)],
          }))
        }
      >
        自动生成／补充参数
      </Button>
      {selected[0] && doc.layers.find((l) => l.id === selected[0]) && (
        <ParamEditorDialog
          layer={doc.layers.find((l) => l.id === selected[0])!}
        >
          <Button size="sm" variant="outline">
            将选中图层设为参数
          </Button>
        </ParamEditorDialog>
      )}
    </div>
  );
}
