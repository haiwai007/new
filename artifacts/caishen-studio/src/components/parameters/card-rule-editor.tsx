import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  cardRuleSchema,
  cardSummary,
  type CardRule,
} from "@/lib/parameters/card";
export default function CardRuleEditor({
  value,
  onChange,
}: {
  value: CardRule;
  onChange: (value: CardRule) => void;
}) {
  const checked = cardRuleSchema.safeParse(value);
  return (
    <fieldset
      className="min-w-0 space-y-3 rounded-lg border p-3"
      aria-label="卡号生成规则"
    >
      <legend className="px-1 text-xs font-medium">卡号生成规则</legend>
      <label className="block space-y-1 text-xs">
        多个固定卡头（每行一个）
        <Textarea
          aria-label="卡号固定卡头"
          rows={4}
          maxLength={3200}
          value={value.prefixes.join("\n")}
          onChange={(e) =>
            onChange({ ...value, prefixes: e.target.value.split(/[\n,，]/) })
          }
          placeholder={"6205\n6222"}
        />
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        只从填写的卡头中选择，卡头本身保持不变；支持逗号分隔，重复项自动去重，最多
        50 组。
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1 text-xs">
          星号数量
          <Input
            aria-label="卡号星号数量"
            type="number"
            min={1}
            max={32}
            value={value.maskCount}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= 32)
                onChange({ ...value, maskCount: n });
            }}
          />
        </label>
        <label className="block space-y-1 text-xs">
          随机尾号位数
          <Input
            aria-label="卡号随机尾号位数"
            type="number"
            min={1}
            max={12}
            value={value.tailLength}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= 12)
                onChange({ ...value, tailLength: n });
            }}
          />
        </label>
      </div>
      {!checked.success && (
        <p role="alert" className="text-xs text-destructive">
          {checked.error.issues[0]?.message}
        </p>
      )}
      <p
        className="text-xs leading-relaxed text-muted-foreground"
        aria-label="卡号规则摘要"
      >
        {cardSummary(value)}
        。星号固定显示，尾号保留前导零；不同长度卡头的完整显示长度相应变化。
      </p>
    </fieldset>
  );
}
