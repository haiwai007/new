import { Link } from "react-router-dom";
import { Heart, LayoutTemplate, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import type { WorkRecord } from "@/lib/storage/db.ts";
import { patchWork } from "@/lib/storage/works.ts";
import { cn } from "@/lib/utils.ts";

export default function CustomTemplateGrid({
  loading,
  templates,
  onUse,
  onChanged,
}: {
  loading: boolean;
  templates: WorkRecord[];
  onUse: (id: string) => void;
  onChanged: () => void;
}) {
  if (loading) {
    return (
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] w-full" />)}
      </div>
    );
  }
  if (templates.length === 0) {
    return (
      <Empty className="mt-10">
        <EmptyHeader>
          <EmptyMedia variant="icon"><LayoutTemplate /></EmptyMedia>
          <EmptyTitle>还没有自定义模板</EmptyTitle>
          <EmptyDescription>上传一张参考图，或在编辑器中点击「另存为模板」。</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" asChild><Link to="/custom">上传图片生成模板</Link></Button>
        </EmptyContent>
      </Empty>
    );
  }
  const fav = async (w: WorkRecord) => {
    try {
      await patchWork(w.id, { favorite: !w.favorite });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {templates.map((w) => (
        <div key={w.id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
          <button type="button" className="flex aspect-[4/5] cursor-pointer items-center justify-center bg-muted" onClick={() => onUse(w.id)}>
            {w.thumbnail ? <img src={w.thumbnail} alt={w.name} className="max-h-full max-w-full object-contain" /> : <LayoutTemplate className="size-8 text-muted-foreground" />}
          </button>
          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{w.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {w.doc.canvas.width}×{w.doc.canvas.height} · {w.doc.parameters.length} 个参数 · v{w.version}
                </p>
              </div>
              <button type="button" onClick={() => fav(w)} className="cursor-pointer p-1 text-muted-foreground hover:text-primary" aria-label="收藏">
                <Heart className={cn("size-4", w.favorite && "fill-primary text-primary")} />
              </button>
            </div>
            <div className="mt-auto flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => onUse(w.id)}>使用</Button>
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/editor/${w.id}`} aria-label="编辑模板"><Pencil className="size-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
