import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const HEARTBEAT_PERIOD_MS = 20000; // Consider active if updated within 20s

export const heartbeat = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user_room", (q) =>
        q.eq("userId", args.userId).eq("roomId", args.roomId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        updatedAt: Date.now(),
        userName: args.userName,
      });
    } else {
      await ctx.db.insert("presence", {
        userId: args.userId,
        roomId: args.roomId,
        updatedAt: Date.now(),
        userName: args.userName,
      });
    }
  },
});

export const leave = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user_room", (q) =>
        q.eq("userId", args.userId).eq("roomId", args.roomId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const list = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - HEARTBEAT_PERIOD_MS;
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_room_updated", (q) =>
        q.eq("roomId", args.roomId).gt("updatedAt", cutoff)
      )
      .collect();

    return presence.length;
  },
});
