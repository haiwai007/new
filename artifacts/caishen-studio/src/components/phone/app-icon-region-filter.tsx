import { Button } from "@/components/ui/button";
import type { AppIconFilter } from "@/lib/phone/app-icon-catalog";
export default function AppIconRegionFilter({
  value,
  onChange,
  counts,
  includeCustom = false,
}: {
  value: AppIconFilter;
  onChange: (value: AppIconFilter) => void;
  counts: Partial<Record<AppIconFilter, number>>;
  includeCustom?: boolean;
}) {
  const options: { value: AppIconFilter; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "domestic", label: "国内" },
    { value: "international", label: "国外" },
    ...(includeCustom ? [{ value: "custom" as const, label: "自定义" }] : []),
  ];
  return (
    <div
      role="group"
      aria-label="APP 图标分类"
      className="flex flex-wrap gap-1"
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "secondary" : "outline"}
          aria-pressed={value === option.value}
          aria-label={`${option.label}APP图标`}
          onClick={() => onChange(option.value)}
          className="h-8 gap-1 px-2 text-xs"
        >
          {option.label}
          <span className="tabular-nums text-muted-foreground">
            {counts[option.value] ?? 0}
          </span>
        </Button>
      ))}
    </div>
  );
}
