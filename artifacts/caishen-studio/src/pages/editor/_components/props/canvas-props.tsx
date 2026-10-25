import { useState } from "react";
import { History, ImagePlus, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import { edit, useEditor } from "@/stores/editor.ts";
import { RESIZE_MODE_LABEL, resizeDoc, type ResizeMode } from "@/lib/template/smart-resize.ts";
import type { TemplateDoc } from "@/types/template.ts";
import { ColorField, NumberField, Section } from "../fields.tsx";
import { pickFile, setBackgroundImage } from "../../_lib/actions.ts";

const PRESETS = [
  { label: "方形", w: 1080, h: 1080 },
  { label: "竖版 4:5", w: 1080, h: 1350 },
  { label: "手机全屏", w: 1080, h: 1920 },
  { label: "横版 16:9", w: 1920, h: 1080 },
  { label: "商品主图", w: 800, h: 800 },
  { label: "公众号封面", w: 900, h: 383 },
];

const MODE_HINT: Record<ResizeMode, string> = {
  smart: "铺满的元素随画布拉伸，其余元素等比缩放并贴住最近的边或保持居中。",
  scale: "所有元素按同一比例缩放，整体居中。",
  none: "只改画布大小，元素位置和尺寸不变。",
};

export default function CanvasProps({ doc }: { doc: TemplateDoc }) {
  const [w, setW] = useState(doc.canvas.width);
  const [h, setH] = useState(doc.canvas.height);
  const [mode, setMode] = useState<ResizeMode>("smart");
  const dirty = w !== doc.canvas.width || h !== doc.canvas.height;
  const apply = (W: number, H: number) => {
    setW(W);
    setH(H);
    edit((d) => resizeDoc(d, W, H, mode));
  };
  return (
    <div>
      <Section title="画布">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="宽度 px" value={w} min={16} max={8000} onChange={setW} />
          <NumberField label="高度 px" value={h} min={16} max={8000} onChange={setH} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-normal text-muted-foreground">元素如何适配新尺寸</Label>
          <ToggleGroup type="single" size="sm" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as ResizeMode)} className="w-full">
            {(Object.keys(RESIZE_MODE_LABEL) as ResizeMode[]).map((m) => (
              <ToggleGroupItem key={m} value={m} className="flex-1 text-xs">{RESIZE_MODE_LABEL[m]}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-[11px] text-muted-foreground">{MODE_HINT[mode]}关闭了「画布缩放时按比例调整」的图层保持不动。</p>
        </div>
        <Button size="sm" className="w-full" disabled={!dirty} onClick={() => apply(Math.round(w), Math.round(h))}>
          应用尺寸
        </Button>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => apply(p.w, p.h)}
              className="cursor-pointer rounded-md border px-2 py-1.5 text-left text-xs transition-colors hover:border-primary"
            >
              <span className="block font-medium">{p.label}</span>
              <span className="text-muted-foreground">{p.w}×{p.h}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="背景">
        <BackgroundControls doc={doc} />
      </Section>
      <p className="px-4 py-3 text-[11px] text-muted-foreground">未选中元素时显示画布设置。点击画布上的元素以编辑它的属性。</p>
    </div>
  );
}

/** Shared between the canvas properties and the left "背景" panel. */
export function BackgroundControls({ doc }: { doc: TemplateDoc }) {
  const setRepairOpen = useEditor((s) => s.setRepairOpen);
  const bg = doc.canvas.backgroundImage;
  const originalId = doc.source?.originalAssetId;
  const showingOriginal = bg?.kind === "asset" && bg.assetId === originalId;
  const canRestore = Boolean(originalId) && doc.source?.mode !== "manual" && !showingOriginal;
  return (
    <div className="space-y-2">
      <ColorField
        label="背景颜色"
        value={doc.canvas.backgroundColor}
        onChange={(backgroundColor) => edit((d) => ({ ...d, canvas: { ...d.canvas, backgroundColor } }))}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={async () => {
          const f = await pickFile();
          if (f) await setBackgroundImage(f);
        }}>
          <ImagePlus className="size-4" /> {bg ? "更换背景图" : "背景图片"}
        </Button>
        {bg && (
          <Button size="sm" variant="ghost" onClick={() => edit((d) => ({ ...d, canvas: { ...d.canvas, backgroundImage: null } }))}>
            <X className="size-4" /> 移除
          </Button>
        )}
      </div>
      {bg && (
        <Button size="sm" variant="secondary" className="w-full" onClick={() => setRepairOpen(true)}>
          <Wand2 className="size-4" /> 背景修复（去除旧文字）
        </Button>
      )}
      {canRestore && originalId && (
        <Button
          size="sm"
          variant="ghost"
          className="w-full"
          onClick={() => edit((d) => ({ ...d, canvas: { ...d.canvas, backgroundImage: { kind: "asset", assetId: originalId } } }))}
        >
          <History className="size-4" /> 恢复为上传的原图
        </Button>
      )}
    </div>
  );
}
