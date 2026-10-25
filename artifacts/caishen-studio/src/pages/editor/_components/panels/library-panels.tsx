import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ImagePlus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from "@/lib/template/builtin.ts";
import { startFromBuiltin, startFromDoc } from "@/lib/template/start.ts";
import TemplatePreview from "@/components/templates/template-preview.tsx";
import { useWorks } from "@/hooks/use-works.ts";
import { listAssets, deleteAsset, resolveImageUrl } from "@/lib/storage/assets.ts";
import { assetsInUse } from "@/lib/storage/works.ts";
import type { AssetRecord, WorkRecord } from "@/lib/storage/db.ts";
import { addImageFromAsset } from "../../_lib/actions.ts";
import { edit } from "@/stores/editor.ts";

export function TemplatesPanel() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<BuiltinTemplate | null>(null);
  const open = async (id: string) => {
    try {
      const workId = await startFromBuiltin(id);
      setPending(null);
      navigate(`/editor/${workId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "打开模板失败");
    }
  };
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {BUILTIN_TEMPLATES.filter((t) => t.category !== "blank").map((t) => (
        <button key={t.id} type="button" onClick={() => setPending(t)} className="cursor-pointer overflow-hidden rounded-md border bg-card text-left hover:border-primary">
          <TemplatePreview doc={t.doc} cacheKey={t.id} />
          <p className="truncate px-1.5 py-1 text-[11px]">{t.name}</p>
        </button>
      ))}
      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>使用「{pending?.name}」</DialogTitle>
            <DialogDescription>将基于该模板新建一个作品，当前作品已自动保存，不会被覆盖。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>取消</Button>
            <Button onClick={() => pending && open(pending.id)}>新建作品</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CustomTemplatesPanel() {
  const navigate = useNavigate();
  const { state } = useWorks();
  const use = async (w: WorkRecord) => {
    try {
      const id = await startFromDoc(w.doc, w.name, w.id);
      navigate(`/editor/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "打开模板失败");
    }
  };
  const templates = state.status === "ready" ? state.works.filter((w) => w.kind === "template") : [];
  return (
    <div className="space-y-3 p-3">
      <Button className="w-full" onClick={() => navigate("/custom")}>
        <Sparkles className="size-4" /> 上传图片生成模板
      </Button>
      {state.status === "loading" ? (
        <div className="grid grid-cols-2 gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
      ) : templates.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">还没有自定义模板。点击顶部「另存为模板」可保存当前设计。</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {templates.map((w) => (
            <button key={w.id} type="button" onClick={() => use(w)} className="cursor-pointer overflow-hidden rounded-md border bg-card text-left hover:border-primary">
              <div className="flex aspect-square items-center justify-center bg-muted">
                {w.thumbnail && <img src={w.thumbnail} alt={w.name} className="max-h-full max-w-full object-contain" />}
              </div>
              <p className="truncate px-1.5 py-1 text-[11px]">{w.name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetThumb({ asset }: { asset: AssetRecord }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    // Object URLs are cached and shared with the canvas renderer.
    resolveImageUrl({ kind: "asset", assetId: asset.id })
      .then((u) => alive && setUrl(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [asset.id]);
  return url ? <img src={url} alt={asset.name} className="size-full object-cover" /> : <Skeleton className="size-full" />;
}

/** Previously uploaded images, reusable across works. */
export function AssetsPanel() {
  const [assets, setAssets] = useState<AssetRecord[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ asset: AssetRecord; usedBy: string[] } | null>(null);
  const load = () => listAssets().then(setAssets).catch(() => setAssets([]));
  useEffect(() => {
    void load();
  }, []);

  const askDelete = async (asset: AssetRecord) => {
    const used = await assetsInUse();
    setPendingDelete({ asset, usedBy: used.get(asset.id) ?? [] });
  };
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteAsset(pendingDelete.asset.id);
    setPendingDelete(null);
    void load();
  };

  if (assets === null) {
    return <div className="grid grid-cols-2 gap-2 p-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}</div>;
  }
  if (assets.length === 0) {
    return <p className="p-6 text-center text-xs text-muted-foreground"><ImagePlus className="mx-auto mb-2 size-6" />上传过的图片会出现在这里，可在多个作品中复用。</p>;
  }
  return (
    <div className="p-3">
      <div className="grid grid-cols-2 gap-2">
        {assets.map((a) => (
          <div key={a.id} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
            <button type="button" className="size-full cursor-pointer" onClick={() => addImageFromAsset(a.id, a.width, a.height, a.name)} title="添加到画布">
              <AssetThumb asset={a} />
            </button>
            <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" className="flex-1 cursor-pointer rounded text-[10px] text-white hover:bg-white/20" onClick={() => edit((d) => ({ ...d, canvas: { ...d.canvas, backgroundImage: { kind: "asset", assetId: a.id } } }))}>
                设为背景
              </button>
              <button type="button" className="cursor-pointer rounded px-1 text-white hover:bg-white/20" onClick={() => askDelete(a)} aria-label="删除素材">
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除素材</DialogTitle>
            <DialogDescription>
              {pendingDelete?.usedBy.length
                ? `该图片正被以下作品或历史版本使用：${pendingDelete.usedBy.join("、")}。删除后这些作品中的图片将无法显示。`
                : "该图片没有被任何作品使用，删除后无法恢复。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>取消</Button>
            <Button variant="destructive" onClick={confirmDelete}>仍然删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
