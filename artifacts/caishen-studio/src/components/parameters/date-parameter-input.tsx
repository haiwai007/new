import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  DATE_PRECISIONS,
  dateInput,
  dateParts,
  dateValue,
  type DatePrecision,
} from "@/lib/parameters/date";
export default function DateParameterInput({
  value,
  name,
  initialPrecision = "date",
  disabled,
  onChange,
}: {
  value: string;
  name: string;
  initialPrecision?: DatePrecision;
  disabled?: boolean;
  onChange: (value: string, precision: DatePrecision) => void;
}) {
  const [precision, setPrecision] = useState<DatePrecision>(
    () => dateParts(value)?.precision ?? initialPrecision,
  );
  useEffect(() => {
    setPrecision(dateParts(value)?.precision ?? initialPrecision);
  }, [value, initialPrecision]);
  return (
    <div className="min-w-0 space-y-2">
      <NativeSelect
        aria-label={`${name}日期精度`}
        value={precision}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as DatePrecision;
          setPrecision(next);
          onChange(value ? dateValue(value, next) : "", next);
        }}
      >
        {DATE_PRECISIONS.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Input
        aria-label={name}
        className="min-w-0 text-sm"
        type={precision === "date" ? "date" : "datetime-local"}
        step={precision === "minute" ? 60 : 1}
        disabled={disabled}
        value={dateInput(value, precision)}
        onChange={(e) =>
          onChange(
            e.target.value ? dateValue(e.target.value, precision) : "",
            precision,
          )
        }
      />
    </div>
  );
}
