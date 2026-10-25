import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import type { Layer, ShapeLayer } from "@/types/template.ts";
import { ColorField, NumberField, Section, SliderField } from "../fields.tsx";

type Setter = (patch: Partial<Layer>, key?: string) => void;

export default function ShapeProps({ layer, set }: { layer: ShapeLayer; set: Setter }) {
  const isLine = layer.type === "line";
  return (
    <>
      <Section title={isLine ? "线条" : "填充与边框"}>
        <ColorField label={isLine ? "线条颜色" : "填充颜色"} value={layer.fill} onChange={(fill) => set({ fill })} />
        {!isLine && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="边框粗细" value={layer.strokeWidth} min={0} max={200} onChange={(strokeWidth) => set({ strokeWidth })} />
              {layer.type === "rect" && <NumberField label="圆角" value={layer.radius} min={0} onChange={(radius) => set({ radius })} />}
            </div>
            {layer.strokeWidth > 0 && <ColorField label="边框颜色" value={layer.stroke} onChange={(stroke) => set({ stroke })} />}
          </>
        )}
        {layer.isMask && <p className="text-[11px] text-muted-foreground">这是一个遮罩，用来盖住原图上的文字。请把填充色调成与周围背景一致。</p>}
      </Section>
      <Section title="阴影">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-normal">启用阴影</Label>
          <Switch
            checked={layer.shadow !== null}
            onCheckedChange={(on) => set({ shadow: on ? { color: "rgba(0,0,0,0.3)", blur: 20, offsetX: 0, offsetY: 8 } : null })}
          />
        </div>
        {layer.shadow && (
          <>
            <ColorField label="阴影颜色" value={layer.shadow.color} onChange={(color) => set({ shadow: { ...layer.shadow!, color } })} />
            <SliderField label="模糊" value={layer.shadow.blur} min={0} max={100} step={1} onChange={(blur) => set({ shadow: { ...layer.shadow!, blur } }, "sb")} />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="X 偏移" value={layer.shadow.offsetX} onChange={(offsetX) => set({ shadow: { ...layer.shadow!, offsetX } })} />
              <NumberField label="Y 偏移" value={layer.shadow.offsetY} onChange={(offsetY) => set({ shadow: { ...layer.shadow!, offsetY } })} />
            </div>
          </>
        )}
      </Section>
    </>
  );
}
