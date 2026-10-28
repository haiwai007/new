/** Shared bounded rank sampling for visible random values. */
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
export function sampleRanks(
  capacity: bigint,
  count: number,
  rng: () => number = secureRandom,
  unique = true,
  label = "单号",
): bigint[] {
  if (!Number.isInteger(count) || count < 0 || count > 10000)
    throw new Error("生成数量应为 0～10000 的整数");
  if (capacity < 1n) throw new Error("当前规则没有可用结果");
  if (unique && BigInt(count) > capacity)
    throw new Error(
      `当前规则最多生成 ${capacity.toString()} 个不重复${label}，本次需要 ${count} 个`,
    );
  const swaps = new Map<bigint, bigint>();
  return Array.from({ length: count }, (_, i) => {
    const remaining = unique ? capacity - BigInt(i) : capacity,
      pick = below(remaining, rng),
      rank = swaps.get(pick) ?? pick;
    if (unique) swaps.set(pick, swaps.get(remaining - 1n) ?? remaining - 1n);
    return rank;
  });
}
