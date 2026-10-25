import { useState } from "react";
import { Eye, EyeOff, GripVertical, Lock, Unlock, Image as ImageIcon, Type, Square, Circle, Triangle, Minus, Link2 } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { edit, useEditor } from "@/stores/editor.ts";
import { moveLayerTo, updateLayer } from "@/lib/template/doc-ops.ts";
import type { Layer } from "@/types/template.ts";
import { cn } from "@/lib/utils.ts";

const ICON: Record<Layer["type"], typeof Type> = {
  text: Type,
  image: ImageIcon,
  rect: Square,
  ellipse: Circle,
  triangle: Triangle,
  line: Minus,
};

export default function LayersPanel() {
  const doc = useEditor((s) => s.doc);
  const selectedIds = useEditor((s) => s.selectedIds);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  if (!doc) return null;
  // Show top-most layer first.
  const list = [...doc.layers].reverse();
  const bound = new Set(doc.parameters.map((p) => p.layerId));

  if (list.length === 0) {
    return (
      <Empty className="py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Square /></EmptyMedia>
          <EmptyTitle>画布是空的</EmptyTitle>
          <EmptyDescription>从左侧添加文字、图片或形状。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const onDrop = (displayIdx: number) => {
    if (!dragId) return;
    // Convert display index (top-first) to array index (bottom-first).
    const target = doc.layers.length - 1 - displayIdx;
    edit((d) => moveLayerTo(d, dragId, target));
    setDragId(null);
    setOverIdx(null);
  };

  return (
    <div className="space-y-0.5 p-2">
      <p className="px-2 pb-2 text-[11px] text-muted-foreground">拖动排序 · 上方图层显示在前面 · Shift 多选</p>
      {list.map((l, i) => {
        const Icon = ICON[l.type];
        const active = selectedIds.includes(l.id);
        return (
          <div
            key={l.id}
            draggable
            onDragStart={() => setDragId(l.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIdx(i);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverIdx(null);
            }}
            onDrop={() => onDrop(i)}
            onClick={(e) => {
              const s = useEditor.getState();
              if (e.shiftKey || e.metaKey || e.ctrlKey) {
                s.select(active ? s.selectedIds.filter((x) => x !== l.id) : [...s.selectedIds, l.id]);
              } else s.select([l.id]);
            }}
            className={cn(
              "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              active ? "bg-primary/10 text-primary" : "hover:bg-muted",
              overIdx === i && dragId && "ring-1 ring-primary",
              !l.visible && "opacity-50",
            )}
          >
            <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100" />
            <Icon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{l.name}</span>
            {l.groupId && <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">组</span>}
            {bound.has(l.id) && <Link2 className="size-3.5 shrink-0 text-accent-foreground dark:text-accent" aria-label="已绑定参数" />}
            <button
              type="button"
              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                edit((d) => updateLayer(d, l.id, { locked: !l.locked }));
              }}
              aria-label={l.locked ? "解锁" : "锁定"}
            >
              {l.locked ? <Lock className="size-3.5 text-primary" /> : <Unlock className="size-3.5 opacity-0 group-hover:opacity-100" />}
            </button>
            <button
              type="button"
              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                edit((d) => updateLayer(d, l.id, { visible: !l.visible }));
              }}
              aria-label={l.visible ? "隐藏" : "显示"}
            >
              {l.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
