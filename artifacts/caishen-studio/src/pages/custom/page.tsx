import { MAX_WORK_NAME } from "@/lib/storage/names";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Check, ClipboardPaste, ImageUp, Loader2, Lock, RefreshCw, ScanText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { formatBytes, formatLabel, imageFromClipboard, importImageFile, type ImportedImage } from "@/lib/image/import.ts";
import { cn } from "@/lib/utils.ts";
import { createUploadTemplate, fitSize, type SizeMode, type UploadMode } from "./_lib/create-upload-template.ts";
import OcrReview, { type CoverMode, type ReviewLine } from "./_components/ocr-review.tsx";
import { useOcr } from "@/hooks/use-ocr.ts";
import OcrConsentDialog from "@/components/ocr/ocr-consent-dialog.tsx";
import OcrProgressBar from "@/components/ocr/ocr-progress.tsx";
import type { OcrResult } from "@/lib/ocr/index.ts";

const MODES: { id: UploadMode; title: string; desc: string }[] = [
  {
    id: "smart",
    title: "智能重建（自动识别文字）",
    desc: "在浏览器本地识别文字和位置，生成可编辑的文字图层和参数，并修复原图中旧文字所在的背景（也可改用纯色遮罩）。识别结果可先检查修改。",
  },
  {
    id: "background",
    title: "原图背景模式",
    desc: "保留原图作为背景，你在上面框选文字区域、添加遮罩盖住旧文字，再放上可编辑的文字和图片框。",
  },
  {
    id: "manual",
    title: "手动重建模式",
    desc: "原图以原色清晰显示并锁定，你可以框选区域添加文字、图片和参数。需要从空白重新绘制时，可隐藏或删除参考层。",
  },
];

export default function CustomTemplatePage() {
  const navigate = useNavigate();
  const [img, setImg] = useState<ImportedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sizeMode, setSizeMode] = useState<SizeMode>("original");
  const [customW, setCustomW] = useState("1080");
  const [customH, setCustomH] = useState("1350");
  const [mode, setMode] = useState<UploadMode>("smart");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [reviewLines, setReviewLines] = useState<ReviewLine[]>([]);
  const [cover, setCover] = useState<CoverMode>("repair");
  const [rebuildBlocks, setRebuildBlocks] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const ocr = useOcr();

  const accept = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    setOcrResult(null);
    try {
      const res = await importImageFile(file);
      setImg((old) => {
        if (old) URL.revokeObjectURL(old.previewUrl);
        return res;
      });
      setName(res.name.replace(/\.[a-z0-9]+$/i, ""));
      setCustomW(String(res.width));
      setCustomH(String(res.height));
      setSizeMode(Math.max(res.width, res.height) > 2400 ? "fit" : "original");
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const f = imageFromClipboard(e);
      if (f) {
        e.preventDefault();
        void accept(f);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [accept]);

  const target = img
    ? sizeMode === "original"
      ? { width: img.width, height: img.height }
      : sizeMode === "fit"
        ? fitSize(img.width, img.height)
        : { width: Math.round(Number(customW) || 0), height: Math.round(Number(customH) || 0) }
    : null;
  const sizeValid = target !== null && target.width >= 16 && target.height >= 16 && target.width <= 8000 && target.height <= 8000;

  const create = async () => {
    if (!img || !target || !sizeValid) return;
    setCreating(true);
    try {
      const smart =
        mode === "smart" && ocrResult
          ? {
              lines: reviewLines.filter((l) => l.include && l.text.trim()).map((l) => ({ ...l, text: l.text.trim() })),
              addMasks: cover === "mask",
              repair: cover === "repair",
              backgroundColor: ocrResult.backgroundColor,
              blocks: rebuildBlocks ? ocrResult.blocks : [],
            }
          : undefined;
      const { workId, stats } = await createUploadTemplate({ image: img, size: target, mode, name: name.trim() || "自定义模板", smart });
      if (stats) {
        const notes = [
          `${stats.textCount} 个文字图层`,
          stats.repaired ? `修复了 ${stats.repaired} 处旧文字背景` : null,
          stats.shapeCount ? `${stats.shapeCount} 个色块形状` : null,
          stats.maskCount ? `${stats.maskCount} 个遮罩` : null,
          stats.maskSkipped ? `${stats.maskSkipped} 处背景复杂未加遮罩` : null,
          stats.outside ? `${stats.outside} 处在画布外被跳过` : null,
        ].filter(Boolean);
        toast.success("已生成模板", { description: notes.join("，") });
      }
      navigate(`/editor/${workId}`);
    } catch (e) {
      toast.error("生成模板失败", { description: e instanceof Error ? e.message : undefined });
      setCreating(false);
    }
  };

  const recognize = async () => {
    if (!img) return;
    const res = await ocr.run({ image: img.blob });
    if (!res) return;
    setOcrResult(res);
    setReviewLines(res.lines.map((l) => ({ ...l, include: true })));
    if (res.lines.length === 0) toast.warning("没有识别到文字");
  };

  const primary = () => (mode === "smart" ? recognize() : create());
  const running = ocr.state.status === "running";

  if (img && ocrResult && mode === "smart") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <h1 className="font-serif text-3xl font-bold">自定义模板 · 识别结果</h1>
        <p className="mt-1 text-muted-foreground">红框是识别到的文字区域，点击可定位到对应条目。</p>
        <OcrReview
          previewUrl={img.previewUrl}
          result={ocrResult}
          lines={reviewLines}
          onLinesChange={setReviewLines}
          cover={cover}
          onCoverChange={setCover}
          rebuildBlocks={rebuildBlocks}
          onRebuildBlocksChange={setRebuildBlocks}
          onBack={() => setOcrResult(null)}
          onCreate={create}
          creating={creating}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <h1 className="font-serif text-3xl font-bold">自定义模板</h1>
      <p className="mt-1 text-muted-foreground">上传一张参考图，把它变成由独立图层组成、可以设置参数的模板。</p>

      <ol className="mt-6 flex flex-wrap gap-2 text-sm">
        {["上传参考图", "选择画布尺寸", "选择处理方式", "进入编辑器拆分图层"].map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 rounded-full border px-3 py-1", (i === 0 || img) && "border-primary/50 bg-primary/5")}>
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void accept(f);
            }}
            className={cn(
              "relative flex min-h-80 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-card p-4 transition-colors",
              dragging ? "border-primary bg-primary/5" : "hover:border-primary/60",
            )}
          >
            {loading ? (
              <Loader2 className="size-8 animate-spin text-primary" />
            ) : img ? (
              <img src={img.previewUrl} alt="参考图预览" className="max-h-[60vh] max-w-full rounded-md object-contain shadow" />
            ) : (
              <div className="text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ImageUp className="size-7" />
                </span>
                <p className="mt-4 font-medium">点击上传，或把图片拖到这里</p>
                <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <ClipboardPaste className="size-4" /> 也可以直接 Ctrl+V 粘贴截图
                </p>
                <p className="mt-3 text-xs text-muted-foreground">PNG / JPG / JPEG / WebP · 不超过 20MB · 最大 8000×8000</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void accept(f);
                e.target.value = "";
              }}
            />
          </div>
          {error && (
            <p className="mt-3 flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="size-4" />{error}</p>
          )}
          {img && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-4 py-2 text-sm">
              <span>尺寸 <b>{img.width}×{img.height}</b></span>
              <span>宽高比 <b>{(img.width / img.height).toFixed(3)}</b></span>
              <span>格式 <b>{formatLabel(img.mime)}</b></span>
              <span>大小 <b>{formatBytes(img.size)}</b></span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => inputRef.current?.click()}>
                <RefreshCw className="size-4" /> 重新上传
              </Button>
            </div>
          )}
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            图片仅保存在你当前浏览器的本地存储中，不会上传到服务器或发送给任何第三方。原图会完整保留，随时可在预览中对比。
          </p>
        </div>

        <div className={cn("space-y-6", !img && "pointer-events-none opacity-50")}>
          <div className="space-y-1">
            <Label>模板名称</Label>
            <Input maxLength={MAX_WORK_NAME} value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：门店促销海报" />
          </div>

          <div className="space-y-2">
            <Label>画布尺寸</Label>
            <RadioGroup value={sizeMode} onValueChange={(v) => setSizeMode(v as SizeMode)} className="gap-2">
              {[
                { id: "original", label: "保持原始尺寸", hint: img ? `${img.width}×${img.height}` : "" },
                { id: "fit", label: "自动适配画布（长边不超过 2000px）", hint: img ? `${fitSize(img.width, img.height).width}×${fitSize(img.width, img.height).height}` : "" },
                { id: "custom", label: "自定义尺寸", hint: "" },
              ].map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-[:checked]:border-primary">
                  <RadioGroupItem value={o.id} />
                  <span className="flex-1 text-sm">{o.label}</span>
                  <span className="text-xs text-muted-foreground">{o.hint}</span>
                </label>
              ))}
            </RadioGroup>
            {sizeMode === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" value={customW} onChange={(e) => setCustomW(e.target.value)} placeholder="宽度" />
                <Input type="number" value={customH} onChange={(e) => setCustomH(e.target.value)} placeholder="高度" />
                <p className="col-span-2 text-xs text-muted-foreground">原图会等比铺满画布，多余部分被裁掉。</p>
              </div>
            )}
            {!sizeValid && img && <p className="text-xs text-destructive">尺寸需在 16 到 8000 像素之间</p>}
          </div>


          <div className="space-y-2">
            <Label>处理方式</Label>
            <div className="space-y-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={running}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "w-full cursor-pointer rounded-lg border p-3 text-left transition-colors hover:border-primary/60",
                    mode === m.id && "border-primary bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.title}</span>
                    {mode === m.id && <Check className="size-4 text-primary" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              说明：可以在下一步选择「修复背景」去掉原图中的旧文字。修复按周围颜色填补，照片中细节丰富的区域会略显模糊。
            </p>
          </div>

          {ocr.state.status === "running" && <OcrProgressBar progress={ocr.state.progress} onCancel={ocr.cancel} />}
          {ocr.state.status === "error" && (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{ocr.state.message} 你也可以改用「原图背景模式」手动框选文字。</span>
            </p>
          )}

          <Button size="lg" className="w-full" onClick={primary} disabled={!img || !sizeValid || creating || running}>
            {creating || running ? <Loader2 className="size-4 animate-spin" /> : mode === "smart" ? <ScanText className="size-4" /> : <ArrowRight className="size-4" />}
            {mode === "smart" ? "开始识别文字" : "生成初始模板并进入编辑器"}
          </Button>
        </div>
      </div>
      <OcrConsentDialog open={ocr.consentOpen} providerLabel={ocr.provider.label} onAnswer={ocr.answerConsent} />
    </div>
  );
}
