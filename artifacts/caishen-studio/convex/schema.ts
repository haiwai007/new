import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  auditLogs: defineTable({
    actor: v.string(),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("login"),
      v.literal("policy"),
    ),
    name: v.string(),
    revision: v.optional(v.number()),
    bytes: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_time", ["createdAt"]),
  cloudPolicy: defineTable({
    key: v.literal("cloud"),
    revision: v.number(),
    uploadsEnabled: v.boolean(),
    notice: v.string(),
    updatedBy: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  cloudWorks: defineTable({
    owner: v.string(),
    localId: v.string(),
    name: v.string(),
    kind: v.union(v.literal("project"), v.literal("template")),
    // Inline payloads remain readable for backups created by the first release.
    payload: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    bytes: v.optional(v.number()),
    revision: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["owner"])
    .index("by_owner_local", ["owner", "localId"])
    .index("by_storage", ["storageId"]),
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
  }).index("by_token", ["tokenIdentifier"]),
});
