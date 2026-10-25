import { useEffect, useState } from "react";
import { Image as ImageIcon, LoaderCircle } from "lucide-react";
import { renderDoc } from "@/lib/canvas/render.ts";
import type { TemplateDoc } from "@/types/template.ts";

export default function BatchPreview({ doc }: { doc: TemplateDoc | null }) {
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    if (!doc) {
      setImage("");
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const multiplier = Math.min(360 / doc.canvas.width, 300 / doc.canvas.height, 1);
    renderDoc(doc, { multiplier })
      .then(({ canvas }) => {
        if (alive) setImage(canvas.toDataURL("image/png"));
      })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : "预览渲染失败");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [doc]);

  return (
    <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border bg-[#f4efe4] p-4" data-testid="preview-batch-canvas">
      {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> 正在渲染预览</div>
        : image ? <img src={image} alt="当前数据行设计预览" className="max-h-[300px] max-w-full object-contain shadow-md" data-testid="img-batch-preview" />
          : <div className="text-center text-sm text-muted-foreground">{error || <><ImageIcon className="mx-auto mb-2 size-7" />选择一行数据查看效果</>}</div>}
    </div>
  );
}
