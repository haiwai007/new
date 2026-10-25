import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { categoryLabel, type BuiltinTemplate } from "@/lib/template/builtin.ts";
import { cn } from "@/lib/utils.ts";
import TemplatePreview from "./template-preview.tsx";

export default function TemplateCard({
  template,
  favorite,
  onToggleFavorite,
  onUse,
  busy,
}: {
  template: BuiltinTemplate;
  favorite: boolean;
  onToggleFavorite: () => void;
  onUse: () => void;
  busy: boolean;
}) {
  const { doc } = template;
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg">
      <button type="button" onClick={onUse} className="relative cursor-pointer" aria-label={`使用模板 ${template.name}`}>
        <div className="aspect-[4/5] bg-muted p-3">
          <TemplatePreview doc={doc} cacheKey={template.id} contain className="bg-transparent [&_img]:drop-shadow-md" />
        </div>
        <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-white">
          {doc.canvas.width}×{doc.canvas.height}
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{template.name}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[11px]">{categoryLabel(template.category)}</Badge>
              {doc.parameters.length > 0 && (
                <span className="text-[11px] text-muted-foreground">{doc.parameters.length} 个参数</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleFavorite}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:text-primary"
            aria-label={favorite ? "取消收藏" : "收藏"}
          >
            <Heart className={cn("size-4", favorite && "fill-primary text-primary")} />
          </button>
        </div>
        <Button size="sm" className="mt-auto" onClick={onUse} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          使用模板
        </Button>
      </div>
    </div>
  );
}
