export type DatePrecision = "date" | "minute" | "second";
export const DATE_PRECISIONS = [
  { id: "date", label: "仅日期" },
  { id: "minute", label: "到分钟" },
  { id: "second", label: "到秒" },
] as const;
export function dateParts(value: string) {
  const match =
    /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      value,
    );
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match,
    y = Number(year),
    m = Number(month),
    d = Number(day);
  const days = [
    31,
    y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > days[m - 1] ||
    Number(hour ?? 0) > 23 ||
    Number(minute ?? 0) > 59 ||
    Number(second ?? 0) > 59
  )
    return null;
  return {
    date: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    hour: hour ?? "00",
    minute: minute ?? "00",
    second: second ?? "00",
    precision: (second !== undefined
      ? "second"
      : hour !== undefined
        ? "minute"
        : "date") as DatePrecision,
  };
}
export function dateInput(value: string, precision: DatePrecision) {
  const p = dateParts(value);
  if (!p) return "";
  return (
    p.date +
    (precision === "date"
      ? ""
      : `T${p.hour}:${p.minute}` +
        (precision === "second" ? `:${p.second}` : ""))
  );
}
export function dateValue(value: string, precision: DatePrecision) {
  return dateInput(value, precision).replace("T", " ");
}
export function dateFormat(precision: DatePrecision) {
  return precision === "second"
    ? "yyyy-MM-dd HH:mm:ss"
    : precision === "minute"
      ? "yyyy-MM-dd HH:mm"
      : "yyyy-MM-dd";
}
