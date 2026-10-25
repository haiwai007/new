import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { recordAudit } from "./audit";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { isAdmin, requireIdentity } from "./access";
export const access = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return {
      allowed: isAdmin(identity.tokenIdentifier),
      tokenIdentifier: identity.tokenIdentifier,
    };
  },
});
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    if (!isAdmin(identity.tokenIdentifier))
      throw new ConvexError("无管理员权限");
    const users = await ctx.db.query("users").order("desc").take(101);
    const works = await ctx.db.query("cloudWorks").order("desc").take(101);
    return {
      users: users.slice(0, 100).map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        createdAt: u._creationTime,
      })),
      userCount: users.length,
      workCount: works.length,
      truncated: users.length > 100 || works.length > 100,
    };
  },
});

export const usersPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    validatePageSize(args.paginationOpts.numItems);
    const result = await ctx.db
      .query("users")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        createdAt: u._creationTime,
        lastSeenAt: u.lastSeenAt,
      })),
    };
  },
});
export const auditPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    validatePageSize(args.paginationOpts.numItems);
    return ctx.db
      .query("auditLogs")
      .withIndex("by_time")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
export const savePolicy = mutation({
  args: {
    uploadsEnabled: v.boolean(),
    notice: v.string(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    if (args.notice.length > 200)
      throw new ConvexError("公告不能超过 200 字符");
    const old = await ctx.db
      .query("cloudPolicy")
      .withIndex("by_key", (q) => q.eq("key", "cloud"))
      .unique();
    if ((old?.revision ?? 0) !== args.expectedRevision)
      throw new ConvexError("云端设置已被其他管理员修改，请刷新后重试");
    const value = {
      key: "cloud" as const,
      revision: (old?.revision ?? 0) + 1,
      uploadsEnabled: args.uploadsEnabled,
      notice: args.notice.trim(),
      updatedBy: identity.tokenIdentifier,
      updatedAt: Date.now(),
    };
    if (old) await ctx.db.replace(old._id, value);
    else await ctx.db.insert("cloudPolicy", value);
    await recordAudit(ctx, {
      actor: identity.tokenIdentifier,
      action: "policy",
      revision: value.revision,
      name: args.uploadsEnabled ? "已启用云端上传" : "已暂停云端上传",
    });
    return { revision: value.revision };
  },
});

async function requireAdmin(ctx: Pick<QueryCtx, "auth">) {
  const identity = await requireIdentity(ctx);
  if (!isAdmin(identity.tokenIdentifier)) throw new ConvexError("无管理员权限");
  return identity;
}
function validatePageSize(size: number) {
  if (!Number.isInteger(size) || size < 1 || size > 100)
    throw new ConvexError("每页须为 1–100 条记录");
}
