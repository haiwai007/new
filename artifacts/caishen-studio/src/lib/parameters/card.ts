import { z } from "zod";
import { sampleRanks, secureRandom } from "./random-space";
export const cardRuleSchema = z.object({
  prefixes: z
    .array(z.string().max(64))
    .max(100)
    .transform((values) => [
      ...new Set(values.map((v) => v.trim()).filter(Boolean)),
    ])
    .pipe(
      z
        .array(z.string().regex(/^\d{1,16}$/, "卡头只能填写 1～16 位数字"))
        .min(1, "至少填写一个固定卡头")
        .max(50, "最多设置 50 个卡头"),
    )
    .default(["6205"]),
  maskCount: z
    .number()
    .int()
    .min(1, "至少保留一个星号")
    .max(32, "星号数量最多 32 位")
    .default(4),
  tailLength: z
    .number()
    .int()
    .min(1, "尾号至少 1 位")
    .max(12, "尾号最多 12 位")
    .default(4),
});
export type CardRule = z.infer<typeof cardRuleSchema>;
export const defaultCardRule = (): CardRule => cardRuleSchema.parse({});
export function inferCardRule(value: string): CardRule {
  const match = /^(\d{1,16})(\*{1,32})(\d{1,12})$/.exec(value);
  return match
    ? {
        prefixes: [match[1]],
        maskCount: match[2].length,
        tailLength: match[3].length,
      }
    : defaultCardRule();
}
export function cardCapacity(raw: CardRule) {
  const r = cardRuleSchema.parse(raw);
  return BigInt(r.prefixes.length) * 10n ** BigInt(r.tailLength);
}
export function cardFromRank(raw: CardRule, rank: bigint) {
  const r = cardRuleSchema.parse(raw),
    perHead = 10n ** BigInt(r.tailLength),
    capacity = BigInt(r.prefixes.length) * perHead;
  if (rank < 0n || rank >= capacity) throw new Error("卡号序号超出规则范围");
  return (
    r.prefixes[Number(rank / perHead)] +
    "*".repeat(r.maskCount) +
    (rank % perHead).toString().padStart(r.tailLength, "0")
  );
}
export function cardError(raw: CardRule, value: string): string | null {
  const parsed = cardRuleSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "卡号规则无效";
  const r = parsed.data;
  return r.prefixes.some(
    (head) =>
      value.length === head.length + r.maskCount + r.tailLength &&
      value.startsWith(head) &&
      value.slice(head.length, head.length + r.maskCount) ===
        "*".repeat(r.maskCount) &&
      /^\d+$/.test(value.slice(head.length + r.maskCount)),
  )
    ? null
    : "卡号应为指定卡头＋固定星号＋随机尾号，请检查位数和卡头";
}
export function generateCards(
  raw: CardRule,
  count: number,
  rng: () => number = secureRandom,
  unique = true,
) {
  const r = cardRuleSchema.parse(raw);
  return sampleRanks(cardCapacity(r), count, rng, unique, "卡号").map((rank) =>
    cardFromRank(r, rank),
  );
}
export function randomCard(
  raw: CardRule,
  current?: string,
  excluded: string[] = [],
  rng: () => number = secureRandom,
) {
  const r = cardRuleSchema.parse(raw),
    capacity = cardCapacity(r),
    blocked = new Set(excluded.filter((v) => !cardError(r, v)));
  if (BigInt(blocked.size) >= capacity)
    throw new Error("当前卡号规则的可见结果已用完，请增加尾号位数或卡头");
  const max = Number(capacity > 1000n ? 1000n : capacity),
    values = generateCards(
      r,
      Math.min(max, Math.max(16, blocked.size + 2)),
      rng,
      true,
    );
  const value =
    values.find((v) => !blocked.has(v) && v !== current) ??
    values.find((v) => !blocked.has(v));
  if (value) return value;
  for (let rank = 0n; rank <= BigInt(blocked.size); rank++) {
    const candidate = cardFromRank(r, rank);
    if (!blocked.has(candidate)) return candidate;
  }
  throw new Error("没有可用卡号");
}
export function cardSummary(raw: CardRule) {
  const parsed = cardRuleSchema.safeParse(raw);
  if (!parsed.success) return "请完善卡号规则";
  const r = parsed.data;
  return `固定卡头 ${r.prefixes.length} 组 · 星号 ${r.maskCount} 位 · 随机尾号 ${r.tailLength} 位`;
}
