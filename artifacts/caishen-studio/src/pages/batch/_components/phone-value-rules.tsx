import { Input } from "@/components/ui/input";
import type { PhoneBatchRules } from "@/lib/batch/phone-rules";
import PhoneModeSwitch from "./phone-mode-switch";

export default function PhoneValueRules({
  value,
  onChange,
}: {
  value: PhoneBatchRules;
  onChange: (value: PhoneBatchRules) => void;
}) {
  const setup = value.setup!;
  const randomTime = value.enabled && value.time.enabled;
  const randomBattery = value.enabled && value.battery.enabled;
  const fixed = (patch: Partial<typeof setup.settings>) =>
    onChange({
      ...value,
      setup: { ...setup, settings: { ...setup.settings, ...patch } },
    });
  const number = (value: string) => (value === "" ? NaN : Number(value));
  return (
    <>
      <section className="space-y-3 rounded-lg border p-3">
        <PhoneModeSwitch
          label="时间"
          value={randomTime ? "random" : "fixed"}
          options={[
            { value: "fixed", label: "固定" },
            { value: "random", label: "区间随机" },
          ]}
          onChange={(mode) =>
            onChange({
              ...value,
              enabled: true,
              time: { ...value.time, enabled: mode === "random" },
            })
          }
        />
        {randomTime ? (
          <>
            <div className="grid grid-cols-2 gap-2">
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
            <p className="text-xs text-muted-foreground">
              {value.time.end < value.time.start
                ? "跨午夜：结束时间为次日。"
                : value.time.end === value.time.start
                  ? "开始与结束相同，每张使用该时间。"
                  : "每张在此区间内随机，包含开始和结束时间。"}
            </p>
          </>
        ) : (
          <label className="block space-y-1 text-xs">
            固定时间
            <Input
              aria-label="固定状态栏时间"
              type="time"
              value={setup.settings.time}
              onChange={(e) => fixed({ time: e.target.value })}
            />
          </label>
        )}
      </section>
      <section className="space-y-3 rounded-lg border p-3">
        <PhoneModeSwitch
          label="电量"
          value={randomBattery ? "random" : "fixed"}
          options={[
            { value: "fixed", label: "固定" },
            { value: "random", label: "区间随机" },
          ]}
          onChange={(mode) =>
            onChange({
              ...value,
              enabled: true,
              battery: { ...value.battery, enabled: mode === "random" },
            })
          }
        />
        {randomBattery ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs">
              最低电量 %
              <Input
                aria-label="随机最低电量"
                type="number"
                min={0}
                max={100}
                step={1}
                value={
                  Number.isFinite(value.battery.min) ? value.battery.min : ""
                }
                onChange={(e) =>
                  onChange({
                    ...value,
                    battery: { ...value.battery, min: number(e.target.value) },
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
                  Number.isFinite(value.battery.max) ? value.battery.max : ""
                }
                onChange={(e) =>
                  onChange({
                    ...value,
                    battery: { ...value.battery, max: number(e.target.value) },
                  })
                }
              />
            </label>
          </div>
        ) : (
          <label className="block space-y-1 text-xs">
            固定电量 %
            <Input
              aria-label="固定状态栏电量"
              type="number"
              min={0}
              max={100}
              step={1}
              value={
                Number.isFinite(setup.settings.battery)
                  ? setup.settings.battery
                  : ""
              }
              onChange={(e) => fixed({ battery: number(e.target.value) })}
            />
          </label>
        )}
        {(value.icons.lowPower || setup.settings.lowPower) && (
          <p className="text-xs text-muted-foreground">
            低电量模式开启的图片，电量不超过 20%；随机电量超过 20% 时改为在
            0%～20% 内抽取，固定电量最多使用 20%。
          </p>
        )}
      </section>
    </>
  );
}
