import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Expand, LoaderCircle, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canvasToBlob, renderDoc } from "@/lib/canvas/render";
import { phoneScreenContent } from "@/lib/phone/export";
import type { TemplateDoc } from "@/types/template";

/** Inspect a frozen drawing without changing its parameters or export resolution. */
export default function ImagePreviewDialog({
  doc,
  label,
  onClose,
}: {
  doc: TemplateDoc;
  label?: string;
  onClose: () => void;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const returnFocus = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(
    null,
  );
  const attachViewport = useCallback((node: HTMLDivElement | null) => {
    viewport.current = node;
    setViewportElement(node);
  }, []);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [fit, setFit] = useState(true);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const position = useRef<{ left: number; top: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const pinch = useRef({ distance: 1, zoom: 1 });
  const width = doc.canvas.width,
    height = doc.canvas.height;
  const multiplier = Math.min(
    1,
    4096 / width,
    4096 / height,
    Math.sqrt(12_000_000 / (width * height)),
  );

  useEffect(() => {
    let alive = true,
      objectUrl = "";
    setError("");
    setUrl("");
    void (async () => {
      const { canvas } = await renderDoc(phoneScreenContent(doc), {
        multiplier,
      });
      try {
        const blob = await canvasToBlob(canvas, "image/png");
        if (alive) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      } finally {
        canvas.width = canvas.height = 0;
      }
    })().catch((e) => {
      if (alive) setError(e instanceof Error ? e.message : "高清预览加载失败");
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc, multiplier, attempt]);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: el.clientWidth, height: el.clientHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewportElement]);
  useLayoutEffect(() => {
    if (!fit || !size.width || !size.height) return;
    const next = Math.min(
      (size.width - 24) / width,
      (size.height - 24) / height,
      1,
    );
    zoomRef.current = Math.max(0.01, next);
    setZoom(zoomRef.current);
    position.current = { left: 0, top: 0 };
  }, [size, fit, width, height]);
  useLayoutEffect(() => {
    if (position.current && viewport.current) {
      viewport.current.scrollTo(position.current);
      position.current = null;
    }
  }, [zoom, size]);

  function zoomAt(value: number, clientX?: number, clientY?: number) {
    const el = viewport.current;
    if (!el) return;
    const next = Math.max(0.01, Math.min(8, value)),
      old = zoomRef.current;
    const rect = el.getBoundingClientRect();
    const x = clientX === undefined ? el.clientWidth / 2 : clientX - rect.left;
    const y = clientY === undefined ? el.clientHeight / 2 : clientY - rect.top;
    const rx =
      (el.scrollLeft + x - Math.max(0, (el.clientWidth - width * old) / 2)) /
      (width * old);
    const ry =
      (el.scrollTop + y - Math.max(0, (el.clientHeight - height * old) / 2)) /
      (height * old);
    position.current = {
      left: Math.max(
        0,
        rx * width * next +
          Math.max(0, (el.clientWidth - width * next) / 2) -
          x,
      ),
      top: Math.max(
        0,
        ry * height * next +
          Math.max(0, (el.clientHeight - height * next) / 2) -
          y,
      ),
    };
    zoomRef.current = next;
    setFit(false);
    setZoom(next);
  }
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAtRef.current(
        zoomRef.current *
          Math.exp(-Math.max(-200, Math.min(200, e.deltaY)) * 0.003),
        e.clientX,
        e.clientY,
      );
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [viewportElement]);

  function startGesture() {
    const points = [...pointers.current.values()],
      el = viewport.current;
    if (!el) return;
    if (points.length === 1)
      pan.current = { ...points[0], left: el.scrollLeft, top: el.scrollTop };
    if (points.length === 2)
      pinch.current = {
        distance: Math.max(
          1,
          Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        ),
        zoom: zoomRef.current,
      };
  }
  function releasePointer(id: number) {
    pointers.current.delete(id);
    startGesture();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (returnFocus.current?.isConnected) returnFocus.current.focus();
        }}
        showCloseButton={false}
        className="flex h-[92dvh] w-[96vw] max-w-none flex-col gap-3 overflow-hidden p-3 sm:max-w-[1440px]"
      >
        <DialogHeader className="relative shrink-0 pr-10 text-left">
          <DialogTitle>
            {label ? `第 ${label} 张放大预览` : "放大预览"}
          </DialogTitle>
          <DialogDescription>
            {width} × {height} · 滚轮或双指缩放，拖动查看细节。
            {multiplier < 1 && "超大图片使用高清预览，导出仍保持原尺寸。"}
          </DialogDescription>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0"
              aria-label="关闭放大预览"
            >
              <X className="size-4" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label="缩小预览图"
            disabled={zoom <= 0.01}
            onClick={() => zoomAt(zoomRef.current / 1.25)}
          >
            <Minus className="size-4" />
          </Button>
          <output
            aria-label="预览缩放比例"
            className="min-w-14 text-center text-sm tabular-nums"
          >
            {Math.round(zoom * 100)}%
          </output>
          <Button
            size="icon"
            variant="outline"
            aria-label="放大预览图"
            disabled={zoom >= 8}
            onClick={() => zoomAt(zoomRef.current * 1.25)}
          >
            <Plus className="size-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => zoomAt(1)}>
            原图尺寸
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFit(true)}>
            <Expand className="mr-1 size-4" />
            适应窗口
          </Button>
        </div>
        <div
          ref={attachViewport}
          aria-label="放大预览画布"
          className="relative min-h-0 flex-1 touch-none overflow-auto overscroll-contain rounded border bg-muted/60 select-none"
          style={{ cursor: "grab" }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            e.currentTarget.setPointerCapture(e.pointerId);
            startGesture();
          }}
          onPointerMove={(e) => {
            if (!pointers.current.has(e.pointerId)) return;
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const points = [...pointers.current.values()];
            if (points.length === 2)
              zoomAt(
                (pinch.current.zoom *
                  Math.hypot(
                    points[0].x - points[1].x,
                    points[0].y - points[1].y,
                  )) /
                  pinch.current.distance,
                (points[0].x + points[1].x) / 2,
                (points[0].y + points[1].y) / 2,
              );
            else if (points.length === 1)
              e.currentTarget.scrollTo({
                left: pan.current.left - e.clientX + pan.current.x,
                top: pan.current.top - e.clientY + pan.current.y,
              });
          }}
          onPointerUp={(e) => releasePointer(e.pointerId)}
          onPointerCancel={(e) => releasePointer(e.pointerId)}
          onLostPointerCapture={(e) => releasePointer(e.pointerId)}
          onDoubleClick={(e) => {
            if (zoomRef.current > 1) setFit(true);
            else zoomAt(2, e.clientX, e.clientY);
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: Math.max(size.width, width * zoom),
              height: Math.max(size.height, height * zoom),
            }}
          >
            {url ? (
              <img
                src={url}
                alt="放大预览图"
                draggable={false}
                className="max-h-none max-w-none shrink-0 object-contain shadow"
                style={{ width: width * zoom, height: height * zoom }}
              />
            ) : error ? (
              <div role="alert" className="max-w-72 p-4 text-center text-sm">
                <p>{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  重新加载预览
                </Button>
              </div>
            ) : (
              <div role="status" className="flex items-center gap-2 text-sm">
                <LoaderCircle className="size-4 animate-spin" />
                正在加载高清预览
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
