import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ImageOff } from "lucide-react";
import { useEditor } from "@/stores/editor.ts";
import { updateLayer, updateLayers } from "@/lib/template/doc-ops.ts";
import { CanvasController } from "../_lib/canvas-controller.ts";
import { handleDrawnBox } from "../_lib/actions.ts";

export type StageApi = { fit: () => void };

export default function CanvasStage({
  onReady,
}: {
  onReady: (api: StageApi) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef<CanvasController | null>(null);
  const doc = useEditor((s) => s.doc);
  const selectedIds = useEditor((s) => s.selectedIds);
  const zoom = useEditor((s) => s.zoom);
  const tool = useEditor((s) => s.tool);
  const locating = useEditor((s) => s.leftPanel === "status-location");
  const [overflow, setOverflow] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);

  // Create the Fabric canvas once.
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctrl = new CanvasController(canvasRef.current, {
      onSelect: (ids) => useEditor.getState().select(ids),
      onModify: (patches) => {
        const { doc: d, commit } = useEditor.getState();
        if (d) commit(updateLayers(d, patches));
      },
      onTextEdited: (id, text) => {
        const { doc: d, commit } = useEditor.getState();
        if (d) commit(updateLayer(d, id, { text }));
      },
      onDraw: (box) => {
        const textId = handleDrawnBox(box);
        if (textId) setTimeout(() => ctrlRef.current?.editText(textId), 120);
      },
      onOverflow: setOverflow,
      onMissing: setMissing,
    });
    ctrlRef.current = ctrl;
    return () => {
      ctrl.dispose();
      ctrlRef.current = null;
    };
  }, []);

  // Fit-to-screen helper exposed to the toolbar.
  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current;
      const d = useEditor.getState().doc;
      if (!el || !d) return;
      const pad = 48;
      const z = Math.min(
        (el.clientWidth - pad) / d.canvas.width,
        (el.clientHeight - pad) / d.canvas.height,
      );
      useEditor.getState().setZoom(Math.max(0.05, Math.min(2, z)));
    };
    onReady({ fit });
    fit();
    // Only on mount: later fits are user-triggered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.templateId]);

  useEffect(() => {
    if (ctrlRef.current && doc) ctrlRef.current.setViewport(doc, zoom);
  }, [doc?.canvas.width, doc?.canvas.height, zoom, doc]);

  useEffect(() => {
    if (ctrlRef.current && doc)
      void ctrlRef.current.sync(doc, useEditor.getState().selectedIds);
  }, [doc]);

  useEffect(() => {
    ctrlRef.current?.applySelection(selectedIds);
  }, [selectedIds]);

  useEffect(() => {
    ctrlRef.current?.setDrawMode(tool !== "select");
  }, [tool]);

  // Ctrl + wheel zoom.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const { zoom: z, setZoom } = useEditor.getState();
      setZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const names = (ids: string[]) =>
    ids
      .map((id) => doc?.layers.find((l) => l.id === id)?.name)
      .filter(Boolean)
      .join("、");

  const toolHint: Record<string, string> = {
    "draw-text": "在画布上拖拽框出文字区域",
    "draw-image": "在画布上拖拽框出图片区域",
    "draw-mask": "拖拽框出需要遮盖的原图文字",
    "draw-rect": "拖拽绘制矩形",
    "draw-ocr": "拖拽框出要识别的文字区域",
  };

  return (
    <div
      ref={wrapRef}
      className="relative flex-1 overflow-auto bg-[radial-gradient(circle,oklch(0.5_0_0/0.14)_1px,transparent_1px)] [background-size:18px_18px]"
      onMouseDown={(e) => {
        if (e.target === wrapRef.current) useEditor.getState().select([]);
      }}
    >
      <div
        className="flex min-h-full min-w-full items-center justify-center p-6"
        style={{
          width: "max-content",
          height: "max-content",
          minWidth: "100%",
          minHeight: "100%",
        }}
      >
        <div
          className="relative shadow-[0_10px_40px_-10px_rgba(0,0,0,0.35)] [&_.canvas-container]:touch-none"
          style={{
            backgroundImage:
              "repeating-conic-gradient(#e6e6e6 0 25%, #fff 0 50%)",
            backgroundSize: "16px 16px",
          }}
        >
          <canvas ref={canvasRef} />
          {locating &&
            doc?.statusLocation &&
            doc.statusLocation.state !== "skipped" && (
              <svg
                className="pointer-events-none absolute inset-0"
                width={doc.canvas.width * zoom}
                height={doc.canvas.height * zoom}
                viewBox={`0 0 ${doc.canvas.width} ${doc.canvas.height}`}
                aria-label="状态栏候选框"
              >
                {[
                  doc.statusLocation.bounds,
                  doc.statusLocation.time,
                  doc.statusLocation.apps,
                  doc.statusLocation.system,
                  ...doc.statusLocation.protected,
                ].map(
                  (r, i) =>
                    r && (
                      <rect
                        key={i}
                        x={r.x * doc.canvas.width}
                        y={
                          r.y *
                            (doc.canvas.height -
                              (doc.phone?.addedHeight ?? 0)) +
                          (doc.phone?.addedHeight ?? 0)
                        }
                        width={r.width * doc.canvas.width}
                        height={
                          r.height *
                          (doc.canvas.height - (doc.phone?.addedHeight ?? 0))
                        }
                        fill="none"
                        stroke={
                          i === 0 ? "#ef4444" : i >= 4 ? "#d97706" : "#2563eb"
                        }
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray={i === 0 ? "5 3" : undefined}
                      />
                    ),
                )}
              </svg>
            )}
        </div>
      </div>
      {tool !== "select" && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-foreground px-4 py-1.5 text-xs text-background shadow">
          {toolHint[tool]} · 按 Esc 取消
        </div>
      )}
      {(overflow.length > 0 || missing.length > 0) && (
        <div className="absolute bottom-3 left-3 flex max-w-md flex-col gap-1">
          {overflow.length > 0 && (
            <p className="flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-xs text-amber-900 shadow dark:bg-amber-900/70 dark:text-amber-100">
              <AlertTriangle className="size-3.5 shrink-0" /> 文字超出文本框：
              {names(overflow)}
            </p>
          )}
          {missing.length > 0 && (
            <p className="flex items-center gap-1.5 rounded-md bg-red-100 px-2.5 py-1 text-xs text-red-900 shadow dark:bg-red-900/70 dark:text-red-100">
              <ImageOff className="size-3.5 shrink-0" /> 图片加载失败：
              {names(missing)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
