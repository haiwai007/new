import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select.tsx";
import { cn } from "@/lib/utils.ts";
import { PARAM_TYPE_LABEL } from "@/lib/template/params.ts";
import { DATE_FORMATS, RULE_MODE_LABEL, modesFor, type DateFormatId, type ParamRule, type RuleMode } from "@/lib/batch/rules.ts";
import type { AssetRecord } from "@/lib/storage/db.ts";
import type { TemplateParameter } from "@/types/template.ts";
import AssetPicker from "./asset-picker.tsx";

type Props = {
  param: TemplateParameter;
  rule: ParamRule;
  locked: boolean;
  assets: AssetRecord[];
  onModeChange: (mode: RuleMode) => void;
  onChange: (rule: ParamRule) => void;
};

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs text-muted-foreground", className)}>
      {label}
      {children}
    </label>
  );
}

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

export default function RuleEditor({ param, rule, locked, assets, onModeChange, onChange }: Props) {
  const isTextProp = param.property === "text";
  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {param.name}
          {param.required && <span className="ml-1 text-primary">*</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{PARAM_TYPE_LABEL[param.type]}</p>
      </div>
      {locked ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3.5" /> 状态栏和锁定参数沿用模板设置</p>
      ) : (
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {modesFor(param.type).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors",
                  rule.mode === m ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/60",
                )}
              >
                {RULE_MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <RuleFields param={param} rule={rule} isTextProp={isTextProp} assets={assets} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function RuleFields({ param, rule, isTextProp, assets, onChange }: Omit<Props, "locked" | "onModeChange"> & { isTextProp: boolean }) {
  switch (rule.mode) {
    case "keep":
      return null;
    case "fixed":
      return <FixedField param={param} value={rule.value} assets={assets} onChange={(value) => onChange({ ...rule, value })} />;
    case "list":
      return <ListField param={param} options={rule.options} assets={assets} onChange={(options) => onChange({ ...rule, options })} />;
    case "range":
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Field label="最小值"><Input type="number" value={rule.min} onChange={(e) => onChange({ ...rule, min: num(e.target.value) })} /></Field>
          <Field label="最大值"><Input type="number" value={rule.max} onChange={(e) => onChange({ ...rule, max: num(e.target.value) })} /></Field>
          <Field label="小数位"><Input type="number" min={0} max={4} value={rule.decimals} onChange={(e) => onChange({ ...rule, decimals: num(e.target.value) })} /></Field>
          {isTextProp && <Field label="前缀"><Input value={rule.prefix} placeholder="¥" onChange={(e) => onChange({ ...rule, prefix: e.target.value })} /></Field>}
          {isTextProp && <Field label="后缀"><Input value={rule.suffix} placeholder="元" onChange={(e) => onChange({ ...rule, suffix: e.target.value })} /></Field>}
        </div>
      );
    case "dateRange":
      return (
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="开始时间"><Input type="datetime-local" value={rule.start} onChange={(e) => onChange({ ...rule, start: e.target.value })} /></Field>
          <Field label="结束时间"><Input type="datetime-local" value={rule.end} onChange={(e) => onChange({ ...rule, end: e.target.value })} /></Field>
          <Field label="显示格式">
            <NativeSelect className="w-full" value={rule.format} onChange={(e) => onChange({ ...rule, format: e.target.value as DateFormatId })}>
              {DATE_FORMATS.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.label}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
        </div>
      );
    case "sequence":
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="前缀"><Input value={rule.prefix} onChange={(e) => onChange({ ...rule, prefix: e.target.value })} /></Field>
          <Field label="起始数字"><Input type="number" min={0} value={rule.start} onChange={(e) => onChange({ ...rule, start: num(e.target.value) })} /></Field>
          <Field label="位数"><Input type="number" min={0} max={10} value={rule.pad} onChange={(e) => onChange({ ...rule, pad: num(e.target.value) })} /></Field>
          <Field label="后缀"><Input value={rule.suffix} onChange={(e) => onChange({ ...rule, suffix: e.target.value })} /></Field>
        </div>
      );
  }
}

type ValueProps<T> = { param: TemplateParameter; assets: AssetRecord[]; onChange: (v: T) => void };

function FixedField({ param, value, assets, onChange }: ValueProps<string> & { value: string }) {
  if (param.type === "toggle") {
    return <label className="flex items-center gap-2 text-sm"><Switch checked={value === "true"} onCheckedChange={(c) => onChange(String(c))} /> {value === "true" ? "显示" : "隐藏"}</label>;
  }
  if (param.type === "image") return <AssetPicker assets={assets} selected={value ? [value] : []} multiple={false} onChange={(ids) => onChange(ids[0] ?? "")} />;
  if (param.type === "select" && param.rules.options?.length) {
    return (
      <NativeSelect className="w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        {param.rules.options.map((o) => <NativeSelectOption key={o} value={o}>{o}</NativeSelectOption>)}
      </NativeSelect>
    );
  }
  if (param.type === "color") {
    return (
      <div className="flex items-center gap-2">
        <input type="color" aria-label="颜色" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border bg-transparent" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="max-w-40 font-mono" />
      </div>
    );
  }
  if (param.type === "multiline") return <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} />;
  return <Input value={value} onChange={(e) => onChange(e.target.value)} />;
}

function ListField({ param, options, assets, onChange }: ValueProps<string[]> & { options: string[] }) {
  if (param.type === "toggle") return <p className="text-xs text-muted-foreground">每张图随机显示或隐藏。</p>;
  if (param.type === "image") return <AssetPicker assets={assets} selected={options} multiple onChange={onChange} />;
  if (param.type === "select" && param.rules.options?.length) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {param.rules.options.map((o) => {
          const on = options.includes(o);
          return (
            <button key={o} type="button" onClick={() => onChange(on ? options.filter((x) => x !== o) : [...options, o])}
              className={cn("cursor-pointer rounded-md border px-2.5 py-1 text-xs", on ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/60")}>
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <Field label={`候选值，每行一个（共 ${options.filter(Boolean).length} 个）`}>
      <Textarea rows={3} value={options.join("\n")} placeholder={param.type === "color" ? "#c8102e\n#e8b04a" : "春日上新\n夏日特惠"} onChange={(e) => onChange(e.target.value.split("\n"))} />
    </Field>
  );
}
