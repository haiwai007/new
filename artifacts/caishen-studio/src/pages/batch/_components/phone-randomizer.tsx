import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PHONE_NETWORKS, type PhoneSettings } from "@/lib/phone/schema";
import {
  RANDOM_PHONE_ICONS,
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
  if (!phone) return null;
  const change = (patch: Partial<PhoneBatchRules>) =>
    onChange({ ...value, ...patch, enabled: true });
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <Toggle
        label="随机日期并显示"
        checked={value.enabled && value.date.enabled}
        onChange={(enabled) => change({ date: { ...value.date, enabled } })}
      />
      {value.date.enabled && (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs">
            开始日期
            <Input
              aria-label="随机开始日期"
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              value={value.date.start}
              onChange={(e) =>
                change({ date: { ...value.date, start: e.target.value } })
              }
            />
          </label>
          <label className="space-y-1 text-xs">
            结束日期
            <Input
              aria-label="随机结束日期"
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              value={value.date.end}
              onChange={(e) =>
                change({ date: { ...value.date, end: e.target.value } })
              }
            />
          </label>
        </div>
      )}
      <Toggle
        label="随机蜂窝信号（0–4 格）"
        checked={value.enabled && value.signal}
        onChange={(signal) => change({ signal })}
      />
      <Toggle
        label="随机 Wi-Fi（关闭或按系统选择信号强度）"
        checked={value.enabled && value.wifi}
        onChange={(wifi) => change({ wifi })}
      />
      <Toggle
        label="随机网络类型"
        checked={value.enabled && value.network.enabled}
        onChange={(enabled) =>
          change({ network: { ...value.network, enabled } })
        }
      />
      {value.network.enabled && (
        <div className="flex flex-wrap gap-3">
          {PHONE_NETWORKS.map((network) => (
            <label key={network} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                aria-label={`候选网络 ${network}`}
                checked={value.network.options.includes(network)}
                onChange={(e) =>
                  change({
                    network: {
                      ...value.network,
                      options: e.target.checked
                        ? [...value.network.options, network]
                        : value.network.options.filter((n) => n !== network),
                    },
                  })
                }
              />
              {network === "none" ? "不显示" : network}
            </label>
          ))}
        </div>
      )}
      <div className="grid gap-x-4 sm:grid-cols-2">
        {RANDOM_PHONE_ICONS.map(([key, label]) => (
          <Toggle
            key={key}
            label={`随机${label}`}
            checked={value.enabled && !!value.icons[key]}
            onChange={(enabled) =>
              change({ icons: { ...value.icons, [key]: enabled } })
            }
          />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        随机状态每张以 50% 概率开启；未开启随机的项目沿用固定设置。有 Wi-Fi
        时优先显示
        Wi-Fi，飞行模式隐藏蜂窝信号和网络文字。低电量模式开启时，电量最多 20%。
      </p>
    </fieldset>
  );
}
