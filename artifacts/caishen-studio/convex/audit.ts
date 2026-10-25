import type { MutationCtx } from "./_generated/server";
export async function recordAudit(
  ctx: MutationCtx,
  event: {
    actor: string;
    action: "create" | "update" | "delete" | "login" | "policy";
    name: string;
    revision?: number;
    bytes?: number;
  },
) {
  await ctx.db.insert("auditLogs", {
    ...event,
    name: event.name.slice(0, 200),
    createdAt: Date.now(),
  });
}
