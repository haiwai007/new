import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import { renderDoc } from "@/lib/canvas/render.ts";
import { resolveImageUrl } from "@/lib/storage/assets.ts";
import { useEditor } from "@/stores/editor.ts";
import CompareSlider from "@/components/templates/compare-slider.tsx";

/** Full-resolution preview of the final output, with original-vs-result compare. */
export default function PreviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const doc = useEditor((s) => s.doc);
  const [url, setUrl] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [mode, setMode] = useState<"result" | "original" | "side" | "slider">("result");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !doc) return;
    let alive = true;
    setUrl(null);
    setError(null);
    const mult = Math.min(1, 1600 / Math.max(doc.canvas.width, doc.canvas.height));
    renderDoc(doc, { multiplier: mult })
      .then(({ canvas }) => alive && setUrl(canvas.toDataURL("image/png")))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "预览失败"));
    if (doc.source) {
      resolveImageUrl({ kind: "asset", assetId: doc.source.originalAssetId })
        .then((u) => alive && setOriginal(u))
        .catch(() => alive && setOriginal(null));
    } else setOriginal(null);
    return () => {
      alive = false;
    };
  }, [open, doc]);

  const img = (src: string | null, alt: string) =>
    src ? <img src={src} alt={alt} className="max-h-[70vh] w-auto max-w-full rounded border object-contain shadow" /> : <Skeleton className="aspect-square w-80" />;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,1100px)]">
        <DialogHeader>
          <DialogTitle>预览</DialogTitle>
          <DialogDescription>{doc ? `${doc.canvas.width}×${doc.canvas.height} px` : ""}</DialogDescription>
        </DialogHeader>
        {original && (
          <ToggleGroup type="single" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as typeof mode)} className="w-fit">
            <ToggleGroupItem value="result">编辑结果</ToggleGroupItem>
            <ToggleGroupItem value="original">原图</ToggleGroupItem>
            <ToggleGroupItem value="side">左右对比</ToggleGroupItem>
            <ToggleGroupItem value="slider">滑动对比</ToggleGroupItem>
          </ToggleGroup>
        )}
        <div className="flex max-h-[72vh] items-center justify-center gap-4 overflow-auto rounded-md bg-muted p-4">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : mode === "slider" && original && url && doc ? (
            <div className="w-full" style={{ maxWidth: `calc(68vh * ${doc.canvas.width / doc.canvas.height})` }}>
              <CompareSlider before={original} after={url} aspect={doc.canvas.width / doc.canvas.height} beforeLabel="原图" afterLabel="编辑结果" />
            </div>
          ) : mode === "side" && original ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 text-center text-xs text-muted-foreground">{img(original, "原图")}<p>原图</p></div>
              <div className="space-y-1 text-center text-xs text-muted-foreground">{img(url, "编辑结果")}<p>编辑结果</p></div>
            </div>
          ) : mode === "original" && original ? (
            img(original, "原图")
          ) : (
            img(url, "编辑结果")
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
