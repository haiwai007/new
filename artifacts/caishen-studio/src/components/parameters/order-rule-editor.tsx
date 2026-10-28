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
        随机部分位数（含 *）
        <Input
          aria-label="订单号随机部分位数"
          type="number"
          min={1}
          max={64}
          value={value.length}
          onChange={(e) => {
            const length = Number(e.target.value);
            if (Number.isInteger(length) && length >= 1 && length <= 64)
              onChange({
                ...value,
                length,
                maskPattern: value.maskPattern
                  ? value.maskPattern.slice(0, length).padEnd(length, "0")
                  : undefined,
              });
          }}
        />
      </label>
      <label className="block space-y-1 text-xs">
        随机单号脱敏示例（可选）
        <Input
          aria-label="订单号脱敏示例"
          value={value.maskPattern ?? ""}
          maxLength={64}
          placeholder="例如：6205****5522"
          onChange={(e) => {
            const pattern = e.target.value
              .replace(/[＊﹡]/g, "*")
              .replace(/\s/g, "");
            if (!/^[0-9A-Za-z*]*$/.test(pattern)) return;
            onChange({
              ...value,
              maskPattern: pattern || undefined,
              length: pattern.length || value.length,
            });
          }}
        />
        <span className="block leading-relaxed text-muted-foreground">
          *
          原位保留，其余位置按字符类型随机。填写示例会自动调整位数；固定首尾内容请用前后缀。清空示例则不随机添加星号。
        </span>
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
