import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listVotesForUser = query({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("votes")
      .withIndex("by_room_user", (q) =>
        q.eq("roomId", args.roomId).eq("userId", args.userId)
      )
      .collect();
  },
});

export const castVote = mutation({
  args: {
    roomId: v.id("rooms"),
    songId: v.id("songs"),
    userId: v.string(),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    if (![ -1, 0, 1 ].includes(args.value)) {
      throw new Error("Vote value must be -1, 0, or 1.");
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new Error("Room not found.");
    }

    if (
      args.value === -1 &&
      !room.settings.allowDownvotes &&
      args.userId !== room.hostUserId
    ) {
      throw new Error("Downvotes are disabled in this room.");
    }

    const song = await ctx.db.get(args.songId);
    if (!song) {
      throw new Error("Song not found.");
    }

    if (song.roomId !== args.roomId) {
      throw new Error("Song does not belong to this room.");
    }

    const existing = await ctx.db
      .query("votes")
      .withIndex("by_song_user", (q) =>
        q.eq("songId", args.songId).eq("userId", args.userId)
      )
      .unique();

    let delta = args.value;

    if (existing) {
      if (args.value === 0) {
        delta = -existing.value;
        await ctx.db.delete(existing._id);
      } else if (existing.value === args.value) {
        return song.score;
      } else {
        delta = args.value - existing.value;
        await ctx.db.patch(existing._id, {
          value: args.value,
          updatedAt: now,
        });
      }
    } else if (args.value !== 0) {
      await ctx.db.insert("votes", {
        roomId: args.roomId,
        songId: args.songId,
        userId: args.userId,
        value: args.value,
        createdAt: now,
        updatedAt: now,
      });
    }

    const nextScore = song.score + delta;
    await ctx.db.patch(args.songId, {
      score: nextScore,
      lastScoreUpdatedAt: now,
    });

    return nextScore;
  },
});
