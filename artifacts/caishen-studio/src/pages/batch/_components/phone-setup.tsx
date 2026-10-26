import FusionPanel from "@/components/phone/fusion-panel";
import { useMemo } from "react";
import PhoneSettingsEditor from "@/components/phone/settings-editor";
import DrawingPresets from "@/components/phone/drawing-presets";
import { applyPhoneLayers } from "@/lib/phone/layers";
import {
  validatePhoneBatchRules,
  type PhoneBatchRules,
} from "@/lib/batch/phone-rules";
import type { TemplateDoc } from "@/types/template";
import PhoneRandomizer from "./phone-randomizer";
import { AppOptions, ModelOptions } from "./phone-options";
export default function PhoneSetup({
  doc,
  value,
  onChange,
  disabled,
  onBusyChange,
}: {
  doc: TemplateDoc;
  value: PhoneBatchRules;
  onChange: (rules: PhoneBatchRules) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const setup = value.setup!;
  const preview = useMemo(() => {
    try {
      return applyPhoneLayers(doc, {
        ...setup.settings,
        placement: setup.mode === "prepend" ? "prepend" : "overlay",
      });
    } catch {
      return doc;
    }
  }, [doc, setup]);
  const errors = validatePhoneBatchRules(value);
  return (
    <div className="space-y-4">
      <DrawingPresets value={value} onLoad={onChange} disabled={disabled} />
      <label className="block space-y-1 text-sm">
        本批次状态栏处理
        <select
          aria-label="批量状态栏处理方式"
          className="h-10 w-full rounded border bg-background px-2 text-sm"
          value={setup.mode}
          onChange={(e) =>
            onChange({
              ...value,
              setup: { ...setup, mode: e.target.value as typeof setup.mode, settings: e.target.value === "auto" ? {...setup.settings, rendering: "natural", fusion: {...setup.settings.fusion, enabled: true, handling: "auto"}} : {...setup.settings, fusion: {...setup.settings.fusion, handling: "manual"}} },
            })
          }
        >
          <option value="auto">自动判断（分析后确认）</option>
          <option value="keep">保留原图（不生成新状态栏）</option>
          <option value="overlay">覆盖原图状态栏（保持尺寸）</option>
          <option value="prepend">添加状态栏（正文下移、增加高度）</option>
        </select>
      </label>
      {setup.mode === "auto" && <FusionPanel doc={doc} settings={setup.settings} onBusyChange={onBusyChange} onChange={settings => onChange({...value, setup: {...setup,settings}})} onMode={mode => onChange({...value,setup:{...setup,mode,settings:{...setup.settings,fusion:{...setup.settings.fusion,handling:"manual"}}}})} />}
      {setup.mode !== "keep" && setup.mode !== "auto" && (
        <>
          <details className="rounded-lg border">
            <summary className="cursor-pointer p-3 text-sm font-medium">
              固定手机型号、时间、配色与图标设置
            </summary>
            <PhoneSettingsEditor
              doc={preview}
              scopeKey={`batch:${doc.templateId}`}
              onBusyChange={onBusyChange}
              onApply={(next) =>
                onChange({
                  ...value,
                  setup: {
                    ...setup,
                    mode: next.phone?.placement ?? "keep",
                    settings: next.phone ?? setup.settings,
                  },
                })
              }
            />
          </details>
          <ModelOptions value={value} onChange={onChange} />
          <AppOptions
            value={value}
            onChange={onChange}
            onBusyChange={onBusyChange}
          />
          <PhoneRandomizer
            phone={setup.settings}
            value={value}
            disabled={disabled}
            onChange={onChange}
          />
        </>
      )}
      {errors.length > 0 && (
        <div role="alert" className="space-y-1 text-xs text-destructive">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}
