import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  Group,
  Lock,
  Trash2,
  Ungroup,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { edit, useEditor } from "@/stores/editor.ts";
import {
  alignLayers,
  groupLayers,
  reorderLayer,
  ungroupLayers,
  updateLayer,
  type AlignAction,
} from "@/lib/template/doc-ops.ts";
import { LAYER_TYPE_LABEL, isShape } from "@/lib/template/layers.ts";
import type { Layer } from "@/types/template.ts";
import { NumberField, Section, SliderField } from "./fields.tsx";
import TextProps from "./props/text-props.tsx";
import ImageProps from "./props/image-props.tsx";
import ShapeProps from "./props/shape-props.tsx";
import CanvasProps from "./props/canvas-props.tsx";

function IconBtn({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8" onClick={onClick} aria-label={label} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const ALIGN: { a: AlignAction; label: string; icon: typeof AlignStartVertical }[] = [
  { a: "left", label: "左对齐", icon: AlignStartVertical },
  { a: "hcenter", label: "水平居中", icon: AlignCenterVertical },
  { a: "right", label: "右对齐", icon: AlignEndVertical },
  { a: "top", label: "顶对齐", icon: AlignStartHorizontal },
  { a: "vcenter", label: "垂直居中", icon: AlignCenterHorizontal },
  { a: "bottom", label: "底对齐", icon: AlignEndHorizontal },
];

export function AlignBar({ ids }: { ids: string[] }) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {ALIGN.map((x) => (
        <IconBtn key={x.a} label={ids.length > 1 ? x.label : `${x.label}（相对画布）`} onClick={() => edit((d) => alignLayers(d, ids, x.a))}>
          <x.icon className="size-4" />
        </IconBtn>
      ))}
    </div>
  );
}

function MultiSelection({ layers }: { layers: Layer[] }) {
  const ids = layers.map((l) => l.id);
  const grouped = layers.some((l) => l.groupId);
  const { duplicate, deleteSelected } = useEditor.getState();
  return (
    <div>
      <Section title={`已选择 ${layers.length} 个图层`}>
        <AlignBar ids={ids} />
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" onClick={() => edit((d) => groupLayers(d, ids))}>
            <Group className="size-4" /> 组合
          </Button>
          <Button size="sm" variant="secondary" onClick={() => edit((d) => ungroupLayers(d, ids))} disabled={!grouped}>
            <Ungroup className="size-4" /> 取消组合
          </Button>
          <Button size="sm" variant="secondary" onClick={duplicate}>
            <Copy className="size-4" /> 复制
          </Button>
          <Button size="sm" variant="secondary" onClick={deleteSelected}>
            <Trash2 className="size-4" /> 删除
          </Button>
        </div>
      </Section>
    </div>
  );
}

export default function PropertiesPanel() {
  const doc = useEditor((s) => s.doc);
  const selectedIds = useEditor((s) => s.selectedIds);
  if (!doc) return null;
  const selected = doc.layers.filter((l) => selectedIds.includes(l.id));
  if (selected.length === 0) return <CanvasProps key={`${doc.canvas.width}x${doc.canvas.height}`} doc={doc} />;
  if (selected.length > 1) return <MultiSelection layers={selected} />;
  const layer = selected[0];
  const set = (patch: Partial<Layer>, key?: string) =>
    edit((d) => updateLayer(d, layer.id, patch), key ? { coalesceKey: `${layer.id}:${key}` } : undefined);
  const disabled = layer.locked;

  return (
    <div>
      <Section title={LAYER_TYPE_LABEL[layer.type]}>
        <div className="space-y-1">
          <Label className="text-[11px] font-normal text-muted-foreground">图层名称</Label>
          <Input value={layer.name} onChange={(e) => set({ name: e.target.value }, "name")} className="h-8 text-sm" />
        </div>
        <div className="flex items-center justify-between gap-1">
          <div className="flex gap-0.5">
            <IconBtn label="置于顶层" onClick={() => edit((d) => reorderLayer(d, layer.id, "front"))}><ArrowUpToLine className="size-4" /></IconBtn>
            <IconBtn label="上移一层" onClick={() => edit((d) => reorderLayer(d, layer.id, "forward"))}><ChevronUp className="size-4" /></IconBtn>
            <IconBtn label="下移一层" onClick={() => edit((d) => reorderLayer(d, layer.id, "backward"))}><ChevronDown className="size-4" /></IconBtn>
            <IconBtn label="置于底层" onClick={() => edit((d) => reorderLayer(d, layer.id, "back"))}><ArrowDownToLine className="size-4" /></IconBtn>
          </div>
          <div className="flex gap-0.5">
            <IconBtn label={layer.locked ? "解锁" : "锁定"} onClick={() => set({ locked: !layer.locked })}>
              {layer.locked ? <Lock className="size-4 text-primary" /> : <Unlock className="size-4" />}
            </IconBtn>
            <IconBtn label="复制" onClick={() => useEditor.getState().duplicate()}><Copy className="size-4" /></IconBtn>
            <IconBtn label="删除" disabled={layer.locked} onClick={() => useEditor.getState().deleteSelected()}><Trash2 className="size-4" /></IconBtn>
          </div>
        </div>
        <AlignBar ids={[layer.id]} />
      </Section>

      <Section title="位置与尺寸">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={layer.x} onChange={(x) => set({ x })} disabled={disabled} />
          <NumberField label="Y" value={layer.y} onChange={(y) => set({ y })} disabled={disabled} />
          <NumberField
            label="宽度"
            value={layer.width}
            min={1}
            disabled={disabled}
            onChange={(width) =>
              set(layer.type === "image" && layer.lockAspect ? { width, height: (layer.height * width) / layer.width } : { width })
            }
          />
          <NumberField
            label="高度"
            value={layer.height}
            min={1}
            disabled={disabled}
            onChange={(height) =>
              set(layer.type === "image" && layer.lockAspect ? { height, width: (layer.width * height) / layer.height } : { height })
            }
          />
          <NumberField label="旋转" value={layer.rotation} suffix="°" onChange={(rotation) => set({ rotation })} disabled={disabled} />
        </div>
        <SliderField
          label="透明度"
          value={layer.opacity}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(opacity) => set({ opacity }, "opacity")}
          disabled={disabled}
        />
        <div className="flex items-center justify-between">
          <Label className="text-xs font-normal">画布缩放时按比例调整</Label>
          <Switch checked={layer.layout === "relative"} onCheckedChange={(v) => set({ layout: v ? "relative" : "fixed" })} />
        </div>
      </Section>

      {layer.type === "text" && <TextProps layer={layer} set={set} />}
      {layer.type === "image" && <ImageProps layer={layer} set={set} />}
      {isShape(layer) && <ShapeProps layer={layer} set={set} />}
    </div>
  );
}
