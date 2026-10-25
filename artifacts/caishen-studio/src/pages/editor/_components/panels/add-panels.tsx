import { BoxSelect, Circle, ImagePlus, Minus, ScanText, Square, SquareDashed, Triangle, Type, Upload } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useEditor } from "@/stores/editor.ts";
import { addImageFrame, addImageFromFile, addShape, addText, pickFile } from "../../_lib/actions.ts";
import { edit } from "@/stores/editor.ts";
import { BackgroundControls } from "../props/canvas-props.tsx";

const tile =
  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border bg-card p-3 text-xs transition-colors hover:border-primary hover:text-primary";

export function TextPanel() {
  const setTool = useEditor((s) => s.setTool);
  const setOcrRequest = useEditor((s) => s.setOcrRequest);
  const busy = useEditor((s) => s.ocrRequest !== null);
  return (
    <div className="space-y-2 p-3">
      <button type="button" onClick={() => addText("title")} className="w-full cursor-pointer rounded-lg border bg-card px-3 py-3 text-left text-xl font-bold hover:border-primary">添加标题</button>
      <button type="button" onClick={() => addText("subtitle")} className="w-full cursor-pointer rounded-lg border bg-card px-3 py-2.5 text-left text-base font-semibold hover:border-primary">添加副标题</button>
      <button type="button" onClick={() => addText("body")} className="w-full cursor-pointer rounded-lg border bg-card px-3 py-2 text-left text-sm hover:border-primary">添加正文</button>
      <Button size="sm" variant="secondary" className="w-full" onClick={() => setTool("draw-text")}>
        <BoxSelect className="size-4" /> 框选区域添加文字
      </Button>
      <p className="px-1 text-[11px] text-muted-foreground">双击画布上的文字可直接编辑。</p>
      <div className="space-y-2 border-t pt-3">
        <p className="px-1 text-xs font-medium">自动识别文字</p>
        <Button size="sm" variant="secondary" className="w-full" disabled={busy} onClick={() => setTool("draw-ocr")}>
          <ScanText className="size-4" /> 框选区域识别文字
        </Button>
        <Button size="sm" variant="secondary" className="w-full" disabled={busy} onClick={() => setOcrRequest({ x: 0, y: 0, width: 0, height: 0, full: true })}>
          <ScanText className="size-4" /> 识别整张图片的文字
        </Button>
        <p className="px-1 text-[11px] text-muted-foreground">在浏览器本地识别，优先使用上传的原图；识别结果可修改后再添加为文字图层。</p>
      </div>
    </div>
  );
}

export function ImagePanel() {
  const setTool = useEditor((s) => s.setTool);
  return (
    <div className="space-y-2 p-3">
      <Button className="w-full" onClick={async () => {
        const f = await pickFile();
        if (f) await addImageFromFile(f);
      }}>
        <Upload className="size-4" /> 上传图片
      </Button>
      <Button variant="secondary" className="w-full" onClick={() => addImageFrame()}>
        <SquareDashed className="size-4" /> 添加空图片框
      </Button>
      <Button variant="secondary" className="w-full" onClick={() => setTool("draw-image")}>
        <BoxSelect className="size-4" /> 框选区域作为图片框
      </Button>
      <p className="px-1 text-[11px] text-muted-foreground">支持 PNG、JPG、WebP，单张不超过 20MB。也可以直接把图片粘贴（Ctrl+V）或拖进画布。图片保存在本浏览器中。</p>
    </div>
  );
}

export function ShapePanel() {
  const setTool = useEditor((s) => s.setTool);
  const items = [
    { k: "rect" as const, label: "矩形", icon: Square },
    { k: "ellipse" as const, label: "圆形", icon: Circle },
    { k: "triangle" as const, label: "三角形", icon: Triangle },
    { k: "line" as const, label: "线条", icon: Minus },
  ];
  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-2">
        {items.map((i) => (
          <button key={i.k} type="button" className={tile} onClick={() => addShape(i.k)}>
            <i.icon className="size-6" />
            {i.label}
          </button>
        ))}
      </div>
      <Button size="sm" variant="secondary" className="w-full" onClick={() => setTool("draw-rect")}>
        <BoxSelect className="size-4" /> 拖拽绘制矩形
      </Button>
      <Button size="sm" variant="secondary" className="w-full" onClick={() => setTool("draw-mask")}>
        <SquareDashed className="size-4" /> 框选添加遮罩
      </Button>
      <p className="px-1 text-[11px] text-muted-foreground">遮罩用于盖住原图上的旧文字，再在上方放新的文字图层。</p>
    </div>
  );
}

const SWATCHES = ["#ffffff", "#fbf7f0", "#f3ead9", "#f7eee9", "#eef0ea", "#1b1b1f", "#2b1d14", "#0f2a2e", "#c8102e", "#b3001b", "#e8b04a", "#2f6b4f"];

export function BackgroundPanel() {
  const doc = useEditor((s) => s.doc);
  if (!doc) return null;
  const setColor = (backgroundColor: string) => edit((d) => ({ ...d, canvas: { ...d.canvas, backgroundColor } }));
  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-6 gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className="aspect-square cursor-pointer rounded-md border shadow-sm transition-transform hover:scale-110"
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
      </div>
      <BackgroundControls doc={doc} />
      <p className="px-1 text-[11px] text-muted-foreground">
        <Type className="mr-1 inline size-3" />
        背景图片会铺满画布，导出 PNG 时可选择透明背景。「背景修复」可以去掉遮罩或文字下方的旧文字。
      </p>
    </div>
  );
}
