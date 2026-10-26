export default function PhoneModeSwitch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">{label}</h3>
      <div
        role="group"
        aria-label={`${label}模式`}
        className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
      >
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            aria-label={`${label}${option.label}`}
            aria-pressed={value === option.value}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring ${value === option.value ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
