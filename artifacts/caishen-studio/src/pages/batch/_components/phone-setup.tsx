import StatusLocationControl from "@/components/phone/status-location-control";
import type { StatusLocation } from "@/lib/status-location/schema";
import { useMemo, useState } from "react";
import PhoneSettingsEditor from "@/components/phone/settings-editor";
import { applyPhoneLayers } from "@/lib/phone/layers";
import { settingsForModel } from "@/lib/phone/profiles";
import { phoneModel } from "@/lib/phone/models";
import {
  validatePhoneBatchRules,
  type PhoneBatchRules,
} from "@/lib/batch/phone-rules";
import type { TemplateDoc } from "@/types/template";
import PhoneRandomizer from "./phone-randomizer";
import PhoneValueRules from "./phone-value-rules";
import PhoneModeSwitch from "./phone-mode-switch";
import { AppOptions, ModelOptions } from "./phone-options";
export default function PhoneSetup({
  doc,
  value,
  onChange,
  disabled,
  onBusyChange,
  onLocationChange,
}: {
  doc: TemplateDoc;
  value: PhoneBatchRules;
  onChange: (rules: PhoneBatchRules) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onLocationChange?: (location: StatusLocation) => void;
}) {
  const setup = value.setup!;
  const modifying = setup.mode !== "keep";
  const [moreOpen, setMoreOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const preview = useMemo(() => {
    if (setup.mode === "keep") return doc;
    try {
      return applyPhoneLayers(doc, {
        ...setup.settings,
        time: setup.settings.time || "09:41",
        battery: Number.isFinite(setup.settings.battery)
          ? Math.min(100, Math.max(0, setup.settings.battery))
          : 100,
        placement: setup.mode === "prepend" ? "prepend" : "overlay",
      });
    } catch {
      return doc;
    }
  }, [doc, setup]);
  const errors = validatePhoneBatchRules(value, doc);
  const lowPower =
    setup.settings.lowPower || (value.enabled && value.icons.lowPower);
  const number = (n: number) => (Number.isFinite(n) ? String(n) : "待填写");
  const summary = [
    value.models?.enabled
      ? `随机 ${value.models.ids.length} 个型号`
      : phoneModel(setup.settings.modelId).name,
    value.enabled && value.time.enabled
      ? `时间 ${value.time.start}～${value.time.end}${value.time.end < value.time.start ? "（次日）" : ""}`
      : `固定时间 ${setup.settings.time}`,
    value.enabled && value.battery.enabled
      ? `电量 ${number(value.battery.min)}%～${number(value.battery.max)}%${lowPower ? "（低电量时≤20%）" : ""}`
      : `固定电量 ${number(setup.settings.battery)}%${lowPower ? "（低电量时≤20%）" : ""}`,
    value.apps?.mode === "random"
      ? `APP ${value.apps.fixed.length + value.apps.min}～${value.apps.fixed.length + value.apps.max} 个`
      : value.apps?.mode === "none"
        ? "不显示 APP"
        : `固定 APP ${value.apps?.fixed.length ?? 0} 个`,
  ].join(" · ");
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-4 disabled:opacity-60"
    >
      <PhoneModeSwitch
        label="状态栏"
        value={modifying ? "modify" : "keep"}
        options={[
          { value: "keep", label: "保留原图" },
          { value: "modify", label: "修改状态栏" },
        ]}
        onChange={(mode) =>
          onChange({
            ...value,
            enabled: mode === "modify" ? true : value.enabled,
            setup: {
              ...setup,
              mode: mode === "keep" ? "keep" : "overlay",
              settings:
                mode === "keep"
                  ? setup.settings
                  : settingsForModel(
                      {
                        ...setup.settings,
                        rendering: "natural",
                        fusion: {
                          ...setup.settings.fusion,
                          enabled: true,
                          handling: "manual",
                        },
                      },
                      setup.settings.modelId,
                    ),
            },
          })
        }
      />
      {modifying && (
        <>
          <p className="text-xs text-muted-foreground">
            自动按模板匹配高度、文字大小、背景和明暗；型号跟随系统样式，默认保持模板图片尺寸。
          </p>
          {setup.mode !== "prepend" && onLocationChange && (
            <StatusLocationControl
              doc={doc}
              disabled={disabled}
              onChange={onLocationChange}
            />
          )}
          <ModelOptions value={value} onChange={onChange} />
          <PhoneValueRules value={value} onChange={onChange} />
          <AppOptions
            doc={doc}
            value={value}
            onChange={onChange}
            onBusyChange={onBusyChange}
          />
          <details
            className="rounded-lg border"
            open={moreOpen}
            onToggle={(e) => setMoreOpen(e.currentTarget.open)}
          >
            <summary className="cursor-pointer p-3 text-sm font-medium">
              更多设置
            </summary>
            {moreOpen && (
              <div className="space-y-4 p-3 pt-0">
                <label className="block space-y-1 text-xs">
                  添加方式
                  <select
                    aria-label="批量状态栏添加方式"
                    className="h-9 w-full rounded border bg-background px-2"
                    value={setup.mode === "prepend" ? "prepend" : "overlay"}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        setup: {
                          ...setup,
                          mode: e.target.value as "overlay" | "prepend",
                        },
                      })
                    }
                  >
                    <option value="overlay">
                      替换原状态栏（保持图片尺寸）
                    </option>
                    <option value="prepend">
                      顶部新增（正文下移，增加图片高度）
                    </option>
                  </select>
                </label>
                <PhoneRandomizer
                  phone={setup.settings}
                  value={value}
                  disabled={disabled}
                  onChange={onChange}
                />
                <details
                  className="rounded-lg border"
                  open={appearanceOpen}
                  onToggle={(e) => setAppearanceOpen(e.currentTarget.open)}
                >
                  <summary className="cursor-pointer p-3 text-sm font-medium">
                    固定外观、日期与网络
                  </summary>
                  {appearanceOpen && (
                    <PhoneSettingsEditor
                      advancedOnly
                      onStatusLocationChange={onLocationChange}
                      doc={preview}
                      scopeKey={`batch:${doc.templateId}`}
                      onBusyChange={onBusyChange}
                      onApply={(next) =>
                        onChange({
                          ...value,
                          setup: {
                            ...setup,
                            mode: next.phone?.placement ?? setup.mode,
                            settings: next.phone
                              ? {
                                  ...next.phone,
                                  time: setup.settings.time,
                                  battery: setup.settings.battery,
                                }
                              : setup.settings,
                          },
                        })
                      }
                    />
                  )}
                </details>
              </div>
            )}
          </details>
          <p
            aria-label="批量状态栏设置摘要"
            className="break-words rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground"
          >
            {summary}
          </p>
          {errors.length > 0 && (
            <div role="alert" className="space-y-1 text-xs text-destructive">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
