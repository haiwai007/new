import AppIconsEditor from "@/components/phone/app-icons-editor";
import PhoneModelPicker from "@/components/phone/model-picker";
import { settingsForModel } from "@/lib/phone/profiles";
import { useState } from "react";
import { Clock, RotateCcw, Smartphone, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { edit, useEditor } from "@/stores/editor";
import { phoneModel } from "@/lib/phone/models";
import { PHONE_NETWORKS, phoneSettingsSchema, type PhoneSettings } from "@/lib/phone/schema";
import {
  applyPhoneLayers,
  defaultPhoneSettings,
  phoneColor,
  phoneDate,
  phoneTime,
  removePhoneLayers,
  statusIconsSvg,
} from "@/lib/phone/layers";
import { matchPatch, sampleStatusBar } from "@/lib/phone/match";
import { renderDoc } from "@/lib/canvas/render";
import { resizeDoc } from "@/lib/template/smart-resize";
import { Field, Section, Segmented, selectClass, SliderRow, SwitchRow } from "./phone-controls";

const LOOKS = [
  { id: "light", label: "浅底黑字", patch: { theme: "dark", backgroundColor: "#ffffff", transparent: false, customColor: null } },
  { id: "gray", label: "灰底黑字", patch: { theme: "dark", backgroundColor: "#f5f5f5", transparent: false, customColor: null } },
  { id: "dark", label: "深底白字", patch: { theme: "light", backgroundColor: "#111111", transparent: false, customColor: null } },
  { id: "clearDark", label: "透明·黑字", patch: { theme: "dark", transparent: true, customColor: null } },
  { id: "clearLight", label: "透明·白字", patch: { theme: "light", transparent: true, customColor: null } },
] as const satisfies readonly { id: string; label: string; patch: Partial<PhoneSettings> }[];

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

export default function PhonePanel() {
  const doc = useEditor((s) => s.doc);
  const [draft, setDraft] = useState<PhoneSettings>(() => doc?.phone ?? defaultPhoneSettings());
  const [resize, setResize] = useState(false);
  const [error, setError] = useState("");
  const [matching, setMatching] = useState(false);
  // Reset the draft when the document's saved phone settings change (undo, load…).
  const [syncedPhone, setSyncedPhone] = useState(doc?.phone);
  if (syncedPhone !== doc?.phone) {
    setSyncedPhone(doc?.phone);
    setDraft(doc?.phone ?? defaultPhoneSettings());
    setError("");
  }
  if (!doc) return null;
  const applied = Boolean(doc.phone);
  const model = phoneModel(draft.modelId);
  const valid = phoneSettingsSchema.safeParse(draft);

  /** Once the bar exists, every change shows on the canvas immediately (one undo step per burst). */
  function update(patch: Partial<PhoneSettings>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    setError("");
    if (!applied) return;
    const checked = phoneSettingsSchema.safeParse(next);
    if (!checked.success) return;
    edit((current) => applyPhoneLayers(current, checked.data), { coalesceKey: "phone-live" });
  }
  const set = <K extends keyof PhoneSettings>(key: K, value: PhoneSettings[K]) =>
    update({ [key]: value } as Pick<PhoneSettings, K>);

  function apply() {
    const checked = phoneSettingsSchema.safeParse(draft);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? "请检查设置");
      return;
    }
    try {
      edit((current) =>
        applyPhoneLayers(
          resize ? resizeDoc(current, model.width, model.height, "smart") : current,
          checked.data,
        ),
      );
      useEditor.getState().select([]);
      toast.success(applied ? "已更新手机状态栏" : "手机状态栏已应用，后续修改会实时显示");
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法应用设置");
    }
  }

  async function autoMatch() {
    if (!doc) return;
    setMatching(true);
    try {
      const base = removePhoneLayers(doc);
      const W = base.canvas.width;
      const H = base.canvas.height;
      const s = Math.min(W / model.points, H / (model.bar + 40));
      const sample = await sampleStatusBar(
        async () => (await renderDoc(base, { multiplier: Math.min(1, 400 / W) })).canvas,
        (model.bar * s) / H,
      );
      if (!sample) {
        toast.error("无法读取画面颜色，请手动选择配色");
        return;
      }
      update(matchPatch(sample));
      toast.success(
        sample.uniform
          ? "已匹配原图背景色，并覆盖原有状态栏"
          : "顶部是图片，已改为透明状态栏并选择更清晰的图标颜色",
      );
    } catch {
      toast.error("匹配失败，请手动选择配色");
    } finally {
      setMatching(false);
    }
  }

  const iconColor = phoneColor(draft);
  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Smartphone className="size-4" />
          手机状态栏
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          给截图或设计稿加上逼真的手机顶部状态栏。仅用于展示，不读取设备真实状态。
        </p>
      </div>

      <div
        className="overflow-hidden rounded-lg border"
        style={{
          backgroundColor: draft.transparent ? undefined : draft.backgroundColor,
          backgroundImage: draft.transparent
            ? "repeating-conic-gradient(#d4d4d4 0% 25%, #f4f4f4 0% 50%)"
            : undefined,
          backgroundSize: "12px 12px",
          color: iconColor,
        }}
        data-testid="phone-panel-preview"
      >
        <div className="flex h-11 items-center justify-between gap-2 px-3">
          <span
            className="text-[13px] tabular-nums"
            style={{ fontWeight: draft.timeWeight === "bold" ? 700 : 400 }}
          >
            {valid.success ? phoneTime(draft) : "--:--"}
          </span>
          <img
            alt="状态图标预览"
            className="h-4 max-w-[70%]"
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(statusIconsSvg(draft))}`}
          />
        </div>
        {draft.showDate && (
          <p className="px-3 pb-2 text-[11px]">{valid.success ? phoneDate(draft) : "请选择有效日期"}</p>
        )}
      </div>

      <Button variant="secondary" size="sm" className="w-full" onClick={autoMatch} disabled={matching}>
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
        <PhoneModelPicker value={draft.modelId} onChange={id => {
          if (!id) return;
          const next = settingsForModel(draft, id);
          setDraft(next);
          setError("");
          try {
            const preset = phoneModel(id);
            edit(current => applyPhoneLayers(resize ? resizeDoc(current, preset.width, preset.height, "smart") : current, next));
          } catch (error) { setError(error instanceof Error ? error.message : "切换机型失败"); }
        }} />
        <p className="text-[11px] text-muted-foreground">
          机型尺寸 {model.width}×{model.height} · 当前画布 {doc.canvas.width}×{doc.canvas.height}
        </p>
        <SwitchRow
          label="同时适配机型画布尺寸"
          hint={resize ? "切换机型或点击应用时智能调整内容，可撤销" : undefined}
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

      <Section title="配色与位置" open>
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
                  if (/^#[0-9a-fA-F]{6}$/.test(value)) set("backgroundColor", value);
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
        <SliderRow label="整体大小" unit="%" min={70} max={150} value={draft.scale} onChange={(v) => set("scale", v)} />
        <SliderRow label="上下位置" min={-30} max={30} value={draft.offsetY} onChange={(v) => set("offsetY", v)} />
        <SliderRow label="左右边距" min={-12} max={30} value={draft.insetX} onChange={(v) => set("insetX", v)} />
        {(draft.scale !== 100 || draft.offsetY !== 0 || draft.insetX !== 0) && (
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
      </Section>

      <Section title="时间与日期" open>
        <div className="grid grid-cols-2 gap-2">
          <Field label="时间">
            <Input
              aria-label="状态栏时间"
              type="time"
              className="h-8 text-xs"
              value={draft.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </Field>
          <Field label="格式">
            <select
              aria-label="时间格式"
              className={selectClass}
              value={draft.timeFormat}
              onChange={(e) => set("timeFormat", e.target.value as PhoneSettings["timeFormat"])}
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
        <Button variant="secondary" size="sm" className="h-8 w-full text-xs" onClick={() => update(today())}>
          <Clock className="size-3" />
          使用当前时间
        </Button>
        <SwitchRow label="显示日期" checked={draft.showDate} onChange={(v) => set("showDate", v)} />
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
                onChange={(e) => set("dateFormat", e.target.value as PhoneSettings["dateFormat"])}
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
          onChange={(e) => set("battery", e.target.value === "" ? Number.NaN : Number(e.target.value))}
        />
        <Segmented
          label="电池样式"
          value={draft.batteryStyle}
          options={[
            { value: "outline", label: "百分比在外" },
            { value: "inside", label: "数字在电池内" },
          ]}
          onChange={(v) => set("batteryStyle", v)}
        />
        <SwitchRow label="显示电量数字" checked={draft.showBatteryPercent} onChange={(v) => set("showBatteryPercent", v)} />
        <SwitchRow label="正在充电" checked={draft.charging} onChange={(v) => set("charging", v)} />
        <SwitchRow label="低电量模式（黄色）" checked={draft.lowPower} onChange={(v) => set("lowPower", v)} />
      </Section>

      <Section title="信号与网络">
        <Segmented
          label="蜂窝信号"
          value={draft.signal}
          options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: n === 0 ? "无" : `${n}格` }))}
          onChange={(v) => set("signal", v)}
        />
        <Segmented
          label="Wi-Fi"
          value={draft.wifi}
          options={[0, 1, 2, 3].map((n) => ({ value: n, label: n === 0 ? "关" : `${n}格` }))}
          onChange={(v) => set("wifi", v)}
        />
        <Field label="网络类型（Wi-Fi 关闭时显示）">
          <select
            aria-label="蜂窝网络类型"
            className={selectClass}
            value={draft.network}
            onChange={(e) => set("network", e.target.value as PhoneSettings["network"])}
          >
            {PHONE_NETWORKS.map((n) => (
              <option key={n} value={n}>{n === "none" ? "隐藏" : n}</option>
            ))}
          </select>
        </Field>
        <SwitchRow label="飞行模式" checked={draft.airplane} onChange={(v) => set("airplane", v)} />
        <SwitchRow label="显示运营商" checked={draft.showCarrier} onChange={(v) => set("showCarrier", v)} />
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

      <AppIconsEditor settings={draft} scopeKey={`${useEditor.getState().workId}:${useEditor.getState().loadId}:${draft.groupId}`} onChange={next => {
        try {
          edit(current => applyPhoneLayers(current, next));
          setDraft(next); setError("");
          return true;
        } catch (error) { setError(error instanceof Error ? error.message : "无法应用 APP 图标"); return false; }
      }} />
      <Section title="更多图标">
        {EXTRA_ICONS.map(([key, label]) => (
          <SwitchRow key={key} label={label} checked={draft[key]} onChange={(v) => set(key, v)} />
        ))}
      </Section>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
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
              useEditor.getState().select([]);
            }}
          >
            <Trash2 className="size-3.5" />
            移除手机状态栏
          </Button>
        )}
      </div>
    </div>
  );
}
