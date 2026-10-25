import { ConvexError } from "convex/values";
import type { QueryCtx } from "./_generated/server";
export async function requireIdentity(ctx: Pick<QueryCtx, "auth">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("请先登录");
  return identity;
}
export function isAdmin(tokenIdentifier: string) {
  // Full issuer + subject identity, never an email supplied by the browser.
  return (process.env.ADMIN_TOKEN_IDENTIFIERS ?? "").split(",").map((s) => s.trim()).filter(Boolean).includes(tokenIdentifier);
}
