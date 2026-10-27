import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import type { SharedGalleryTemplate } from "@/lib/catalog-service/provider";
import { categoryLabel } from "@/lib/template/builtin.ts";
import { cn } from "@/lib/utils.ts";
import TemplatePreview from "./template-preview.tsx";

export default function TemplateCard({
  template,
  favorite,
  onToggleFavorite,
  onUse,
  busy,
}: {
  template: SharedGalleryTemplate;
  favorite: boolean;
  onToggleFavorite: () => void;
  onUse: () => void;
  busy: boolean;
}) {
  const { doc } = template;
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg">
      <button
        type="button"
        onClick={onUse}
        className="relative cursor-pointer"
        aria-label={`使用模板 ${template.name}`}
      >
        <div className="aspect-[4/5] bg-muted p-3">
          {template.thumbnailUrl ? (
            <img
              src={template.thumbnailUrl}
              alt={template.name}
              loading="lazy"
              className="size-full object-contain"
            />
          ) : (
            <TemplatePreview
              doc={doc}
              cacheKey={template.id}
              contain
              className="bg-transparent [&_img]:drop-shadow-md"
            />
          )}
        </div>
        <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-white">
          {doc.canvas.width}×{doc.canvas.height}
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="line-clamp-2 font-medium" title={template.name}>
              {template.name}
            </p>
            {template.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {template.description}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-[11px]">
                {template.categoryName ?? categoryLabel(template.category)}
              </Badge>
              {(template.parameterCount ?? doc.parameters.length) > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {template.parameterCount ?? doc.parameters.length} 个参数
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleFavorite}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:text-primary"
            aria-label={favorite ? "取消收藏" : "收藏"}
          >
            <Heart
              className={cn("size-4", favorite && "fill-primary text-primary")}
            />
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
