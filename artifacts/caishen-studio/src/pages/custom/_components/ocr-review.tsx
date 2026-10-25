import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import type { AnalyzedLine, OcrResult } from "@/lib/ocr/index.ts";

export type ReviewLine = AnalyzedLine & { include: boolean };
export type CoverMode = "repair" | "mask" | "none";

const COVER_OPTIONS: { id: CoverMode; title: string; desc: string }[] = [
  { id: "repair", title: "修复背景（推荐）", desc: "按周围颜色填补旧文字所在区域，生成新背景。纯色和渐变背景效果最好，照片背景会略显模糊。" },
  { id: "mask", title: "纯色遮罩", desc: "用取自周围的纯色矩形盖住旧文字。背景复杂处不自动添加。" },
  { id: "none", title: "保留原图文字", desc: "不处理原图，适合只想参考原图位置的情况。" },
];

function confTone(c: number) {
  if (c >= 80) return "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300";
  if (c >= 55) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-red-500/15 text-red-700 dark:text-red-300";
}

/** Step 2: show recognized regions over the image and let the user fix them. */
export default function OcrReview({
  previewUrl,
  result,
  lines,
  onLinesChange,
  cover,
  onCoverChange,
  rebuildBlocks,
  onRebuildBlocksChange,
  onBack,
  onCreate,
  creating,
}: {
  previewUrl: string;
  result: OcrResult;
  lines: ReviewLine[];
  onLinesChange: (l: ReviewLine[]) => void;
  cover: CoverMode;
  onCoverChange: (v: CoverMode) => void;
  rebuildBlocks: boolean;
  onRebuildBlocksChange: (v: boolean) => void;
  onBack: () => void;
  onCreate: () => void;
  creating: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const update = (id: string, patch: Partial<ReviewLine>) =>
    onLinesChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const included = lines.filter((l) => l.include && l.text.trim()).length;
  const pct = (n: number, total: number) => `${(n / total) * 100}%`;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-xl border bg-card shadow-sm">
          <img src={previewUrl} alt="识别结果" className="block max-h-[70vh] max-w-full" />
          {rebuildBlocks &&
            result.blocks.map((b, i) => (
              <div
                key={`block-${i}`}
                className="pointer-events-none absolute border-2 border-dashed border-sky-500"
                style={{ left: pct(b.x, result.imageWidth), top: pct(b.y, result.imageHeight), width: pct(b.width, result.imageWidth), height: pct(b.height, result.imageHeight) }}
              />
            ))}
          {lines.map((l, i) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setActive(l.id)}
              title={l.text}
              className={cn(
                "absolute cursor-pointer rounded-[2px] border-2 transition-colors",
                !l.include
                  ? "border-dashed border-muted-foreground/60 bg-transparent"
                  : active === l.id
                    ? "border-primary bg-primary/25"
                    : "border-primary/80 bg-primary/10 hover:bg-primary/20",
              )}
              style={{
                left: pct(l.bbox.x, result.imageWidth),
                top: pct(l.bbox.y, result.imageHeight),
                width: pct(l.bbox.width, result.imageWidth),
                height: pct(l.bbox.height, result.imageHeight),
              }}
            >
              <span className="absolute -left-0.5 -top-4 rounded-sm bg-primary px-1 text-[10px] leading-4 text-primary-foreground">{i + 1}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {result.engine} · 用时 {(result.durationMs / 1000).toFixed(1)} 秒 · 识别到 {result.lines.length} 处文字、{result.blocks.length} 个色块 · 推测背景色
          <span className="ml-1 inline-block size-3 translate-y-0.5 rounded-sm border" style={{ backgroundColor: result.backgroundColor }} />
        </p>
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <div>
          <h2 className="font-semibold">检查识别结果</h2>
          <p className="text-sm text-muted-foreground">修改错字，取消勾选不需要的文字。漏掉的文字可在编辑器里用「框选识别」或「框选添加文字」补上。</p>
        </div>

        {lines.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            没有识别到文字。可能是文字太小、字体特殊或对比度太低。你仍然可以生成模板，然后在编辑器里手动框选添加文字。
          </div>
        ) : (
          <ul className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {lines.map((l, i) => (
              <li
                key={l.id}
                onFocus={() => setActive(l.id)}
                className={cn("rounded-lg border bg-card p-2.5 transition-colors", active === l.id && "border-primary", !l.include && "opacity-60")}
              >
                <div className="flex items-center gap-2">
                  <Checkbox checked={l.include} onCheckedChange={(v) => update(l.id, { include: v === true })} aria-label={`保留第 ${i + 1} 条`} />
                  <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                  <Input value={l.text} onChange={(e) => update(l.id, { text: e.target.value })} className="h-8 flex-1" aria-label={`第 ${i + 1} 条文字`} />
                  <input
                    type="color"
                    value={l.color}
                    onChange={(e) => update(l.id, { color: e.target.value })}
                    className="size-8 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
                    aria-label="文字颜色"
                  />
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => onLinesChange(lines.filter((x) => x.id !== l.id))} aria-label="删除">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-12 text-[11px] text-muted-foreground">
                  <Badge variant="secondary" className={cn("px-1.5 py-0 text-[10px]", confTone(l.confidence))}>置信度 {l.confidence}%</Badge>
                  <span>{Math.round(l.bbox.width)}×{Math.round(l.bbox.height)} @ ({Math.round(l.bbox.x)}, {Math.round(l.bbox.y)})</span>
                  <button type="button" className="cursor-pointer underline-offset-2 hover:underline" onClick={() => update(l.id, { bold: !l.bold })}>
                    {l.bold ? "粗体" : "常规"}
                  </button>
                  {!l.bgUniform && cover === "mask" && <span className="text-amber-700 dark:text-amber-400">背景复杂，不自动加遮罩</span>}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1.5">
          <p className="text-sm font-medium">原图中的旧文字</p>
          {COVER_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onCoverChange(o.id)}
              className={cn("w-full cursor-pointer rounded-lg border p-2.5 text-left transition-colors hover:border-primary/60", cover === o.id && "border-primary bg-primary/5")}
            >
              <span className="text-sm font-medium">{o.title}</span>
              <span className="block text-xs text-muted-foreground">{o.desc}</span>
            </button>
          ))}
        </div>

        {result.blocks.length > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <Switch checked={rebuildBlocks} onCheckedChange={onRebuildBlocksChange} className="mt-0.5" />
            <span className="text-sm">
              把 {result.blocks.length} 个纯色块重建为可编辑形状
              <span className="block text-xs text-muted-foreground">如按钮、横幅、标签底色（图中蓝色虚线框）。重建后可单独改颜色、尺寸和圆角。</span>
            </span>
          </label>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack} disabled={creating}>
            <ArrowLeft className="size-4" /> 返回
          </Button>
          <Button className="flex-1" onClick={onCreate} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : included > 0 ? <ArrowRight className="size-4" /> : <Plus className="size-4" />}
            {creating && cover === "repair" ? "正在修复背景…" : included > 0 ? `用 ${included} 条文字生成模板` : "不含识别文字，直接生成模板"}
          </Button>
        </div>
      </div>
    </div>
  );
}
