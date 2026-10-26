import {
  PHONE_BRANDS,
  PHONE_MODELS,
  phoneModel,
  type PhoneModelId,
} from "@/lib/phone/models";
import { statusProfile } from "@/lib/phone/profiles";
const selectClass =
  "h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm";
export default function PhoneModelPicker({
  value,
  onChange,
  allowNone = false,
  disabled = false,
  compact = false,
}: {
  value: PhoneModelId | undefined;
  onChange: (value: PhoneModelId | undefined) => void;
  allowNone?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const brand = value ? phoneModel(value).brand : "";
  return (
    <div className={compact ? "grid grid-cols-2 gap-2" : "space-y-2"}>
      <label className="block space-y-1 text-xs">
        <span>手机品牌</span>
        <select
          aria-label="手机品牌"
          className={selectClass}
          value={brand}
          disabled={disabled}
          onChange={(e) =>
            onChange(PHONE_MODELS.find((m) => m.brand === e.target.value)?.id)
          }
        >
          {allowNone && <option value="">不添加状态栏</option>}
          {PHONE_BRANDS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-xs">
        <span>手机型号</span>
        <select
          aria-label="手机型号"
          className={selectClass}
          disabled={disabled || !value}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value as PhoneModelId)}
        >
          {!value && <option value="">请先选择品牌</option>}
          {PHONE_MODELS.filter((m) => m.brand === brand).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {!compact && value && (
        <p className="text-xs text-muted-foreground">
          机型默认：{statusProfile(value).label} · {phoneModel(value).width}×
          {phoneModel(value).height} 参考分辨率
        </p>
      )}
      {!compact && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          按品牌系统预设切换时钟、电池和信号样式；系统版本、主题及显示缩放可能影响实际外观。
        </p>
      )}
    </div>
  );
}
