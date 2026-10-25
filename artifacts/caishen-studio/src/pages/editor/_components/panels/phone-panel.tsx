import { useEffect, useState } from "react";
import { Clock, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { edit, useEditor } from "@/stores/editor";
import { PHONE_MODELS, phoneModel } from "@/lib/phone/models";
import { phoneSettingsSchema, type PhoneSettings } from "@/lib/phone/schema";
import {
  applyPhoneLayers,
  defaultPhoneSettings,
  phoneDate,
  phoneTime,
  removePhoneLayers,
  statusIconsSvg,
} from "@/lib/phone/layers";
import { resizeDoc } from "@/lib/template/smart-resize";
const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
    </label>
  );
}
export default function PhonePanel() {
  const doc = useEditor((s) => s.doc);
  const [draft, setDraft] = useState<PhoneSettings>(
    () => doc?.phone ?? defaultPhoneSettings(),
  );
  const [resize, setResize] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(doc?.phone ?? defaultPhoneSettings());
    setError("");
  }, [doc?.phone]);
  if (!doc) return null;
  const set = <K extends keyof PhoneSettings>(
    key: K,
    value: PhoneSettings[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const model = phoneModel(draft.modelId);
  const valid = phoneSettingsSchema.safeParse(draft);
  function apply() {
    const checked = phoneSettingsSchema.safeParse(draft);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? "请检查设置");
      return;
    }
    try {
      edit((current) =>
        applyPhoneLayers(
          resize
            ? resizeDoc(current, model.width, model.height, "smart")
            : current,
          checked.data,
        ),
      );
      useEditor.getState().select([]);
      toast.success("手机状态栏已应用，可撤销");
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法应用设置");
    }
  }
  return (
    <div className="space-y-4 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <Smartphone className="size-4" />
        手机型号与状态栏
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        用于界面展示与设计。机型为尺寸和外观参考，不读取或改变设备实际状态。修改后点击应用。保存图片只导出屏幕内容，不包含硬件开孔。
      </p>
      <div
        className="overflow-hidden rounded-lg border"
        style={{
          backgroundColor: draft.transparent
            ? "#e5e7eb"
            : draft.backgroundColor,
          color: draft.theme === "dark" ? "#111111" : "#ffffff",
        }}
        data-testid="phone-panel-preview"
      >
        <div className="flex h-12 items-center justify-between gap-1 px-3">
          <span className="text-xs font-semibold">
            {valid.success ? phoneTime(draft) : "--:--"}
          </span>
          <img
            alt="状态图标预览"
            className="h-5 w-28"
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(statusIconsSvg(draft))}`}
          />
        </div>
        {draft.showDate && (
          <p className="px-3 pb-2 text-[11px]">
            {valid.success ? phoneDate(draft) : "请选择有效日期"}
          </p>
        )}
      </div>
      <label className="block space-y-1 text-xs">
        <span>手机型号</span>
        <select
          aria-label="手机型号"
          className={selectClass}
          value={draft.modelId}
          onChange={(e) =>
            set("modelId", e.target.value as PhoneSettings["modelId"])
          }
        >
          {PHONE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] text-muted-foreground">
        参考尺寸 {model.width}×{model.height} · 当前画布 {doc.canvas.width}×
        {doc.canvas.height}
      </p>
      <Toggle
        label="同时适配机型画布尺寸"
        checked={resize}
        onChange={setResize}
      />
      {resize && (
        <p className="text-[11px] text-muted-foreground">
          应用时智能调整现有内容；原始素材会保留，可撤销。
        </p>
      )}
      <div className="space-y-2 border-t pt-3">
        <label className="block space-y-1 text-xs">
          <span>时间</span>
          <Input
            aria-label="状态栏时间"
            type="time"
            value={draft.time}
            onChange={(e) => set("time", e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span>时间格式</span>
          <select
            aria-label="时间格式"
            className={selectClass}
            value={draft.timeFormat}
            onChange={(e) =>
              set("timeFormat", e.target.value as PhoneSettings["timeFormat"])
            }
          >
            <option value="24h">24 小时制</option>
            <option value="12h">12 小时制（AM / PM）</option>
          </select>
        </label>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => {
            const now = new Date();
            setDraft((d) => ({
              ...d,
              time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
              date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
            }));
          }}
        >
          <Clock className="size-3" />
          使用设备当前时间
        </Button>
        <Toggle
          label="显示日期"
          checked={draft.showDate}
          onChange={(v) => set("showDate", v)}
        />
        <label className="block space-y-1 text-xs">
          <span>日期</span>
          <Input
            aria-label="状态栏日期"
            type="date"
            min="1900-01-01"
            max="9999-12-31"
            value={draft.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span>日期格式</span>
          <select
            aria-label="日期格式"
            className={selectClass}
            value={draft.dateFormat}
            onChange={(e) =>
              set("dateFormat", e.target.value as PhoneSettings["dateFormat"])
            }
          >
            <option value="weekday">月日 + 星期</option>
            <option value="chinese">中文月日</option>
            <option value="iso">YYYY-MM-DD</option>
          </select>
        </label>
      </div>
      <div className="space-y-2 border-t pt-3">
        <label className="block space-y-1 text-xs">
          <span>电量（0–100%）</span>
          <Input
            aria-label="电量百分比"
            type="number"
            min={0}
            max={100}
            step={1}
            value={Number.isFinite(draft.battery) ? draft.battery : ""}
            onChange={(e) =>
              set(
                "battery",
                e.target.value === "" ? Number.NaN : Number(e.target.value),
              )
            }
          />
        </label>
        <Toggle
          label="显示电量百分比"
          checked={draft.showBatteryPercent}
          onChange={(v) => set("showBatteryPercent", v)}
        />
        <Toggle
          label="正在充电"
          checked={draft.charging}
          onChange={(v) => set("charging", v)}
        />
        <label className="block space-y-1 text-xs">
          <span>蜂窝信号</span>
          <select
            aria-label="蜂窝信号"
            className={selectClass}
            value={draft.signal}
            onChange={(e) => set("signal", Number(e.target.value))}
          >
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "无信号" : `${n} 格`}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-xs">
          <span>Wi-Fi</span>
          <select
            aria-label="Wi-Fi 信号"
            className={selectClass}
            value={draft.wifi}
            onChange={(e) => set("wifi", Number(e.target.value))}
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "关闭" : `${n} 格`}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-xs">
          <span>蜂窝网络（Wi-Fi 关闭时）</span>
          <select
            aria-label="蜂窝网络类型"
            className={selectClass}
            value={draft.network}
            onChange={(e) =>
              set("network", e.target.value as PhoneSettings["network"])
            }
          >
            {["none", "4G", "5G", "LTE"].map((n) => (
              <option key={n} value={n}>
                {n === "none" ? "隐藏" : n}
              </option>
            ))}
          </select>
        </label>
        <Toggle
          label="飞行模式"
          checked={draft.airplane}
          onChange={(v) => set("airplane", v)}
        />
        <Toggle
          label="蓝牙图标"
          checked={draft.bluetooth}
          onChange={(v) => set("bluetooth", v)}
        />
        <Toggle
          label="显示运营商"
          checked={draft.showCarrier}
          onChange={(v) => set("showCarrier", v)}
        />
        <label className="block space-y-1 text-xs">
          <span>运营商名称</span>
          <Input
            aria-label="运营商名称"
            maxLength={12}
            value={draft.carrier}
            onChange={(e) => set("carrier", e.target.value)}
          />
        </label>
      </div>
      <div className="space-y-2 border-t pt-3">
        <label className="block space-y-1 text-xs">
          <span>图标配色</span>
          <select
            aria-label="状态栏配色"
            className={selectClass}
            value={draft.theme}
            onChange={(e) => {
              const theme = e.target.value as PhoneSettings["theme"];
              setDraft((d) => ({
                ...d,
                theme,
                backgroundColor: theme === "dark" ? "#ffffff" : "#111111",
              }));
            }}
          >
            <option value="dark">深色图标 · 浅色背景</option>
            <option value="light">浅色图标 · 深色背景</option>
          </select>
        </label>
        <label className="flex items-center justify-between text-xs">
          <span>背景颜色</span>
          <input
            aria-label="状态栏背景颜色"
            type="color"
            value={draft.backgroundColor}
            onChange={(e) => set("backgroundColor", e.target.value)}
          />
        </label>
        <Toggle
          label="透明状态栏背景"
          checked={draft.transparent}
          onChange={(v) => set("transparent", v)}
        />
        <Toggle
          label="显示灵动岛 / 刘海 / 开孔"
          checked={draft.showCutout}
          onChange={(v) => set("showCutout", v)}
        />
        <Toggle
          label="显示底部手势条"
          checked={draft.showHomeIndicator}
          onChange={(v) => set("showHomeIndicator", v)}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" onClick={apply}>
        应用手机状态栏
      </Button>
      {doc.phone && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            edit(removePhoneLayers);
            useEditor.getState().select([]);
          }}
        >
          移除手机状态栏
        </Button>
      )}
      <p className="text-[11px] text-muted-foreground">
        生成的图层默认锁定，可在图层面板解锁。重新应用会更新并置顶；移除不改回画布尺寸。
      </p>
    </div>
  );
}
