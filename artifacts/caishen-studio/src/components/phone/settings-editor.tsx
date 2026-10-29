import { adjustInkTone } from "@/lib/status-location/source-fit";
import {
  clockFontForSettings,
  numericAdvance,
  numericSvg,
} from "@/lib/phone/numeric-font";
import { applyLocationToWork } from "@/lib/status-location/apply";
import StatusLocationControl from "./status-location-control";
import {
  isLocationConfirmed,
  locationRenderKey,
  requireStatusLocation,
  locationAppCapacity,
} from "@/lib/status-location/model";
import { SYSTEM_STYLES, compatibleStyle } from "@/lib/phone/system-styles";
import { resolveFusionSettings } from "@/lib/phone/fusion-metrics";
import FusionPanel from "./fusion-panel";
import { FUSION_LOCKS } from "@/lib/phone/fusion-schema";
import { fitPhoneToImage } from "@/lib/phone/fusion";
import { uploadCoverRatio } from "@/lib/phone/upload-fit";
import AppIconsEditor from "@/components/phone/app-icons-editor";
import PhoneModelPicker from "@/components/phone/model-picker";
import { settingsForModel, maximumWifiLevel } from "@/lib/phone/profiles";
import { useEffect, useRef, useState } from "react";
import {
  Clock,
  RotateCcw,
  Smartphone,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { TemplateDoc } from "@/types/template";
import { phoneModel } from "@/lib/phone/models";
import {
  PHONE_NETWORKS,
  phoneSettingsSchema,
  type PhoneSettings,
} from "@/lib/phone/schema";
import {
  applyPhoneLayers as applyPhoneLayersCore,
  defaultPhoneSettings,
  naturalPhoneSettings,
  phoneColor,
  phoneDate,
  phoneTime,
  removePhoneLayers,
  statusIconsSvg,
} from "@/lib/phone/layers";
import { matchPatch, sampleStatusBar } from "@/lib/phone/match";
import { renderDoc } from "@/lib/canvas/render";
import { resizeDoc } from "@/lib/template/smart-resize";
import {
  Field,
  Section,
  Segmented,
  selectClass,
  SliderRow,
  SwitchRow,
} from "@/pages/editor/_components/panels/phone-controls";

const applyPhoneLayers = (doc: TemplateDoc, settings: PhoneSettings) =>
  applyPhoneLayersCore(
    settings.rendering === "natural" &&
      settings.fusion.enabled &&
      settings.placement === "overlay"
      ? requireStatusLocation(doc)
      : doc,
    settings,
  );

const LOOKS = [
  {
    id: "light",
    label: "浅底黑字",
    patch: {
      theme: "dark",
      backgroundColor: "#ffffff",
      transparent: false,
      customColor: null,
    },
  },
  {
    id: "gray",
    label: "灰底黑字",
    patch: {
      theme: "dark",
      backgroundColor: "#f5f5f5",
      transparent: false,
      customColor: null,
    },
  },
  {
    id: "dark",
    label: "深底白字",
    patch: {
      theme: "light",
      backgroundColor: "#111111",
      transparent: false,
      customColor: null,
    },
  },
  {
    id: "clearDark",
    label: "透明·黑字",
    patch: { theme: "dark", transparent: true, customColor: null },
  },
  {
    id: "clearLight",
    label: "透明·白字",
    patch: { theme: "light", transparent: true, customColor: null },
  },
] as const satisfies readonly {
  id: string;
  label: string;
  patch: Partial<PhoneSettings>;
}[];

const EXTRA_ICONS = [
  ["location", "定位"],
  ["alarm", "闹钟"],
  ["mute", "静音"],
  ["dnd", "勿扰 / 专注"],
  ["bluetooth", "蓝牙"],
  ["vpn", "VPN"],
  ["hd", "HD 高清通话"],
  ["dualSim", "双卡信号"],
] as const satisfies readonly (readonly [keyof PhoneSettings, string])[];

function today() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
}

export default function PhoneSettingsEditor({
  doc,
  onApply,
  scopeKey,
  onBusyChange,
  advancedOnly = false,
  onStatusLocationChange,
}: {
  doc: TemplateDoc;
  onApply: (next: TemplateDoc, options?: { coalesceKey?: string }) => void;
  scopeKey: string;
  onBusyChange?: (busy: boolean) => void;
  advancedOnly?: boolean;
  onStatusLocationChange?: (
    location: NonNullable<TemplateDoc["statusLocation"]>,
  ) => void;
}) {
  const alive = useRef(true);
  const latest = useRef({ doc, scopeKey });
  latest.current = { doc, scopeKey };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const edit = (
    fn: (current: TemplateDoc) => TemplateDoc,
    options?: { coalesceKey?: string },
  ) => onApply(fn(doc), options);
  const [draft, setDraft] = useState<PhoneSettings>(
    () => doc?.phone ?? naturalPhoneSettings(),
  );
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const [resize, setResize] = useState(false);
  const [error, setError] = useState("");
  const [matching, setMatching] = useState(false);
  // Reset the draft when the document's saved phone settings change (undo, load…).
  const [syncedPhone, setSyncedPhone] = useState(doc?.phone);
  if (syncedPhone !== doc?.phone) {
    setSyncedPhone(doc?.phone);
    setDraft(doc?.phone ?? naturalPhoneSettings());
    setError("");
  }
  useEffect(() => {
    if (
      !doc?.phone ||
      doc.phone.rendering !== "natural" ||
      !doc.phone.fusion.enabled ||
      doc.phone.placement !== "overlay" ||
      !isLocationConfirmed(doc) ||
      doc.phone.locationKey === locationRenderKey(doc)
    )
      return;
    try {
      onApply(
        applyPhoneLayersCore(doc, {
          ...doc.phone,
          rendering: "natural",
          fusion: { ...doc.phone.fusion, enabled: true },
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "请调整状态栏设置后重新应用");
    }
  }, [doc, onApply]);
  if (!doc) return null;
  const applied = Boolean(doc.phone);
  const model = phoneModel(draft.modelId);
  const valid = phoneSettingsSchema.safeParse(draft);

  /** Once the bar exists, every change shows on the canvas immediately (one undo step per burst). */
  function update(patch: Partial<PhoneSettings>) {
    const locks = new Set(draft.fusion.locks);
    if (draft.fusion.enabled && !patch.fusion) {
      if (["theme", "customColor"].some((k) => k in patch)) locks.add("color");
      if (["backgroundColor", "transparent"].some((k) => k in patch))
        locks.add("background");
      if ("coverRatio" in patch) locks.add("coverage");
      if (["scale", "offsetY", "insetX"].some((k) => k in patch))
        locks.add("geometry");
    }
    const next = {
      ...draft,
      ...patch,
      fusion: patch.fusion ?? { ...draft.fusion, locks: [...locks] },
    };
    setDraft(next);
    setError("");
    if (!applied) return;
    const checked = phoneSettingsSchema.safeParse(next);
    if (!checked.success) return;
    try {
      edit((current) => applyPhoneLayers(current, checked.data), {
        coalesceKey: "phone-live",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法应用设置");
    }
  }
  const set = <K extends keyof PhoneSettings>(
    key: K,
    value: PhoneSettings[K],
  ) => update({ [key]: value } as Pick<PhoneSettings, K>);

  function apply() {
    const checked = phoneSettingsSchema.safeParse(draft);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? "请检查设置");
      return;
    }
    try {
      if (
        resize &&
        draft.rendering === "natural" &&
        draft.placement === "overlay"
      ) {
        const resized = resizeDoc(doc, model.width, model.height, "smart");
        if (!isLocationConfirmed(resized)) {
          onApply({
            ...removePhoneLayers(resized),
            phone: { ...checked.data, addedHeight: 0, placement: "overlay" },
          });
          setError("画布尺寸已调整，请重新确认状态栏定位后再替换");
          return;
        }
      }
      edit((current) =>
        applyPhoneLayers(
          resize
            ? resizeDoc(current, model.width, model.height, "smart")
            : current,
          checked.data,
        ),
      );

      toast.success(
        applied ? "已更新手机状态栏" : "手机状态栏已应用，后续修改会实时显示",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法应用设置");
    }
  }

  async function autoMatch() {
    if (!doc) return;
    setMatching(true);
    onBusyChange?.(true);
    try {
      if (draft.rendering === "natural") {
        const next = await fitPhoneToImage(doc, {
          ...draft,
          fusion: {
            ...draft.fusion,
            locks: draft.fusion.locks.filter(
              (k) => k !== "color" && k !== "background" && k !== "coverage",
            ),
          },
        });
        if (
          alive.current &&
          latest.current.doc === doc &&
          latestDraft.current === draft
        ) {
          update(next.phone!);
          toast.success("已根据原图重新匹配，请检查顶部放大预览");
        }
        return;
      }
      const base = removePhoneLayers(doc);
      const W = base.canvas.width;
      const H = base.canvas.height;
      const s = Math.min(W / model.points, H / (model.bar + 40));
      const sample = await sampleStatusBar(
        async () =>
          (await renderDoc(base, { multiplier: Math.min(1, 400 / W) })).canvas,
        (model.bar * s) / H,
      );
      if (
        !alive.current ||
        latest.current.scopeKey !== scopeKey ||
        latest.current.doc !== doc ||
        latestDraft.current !== draft
      )
        return;
      if (!sample) {
        toast.error("无法读取画面颜色，请手动选择配色");
        return;
      }
      update({
        ...matchPatch(sample),
        ...(base.source && draft.placement === "overlay"
          ? {
              transparent: false,
              coverRatio: uploadCoverRatio(
                {
                  width: base.source.originalWidth,
                  height: base.source.originalHeight,
                },
                base.canvas,
              ),
            }
          : {}),
      });
      toast.success(
        sample.uniform
          ? "已匹配原图背景色，并覆盖原有状态栏"
          : "顶部是图片，已改为透明状态栏并选择更清晰的图标颜色",
      );
    } catch {
      if (alive.current) toast.error("匹配失败，请手动选择配色");
    } finally {
      if (alive.current) {
        setMatching(false);
        onBusyChange?.(false);
      }
    }
  }

  function chooseMode(mode: "keep" | "overlay" | "prepend") {
    if (mode === "keep") {
      setDraft({ ...draft, fusion: { ...draft.fusion, handling: "manual" } });
      edit(removePhoneLayers);
      return;
    }
    const next = {
      ...draft,
      placement: mode,
      fusion: { ...draft.fusion, handling: "manual" as const },
    };
    setDraft(next);
    try {
      edit((current) => applyPhoneLayers(current, next));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法应用状态栏");
    }
  }
  const previewSettings = resolveFusionSettings(
    draft,
    removePhoneLayers(doc).canvas,
  );
  const iconColor =
    draft.rendering === "natural" &&
    doc.statusLocation?.background === "auto" &&
    doc.statusLocation?.sourceFit?.inkColor &&
    !draft.customColor &&
    !draft.fusion.locks.includes("color")
      ? adjustInkTone(
          doc.statusLocation.sourceFit.inkColor,
          draft.toneAdjustment,
        )
      : phoneColor(previewSettings);
  const previewBackground = doc.statusLocation
    ? doc.statusLocation.background === "solid"
      ? doc.statusLocation.color
      : (doc.statusLocation.fills[0]?.top ?? draft.backgroundColor)
    : draft.backgroundColor;
  const previewBottom =
    doc.statusLocation?.background === "auto"
      ? (doc.statusLocation.fills[0]?.bottom ?? previewBackground)
      : previewBackground;
  return (
    <div className="space-y-3 p-3">
      {!advancedOnly && (
        <>
          <label className="block space-y-1 text-xs">
            状态栏处理方式
            <select
              aria-label="状态栏处理方式"
              className={selectClass}
              value={
                draft.fusion.handling === "auto"
                  ? "auto"
                  : applied
                    ? draft.placement
                    : "keep"
              }
              onChange={(e) => {
                if (e.target.value === "auto") {
                  update({
                    rendering: "natural",
                    fusion: {
                      ...draft.fusion,
                      enabled: true,
                      handling: "auto",
                    },
                  });
                  return;
                }
                chooseMode(e.target.value as "keep" | "overlay" | "prepend");
              }}
            >
              <option value="auto">自动判断（分析后确认）</option>
              <option value="keep">保留原图（不生成新状态栏）</option>
              <option value="overlay">覆盖原图状态栏（保持尺寸）</option>
              <option value="prepend">添加状态栏（正文下移）</option>
            </select>
          </label>
          <p className="text-[11px] text-muted-foreground">
            当前导出尺寸 {doc.canvas.width} × {doc.canvas.height}
            ；移除状态栏可恢复原图内容。添加模式会增加高度，不拉伸正文。
          </p>
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <Smartphone className="size-4" />
              手机状态栏
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              给截图或设计稿加上逼真的手机顶部状态栏。仅用于展示，不读取设备真实状态。
            </p>
          </div>

          {draft.placement === "overlay" && draft.rendering === "natural" ? (
            <>
              <StatusLocationControl
                doc={doc}
                onChange={(location) => {
                  if (onStatusLocationChange) {
                    onStatusLocationChange(location);
                    return;
                  }
                  const current = applyLocationToWork(doc, location);
                  onApply(current);
                }}
              />
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  布局兼容选项
                </summary>
                <select
                  aria-label="状态栏布局版本"
                  className={selectClass}
                  value={draft.rendering}
                  onChange={(e) =>
                    update({
                      rendering: e.target.value as PhoneSettings["rendering"],
                      fusion: {
                        ...draft.fusion,
                        enabled: e.target.value === "natural",
                      },
                    })
                  }
                >
                  <option value="natural">自然布局</option>
                  <option value="legacy">旧版参考布局</option>
                </select>
              </details>
              <label className="block space-y-1 text-xs">
                自定义 APP 颜色
                <select
                  aria-label="自定义 APP 颜色"
                  className={selectClass}
                  value={draft.customAppStyle}
                  onChange={(e) =>
                    set(
                      "customAppStyle",
                      e.target.value as PhoneSettings["customAppStyle"],
                    )
                  }
                >
                  <option value="original">保留上传颜色</option>
                  <option value="mono">
                    按透明度染为状态栏颜色（推荐透明 PNG）
                  </option>
                </select>
              </label>
              {isLocationConfirmed(doc) && (
                <label className="block space-y-1 text-xs">
                  系统参考样式
                  <select
                    aria-label="系统参考样式"
                    className={selectClass}
                    value={draft.styleId}
                    onChange={(e) =>
                      update({
                        styleId: e.target.value as PhoneSettings["styleId"],
                      })
                    }
                  >
                    <option value="auto">跟随型号</option>
                    {SYSTEM_STYLES.filter((style) =>
                      compatibleStyle(
                        style.id,
                        phoneModel(draft.modelId).system,
                        draft.modelId,
                      ),
                    ).map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          ) : (
            <FusionPanel
              doc={doc}
              settings={draft}
              onChange={(next) => update(next)}
              onMode={chooseMode}
              onBusyChange={onBusyChange}
            />
          )}

          <div
            className="overflow-hidden rounded-lg border"
            style={{
              backgroundColor: doc.statusLocation
                ? previewBackground
                : draft.transparent
                  ? undefined
                  : draft.backgroundColor,
              backgroundImage: doc.statusLocation
                ? previewBottom !== previewBackground
                  ? `linear-gradient(${previewBackground},${previewBottom})`
                  : undefined
                : draft.transparent
                  ? "repeating-conic-gradient(#d4d4d4 0% 25%, #f4f4f4 0% 50%)"
                  : undefined,
              backgroundSize: doc.statusLocation ? "100% 100%" : "12px 12px",
              color: iconColor,
            }}
            data-testid="phone-panel-preview"
          >
            <div className="flex h-11 items-center justify-between gap-2 px-3">
              <span
                className="text-[13px] tabular-nums"
                style={{ fontWeight: draft.timeWeight === "bold" ? 700 : 400 }}
              >
                {valid.success && clockFontForSettings(draft) ? (
                  <img
                    alt="时间预览"
                    className="h-[18px]"
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(numericSvg(clockFontForSettings(draft)!, phoneTime(draft), 13, 18, (numericAdvance(clockFontForSettings(draft)!, phoneTime(draft)) + 0.15) * 13, iconColor))}`}
                  />
                ) : valid.success ? (
                  phoneTime(draft)
                ) : (
                  "--:--"
                )}
              </span>
              <img
                alt="状态图标预览"
                className="h-4 max-w-[70%]"
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(statusIconsSvg({ ...previewSettings, customColor: iconColor }))}`}
              />
            </div>
            {draft.showDate && (
              <p className="px-3 pb-2 text-[11px]">
                {valid.success ? phoneDate(draft) : "请选择有效日期"}
              </p>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={autoMatch}
            disabled={matching}
          >
            {matching ? <Spinner /> : <WandSparkles className="size-3.5" />}
            智能匹配原图配色
          </Button>
          <div className="flex flex-wrap gap-1">
            {LOOKS.map((look) => (
              <button
                key={look.id}
                type="button"
                onClick={() => update(look.patch)}
                className="cursor-pointer rounded-full border bg-background px-2 py-0.5 text-[11px] hover:border-primary hover:text-primary"
              >
                {look.label}
              </button>
            ))}
          </div>

          <Section title="机型" open>
            <PhoneModelPicker
              value={draft.modelId}
              styleId={draft.styleId}
              onChange={(id) => {
                if (!id) return;
                const next = settingsForModel(draft, id);
                setDraft(next);
                setError("");
                try {
                  const preset = phoneModel(id);
                  edit((current) =>
                    applyPhoneLayers(
                      resize
                        ? resizeDoc(
                            current,
                            preset.width,
                            preset.height,
                            "smart",
                          )
                        : current,
                      next,
                    ),
                  );
                } catch (error) {
                  setError(
                    error instanceof Error ? error.message : "切换机型失败",
                  );
                }
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              机型尺寸 {model.width}×{model.height} · 当前画布{" "}
              {doc.canvas.width}×{doc.canvas.height}
            </p>
            <SwitchRow
              label="同时适配机型画布尺寸"
              hint={
                resize ? "切换机型或点击应用时智能调整内容，可撤销" : undefined
              }
              checked={resize}
              onChange={setResize}
            />
            <SwitchRow
              label="显示灵动岛 / 刘海 / 开孔"
              hint="仅编辑时参考，保存图片不包含"
              checked={draft.showCutout}
              onChange={(v) => set("showCutout", v)}
            />
            <SwitchRow
              label="显示底部手势条"
              checked={draft.showHomeIndicator}
              onChange={(v) => set("showHomeIndicator", v)}
            />
          </Section>
        </>
      )}
      {advancedOnly && (
        <StatusLocationControl
          doc={doc}
          onChange={(location) => {
            if (onStatusLocationChange) onStatusLocationChange(location);
            else onApply(applyLocationToWork(doc, location));
          }}
        />
      )}
      <details className="rounded-lg border">
        <summary className="cursor-pointer p-2 text-xs font-medium">
          {doc.statusLocation
            ? "融合微调（大小、位置与深浅）"
            : "高级微调（颜色、位置与覆盖高度）"}
        </summary>
        <Section title="配色与位置" open>
          {!doc.statusLocation && (
            <>
              <Segmented
                label="图标颜色"
                value={draft.customColor ? "custom" : draft.theme}
                options={[
                  { value: "dark", label: "黑色" },
                  { value: "light", label: "白色" },
                  { value: "custom", label: "自定义" },
                ]}
                onChange={(v) =>
                  v === "custom"
                    ? set("customColor", draft.customColor ?? "#333333")
                    : update({ theme: v, customColor: null })
                }
              />
              {draft.customColor && (
                <label className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">自定义图标颜色</span>
                  <input
                    aria-label="自定义图标颜色"
                    type="color"
                    className="h-7 w-12 cursor-pointer"
                    value={draft.customColor}
                    onChange={(e) => set("customColor", e.target.value)}
                  />
                </label>
              )}
              <SwitchRow
                label="透明背景"
                hint="让原图透出来；需要盖住原图状态栏时请关闭"
                checked={draft.transparent}
                onChange={(v) => set("transparent", v)}
              />
              {!draft.transparent && (
                <label className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">背景颜色</span>
                  <span className="flex items-center gap-2">
                    <Input
                      aria-label="背景颜色色值"
                      className="h-7 w-20 px-1.5 font-mono text-[11px]"
                      value={draft.backgroundColor}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        if (/^#[0-9a-fA-F]{6}$/.test(value))
                          set("backgroundColor", value);
                      }}
                    />
                    <input
                      aria-label="状态栏背景颜色"
                      type="color"
                      className="h-7 w-10 cursor-pointer"
                      value={draft.backgroundColor}
                      onChange={(e) => set("backgroundColor", e.target.value)}
                    />
                  </span>
                </label>
              )}
            </>
          )}
          {!doc.statusLocation && (
            <label className="block space-y-1 text-xs">
              原状态栏覆盖比例 %
              <Input
                aria-label="原状态栏覆盖比例"
                type="number"
                min={0}
                max={25}
                step={0.1}
                value={Number((draft.coverRatio * 100).toFixed(2))}
                onChange={(e) =>
                  set(
                    "coverRatio",
                    Math.max(0, Math.min(0.25, Number(e.target.value) / 100)),
                  )
                }
              />
            </label>
          )}
          {doc.statusLocation && (
            <p className="text-xs text-muted-foreground">
              替换位置和清理范围由模板定位决定，调整请打开“状态栏定位”。
            </p>
          )}
          {doc.statusLocation && (
            <>
              {doc.statusLocation.backgroundQuality === "complex" && (
                <p role="status" className="text-xs text-amber-700">
                  背景较复杂，本地修补可能存在接缝，可调整状态栏外框改善效果。
                </p>
              )}
              <SliderRow
                label="整体大小"
                unit="%"
                min={70}
                max={150}
                value={draft.scale}
                onChange={(v) => set("scale", v)}
              />
              <SliderRow
                label="上下位置"
                min={-30}
                max={30}
                value={draft.offsetY}
                onChange={(v) => set("offsetY", v)}
              />
              <SliderRow
                label="深浅"
                unit="%"
                min={-20}
                max={20}
                value={draft.toneAdjustment}
                onChange={(v) =>
                  update({
                    toneAdjustment: v,
                    customColor: null,
                    fusion: {
                      ...draft.fusion,
                      locks: draft.fusion.locks.filter(
                        (lock) => lock !== "color",
                      ),
                    },
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  update({
                    scale: 100,
                    offsetY: 0,
                    insetX: 0,
                    toneAdjustment: 0,
                    customColor: null,
                    fusion: {
                      ...draft.fusion,
                      locks: draft.fusion.locks.filter(
                        (lock) => lock !== "geometry" && lock !== "color",
                      ),
                    },
                  })
                }
              >
                恢复自动
              </Button>
            </>
          )}
          {!doc.statusLocation && (
            <>
              <SliderRow
                label="整体大小"
                unit="%"
                min={70}
                max={150}
                value={draft.scale}
                onChange={(v) => set("scale", v)}
              />
              <SliderRow
                label="上下位置"
                min={-30}
                max={30}
                value={draft.offsetY}
                onChange={(v) => set("offsetY", v)}
              />
              <SliderRow
                label="左右边距"
                min={-12}
                max={30}
                value={draft.insetX}
                onChange={(v) => set("insetX", v)}
              />
              {(draft.scale !== 100 ||
                draft.offsetY !== 0 ||
                draft.insetX !== 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full text-[11px]"
                  onClick={() => update({ scale: 100, offsetY: 0, insetX: 0 })}
                >
                  <RotateCcw className="size-3" />
                  恢复默认大小与位置
                </Button>
              )}
            </>
          )}
        </Section>
      </details>
      <Section title="时间与日期" open>
        <div className="grid grid-cols-2 gap-2">
          {!advancedOnly && (
            <Field label="时间">
              <Input
                aria-label="状态栏时间"
                type="time"
                className="h-8 text-xs"
                value={draft.time}
                onChange={(e) => set("time", e.target.value)}
              />
            </Field>
          )}
          <Field label="格式">
            <select
              aria-label="时间格式"
              className={selectClass}
              value={draft.timeFormat}
              onChange={(e) =>
                set("timeFormat", e.target.value as PhoneSettings["timeFormat"])
              }
            >
              <option value="24h">24 小时</option>
              <option value="12h">12 小时</option>
            </select>
          </Field>
        </div>
        <Segmented
          label="时间字重"
          value={draft.timeWeight}
          options={[
            { value: "bold", label: "粗体（iPhone）" },
            { value: "normal", label: "常规（安卓）" },
          ]}
          onChange={(v) => set("timeWeight", v)}
        />
        {!advancedOnly && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() => update(today())}
          >
            <Clock className="size-3" />
            使用当前时间
          </Button>
        )}
        <SwitchRow
          label="显示日期"
          checked={draft.showDate}
          onChange={(v) => set("showDate", v)}
        />
        {draft.showDate && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="日期">
              <Input
                aria-label="状态栏日期"
                type="date"
                className="h-8 text-xs"
                min="1900-01-01"
                max="9999-12-31"
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field label="格式">
              <select
                aria-label="日期格式"
                className={selectClass}
                value={draft.dateFormat}
                onChange={(e) =>
                  set(
                    "dateFormat",
                    e.target.value as PhoneSettings["dateFormat"],
                  )
                }
              >
                <option value="weekday">月日 星期</option>
                <option value="chinese">中文月日</option>
                <option value="iso">YYYY-MM-DD</option>
              </select>
            </Field>
          </div>
        )}
      </Section>

      <Section title="电池" open>
        {!advancedOnly && (
          <>
            <SliderRow
              label="电量"
              unit="%"
              min={0}
              max={100}
              value={Number.isFinite(draft.battery) ? draft.battery : 0}
              onChange={(v) => set("battery", v)}
            />
            <Input
              aria-label="电量百分比"
              type="number"
              min={0}
              max={100}
              step={1}
              className="h-8 text-xs"
              value={Number.isFinite(draft.battery) ? draft.battery : ""}
              onChange={(e) =>
                set(
                  "battery",
                  e.target.value === "" ? Number.NaN : Number(e.target.value),
                )
              }
            />
          </>
        )}
        <Segmented
          label="电池样式"
          value={draft.batteryStyle}
          options={[
            { value: "outline", label: "百分比在外" },
            { value: "inside", label: "数字在电池内" },
          ]}
          onChange={(v) => set("batteryStyle", v)}
        />
        <SwitchRow
          label="显示电量数字"
          checked={draft.showBatteryPercent}
          onChange={(v) => set("showBatteryPercent", v)}
        />
        <SwitchRow
          label="正在充电"
          checked={draft.charging}
          onChange={(v) => set("charging", v)}
        />
        <SwitchRow
          label="低电量模式（黄色）"
          checked={draft.lowPower}
          onChange={(v) => set("lowPower", v)}
        />
      </Section>

      {draft.showBatteryPercent && draft.batteryStyle === "outline" && (
        <SwitchRow
          label="百分号前留空格"
          checked={draft.spaceBeforePercent}
          onChange={(value) => set("spaceBeforePercent", value)}
        />
      )}
      <Section title="信号与网络">
        <SwitchRow
          label="显示蜂窝信号"
          checked={draft.showCellular}
          onChange={(value) => set("showCellular", value)}
        />
        <Segmented
          label="蜂窝信号"
          value={draft.signal}
          options={[0, 1, 2, 3, 4].map((n) => ({
            value: n,
            label: `${n}格`,
          }))}
          onChange={(v) => set("signal", v)}
        />
        <Segmented
          label="Wi-Fi"
          value={draft.wifi}
          options={Array.from(
            { length: maximumWifiLevel(draft) + 1 },
            (_, n) => n,
          ).map((n) => ({
            value: n,
            label: n === 0 ? "关" : `${n}格`,
          }))}
          onChange={(v) => set("wifi", v)}
        />
        <Field label="网络类型（Wi-Fi 关闭时显示）">
          <select
            aria-label="蜂窝网络类型"
            className={selectClass}
            value={draft.network}
            onChange={(e) =>
              set("network", e.target.value as PhoneSettings["network"])
            }
          >
            {PHONE_NETWORKS.map((n) => (
              <option key={n} value={n}>
                {n === "none" ? "隐藏" : n}
              </option>
            ))}
          </select>
        </Field>
        <SwitchRow
          label="飞行模式"
          checked={draft.airplane}
          onChange={(v) => set("airplane", v)}
        />
        <SwitchRow
          label="显示运营商"
          checked={draft.showCarrier}
          onChange={(v) => set("showCarrier", v)}
        />
        {draft.showCarrier && (
          <Input
            aria-label="运营商名称"
            className="h-8 text-xs"
            maxLength={12}
            value={draft.carrier}
            placeholder="中国移动"
            onChange={(e) => set("carrier", e.target.value)}
          />
        )}
      </Section>

      {!advancedOnly && (
        <AppIconsEditor
          settings={draft}
          capacity={
            doc.statusLocation &&
            draft.placement === "overlay" &&
            draft.rendering === "natural"
              ? locationAppCapacity(
                  doc,
                  draft.scale,
                  draft.appIconGap / draft.appIconSize,
                  draft.appIconSize / 12,
                )
              : undefined
          }
          scopeKey={`${scopeKey}:${draft.groupId}`}
          onBusyChange={onBusyChange}
          onChange={(next) => {
            try {
              edit((current) => applyPhoneLayers(current, next));
              setDraft(next);
              setError("");
              return true;
            } catch (error) {
              setDraft(next);
              setError(
                error instanceof Error ? error.message : "无法应用 APP 图标",
              );
              return phoneSettingsSchema.safeParse(next).success;
            }
          }}
        />
      )}
      <Section title="更多图标">
        {EXTRA_ICONS.map(([key, label]) => (
          <SwitchRow
            key={key}
            label={label}
            checked={draft[key]}
            onChange={(v) => set(key, v)}
          />
        ))}
      </Section>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {!advancedOnly && (
        <div className="sticky bottom-0 space-y-2 border-t bg-sidebar pt-3 pb-1">
          <Button className="w-full" onClick={apply}>
            {applied ? "重新应用（置顶状态栏）" : "应用手机状态栏"}
          </Button>
          {applied && (
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => {
                edit(removePhoneLayers);
              }}
            >
              <Trash2 className="size-3.5" />
              移除手机状态栏
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
