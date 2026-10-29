import { calibrationFor } from "@/lib/phone/calibration-sources";
import type { SystemStyleId } from "@/lib/phone/system-styles";
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
  styleId = "auto",
}: {
  value: PhoneModelId | undefined;
  onChange: (value: PhoneModelId | undefined) => void;
  allowNone?: boolean;
  disabled?: boolean;
  compact?: boolean;
  styleId?: SystemStyleId;
}) {
  const brand = value ? phoneModel(value).brand : "";
  const calibration = value ? calibrationFor(value, styleId) : undefined;
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
      {calibration && (
        <div
          data-testid="phone-layout-calibration"
          className="col-span-2 text-[11px] leading-relaxed text-muted-foreground"
        >
          <span>
            所选版本配置：
            {calibration.status === "calibrated"
              ? "真机核准"
              : calibration.status === "partial"
                ? "部分核对（样本位置）"
                : "参考适配（尚未真机核准）"}
          </span>
          {calibration.status === "partial" && (
            <p>
              字体、完整布局及其他状态仍待校准。样本：
              {calibration.sources[0]?.observedSystem}
            </p>
          )}
          {calibration.sources[0] && (
            <a
              href={calibration.sources[0].reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              查看核对来源
            </a>
          )}
        </div>
      )}
      {!compact && value && (
        <p className="text-xs text-muted-foreground">
          机型默认：{statusProfile(value).label} · {phoneModel(value).width}×
          {phoneModel(value).height} 参考分辨率
        </p>
      )}
      {!compact && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          具体型号与版本分别维护布局，核对状态如下；系统主题与显示缩放会影响实际外观。
        </p>
      )}
    </div>
  );
}
