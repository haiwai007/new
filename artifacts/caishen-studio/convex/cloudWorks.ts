import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { recordAudit } from "./audit";
import { requireIdentity } from "./access";
import { parseTemplateFile } from "../src/lib/template/package";
import { MAX_CLOUD_WORKS } from "../src/lib/cloud-limits";

const kind = v.union(v.literal("project"), v.literal("template"));
const metadataArgs = {
  localId: v.string(),
  name: v.string(),
  kind,
  expectedRevision: v.number(),
};
export function validateMetadata(args: {
  localId: string;
  name: string;
  expectedRevision: number;
}) {
  if (!args.localId || args.localId.length > 200)
    throw new ConvexError("作品标识须为 1–200 字符");
  if (!args.name.trim() || args.name.length > 200)
    throw new ConvexError("作品名称须为 1–200 字符");
  if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0)
    throw new ConvexError("云端版本号无效");
}
export function validatePackage(payload: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    throw new ConvexError("作品文件不是有效 JSON");
  }
  const parsed = parseTemplateFile(raw);
  if (!parsed.ok || parsed.warnings.length)
    throw new ConvexError("作品包无效或缺少图片，请修复后重试");
}
async function checkRevision(
  ctx: MutationCtx,
  owner: string,
  localId: string,
  expectedRevision: number,
) {
  const policy = await ctx.db
    .query("cloudPolicy")
    .withIndex("by_key", (q) => q.eq("key", "cloud"))
    .unique();
  if (policy?.uploadsEnabled === false)
    throw new ConvexError(
      policy.notice || "管理员已暂停云端上传，下载和本地编辑仍可使用",
    );
  const row = await ctx.db
    .query("cloudWorks")
    .withIndex("by_owner_local", (q) =>
      q.eq("owner", owner).eq("localId", localId),
    )
    .unique();
  if ((row?.revision ?? 0) !== expectedRevision)
    throw new ConvexError(
      "云端版本已变化，请刷新后确认再上传；本地作品未被覆盖",
    );
  if (!row) {
    const existing = await ctx.db
      .query("cloudWorks")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .take(MAX_CLOUD_WORKS);
    if (existing.length >= MAX_CLOUD_WORKS)
      throw new ConvexError("每个账户最多保存 100 个云端作品");
  }
  return row;
}
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const rows = await ctx.db
      .query("cloudWorks")
      .withIndex("by_owner", (q) => q.eq("owner", identity.tokenIdentifier))
      .take(MAX_CLOUD_WORKS);
    return rows
      .map((row) => ({
        _id: row._id,
        localId: row.localId,
        name: row.name,
        kind: row.kind,
        revision: row.revision,
        updatedAt: row.updatedAt,
        bytes: row.bytes ?? new TextEncoder().encode(row.payload ?? "").length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
// Retained for compatibility with the original inline-backup client.
export const read = query({
  args: { id: v.id("cloudWorks") },
  handler: async (ctx, { id }) => {
    const identity = await requireIdentity(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.owner !== identity.tokenIdentifier)
      throw new ConvexError("云端作品不存在");
    if (row.storageId)
      throw new ConvexError("此备份使用新版存储，请更新页面后恢复");
    return row;
  },
});
export const save = mutation({
  args: { ...metadataArgs, payload: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    validateMetadata(args);
    const bytes = new TextEncoder().encode(args.payload).length;
    if (bytes > 900_000)
      throw new ConvexError(
        "旧版接口上限为 900KB，请更新页面后上传（新版上限 8MB）",
      );
    validatePackage(args.payload);
    const row = await checkRevision(
      ctx,
      identity.tokenIdentifier,
      args.localId,
      args.expectedRevision,
    );
    const value = {
      owner: identity.tokenIdentifier,
      localId: args.localId,
      name: args.name.trim(),
      kind: args.kind,
      payload: args.payload,
      bytes,
      revision: (row?.revision ?? 0) + 1,
      updatedAt: Date.now(),
    };
    await recordAudit(ctx, {
      actor: value.owner,
      action: row ? "update" : "create",
      name: value.name,
      revision: value.revision,
      bytes: value.bytes,
    });
    if (row) {
      if (row.storageId) await ctx.storage.delete(row.storageId);
      await ctx.db.replace(row._id, value);
      return row._id;
    }
    return ctx.db.insert("cloudWorks", value);
  },
});
export const remove = mutation({
  args: { id: v.id("cloudWorks"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.owner !== identity.tokenIdentifier)
      throw new ConvexError("云端作品不存在");
    if (row.revision !== args.expectedRevision)
      throw new ConvexError("云端版本已变化，请刷新后重试");
    await recordAudit(ctx, {
      actor: identity.tokenIdentifier,
      action: "delete",
      name: row.name,
      revision: row.revision,
      bytes: row.bytes,
    });
    if (row.storageId) await ctx.storage.delete(row.storageId);
    await ctx.db.delete(row._id);
  },
});
// Only server actions can pass an owner; the public API always derives it from authentication.
export const commitFile = internalMutation({
  args: {
    ...metadataArgs,
    owner: v.string(),
    storageId: v.id("_storage"),
    bytes: v.number(),
  },
  handler: async (ctx, args) => {
    validateMetadata(args);
    const row = await checkRevision(
      ctx,
      args.owner,
      args.localId,
      args.expectedRevision,
    );
    const value = {
      owner: args.owner,
      localId: args.localId,
      name: args.name.trim(),
      kind: args.kind,
      storageId: args.storageId,
      bytes: args.bytes,
      revision: (row?.revision ?? 0) + 1,
      updatedAt: Date.now(),
    };
    await recordAudit(ctx, {
      actor: value.owner,
      action: row ? "update" : "create",
      name: value.name,
      revision: value.revision,
      bytes: value.bytes,
    });
    if (row) {
      if (row.storageId) await ctx.storage.delete(row.storageId);
      await ctx.db.replace(row._id, value);
      return row._id;
    }
    return ctx.db.insert("cloudWorks", value);
  },
});
export const getForOwner = internalQuery({
  args: { id: v.id("cloudWorks"), owner: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.owner !== args.owner)
      throw new ConvexError("云端作品不存在");
    return row;
  },
});
export const discardUnreferenced = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const used = await ctx.db
      .query("cloudWorks")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .first();
    if (!used) await ctx.storage.delete(storageId);
  },
});

export const policy = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    const row = await ctx.db
      .query("cloudPolicy")
      .withIndex("by_key", (q) => q.eq("key", "cloud"))
      .unique();
    return {
      uploadsEnabled: row?.uploadsEnabled ?? true,
      notice: row?.notice ?? "",
      revision: row?.revision ?? 0,
    };
  },
});
