import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import CompareSlider from "@/components/templates/compare-slider.tsx";
import { loadImage } from "@/lib/canvas/image-cache.ts";
import { getAsset, resolveImageUrl, saveAsset } from "@/lib/storage/assets.ts";
import { getRepairProvider } from "@/lib/repair/provider.ts";
import { canvasBoxesToImage, repairCandidates } from "@/lib/repair/regions.ts";
import { removeLayers } from "@/lib/template/doc-ops.ts";
import { cn } from "@/lib/utils.ts";
import { edit, useEditor } from "@/stores/editor.ts";

type Result = { url: string; blob: Blob; width: number; height: number; pixels: number; durationMs: number; maskIds: string[] };

/** Repair the background behind masks / old text, preview before vs after, then apply as a new background image. */
export default function RepairDialog() {
  const open = useEditor((s) => s.repairOpen);
  const setOpen = useEditor((s) => s.setRepairOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="size-5 text-primary" />背景修复</DialogTitle>
          <DialogDescription>把遮罩或旧文字下方的背景按周围颜色重新填补，生成一张新的背景图。原图会完整保留，可随时恢复。</DialogDescription>
        </DialogHeader>
        {open && <RepairBody onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RepairBody({ onDone }: { onDone: () => void }) {
  const doc = useEditor((s) => s.doc);
  const provider = getRepairProvider();
  const candidates = useMemo(() => (doc ? repairCandidates(doc) : []), [doc]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.map((c) => c.layerId)));
  const [pad, setPad] = useState(4);
  const [removeMasks, setRemoveMasks] = useState(true);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bg = doc?.canvas.backgroundImage ?? null;

  useEffect(() => {
    if (!bg) return;
    let alive = true;
    resolveImageUrl(bg).then((u) => alive && setBeforeUrl(u)).catch(() => alive && setError("背景图片无法加载"));
    return () => {
      alive = false;
    };
  }, [bg]);

  // Revoke the preview URL when it is replaced or the dialog closes.
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  if (!doc) return null;
  if (!bg) {
    return <p className="rounded-md bg-muted px-3 py-4 text-sm text-muted-foreground">当前画布没有背景图片。背景修复只作用于背景图片，请先在「背景」中上传一张。</p>;
  }

  const toggle = (id: string, on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const run = async () => {
    setError(null);
    setResult(null);
    const chosen = candidates.filter((c) => picked.has(c.layerId));
    if (chosen.length === 0) return setError("请至少选择一个区域");
    try {
      const el = await loadImage(bg);
      const image = { width: el.naturalWidth || el.width, height: el.naturalHeight || el.height };
      // Padding is chosen in canvas pixels, so inflate before mapping onto the image.
      const boxes = chosen.map((c) => ({ x: c.box.x - pad, y: c.box.y - pad, width: c.box.width + pad * 2, height: c.box.height + pad * 2 }));
      const regions = canvasBoxesToImage(boxes, image, doc.canvas);
      const mime = bg.kind === "asset" && (await getAsset(bg.assetId))?.mime === "image/jpeg" ? "image/jpeg" : "image/png";
      setRunning({ done: 0, total: 1 });
      const res = await provider.repair({ image: el, regions, mime, onProgress: (done, total) => setRunning({ done, total }) });
      setResult({ ...res, url: URL.createObjectURL(res.blob), maskIds: chosen.filter((c) => c.kind === "mask").map((c) => c.layerId) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "修复失败");
    } finally {
      setRunning(null);
    }
  };

  const apply = async () => {
    if (!result) return;
    try {
      const asset = await saveAsset(result.blob, {
        name: `${doc.name}-修复背景`,
        width: result.width,
        height: result.height,
        category: "背景修复",
        scope: "internal",
      });
      edit((d) => {
        const withBg = { ...d, canvas: { ...d.canvas, backgroundImage: { kind: "asset" as const, assetId: asset.id } } };
        return removeMasks && result.maskIds.length ? removeLayers(withBg, result.maskIds) : withBg;
      });
      toast.success("已应用修复后的背景", {
        description: `${removeMasks && result.maskIds.length ? `已移除 ${result.maskIds.length} 个遮罩。` : ""}可按 Ctrl+Z 撤销，或在「背景」中恢复原图。`,
      });
      onDone();
    } catch (e) {
      toast.error("保存失败", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const aspect = doc.canvas.width / doc.canvas.height;
  const masks = candidates.filter((c) => c.kind === "mask");
  const texts = candidates.filter((c) => c.kind === "text");

  return (
    <div className="space-y-4">
      {result && beforeUrl ? (
        <div className="space-y-2">
          <div className="mx-auto" style={{ maxWidth: `calc(50vh * ${aspect})` }}>
            <CompareSlider before={beforeUrl} after={result.url} aspect={aspect} beforeLabel="修复前" afterLabel="修复后" />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            拖动中间的分隔线对比 · 修复 {result.pixels.toLocaleString()} 个像素 · 用时 {(result.durationMs / 1000).toFixed(1)} 秒 · 预览不含图层
          </p>
        </div>
      ) : (
        beforeUrl && (
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-md border" style={{ aspectRatio: aspect }}>
            <img src={beforeUrl} alt="当前背景" className="absolute inset-0 size-full object-cover" />
            {candidates.map((c) => (
              <div
                key={c.layerId}
                className={cn("absolute border-2", picked.has(c.layerId) ? "border-primary bg-primary/25" : "border-dashed border-white/70")}
                style={{
                  left: `${(c.box.x / doc.canvas.width) * 100}%`,
                  top: `${(c.box.y / doc.canvas.height) * 100}%`,
                  width: `${(c.box.width / doc.canvas.width) * 100}%`,
                  height: `${(c.box.height / doc.canvas.height) * 100}%`,
                }}
              />
            ))}
          </div>
        )
      )}

      {!result && (
        <>
          {candidates.length === 0 ? (
            <p className="rounded-md bg-muted px-3 py-3 text-sm text-muted-foreground">
              没有可修复的区域。先用「形状 → 框选添加遮罩」框出要去掉的旧文字或图案，再回来修复。
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {[{ title: "遮罩区域", list: masks }, { title: "文字图层下方", list: texts }].map((g) =>
                g.list.length ? (
                  <div key={g.title} className="space-y-1.5">
                    <p className="text-xs font-medium">{g.title}</p>
                    <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
                      {g.list.map((c) => (
                        <li key={c.layerId}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox checked={picked.has(c.layerId)} onCheckedChange={(v) => toggle(c.layerId, v === true)} />
                            <span className="truncate">{c.name}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          )}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground"><span>向外扩展</span><span>{pad}px</span></div>
            <input type="range" min={0} max={30} value={pad} onChange={(e) => setPad(Number(e.target.value))} className="w-full cursor-pointer accent-[var(--primary)]" aria-label="向外扩展" />
            <p className="text-[11px] text-muted-foreground">旧文字有残留边缘时可适当加大。</p>
          </div>
        </>
      )}

      {running && (
        <div className="space-y-1">
          <Progress value={(running.done / Math.max(1, running.total)) * 100} />
          <p className="text-xs text-muted-foreground">正在修复第 {Math.min(running.total, running.done + 1)} / {running.total} 组区域…</p>
        </div>
      )}
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <p className="rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
        {provider.label}：{provider.limitation}图片不会上传。
      </p>

      {result && masks.length > 0 && result.maskIds.length > 0 && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={removeMasks} onCheckedChange={setRemoveMasks} />应用后移除已修复区域的 {result.maskIds.length} 个遮罩
        </label>
      )}

      <DialogFooter className="gap-2">
        {result ? (
          <>
            <Button variant="ghost" onClick={() => setResult(null)}>重新选择</Button>
            <Button onClick={apply}><Sparkles className="size-4" />应用为新背景</Button>
          </>
        ) : (
          <Button onClick={run} disabled={running !== null || candidates.length === 0 || picked.size === 0}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}开始修复（{picked.size} 处）
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
