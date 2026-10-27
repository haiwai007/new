import { useEditor } from "@/stores/editor";
export default function ParameterDrawOptions() {
  const enabled = useEditor((s) => s.isTemplate || s.tool === "draw-parameter"),
    continuous = useEditor((s) => s.continuousDraw),
    snap = useEditor((s) => s.snapEnabled),
    magnifier = useEditor((s) => s.magnifierEnabled),
    ratio = useEditor((s) => s.drawRatio);
  if (!enabled) return null;
  const set = useEditor.getState().setDrawOptions;
  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b bg-background/95 px-3 py-2 text-xs"
      aria-label="框选辅助设置"
    >
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={continuous}
          onChange={(e) => set({ continuousDraw: e.target.checked })}
        />
        连续框选
      </label>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={snap}
          onChange={(e) => set({ snapEnabled: e.target.checked })}
        />
        辅助吸附
      </label>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={magnifier}
          onChange={(e) => set({ magnifierEnabled: e.target.checked })}
        />
        局部放大镜
      </label>
      <label className="flex items-center gap-1">
        框选比例
        <select
          aria-label="框选比例"
          value={ratio ?? 0}
          onChange={(e) => set({ drawRatio: Number(e.target.value) || null })}
          className="rounded border bg-background px-1"
        >
          <option value={0}>自由</option>
          <option value={1}>1:1 正方形</option>
          <option value={4 / 3}>4:3</option>
          <option value={16 / 9}>16:9</option>
        </select>
      </label>
    </div>
  );
}
