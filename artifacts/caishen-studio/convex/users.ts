import { recordAudit } from "./audit";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if we've already stored this identity before.
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    await recordAudit(ctx, {
      actor: identity.tokenIdentifier,
      action: "login",
      name: identity.name ?? "账户登录",
    });
    if (user !== null) {
      await ctx.db.patch(user._id, {
        name: identity.name ?? user.name,
        email: identity.email ?? user.email,
        lastSeenAt: Date.now(),
      });
      return user._id;
    }
    // If it's a new identity, create a new User.
    return await ctx.db.insert("users", {
      lastSeenAt: Date.now(),
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Called getCurrentUser without authentication present",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    return user;
  },
});
