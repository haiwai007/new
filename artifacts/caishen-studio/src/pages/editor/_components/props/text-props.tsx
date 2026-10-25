import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic } from "lucide-react";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import { Toggle } from "@/components/ui/toggle.tsx";
import { FONTS } from "@/lib/canvas/fonts.ts";
import type { Layer, TextLayer, TextAlign, VerticalAlign } from "@/types/template.ts";
import { ColorField, NumberField, Section, SliderField } from "../fields.tsx";

type Setter = (patch: Partial<Layer>, key?: string) => void;

export default function TextProps({ layer, set }: { layer: TextLayer; set: Setter }) {
  const fontList = FONTS.some((f) => f.family === layer.fontFamily)
    ? FONTS
    : [{ family: layer.fontFamily, label: layer.fontFamily }, ...FONTS];
  return (
    <>
      <Section title="文字内容">
        <Textarea
          value={layer.text}
          onChange={(e) => set({ text: e.target.value }, "text")}
          rows={3}
          className="text-sm"
          disabled={!layer.editable}
        />
        {!layer.editable && <p className="text-[11px] text-muted-foreground">此图层被设为不可编辑</p>}
      </Section>
      <Section title="字体">
        <Select value={layer.fontFamily} onValueChange={(fontFamily) => set({ fontFamily })}>
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontList.map((f) => (
              <SelectItem key={f.family} value={f.family}>
                <span style={{ fontFamily: f.family }}>{f.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="字号" value={layer.fontSize} min={1} max={2000} onChange={(fontSize) => set({ fontSize })} />
          <ColorField label="颜色" value={layer.fill} onChange={(fill) => set({ fill })} />
        </div>
        <div className="flex items-center gap-1">
          <Toggle size="sm" pressed={layer.fontWeight === "bold"} onPressedChange={(p) => set({ fontWeight: p ? "bold" : "normal" })} aria-label="加粗">
            <Bold className="size-4" />
          </Toggle>
          <Toggle size="sm" pressed={layer.fontStyle === "italic"} onPressedChange={(p) => set({ fontStyle: p ? "italic" : "normal" })} aria-label="斜体">
            <Italic className="size-4" />
          </Toggle>
          <ToggleGroup
            type="single"
            size="sm"
            value={layer.textAlign}
            onValueChange={(v) => v && set({ textAlign: v as TextAlign })}
            className="ml-auto"
          >
            <ToggleGroupItem value="left" aria-label="左对齐"><AlignLeft className="size-4" /></ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="居中"><AlignCenter className="size-4" /></ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="右对齐"><AlignRight className="size-4" /></ToggleGroupItem>
            <ToggleGroupItem value="justify" aria-label="两端对齐"><AlignJustify className="size-4" /></ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-normal text-muted-foreground">垂直对齐</Label>
          <ToggleGroup type="single" size="sm" variant="outline" value={layer.verticalAlign} onValueChange={(v) => v && set({ verticalAlign: v as VerticalAlign })} className="w-full">
            <ToggleGroupItem value="top" className="flex-1">顶部</ToggleGroupItem>
            <ToggleGroupItem value="middle" className="flex-1">居中</ToggleGroupItem>
            <ToggleGroupItem value="bottom" className="flex-1">底部</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <SliderField label="行高" value={layer.lineHeight} min={0.8} max={3} step={0.05} format={(v) => v.toFixed(2)} onChange={(lineHeight) => set({ lineHeight }, "lh")} />
        <SliderField label="字间距" value={layer.letterSpacing} min={-10} max={60} step={0.5} format={(v) => `${v}px`} onChange={(letterSpacing) => set({ letterSpacing }, "ls")} />
      </Section>
      <Section title="排版适配">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-normal">自动换行</Label>
          <Switch checked={layer.wrap} onCheckedChange={(wrap) => set({ wrap })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-normal">超出时自动缩小字号</Label>
          <Switch checked={layer.autoShrink} onCheckedChange={(autoShrink) => set({ autoShrink })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-normal">超出时文本框自动加高</Label>
          <Switch checked={layer.autoGrow} onCheckedChange={(autoGrow) => set({ autoGrow })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="最小字号" value={layer.minFontSize} min={1} onChange={(minFontSize) => set({ minFontSize })} />
          <NumberField label="最大行数（0 不限）" value={layer.maxLines} min={0} max={50} onChange={(maxLines) => set({ maxLines: Math.round(maxLines) })} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          文本框高度为 {Math.round(layer.height)}px。两项都打开时先缩小到最小字号，仍放不下再加高。文字超出时画布左下角会提示。
        </p>
      </Section>
    </>
  );
}
