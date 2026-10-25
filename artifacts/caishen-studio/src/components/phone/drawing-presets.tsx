import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteDrawingPreset,
  listDrawingPresets,
  saveDrawingPreset,
} from "@/lib/storage/drawing-presets";
import {
  validatePhoneBatchRules,
  type PhoneBatchRules,
} from "@/lib/batch/phone-rules";
import type { DrawingPreset } from "@/lib/phone/drawing-preset";
export default function DrawingPresets({
  value,
  onLoad,
  disabled = false,
  single = false,
  canSave = true,
}: {
  value: PhoneBatchRules;
  onLoad: (rules: PhoneBatchRules) => void;
  disabled?: boolean;
  single?: boolean;
  canSave?: boolean;
}) {
  const [rows, setRows] = useState<DrawingPreset[]>([]),
    [id, setId] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      listDrawingPresets()
        .then((rows) => {
          if (alive) setRows(rows);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      window.removeEventListener("focus", refresh);
    };
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const row = await saveDrawingPreset(name, value);
      setRows(await listDrawingPresets());
      setId(row.id);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset
      disabled={disabled || busy}
      className="min-w-0 space-y-2 rounded-lg border p-3"
    >
      <legend className="px-1 text-sm font-semibold">作图预设</legend>
      <select
        aria-label="选择作图预设"
        className="h-9 w-full min-w-0 rounded border bg-background px-2 text-xs"
        value={id}
        onChange={(e) => setId(e.target.value)}
      >
        <option value="">选择已保存预设</option>
        {rows.map((row) => (
          <option value={row.id} key={row.id}>
            {row.name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!rows.some((r) => r.id === id)}
          onClick={() => {
            const row = rows.find((r) => r.id === id);
            if (row) {
              setError("");
              onLoad(structuredClone(row.rules));
            }
          }}
        >
          应用预设
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!id}
          onClick={async () => {
            setBusy(true);
            try {
              await deleteDrawingPreset(id);
              setRows(await listDrawingPresets());
              setId("");
              setError("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "删除失败");
            } finally {
              setBusy(false);
            }
          }}
        >
          删除预设
        </Button>
      </div>
      <Input
        aria-label="作图预设名称"
        maxLength={80}
        placeholder="例如：安卓通知随机"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={!canSave || !name.trim() || validatePhoneBatchRules(value).length > 0}
        onClick={save}
      >
        保存为新预设
      </Button>
      <p className="text-[11px] text-muted-foreground">
        预设仅存本浏览器，随完整备份迁移。
        {single
          ? "请先应用手机状态栏，再保存预设。单张作图只应用固定部分，原预设保留随机规则。"
          : "包括型号候选、状态栏与 APP 随机规则，不修改模板。"}
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
