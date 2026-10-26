import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { phoneModel } from "@/lib/phone/models";
import { settingsForModel, systemStyleLabel } from "@/lib/phone/profiles";
import { SYSTEM_STYLES, compatibleStyle } from "@/lib/phone/system-styles";
import { applyPhoneLayers, removePhoneLayers } from "@/lib/phone/layers";
import {
  analysePhoneBackground,
  suggestedPlacement,
  topPreview,
} from "@/lib/phone/fusion";
import {
  designKey,
  fusionWarnings,
  naturalBarRatio,
  phoneGeometry,
} from "@/lib/phone/fusion-metrics";
import type { PhoneSettings } from "@/lib/phone/schema";
import type { TemplateDoc } from "@/types/template";
export default function FusionPanel({
  doc,
  settings,
  onChange,
  onMode,
  onBusyChange,
}: {
  doc: TemplateDoc;
  settings: PhoneSettings;
  onChange: (s: PhoneSettings) => void;
  onMode?: (mode: "keep" | "overlay" | "prepend") => void;
  onBusyChange?: (b: boolean) => void;
}) {
  const key = designKey(removePhoneLayers(doc));
  const latest = useRef({ doc, settings, onChange, key });
  latest.current = { doc, settings, onChange, key };
  const alive = useRef(true),
    pending = useRef(false);
  const [enlarged, setEnlarged] = useState(false),
    [zoom, setZoom] = useState(1.5);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [failedKey, setFailedKey] = useState("");
  const [preview, setPreview] = useState<{
      original: string;
      result: string;
    } | null>(null),
    [original, setOriginal] = useState(false),
    [guides, setGuides] = useState(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function analyse(force = false) {
    if (pending.current) return;
    const source = latest.current;
    pending.current = true;
    setBusy(true);
    setError("");
    onBusyChange?.(true);
    try {
      const data = await analysePhoneBackground(source.doc, force);
      const current = latest.current;
      if (
        !alive.current ||
        current.key !== source.key ||
        !current.settings.fusion.enabled ||
        current.settings.rendering !== "natural"
      )
        return;
      current.onChange({
        ...current.settings,
        fusion: { ...current.settings.fusion, analysis: data },
      });
      setFailedKey("");
    } catch (e) {
      if (alive.current) {
        setFailedKey(source.key);
        setError(
          e instanceof Error ? e.message : "原图分析失败，请使用手动设置",
        );
      }
    } finally {
      pending.current = false;
      if (alive.current) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  }
  useEffect(() => {
    if (typeof ImageData === "undefined") return; // Non-canvas environments retain manual editing.
    if (
      settings.rendering === "natural" &&
      settings.fusion.enabled &&
      settings.fusion.analysis?.sourceKey !== key &&
      failedKey !== key &&
      !busy
    )
      void analyse();
  }, [
    key,
    settings.rendering,
    settings.fusion.enabled,
    settings.fusion.analysis?.sourceKey,
    failedKey,
    busy,
  ]);
  const result = useMemo(() => {
    try {
      return applyPhoneLayers(doc, settings);
    } catch {
      return null;
    }
  }, [doc, settings]);
  useEffect(() => {
    let active = true;
    if (!result || settings.rendering !== "natural") {
      setPreview(null);
      return;
    }
    if (typeof ImageData === "undefined") return;
    const timer = window.setTimeout(() => {
      topPreview(result, settings)
        .then((p) => {
          if (active) setPreview(p);
        })
        .catch(() => {
          if (active) setPreview(null);
        });
    }, 100);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [result, settings]);
  const fusion = settings.fusion,
    modern = settings.rendering === "natural",
    data = fusion.analysis;
  const warnings = fusionWarnings(settings);
  const choose = (mode: "keep" | "overlay" | "prepend") => onMode?.(mode);
  return (
    <section
      className="min-w-0 space-y-3 rounded-lg border p-3"
      aria-label="智能自然融合设置"
    >
      <h3 className="text-sm font-semibold">自然融合与系统样式</h3>
      <label className="flex items-center justify-between gap-2 text-xs">
        智能自然融合
        <Switch
          aria-label="智能自然融合"
          checked={modern && fusion.enabled}
          onCheckedChange={(enabled) => {
            const next = {
              ...settings,
              rendering: enabled ? ("natural" as const) : settings.rendering,
              fusion: { ...fusion, enabled },
            };
            onChange(enabled ? settingsForModel(next, next.modelId) : next);
          }}
        />
      </label>
      {!modern && (
        <p className="text-[11px] text-muted-foreground">
          旧版外观保持不变。开启后升级样式并自动分析原图，可撤销。
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        当前使用：{systemStyleLabel(settings)}
        {modern ? " · 自然布局" : " · 旧版布局"}
      </p>
      {modern && (
        <>
          <select
            aria-label="系统参考样式"
            className="h-9 w-full min-w-0 rounded border bg-background px-2 text-xs"
            value={settings.styleId}
            onChange={(e) => {
              const next = {
                ...settings,
                styleId: e.target.value as PhoneSettings["styleId"],
              };
              onChange(settingsForModel(next, next.modelId));
            }}
          >
            <option value="auto">按型号选择参考样式（非系统识别）</option>
            {SYSTEM_STYLES.filter((s) =>
              compatibleStyle(
                s.id,
                phoneModel(settings.modelId).system,
                settings.modelId,
              ),
            ).map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            系统版本、主题与地区可能影响外观；字体使用可用的本地替代字体。不会读取设备实际状态。
          </p>
          <label className="block space-y-1 text-xs">
            背景融合策略
            <select
              aria-label="背景融合策略"
              className="h-9 w-full rounded border bg-background px-2 text-xs"
              value={fusion.background}
              onChange={(e) =>
                onChange({
                  ...settings,
                  fusion: {
                    ...fusion,
                    background: e.target.value as typeof fusion.background,
                    locks: fusion.locks.filter((k) => k !== "background"),
                  },
                })
              }
            >
              <option value="auto">自动：匹配纯色／渐变，复杂背景保留</option>
              <option value="flat">匹配纯色背景</option>
              <option value="preserve">保留原图背景（检查旧内容重影）</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void analyse(true)}
            >
              {busy ? "正在分析原图…" : "重新自动适配"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                onChange({
                  ...settings,
                  fusion: { ...fusion, handling: "auto" },
                })
              }
            >
              自动判断处理方式
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              onChange({
                ...settings,
                scale: 100,
                offsetY: 0,
                insetX: 0,
                coverRatio: 0,
                customColor: null,
                fusion: {
                  ...fusion,
                  locks: [],
                  analysis: null,
                  background: "auto",
                },
              })
            }
          >
            恢复自动适配（清除手动锁定）
          </Button>
          {fusion.locks.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              已保留手动调整：
              {fusion.locks
                .map(
                  (k) =>
                    ({
                      color: "颜色",
                      background: "背景",
                      coverage: "覆盖高度",
                      geometry: "大小与位置",
                    })[k],
                )
                .join("、")}
              。更改时间、电量或 APP 不会重置这些调整。
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            替换范围受状态栏边界保护，不自动扩大到标题、按钮或正文；需要额外空间请选择顶部新增。
          </p>
          {data && (
            <p role="status" className="text-xs text-muted-foreground">
              顶部分析：
              {
                {
                  flat: "近似纯色",
                  gradient: "渐变",
                  complex: "图片／复杂背景",
                }[data.kind]
              }{" "}
              · 可信度
              {{ high: "较高", medium: "中等", low: "较低" }[data.confidence]}
              {data.suspectedOldBar
                ? " · 疑似已有状态内容"
                : " · 未确定原有状态栏"}
            </p>
          )}
          {data && !fusion.locks.includes("geometry") && (
            <p
              className="text-xs text-muted-foreground"
              data-testid="status-bar-sizing"
            >
              {data.geometry
                ? "已按模板原状态栏适配"
                : "未识别到清晰状态栏，使用紧凑比例"}
              {" · 高度 "}
              {Math.round(
                phoneGeometry(settings, removePhoneLayers(doc).canvas).bar,
              )}{" "}
              px
              {" · 时间与图标同步缩放"}
            </p>
          )}
          {fusion.handling === "auto" && (
            <div className="space-y-2 rounded border bg-muted/30 p-2 text-xs">
              <p>
                {!data
                  ? "分析完成后，请确认处理方式。"
                  : suggestedPlacement(data) === "overlay"
                    ? "建议覆盖原状态栏；请先查看局部预览再确认。"
                    : suggestedPlacement(data) === "prepend"
                      ? "未确定原有状态栏，建议添加顶部区域；此操作会增加高度。"
                      : "无法可靠确定处理方式，请选择。"}
              </p>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["overlay", "确认覆盖"],
                    ["prepend", "确认添加"],
                    ["keep", "保留原图"],
                  ] as const
                ).map(([mode, label]) => (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    key={mode}
                    onClick={() => choose(mode)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {preview && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={original ? "secondary" : "ghost"}
                  onClick={() => setOriginal(true)}
                >
                  查看原图
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!original ? "secondary" : "ghost"}
                  onClick={() => setOriginal(false)}
                >
                  查看融合效果
                </Button>
              </div>
              <div className="relative overflow-hidden rounded border bg-muted">
                <img
                  className="block w-full"
                  alt={original ? "原图顶部放大" : "融合状态栏顶部放大"}
                  src={original ? preview.original : preview.result}
                />
                {guides && !original && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[4%] right-[4%] top-0 border-x border-b border-dashed border-primary"
                    style={{
                      height: `${Math.min(100, (naturalBarRatio(settings, removePhoneLayers(doc).canvas) / 0.16) * 100)}%`,
                    }}
                  />
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEnlarged(true)}
              >
                放大检查顶部
              </Button>
              <Dialog open={enlarged} onOpenChange={setEnlarged}>
                <DialogContent className="max-w-[min(96vw,1100px)]">
                  <DialogHeader>
                    <DialogTitle>状态栏顶部放大对比</DialogTitle>
                    <DialogDescription>
                      可横向滚动查看两侧细节，辅助线不进入导出。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setOriginal((v) => !v)}
                    >
                      {original ? "切换为融合效果" : "切换为原图"}
                    </Button>
                    <label className="flex items-center gap-2 text-xs">
                      放大 {zoom}×
                      <input
                        aria-label="顶部预览放大倍率"
                        type="range"
                        min={1}
                        max={3}
                        step={0.5}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <div className="max-h-[60vh] overflow-auto rounded border bg-muted">
                    <img
                      alt={original ? "原图顶部细节" : "融合顶部细节"}
                      src={original ? preview.original : preview.result}
                      style={{ width: 720 * zoom, maxWidth: "none" }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
              <label className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={guides}
                  onChange={(e) => setGuides(e.target.checked)}
                />
                显示覆盖及安全区域辅助线（仅编辑预览）
              </label>
            </div>
          )}
          <label className="block text-xs">
            自定义 APP 颜色
            <select
              aria-label="自定义 APP 颜色"
              className="mt-1 h-9 w-full rounded border bg-background px-2 text-xs"
              value={settings.customAppStyle}
              onChange={(e) =>
                onChange({
                  ...settings,
                  customAppStyle: e.target
                    .value as PhoneSettings["customAppStyle"],
                })
              }
            >
              <option value="original">保留上传颜色</option>
              <option value="mono">
                按透明度染为状态栏颜色（推荐透明 PNG）
              </option>
            </select>
          </label>
        </>
      )}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">
          布局兼容选项
        </summary>
        <select
          aria-label="状态栏布局版本"
          className="mt-2 h-9 w-full rounded border bg-background px-2 text-xs"
          value={settings.rendering}
          onChange={(e) =>
            onChange({
              ...settings,
              rendering: e.target.value as PhoneSettings["rendering"],
              fusion: { ...fusion, enabled: e.target.value === "natural" },
            })
          }
        >
          <option value="natural">自然布局</option>
          <option value="legacy">旧版参考布局</option>
        </select>
      </details>
      {error && (
        <p role="status" className="text-xs text-destructive">
          {error}。原图保持不变，可改用手动配色或背景修复。
        </p>
      )}
      {warnings.map((w) => (
        <p key={w} className="text-[11px] text-amber-800 dark:text-amber-300">
          {w}
        </p>
      ))}
    </section>
  );
}
