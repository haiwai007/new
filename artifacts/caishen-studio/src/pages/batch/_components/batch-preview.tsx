import ImagePreviewDialog from "@/components/templates/image-preview-dialog";
import { phoneScreenContent } from "@/lib/phone/export";
import { useEffect, useState } from "react";
import { Image as ImageIcon, LoaderCircle, ZoomIn } from "lucide-react";
import { renderDoc } from "@/lib/canvas/render.ts";
import { cn } from "@/lib/utils.ts";
import type { TemplateDoc } from "@/types/template.ts";

type Props = {
  doc: TemplateDoc | null;
  label?: string;
  invalid?: boolean;
  maxSize?: number;
};

export default function BatchPreview({
  doc,
  label,
  invalid,
  maxSize = 300,
}: Props) {
  const [rendered, setRendered] = useState<{
    doc: TemplateDoc;
    url: string;
  } | null>(null);
  const [viewing, setViewing] = useState<TemplateDoc | null>(null);
  const image = rendered?.doc === doc ? rendered.url : "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setViewing(null);
    if (!doc) return;
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      setLoading(true);
      setError("");
    });
    const multiplier = Math.min(
      (maxSize * 1.5) / doc.canvas.width,
      (maxSize * 1.5) / doc.canvas.height,
      1,
    );
    renderDoc(phoneScreenContent(doc), { multiplier })
      .then(({ canvas }) => {
        try {
          if (alive) setRendered({ doc, url: canvas.toDataURL("image/png") });
        } finally {
          canvas.width = canvas.height = 0;
        }
      })
      .catch((reason: unknown) => {
        if (alive)
          setError(reason instanceof Error ? reason.message : "预览渲染失败");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [doc, maxSize]);

  return (
    <>
      <figure
        className={cn(
          "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted/60 p-3",
          invalid && "border-destructive/60",
        )}
      >
        {label && (
          <span className="absolute left-2 top-2 z-10 rounded bg-foreground/75 px-1.5 py-0.5 font-mono text-[10px] text-background">
            {label}
          </span>
        )}
        {!doc ? (
          <div className="text-center text-sm text-muted-foreground">
            <ImageIcon className="mx-auto mb-2 size-7" />
            选择模板后预览
          </div>
        ) : loading && !image ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> 渲染中
          </div>
        ) : image ? (
          <button
            type="button"
            aria-label={label ? `放大查看第 ${label} 张预览` : "放大查看预览"}
            disabled={loading}
            onClick={() => setViewing(doc)}
            className="flex h-full w-full cursor-zoom-in items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-primary"
          >
            <img
              src={image}
              alt={label ? `第 ${label} 张预览` : "预览"}
              className={cn(
                "max-h-full max-w-full object-contain shadow-md transition-opacity",
                loading && "opacity-50",
              )}
            />
            <span className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded bg-foreground/80 px-2 py-1 text-[11px] text-background">
              <ZoomIn className="size-3" />
              点击放大
            </span>
          </button>
        ) : (
          <div className="text-center text-sm text-muted-foreground">
            {error || "预览不可用"}
          </div>
        )}
      </figure>
      {viewing && (
        <ImagePreviewDialog
          doc={viewing}
          label={label}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
