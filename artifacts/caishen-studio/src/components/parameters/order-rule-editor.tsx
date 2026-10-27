import type { OrderRule } from "@/lib/parameters/order";
import { orderSummary } from "@/lib/parameters/order";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
export default function OrderRuleEditor({
  value,
  onChange,
}: {
  value: OrderRule;
  onChange: (value: OrderRule) => void;
}) {
  return (
    <fieldset
      className="min-w-0 space-y-3 rounded-lg border p-3"
      aria-label="订单号生成规则"
    >
      <legend className="px-1 text-xs font-medium">订单号生成规则</legend>
      <label className="block space-y-1 text-xs">
        随机部分位数
        <Input
          aria-label="订单号随机部分位数"
          type="number"
          min={1}
          max={64}
          value={value.length}
          onChange={(e) => {
            const length = Number(e.target.value);
            if (Number.isInteger(length) && length >= 1 && length <= 64)
              onChange({ ...value, length });
          }}
        />
      </label>
      <label className="block space-y-1 text-xs">
        字符类型
        <select
          aria-label="订单号字符类型"
          className="h-9 w-full rounded border bg-background px-2"
          value={value.alphabet}
          onChange={(e) =>
            onChange({
              ...value,
              alphabet: e.target.value as OrderRule["alphabet"],
            })
          }
        >
          <option value="digits">纯数字</option>
          <option value="letters">纯字母</option>
          <option value="mixed">数字与字母混合</option>
        </select>
      </label>
      {value.alphabet !== "digits" && (
        <label className="block space-y-1 text-xs">
          字母大小写
          <select
            aria-label="订单号字母大小写"
            className="h-9 w-full rounded border bg-background px-2"
            value={value.letterCase}
            onChange={(e) =>
              onChange({
                ...value,
                letterCase: e.target.value as OrderRule["letterCase"],
              })
            }
          >
            <option value="upper">大写</option>
            <option value="lower">小写</option>
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs">
          固定前缀
          <Input
            aria-label="订单号固定前缀"
            maxLength={40}
            value={value.prefix}
            onChange={(e) => onChange({ ...value, prefix: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-xs">
          固定后缀
          <Input
            aria-label="订单号固定后缀"
            maxLength={40}
            value={value.suffix}
            onChange={(e) => onChange({ ...value, suffix: e.target.value })}
          />
        </label>
      </div>
      {value.alphabet !== "letters" && (
        <label className="flex items-center justify-between gap-2 text-xs">
          随机部分首位允许为 0
          <Switch
            aria-label="订单号首位允许为0"
            checked={value.leadingZero}
            onCheckedChange={(leadingZero) =>
              onChange({ ...value, leadingZero })
            }
          />
        </label>
      )}
      <p
        className="text-xs leading-relaxed text-muted-foreground"
        aria-label="订单号规则摘要"
      >
        {orderSummary(value)}
      </p>
    </fieldset>
  );
}
