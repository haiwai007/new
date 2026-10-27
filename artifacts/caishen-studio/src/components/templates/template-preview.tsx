import { useEffect, useState, useRef } from "react";
import { ImageOff } from "lucide-react";
import { renderThumbnail } from "@/lib/canvas/render.ts";
import type { TemplateDoc } from "@/types/template.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";

const cache = new Map<string, Promise<string>>();
// Render one thumbnail at a time so the home page doesn't stall.
let queue: Promise<unknown> = Promise.resolve();

function thumbFor(key: string, doc: TemplateDoc): Promise<string> {
  let p = cache.get(key);
  if (!p) {
    p = queue.then(() => renderThumbnail(doc, 480));
    queue = p.catch(() => undefined);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** Live preview rendered from the template's layer data. */
export default function TemplatePreview({
  doc,
  cacheKey,
  className,
  contain = false,
}: {
  doc: TemplateDoc;
  cacheKey: string;
  className?: string;
  /** Fill the parent box and letterbox the preview instead of using the canvas ratio. */
  contain?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    if (
      visible ||
      !container.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [visible]);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    thumbFor(cacheKey, doc)
      .then((u) => alive && (u ? setUrl(u) : setFailed(true)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [cacheKey, doc, visible]);
  const ratio = `${doc.canvas.width} / ${doc.canvas.height}`;
  return (
    <div
      ref={container}
      className={cn(
        "relative w-full overflow-hidden bg-muted",
        contain && "h-full",
        className,
      )}
      style={contain ? undefined : { aspectRatio: ratio }}
    >
      {url ? (
        <img
          src={url}
          alt={doc.name}
          className={
            contain ? "size-full object-contain" : "size-full object-cover"
          }
          loading="lazy"
        />
      ) : failed ? (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff className="size-6" />
        </div>
      ) : (
        <Skeleton className="size-full rounded-none" />
      )}
    </div>
  );
}
