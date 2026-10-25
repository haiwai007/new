import { cn } from "@/lib/utils.ts";

/** Brand mark: a gold coin with a red square hole, drawn with divs. */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f2c14e] to-[#c98a1b] shadow-sm ring-2 ring-[#f2c14e]/40",
        className,
      )}
      aria-hidden
    >
      <span className="size-3 rotate-0 rounded-[2px] bg-primary" />
    </span>
  );
}
