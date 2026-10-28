import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { TemplateDoc } from "@/types/template";
import {
  defaultStatusLocation,
  locationSourceKey,
  locationState,
  locationStatusLabels,
} from "@/lib/status-location/model";
import {
  LOCATION_ROLES,
  type LocationRect,
  type StatusLocation,
} from "@/lib/status-location/schema";
import {
  locationSnapshot,
  proposeStatusLocation,
  testStatusLocation,
  confirmStatusLocation,
  type LocationTestResult,
} from "@/lib/status-location/engine";
const names = {
  bounds: "外框",
  time: "时间",
  apps: "APP",
  system: "系统图标",
  date: "日期",
  carrier: "运营商",
} as const;
type Target = keyof typeof names | `protected-${number}`;
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export default function StatusLocationControl({
  doc,
  onChange,
  disabled = false,
}: {
  doc: TemplateDoc;
  onChange: (location: StatusLocation) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const latest = useRef(doc);
  latest.current = doc;
  const state = locationState(doc);
  return (
    <section
      className="space-y-2 rounded-lg border p-3"
      aria-label="模板状态栏定位"
    >
      <p className="text-sm font-medium">
        状态栏定位 ·{" "}
        <span data-testid="status-location-state">
          {locationStatusLabels[state]}
        </span>
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        模板只框选状态栏外框。内部位置由具体手机型号与系统版本决定，外框之外保持原图。
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          {state === "confirmed" ? "调整状态栏定位" : "定位原状态栏"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() =>
            onChange({ ...defaultStatusLocation(doc), state: "skipped" })
          }
        >
          不设置状态栏
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>模板状态栏定位</DialogTitle>
            <DialogDescription>
              自动框选或手动调整后可直接确认保存。测试替换仅用于查看效果，不影响确认。
            </DialogDescription>
          </DialogHeader>
          {open && (
            <LocationBody
              doc={doc}
              onConfirm={(location) => {
                if (
                  location.approval !== "direct" &&
                  location.sourceKey !==
                    locationSourceKey(latest.current, location.bounds)
                ) {
                  setError("原图已变化，请重新打开定位并测试");
                  throw new Error("原图已变化，请重新定位");
                }
                onChange(location);
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
function LocationBody({
  doc,
  onConfirm,
}: {
  doc: TemplateDoc;
  onConfirm: (location: StatusLocation) => void;
}) {
  const [source] = useState(doc),
    [draft, setDraft] = useState<StatusLocation>(() => ({
      ...structuredClone(doc.statusLocation ?? defaultStatusLocation(doc)),
      layout: "device",
      protected: [],
    }));
  const [image, setImage] = useState(""),
    [target, setTarget] = useState<Target>("bounds"),
    [mode, setMode] = useState<"move" | "draw">("move");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [zoom, setZoom] = useState(1),
    [effect, setEffect] = useState(false);
  const [result, setResult] = useState<LocationTestResult | null>(null),
    [past, setPast] = useState<StatusLocation[]>([]),
    [future, setFuture] = useState<StatusLocation[]>([]);
  const alive = useRef(true);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    start: { x: number; y: number };
    rect: LocationRect;
    draft: StatusLocation;
    handle: string;
    target: Target;
  } | null>(null);
  const W = source.canvas.width,
    H = source.canvas.height - (source.phone?.addedHeight ?? 0);
  function change(next: StatusLocation, history = true) {
    if (history) {
      setPast((p) => [...p, draft].slice(-50));
      setFuture([]);
    }
    setDraft({ ...next, state: "pending", fills: [], testKey: "" });
    setResult(null);
    setEffect(false);
    setError("");
  }
  useEffect(() => {
    alive.current = true;
    void locationSnapshot(source)
      .then(({ canvas }) => {
        if (alive.current) setImage(canvas.toDataURL("image/png"));
        canvas.width = canvas.height = 0;
      })
      .catch((e) => alive.current && setError(e.message));
    return () => {
      alive.current = false;
    };
  }, [source]);
  const selected = (l: StatusLocation, t: Target): LocationRect | null =>
    t.startsWith("protected-")
      ? (l.protected[Number(t.split("-")[1])] ?? null)
      : l[t as keyof typeof names];
  function updated(
    l: StatusLocation,
    t: Target,
    r: LocationRect,
  ): StatusLocation {
    if (t.startsWith("protected-")) {
      const p = [...l.protected];
      p[Number(t.split("-")[1])] = r;
      return { ...l, protected: p };
    }
    if (t === "bounds") {
      const old = l.bounds,
        next = { ...l, bounds: r };
      for (const role of LOCATION_ROLES) {
        const q = l[role];
        if (q)
          next[role] = {
            x: r.x + ((q.x - old.x) / old.width) * r.width,
            y: r.y + ((q.y - old.y) / old.height) * r.height,
            width: (q.width / old.width) * r.width,
            height: (q.height / old.height) * r.height,
          };
      }
      return next;
    }
    return { ...l, [t]: r };
  }
  useEffect(() => {
    if (!source.statusLocation && source.source) void automatic();
    // One proposal per opened source, never move a confirmed box during ordinary editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);
  const active = selected(draft, target);
  const point = (e: PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp((e.clientX - b.left) / b.width, 0, 1),
      y: clamp((e.clientY - b.top) / b.height, 0, 1),
    };
  };
  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (busy || effect || !active) return;
    const handle = (e.target as Element).getAttribute("data-handle");
    if (mode === "move" && !handle) return;
    drag.current = {
      start: point(e),
      rect: active,
      draft: structuredClone(draft),
      handle: mode === "draw" ? "draw" : (handle ?? "move"),
      target,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = point(e),
      dx = p.x - d.start.x,
      dy = p.y - d.start.y;
    let r = { ...d.rect };
    if (d.handle === "move") {
      r.x = clamp(r.x + dx, 0, 1 - r.width);
      r.y = clamp(r.y + dy, 0, 1 - r.height);
    } else {
      let left = r.x,
        top = r.y,
        right = r.x + r.width,
        bottom = r.y + r.height;
      if (d.handle === "draw") {
        left = Math.min(d.start.x, p.x);
        right = Math.max(d.start.x, p.x);
        top = Math.min(d.start.y, p.y);
        bottom = Math.max(d.start.y, p.y);
      } else {
        if (d.handle.includes("w")) left = clamp(left + dx, 0, right - 1 / W);
        if (d.handle.includes("e")) right = clamp(right + dx, left + 1 / W, 1);
        if (d.handle.includes("n")) top = clamp(top + dy, 0, bottom - 1 / H);
        if (d.handle.includes("s")) bottom = clamp(bottom + dy, top + 1 / H, 1);
      }
      r = {
        x: left,
        y: top,
        width: Math.max(1 / W, right - left),
        height: Math.max(1 / H, bottom - top),
      };
    }
    change(updated(d.draft, d.target, r), false);
  };
  const end = () => {
    const d = drag.current;
    if (d) {
      setPast((p) => [...p, d.draft].slice(-50));
      setFuture([]);
      drag.current = null;
    }
  };
  async function automatic() {
    setBusy(true);
    setError("");
    try {
      const found = await proposeStatusLocation(source);
      if (!alive.current) return;
      if (!found)
        throw new Error("未找到可靠候选，请手动框选；不会自动在顶部添加状态栏");
      change(found);
      setTarget("bounds");
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "定位失败");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const next = await testStatusLocation(source, draft);
      if (alive.current) {
        setResult(next);
        setEffect(true);
      }
    } catch (e) {
      if (alive.current)
        setError(
          `预览暂不可用，仍可直接确认保存。${e instanceof Error ? e.message : ""}`,
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const location = await confirmStatusLocation(source, draft);
      if (alive.current) onConfirm(location);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function undo() {
    const next = past[past.length - 1];
    if (next) {
      setPast((p) => p.slice(0, -1));
      setFuture((p) => [draft, ...p]);
      setDraft(next);
      setResult(null);
      setEffect(false);
    }
  }
  function redo() {
    const next = future[0];
    if (next) {
      setFuture((p) => p.slice(1));
      setPast((p) => [...p, draft]);
      setDraft(next);
      setResult(null);
      setEffect(false);
    }
  }
  const all: [Target, LocationRect][] = [["bounds", draft.bounds]];
  return (
    <div
      onKeyDownCapture={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) redo();
          else undo();
        }
      }}
    >
      <fieldset
        disabled={busy}
        className="min-w-0 space-y-3 disabled:opacity-60"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void automatic()}
          >
            {busy ? "正在处理…" : "自动定位"}
          </Button>
          <Button
            size="sm"
            variant={mode === "draw" ? "default" : "outline"}
            onClick={() => {
              setMode("draw");
              setEffect(false);
            }}
          >
            手动框选
          </Button>
          <Button
            size="sm"
            variant={mode === "move" ? "default" : "outline"}
            onClick={() => setMode("move")}
          >
            移动／调整边界
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!past.length}
            onClick={undo}
          >
            撤销定位
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!future.length}
            onClick={redo}
          >
            重做定位
          </Button>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button
                size="sm"
                variant={!effect ? "secondary" : "ghost"}
                onClick={() => setEffect(false)}
              >
                查看原图
              </Button>
              <Button
                size="sm"
                variant={effect ? "secondary" : "ghost"}
                disabled={!result}
                onClick={() => setEffect(true)}
              >
                查看测试效果
              </Button>
              <label className="flex items-center gap-2">
                放大
                <Input
                  aria-label="定位放大倍数"
                  type="range"
                  min={1}
                  max={3}
                  step={0.5}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
                {zoom}×
              </label>
            </div>
            <div
              className="max-h-[58dvh] overflow-auto rounded border bg-muted/20"
              data-testid="status-location-image"
            >
              {image ? (
                <svg
                  ref={svg}
                  role="img"
                  aria-label="状态栏定位原图"
                  viewBox={`0 0 ${W} ${H}`}
                  style={{
                    width: `${zoom * 100}%`,
                    maxWidth: "none",
                    touchAction: "none",
                    height: "auto",
                    display: "block",
                  }}
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={end}
                >
                  <image
                    href={effect && result ? result.result : image}
                    x={0}
                    y={0}
                    width={W}
                    height={H}
                  />
                  {!effect &&
                    all.map(([t, r]) => (
                      <rect
                        key={t}
                        x={r.x * W}
                        y={r.y * H}
                        width={r.width * W}
                        height={r.height * H}
                        fill={t === target ? "transparent" : "none"}
                        stroke={
                          t.startsWith("protected-")
                            ? "#d97706"
                            : t === "bounds"
                              ? "#ef4444"
                              : "#2563eb"
                        }
                        strokeWidth={t === target ? 2 : 1}
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray={t === "bounds" ? "5 3" : undefined}
                        data-handle={t === target ? "move" : undefined}
                        onClick={() => {
                          setTarget(t);
                        }}
                      />
                    ))}
                  {!effect &&
                    active &&
                    ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map(
                      (handle) => {
                        const x = handle.includes("w")
                            ? active.x
                            : handle.includes("e")
                              ? active.x + active.width
                              : active.x + active.width / 2,
                          y = handle.includes("n")
                            ? active.y
                            : handle.includes("s")
                              ? active.y + active.height
                              : active.y + active.height / 2;
                        return (
                          <rect
                            key={handle}
                            x={x * W - 4 / zoom}
                            y={y * H - 4 / zoom}
                            width={8 / zoom}
                            height={8 / zoom}
                            fill="white"
                            stroke="#2563eb"
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                            data-handle={handle}
                          />
                        );
                      },
                    )}
                </svg>
              ) : (
                <p className="p-6 text-sm">正在载入原图…</p>
              )}
            </div>
          </div>
          <div className="min-w-0 space-y-3 text-xs">
            <p className="rounded border bg-muted/40 p-2 leading-relaxed">
              只框选状态栏外框。时间、APP、信号和电池的位置由作图时选择的具体手机型号及系统版本自动决定，外框内旧内容会整体替换。
            </p>
            {active && (
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "width", "height"] as const).map((key) => (
                  <label key={key} className="space-y-1">
                    {key === "x"
                      ? "X"
                      : key === "y"
                        ? "Y"
                        : key === "width"
                          ? "宽度"
                          : "高度"}{" "}
                    px
                    <Input
                      aria-label={`定位区域${key === "x" ? " X" : key === "y" ? " Y" : key === "width" ? "宽度" : "高度"}`}
                      type="number"
                      min={key === "x" || key === "y" ? 0 : 1}
                      max={key === "x" || key === "width" ? W : H}
                      value={
                        Math.round(
                          active[key] *
                            (key === "x" || key === "width" ? W : H) *
                            100,
                        ) / 100
                      }
                      onChange={(e) => {
                        if (e.target.value === "") return;
                        const dimension =
                          key === "x" || key === "width" ? W : H;
                        const n = Number(e.target.value) / dimension;
                        const r = {
                          ...active,
                          [key]: clamp(
                            n,
                            key === "width"
                              ? 1 / W
                              : key === "height"
                                ? 1 / H
                                : 0,
                            1,
                          ),
                        };
                        if (r.x + r.width > 1) r.x = 1 - r.width;
                        if (r.y + r.height > 1) r.y = 1 - r.height;
                        change(updated(draft, target, r));
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
            <label className="block space-y-1">
              旧内容背景处理
              <select
                aria-label="定位背景处理"
                className="h-9 w-full rounded border bg-background px-2"
                value={draft.background}
                onChange={(e) =>
                  change({
                    ...draft,
                    background: e.target.value as "auto" | "solid",
                  })
                }
              >
                <option value="auto">自动：纯色／简单渐变</option>
                <option value="solid">手动指定纯色（明确替换区域背景）</option>
              </select>
            </label>
            {draft.background === "solid" && (
              <label className="flex items-center justify-between">
                替换底色
                <Input
                  aria-label="定位替换底色"
                  type="color"
                  className="w-16"
                  value={draft.color}
                  onChange={(e) => change({ ...draft, color: e.target.value })}
                />
              </label>
            )}
            <p className="leading-relaxed text-muted-foreground">
              红框是唯一替换范围，蓝色手柄用于调整边界。内部布局由型号与版本决定，框外保持原图。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void test()} disabled={!image}>
            {busy ? "正在测试…" : "测试替换"}
          </Button>
          <Button variant="secondary" onClick={() => void save()}>
            确认并保存定位
          </Button>
        </div>
        {result && (
          <p role="status" className="text-sm text-emerald-700">
            预览已生成：外框外 {result.outside}{" "}
            个像素变化，仅供参考。可直接确认保存。
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </fieldset>
    </div>
  );
}
