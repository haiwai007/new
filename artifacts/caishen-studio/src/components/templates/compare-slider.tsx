import { useState } from "react";
import { cn } from "@/lib/utils.ts";

/**
 * Before/after comparison: drag the handle to reveal the "before" image.
 * Both images are drawn with object-cover in the same box, matching how the
 * canvas draws its background, so they line up even if aspect ratios differ.
 */
export default function CompareSlider({
  before,
  after,
  aspect,
  beforeLabel = "原图",
  afterLabel = "结果",
  className,
}: {
  before: string;
  after: string;
  /** width / height of the box. */
  aspect: number;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  const [pos, setPos] = useState(50);
  return (
    <div className={cn("relative mx-auto w-full select-none overflow-hidden rounded-md border bg-muted", className)} style={{ aspectRatio: aspect }}>
      <img src={after} alt={afterLabel} className="absolute inset-0 size-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt={beforeLabel} className="absolute inset-0 size-full object-cover" draggable={false} />
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" style={{ left: `${pos}%` }}>
        <span className="absolute left-1/2 top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[10px] font-bold text-neutral-800 shadow">⇆</span>
      </div>
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{beforeLabel}</span>
      <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{afterLabel}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="拖动对比"
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
