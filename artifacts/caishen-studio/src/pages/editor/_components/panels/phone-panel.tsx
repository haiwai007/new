import { useMemo } from "react";
import { edit, useEditor } from "@/stores/editor";
import PhoneSettingsEditor from "@/components/phone/settings-editor";
import DrawingPresets from "@/components/phone/drawing-presets";
import { drawingRules, applyPhoneBatchRules } from "@/lib/batch/phone-rules";
import { defaultPhoneSettings } from "@/lib/phone/layers";
export default function PhonePanel() {
  const doc = useEditor(s => s.doc);
  const rules = useMemo(() => drawingRules(doc?.phone ?? defaultPhoneSettings()), [doc?.phone]);
  if (!doc) return null;
  return <>
    <div className="p-3"><DrawingPresets canSave={!!doc.phone} value={rules} onLoad={rules => {
      const fixed = {...rules, enabled: false, models: rules.models ? {...rules.models, enabled: false} : undefined,
        apps: rules.apps?.mode === "random" ? {...rules.apps, mode: "fixed" as const} : rules.apps};
      edit(current => applyPhoneBatchRules(current, fixed, () => 0));
    }} single /></div>
    <PhoneSettingsEditor doc={doc} scopeKey={`${useEditor.getState().workId}:${useEditor.getState().loadId}`} onApply={(next, options) => edit(() => next, options)} />
  </>;
}
