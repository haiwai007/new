import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireIdentity } from "./access";
import { validateMetadata, validatePackage } from "./cloudWorks";
import { MAX_CLOUD_PACKAGE_BYTES } from "../src/lib/cloud-limits";

/** Authenticated actions avoid exposing permanent public download URLs or upload capabilities. */
export const save = action({
  args: {
    localId: v.string(),
    name: v.string(),
    kind: v.union(v.literal("project"), v.literal("template")),
    payload: v.string(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"cloudWorks">> => {
    const identity = await requireIdentity(ctx);
    validateMetadata(args);
    const blob = new Blob([args.payload], { type: "application/json" });
    if (blob.size > MAX_CLOUD_PACKAGE_BYTES)
      throw new ConvexError(
        "单个云端作品上限为 8MB（含图片），大型作品请使用本地文件导出",
      );
    validatePackage(args.payload);
    const storageId = await ctx.storage.store(blob);
    try {
      return await ctx.runMutation(internal.cloudWorks.commitFile, {
        owner: identity.tokenIdentifier,
        localId: args.localId,
        name: args.name,
        kind: args.kind,
        expectedRevision: args.expectedRevision,
        storageId,
        bytes: blob.size,
      });
    } catch (error) {
      // A failed or stale write must not leave an uploaded blob behind.
      await ctx.runMutation(internal.cloudWorks.discardUnreferenced, {
        storageId,
      });
      throw error;
    }
  },
});
export const download = action({
  args: { id: v.id("cloudWorks") },
  handler: async (
    ctx,
    { id },
  ): Promise<{
    payload: string;
    name: string;
    kind: "project" | "template";
  }> => {
    const identity = await requireIdentity(ctx);
    const row = await ctx.runQuery(internal.cloudWorks.getForOwner, {
      id,
      owner: identity.tokenIdentifier,
    });
    if (row.payload !== undefined)
      return { payload: row.payload, name: row.name, kind: row.kind };
    if (!row.storageId) throw new ConvexError("云端备份内容缺失");
    const blob = await ctx.storage.get(row.storageId);
    if (!blob) throw new ConvexError("云端备份文件不存在，请从原设备重新上传");
    if (blob.size > MAX_CLOUD_PACKAGE_BYTES)
      throw new ConvexError("云端备份超过当前大小上限");
    return { payload: await blob.text(), name: row.name, kind: row.kind };
  },
});
