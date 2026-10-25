import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import type { ImageFit, ImageLayer, Layer } from "@/types/template.ts";
import { Section, SliderField, NumberField } from "../fields.tsx";
import { pickFile, replaceImage } from "../../_lib/actions.ts";

type Setter = (patch: Partial<Layer>, key?: string) => void;

export default function ImageProps({ layer, set }: { layer: ImageLayer; set: Setter }) {
  const replace = async () => {
    const f = await pickFile();
    if (f) await replaceImage(layer.id, f);
  };
  return (
    <>
      <Section title="图片">
        <Button size="sm" className="w-full" onClick={replace} disabled={layer.locked}>
          <ImagePlus className="size-4" /> {layer.src ? "替换图片" : "放入图片"}
        </Button>
        <div className="space-y-1">
          <Label className="text-[11px] font-normal text-muted-foreground">填充方式</Label>
          <ToggleGroup type="single" size="sm" variant="outline" value={layer.fit} onValueChange={(v) => v && set({ fit: v as ImageFit })} className="w-full">
            <ToggleGroupItem value="cover" className="flex-1">填满</ToggleGroupItem>
            <ToggleGroupItem value="contain" className="flex-1">完整显示</ToggleGroupItem>
            <ToggleGroupItem value="stretch" className="flex-1">拉伸</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-normal">锁定宽高比</Label>
          <Switch checked={layer.lockAspect} onCheckedChange={(lockAspect) => set({ lockAspect })} />
        </div>
        <NumberField label="圆角" value={layer.radius} min={0} onChange={(radius) => set({ radius })} />
      </Section>
      {layer.fit === "cover" && (
        <Section title="裁剪">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-normal">智能焦点</Label>
            <Switch checked={layer.autoFocus} onCheckedChange={(autoFocus) => set({ autoFocus })} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {layer.autoFocus
              ? "按图片中细节最集中的位置自动取景，换图后自动重新对焦。拖动下方焦点会改为手动。"
              : "使用手动设置的焦点。"}
          </p>
          <SliderField label="裁剪缩放" value={layer.cropZoom} min={1} max={5} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(cropZoom) => set({ cropZoom }, "zoom")} />
          <SliderField label="水平焦点" value={layer.focusX} min={0} max={1} step={0.01} format={(v) => (layer.autoFocus ? "自动" : `${Math.round(v * 100)}%`)} onChange={(focusX) => set({ focusX, autoFocus: false }, "fx")} />
          <SliderField label="垂直焦点" value={layer.focusY} min={0} max={1} step={0.01} format={(v) => (layer.autoFocus ? "自动" : `${Math.round(v * 100)}%`)} onChange={(focusY) => set({ focusY, autoFocus: false }, "fy")} />
          <p className="text-[11px] text-muted-foreground">替换图片后，图片框位置和尺寸保持不变。</p>
        </Section>
      )}
    </>
  );
}
