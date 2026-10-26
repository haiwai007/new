import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { edit, useEditor } from "@/stores/editor";
import {
  MAX_PARAMETER_NAME,
  parameterNameError,
  renameParameter,
} from "@/lib/template/params";
import type { TemplateParameter } from "@/types/template";

/** Change the display label without touching the parameter ID, value or rules. */
export default function ParameterNameEditor({
  param,
}: {
  param: TemplateParameter;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(param.name);
  const [error, setError] = useState("");
  const workId = useEditor((s) => s.workId),
    loadId = useEditor((s) => s.loadId);
  useEffect(() => {
    setEditing(false);
    setError("");
  }, [workId, loadId, param.id]);
  const cancel = () => {
    setEditing(false);
    setError("");
  };
  const save = () => {
    const message = parameterNameError(draft);
    if (message) {
      setError(message);
      return;
    }
    if (draft.trim() !== param.name)
      edit((doc) => renameParameter(doc, param.id, draft));
    setEditing(false);
    setError("");
  };
  if (!editing)
    return (
      <button
        type="button"
        className="group/name flex min-h-7 min-w-0 flex-1 cursor-pointer items-center gap-1 text-left font-medium hover:text-primary"
        title={`${param.name} · 点击重命名`}
        aria-label={`重命名参数：${param.name}`}
        onClick={() => {
          setDraft(param.name);
          setError("");
          setEditing(true);
        }}
      >
        <span className="min-w-0 truncate">{param.name}</span>
        <Pencil className="size-3 shrink-0 text-muted-foreground group-hover/name:text-primary" />
      </button>
    );
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <Input
        autoFocus
        aria-label="自定义参数名称"
        aria-invalid={!!error}
        maxLength={MAX_PARAMETER_NAME}
        value={draft}
        className="h-8 min-w-0 text-xs"
        onChange={(e) => {
          setDraft(e.target.value);
          setError("");
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="保存参数名称"
          title="保存名称（Enter）"
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded border hover:bg-muted"
          onClick={save}
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          aria-label="取消参数重命名"
          title="取消（Esc）"
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded border hover:bg-muted"
          onClick={cancel}
        >
          <X className="size-4" />
        </button>
        <span className="text-[10px] text-muted-foreground">
          {draft.length}/{MAX_PARAMETER_NAME}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
