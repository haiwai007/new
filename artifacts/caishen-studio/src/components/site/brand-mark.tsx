import { cn } from "@/lib/utils.ts";

/** Shared site logo, using the image supplied in 模版/image.png. */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/haishen-logo.png"
      alt=""
      aria-hidden="true"
      width={32}
      height={32}
      className={cn(
        "inline-block size-8 shrink-0 rounded-lg bg-background object-contain shadow-sm ring-1 ring-border",
        className,
      )}
    />
  );
}
