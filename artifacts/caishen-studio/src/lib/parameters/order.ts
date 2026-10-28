import { secureRandom, sampleRanks } from "./random-space";
export { secureRandom } from "./random-space";
import { z } from "zod";
export const orderRuleSchema = z
  .object({
    length: z.number().int().min(1).max(64).default(10),
    alphabet: z.enum(["digits", "letters", "mixed"]).default("digits"),
    letterCase: z.enum(["upper", "lower"]).default("upper"),
    prefix: z.string().max(40).default(""),
    suffix: z.string().max(40).default(""),
    leadingZero: z.boolean().default(true),
    maskPattern: z
      .string()
      .max(64)
      .regex(/^[0-9A-Za-z*]*$/)
      .optional(),
  })
  .refine(
    (rule) => !rule.maskPattern || rule.maskPattern.length === rule.length,
    { message: "脱敏示例长度应与随机部分位数一致", path: ["maskPattern"] },
  );
export type OrderRule = z.infer<typeof orderRuleSchema>;
export const defaultOrderRule = (): OrderRule => orderRuleSchema.parse({});
function chars(rule: OrderRule) {
  const letters =
    rule.letterCase === "upper"
      ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      : "abcdefghijklmnopqrstuvwxyz";
  const rest =
    rule.alphabet === "digits"
      ? "0123456789"
      : rule.alphabet === "letters"
        ? letters
        : `0123456789${letters}`;
  return { rest, first: rule.leadingZero ? rest : rest.replace("0", "") };
}
function masked(rule: OrderRule, index: number) {
  return rule.maskPattern?.[index] === "*";
}
export function inferOrderRule(value: string): OrderRule {
  const base = defaultOrderRule();
  if (!value.includes("*") || !/^[0-9A-Za-z*]{1,64}$/.test(value)) return base;
  const digits = /[0-9]/.test(value),
    letters = /[A-Za-z]/.test(value);
  return {
    ...base,
    length: value.length,
    maskPattern: value,
    alphabet: letters ? (digits ? "mixed" : "letters") : "digits",
    letterCase: /[a-z]/.test(value) ? "lower" : "upper",
  };
}
export function orderCapacity(raw: OrderRule): bigint {
  const rule = orderRuleSchema.parse(raw),
    { first, rest } = chars(rule);
  let capacity = 1n;
  for (let i = 0; i < rule.length; i++)
    if (!masked(rule, i))
      capacity *= BigInt(i === 0 ? first.length : rest.length);
  return capacity;
}
export function orderError(raw: OrderRule, value: string): string | null {
  const parsed = orderRuleSchema.safeParse(raw);
  if (!parsed.success) return "订单号规则无效，请检查脱敏示例和位数";
  const rule = parsed.data,
    { first, rest } = chars(rule);
  if (!value.startsWith(rule.prefix) || !value.endsWith(rule.suffix))
    return "前后缀不符合模板规则";
  const body = value.slice(
    rule.prefix.length,
    rule.suffix ? -rule.suffix.length : undefined,
  );
  if (body.length !== rule.length)
    return `随机部分应为 ${rule.length} 位（每个 * 计 1 位）`;
  const hasMask = rule.maskPattern?.includes("*");
  for (let i = 0; i < body.length; i++) {
    if (masked(rule, i)) {
      if (body[i] !== "*") return "星号位置不符合模板脱敏格式";
      continue;
    }
    if (body[i] === "*") {
      if (hasMask) return "星号位置不符合模板脱敏格式";
      continue;
    }
    if (!(i === 0 ? first : rest).includes(body[i]))
      return "字符类型或首位规则不符合模板设置";
  }
  return null;
}
function generatedMember(rule: OrderRule, value: string) {
  if (orderError(rule, value)) return false;
  const body = value.slice(
    rule.prefix.length,
    rule.suffix ? -rule.suffix.length : undefined,
  );
  return [...body].every((c, i) => (c === "*") === masked(rule, i));
}
export function orderFromRank(raw: OrderRule, rank: bigint): string {
  const rule = orderRuleSchema.parse(raw),
    { first, rest } = chars(rule),
    capacity = orderCapacity(rule);
  if (rank < 0n || rank >= capacity) throw new Error("单号序号超出规则范围");
  const body = Array.from({ length: rule.length }, () => "*");
  for (let i = rule.length - 1; i >= 0; i--) {
    if (masked(rule, i)) continue;
    const alphabet = i === 0 ? first : rest;
    body[i] = alphabet[Number(rank % BigInt(alphabet.length))];
    rank /= BigInt(alphabet.length);
  }
  return rule.prefix + body.join("") + rule.suffix;
}
/** Sparse Fisher–Yates: bounded work, no collisions or retry storms in small spaces. */
export function generateOrders(
  raw: OrderRule,
  count: number,
  rng: () => number = secureRandom,
  unique = true,
): string[] {
  const rule = orderRuleSchema.parse(raw),
    capacity = orderCapacity(rule);
  return sampleRanks(capacity, count, rng, unique).map((rank) =>
    orderFromRank(rule, rank),
  );
}
export function randomOrder(
  rule: OrderRule,
  current?: string,
  excluded: string[] = [],
  rng: () => number = secureRandom,
): string {
  const blocked = new Set(excluded.filter((v) => generatedMember(rule, v)));
  if (BigInt(blocked.size) >= orderCapacity(rule))
    throw new Error("当前规则的可用单号已用完，请增加位数或调整规则");
  const max = Number(orderCapacity(rule) > 1000n ? 1000n : orderCapacity(rule));
  // Always bounded, and a deterministic rank scan guarantees a free value in tiny spaces.
  const candidates = generateOrders(
    rule,
    Math.min(max, Math.max(16, blocked.size + 2)),
    rng,
    true,
  );
  const value =
    candidates.find((v) => !blocked.has(v) && v !== current) ??
    candidates.find((v) => !blocked.has(v));
  if (value) return value;
  for (let rank = 0n; rank <= BigInt(blocked.size + 1); rank++) {
    const v = orderFromRank(rule, rank);
    if (!blocked.has(v)) return v;
  }
  throw new Error("没有可用单号");
}
export function orderSummary(rule: OrderRule): string {
  const hidden = [...(rule.maskPattern ?? "")].filter((c) => c === "*").length;
  return `${rule.alphabet === "digits" ? "纯数字" : rule.alphabet === "letters" ? "纯字母" : "数字与字母"} · 随机部分 ${rule.length} 位 · 完整 ${rule.prefix.length + rule.length + rule.suffix.length} 位${hidden ? ` · 固定保留 ${hidden} 个 *` : " · 支持输入 *"}`;
}
