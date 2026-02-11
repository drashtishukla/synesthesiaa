import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const AUTO_DELETE_MS = 5_000; // delete reaction from DB after 5 seconds
const RATE_LIMIT_MS = 500; // minimum gap between reactions per user

/** Send a reaction emoji — stored only long enough for real-time delivery. */
export const sendReaction = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    // Rate-limit: check the user's most recent reaction in this room
    const recent = await ctx.db
      .query("reactions")
      .withIndex("by_room_time", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .collect();

    const lastByUser = recent.find((r) => r.userId === args.userId);
    if (lastByUser && Date.now() - lastByUser.createdAt < RATE_LIMIT_MS) {
      throw new Error("Slow down! You're reacting too fast.");
    }

    const id = await ctx.db.insert("reactions", {
      roomId: args.roomId,
      userId: args.userId,
      emoji: args.emoji,
      createdAt: Date.now(),
    });

    // Schedule auto-cleanup so the table stays empty
    await ctx.scheduler.runAfter(AUTO_DELETE_MS, internal.reactions.deleteReaction, { id });
  },
});

/** Internal mutation – auto-deletes a reaction after it's been delivered. */
export const deleteReaction = internalMutation({
  args: { id: v.id("reactions") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (doc) await ctx.db.delete(args.id);
  },
});

/**
 * Return reactions created in the last N seconds.
 * Convex reactive queries push new reactions to every subscribed client in real-time.
 */
export const recentReactions = query({
  args: {
    roomId: v.id("rooms"),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reactions")
      .withIndex("by_room_time", (q) =>
        q.eq("roomId", args.roomId).gte("createdAt", args.since),
      )
      .collect();
  },
});
