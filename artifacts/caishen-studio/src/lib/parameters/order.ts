import { z } from "zod";
export const orderRuleSchema = z.object({
  length: z.number().int().min(1).max(64).default(10),
  alphabet: z.enum(["digits", "letters", "mixed"]).default("digits"),
  letterCase: z.enum(["upper", "lower"]).default("upper"),
  prefix: z.string().max(40).default(""),
  suffix: z.string().max(40).default(""),
  leadingZero: z.boolean().default(true),
});
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
export function orderCapacity(raw: OrderRule): bigint {
  const rule = orderRuleSchema.parse(raw),
    { first, rest } = chars(rule);
  return BigInt(first.length) * BigInt(rest.length) ** BigInt(rule.length - 1);
}
export function orderError(rule: OrderRule, value: string): string | null {
  const { first, rest } = chars(rule);
  if (!value.startsWith(rule.prefix) || !value.endsWith(rule.suffix))
    return "前后缀不符合模板规则";
  const body = value.slice(
    rule.prefix.length,
    rule.suffix ? -rule.suffix.length : undefined,
  );
  if (body.length !== rule.length) return `随机部分应为 ${rule.length} 位`;
  if (
    !first.includes(body[0]) ||
    [...body.slice(1)].some((c) => !rest.includes(c))
  )
    return "字符类型或首位规则不符合模板设置";
  return null;
}
export function orderFromRank(raw: OrderRule, rank: bigint): string {
  const rule = orderRuleSchema.parse(raw),
    { first, rest } = chars(rule);
  const capacity = orderCapacity(rule);
  if (rank < 0n || rank >= capacity) throw new Error("单号序号超出规则范围");
  let body = "";
  for (let i = rule.length - 1; i > 0; i--) {
    body = rest[Number(rank % BigInt(rest.length))] + body;
    rank /= BigInt(rest.length);
  }
  return rule.prefix + first[Number(rank)] + body + rule.suffix;
}
export function secureRandom(): number {
  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return bytes[0] / 4294967296;
}
function below(limit: bigint, rng: () => number): bigint {
  if (limit <= 1n) return 0n;
  const bits = (limit - 1n).toString(2).length,
    words = Math.ceil(bits / 32),
    mask = (1n << BigInt(bits)) - 1n;
  let n = 0n;
  for (let attempt = 0; attempt < 64; attempt++) {
    n = 0n;
    for (let i = 0; i < words; i++)
      n =
        (n << 32n) |
        BigInt(
          Math.floor(
            Math.max(0, Math.min(0.9999999999999999, rng())) * 4294967296,
          ),
        );
    n &= mask;
    if (n < limit) return n;
  }
  return n % limit;
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
  if (!Number.isInteger(count) || count < 0 || count > 10000)
    throw new Error("生成数量应为 0～10000 的整数");
  if (unique && BigInt(count) > capacity)
    throw new Error(
      `当前规则最多生成 ${capacity.toString()} 个不重复单号，本次需要 ${count} 个`,
    );
  const swaps = new Map<bigint, bigint>();
  return Array.from({ length: count }, (_, i) => {
    const remaining = unique ? capacity - BigInt(i) : capacity;
    const pick = below(remaining, rng),
      rank = swaps.get(pick) ?? pick;
    if (unique) swaps.set(pick, swaps.get(remaining - 1n) ?? remaining - 1n);
    return orderFromRank(rule, rank);
  });
}
export function randomOrder(
  rule: OrderRule,
  current?: string,
  excluded: string[] = [],
  rng: () => number = secureRandom,
): string {
  const blocked = new Set(excluded.filter((v) => !orderError(rule, v)));
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
  return `${rule.alphabet === "digits" ? "纯数字" : rule.alphabet === "letters" ? "纯字母" : "数字与字母"} · 随机部分 ${rule.length} 位 · 完整 ${rule.prefix.length + rule.length + rule.suffix.length} 位`;
}
