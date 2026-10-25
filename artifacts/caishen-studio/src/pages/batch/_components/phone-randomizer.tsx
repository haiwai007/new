import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PHONE_NETWORKS, type PhoneSettings } from "@/lib/phone/schema";
import {
  RANDOM_PHONE_ICONS,
  validatePhoneBatchRules,
  type PhoneBatchRules,
} from "@/lib/batch/phone-rules";

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
    <label className="flex items-center justify-between gap-3 py-1 text-sm">
      <span>{label}</span>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
export default function PhoneRandomizer({
  phone,
  value,
  onChange,
  disabled,
}: {
  phone: PhoneSettings | undefined;
  value: PhoneBatchRules;
  onChange: (rules: PhoneBatchRules) => void;
  disabled: boolean;
}) {
  if (!phone)
    return (
      <p className="text-sm text-muted-foreground">
        当前模板没有手机状态栏。请先在编辑器的「手机」面板添加并另存为模板，再来批量随机。
      </p>
    );
  const errors = validatePhoneBatchRules(value);
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-3 disabled:opacity-60"
    >
      <Toggle
        label="随机状态栏"
        checked={value.enabled}
        onChange={(enabled) => onChange({ ...value, enabled })}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        {value.enabled
          ? "每张图独立随机；未勾选项沿用模板。预览与导出一致，点击「换一批」重新随机。"
          : "沿用模板中的全部状态栏设置。开启后可分别选择随机项。"}
      </p>
      {errors.length > 0 && (
        <div role="alert" className="space-y-1 text-xs text-destructive">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
      {value.enabled && (
        <>
          <div className="rounded-lg border p-3">
            <Toggle
              label="随机时间"
              checked={value.time.enabled}
              onChange={(enabled) =>
                onChange({ ...value, time: { ...value.time, enabled } })
              }
            />
            {value.time.enabled && (
              <>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs">
                    开始时间
                    <Input
                      aria-label="随机开始时间"
                      type="time"
                      value={value.time.start}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          time: { ...value.time, start: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    结束时间
                    <Input
                      aria-label="随机结束时间"
                      type="time"
                      value={value.time.end}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          time: { ...value.time, end: e.target.value },
                        })
                      }
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  结束早于开始时跨午夜随机；两者相同则固定该时间。
                </p>
              </>
            )}
          </div>
          <div className="rounded-lg border p-3">
            <Toggle
              label="随机日期并显示"
              checked={value.date.enabled}
              onChange={(enabled) =>
                onChange({ ...value, date: { ...value.date, enabled } })
              }
            />
            {value.date.enabled && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs">
                  开始日期
                  <Input
                    aria-label="随机开始日期"
                    type="date"
                    value={value.date.start}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        date: { ...value.date, start: e.target.value },
                      })
                    }
                  />
                </label>
                <label className="space-y-1 text-xs">
                  结束日期
                  <Input
                    aria-label="随机结束日期"
                    type="date"
                    value={value.date.end}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        date: { ...value.date, end: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
            )}
          </div>
          <div className="rounded-lg border p-3">
            <Toggle
              label="随机电量"
              checked={value.battery.enabled}
              onChange={(enabled) =>
                onChange({ ...value, battery: { ...value.battery, enabled } })
              }
            />
            {value.battery.enabled && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs">
                  最低电量 %
                  <Input
                    aria-label="随机最低电量"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={
                      Number.isNaN(value.battery.min) ? "" : value.battery.min
                    }
                    onChange={(e) =>
                      onChange({
                        ...value,
                        battery: {
                          ...value.battery,
                          min:
                            e.target.value === ""
                              ? NaN
                              : Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label className="space-y-1 text-xs">
                  最高电量 %
                  <Input
                    aria-label="随机最高电量"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={
                      Number.isNaN(value.battery.max) ? "" : value.battery.max
                    }
                    onChange={(e) =>
                      onChange({
                        ...value,
                        battery: {
                          ...value.battery,
                          max:
                            e.target.value === ""
                              ? NaN
                              : Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              </div>
            )}
          </div>
          <div className="rounded-lg border p-3">
            <Toggle
              label="随机蜂窝信号（0–4 格）"
              checked={value.signal}
              onChange={(signal) => onChange({ ...value, signal })}
            />
            <Toggle
              label="随机 Wi-Fi（关闭或 1–3 格）"
              checked={value.wifi}
              onChange={(wifi) => onChange({ ...value, wifi })}
            />
            <Toggle
              label="随机网络类型"
              checked={value.network.enabled}
              onChange={(enabled) =>
                onChange({ ...value, network: { ...value.network, enabled } })
              }
            />
            {value.network.enabled && (
              <div className="mt-2 flex flex-wrap gap-3">
                {PHONE_NETWORKS.map((network) => (
                  <label
                    key={network}
                    className="flex items-center gap-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      aria-label={`候选网络 ${network}`}
                      checked={value.network.options.includes(network)}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          network: {
                            ...value.network,
                            options: e.target.checked
                              ? [...value.network.options, network]
                              : value.network.options.filter(
                                  (n) => n !== network,
                                ),
                          },
                        })
                      }
                    />
                    {network === "none" ? "不显示" : network}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              图标遵循模板的显示规则：有 Wi-Fi 时优先显示
              Wi-Fi，飞行模式下隐藏蜂窝信号和网络文字。
            </p>
          </div>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              更多随机图标
            </summary>
            <p className="my-2 text-xs text-muted-foreground">
              勾选后，每张图片以 50% 概率显示或关闭该状态。
            </p>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {RANDOM_PHONE_ICONS.map(([key, label]) => (
                <Toggle
                  key={key}
                  label={`随机${label}`}
                  checked={!!value.icons[key]}
                  onChange={(enabled) =>
                    onChange({
                      ...value,
                      icons: { ...value.icons, [key]: enabled },
                    })
                  }
                />
              ))}
            </div>
          </details>
        </>
      )}
    </fieldset>
  );
}
